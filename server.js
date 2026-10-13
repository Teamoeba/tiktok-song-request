const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection } = require('tiktok-live-connector');
const yts = require('yt-search');
const play = require('play-dl');

// Setup Web Server & WebSocket
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let queue = [];
let currentSong = null;
let isPlaying = false;
let songTimeoutTimer = null;
let fanClubSkips = {}; // Memori batas skip untuk subscriber/fan club

// --- 1. SETUP TIKTOK DENGAN AUTO-RECONNECT ---
let tiktokUsername = "teamoeba"; 
let tiktokLiveConnection = new TikTokLiveConnection(tiktokUsername, {});

let isConnecting = false;
let reconnectTimer = null;

async function connectTikTok() {
    if (isConnecting) return;
    isConnecting = true;

    try {
        console.log(`[TIKTOK] Mencoba menyambung ke live @${tiktokUsername}...`);
        const state = await tiktokLiveConnection.connect();
        console.info(`[TIKTOK] ✅ Berhasil terhubung ke live room: ${state?.roomId || tiktokUsername}!`);
        isConnecting = false;
    } catch (err) {
        isConnecting = false;
        console.warn(`[TIKTOK] ⚠️ Belum bisa terhubung ke @${tiktokUsername} (${err.message || 'Streamer sedang offline'}).`);
        console.info(`[TIKTOK] Mencoba menyambung kembali dalam 15 detik...`);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(connectTikTok, 15000);
    }
}

tiktokLiveConnection.on('disconnected', () => {
    console.warn(`[TIKTOK] ⚠️ Koneksi terputus dari TikTok. Menghubungkan ulang dalam 10 detik...`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectTikTok, 10000);
});

tiktokLiveConnection.on('streamEnd', () => {
    console.info(`[TIKTOK] Sesi Live telah berakhir.`);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectTikTok, 30000);
});

// Mulai koneksi ke TikTok
connectTikTok();

// Helper untuk normalisasi data event TikTok (kompatibel v1 & v2 protobuf)
function parseUserData(data) {
    const user = data.user || {};
    const username = user.uniqueId || data.uniqueId || user.displayId || "penonton";
    const comment = (data.content || data.comment || "").trim();
    
    const isHost = username.toLowerCase() === tiktokUsername.toLowerCase();
    const badges = user.badgeList || data.userBadges || [];

    const isModerator = isHost || Boolean(
        data.isModerator ||
        badges.some(b => 
            (b.type && b.type.toLowerCase().includes('moderator')) ||
            b.badgeSceneType === 1 ||
            b.sceneType === 1
        )
    );

    const isSubscriber = Boolean(
        data.isSubscriber ||
        badges.some(b => 
            (b.url && b.url.toLowerCase().includes('/sub_')) ||
            b.badgeSceneType === 4 ||
            b.badgeSceneType === 7 ||
            b.sceneType === 4 ||
            b.sceneType === 7
        )
    );

    const followRole = data.followRole ?? user.followInfo?.followStatus ?? (isHost ? 2 : 0);

    return { username, comment, isHost, isModerator, isSubscriber, followRole };
}

function formatDuration(sec) {
    if (!sec || isNaN(sec)) return "3:45";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Helper pencarian YouTube yang andal (mengembalikan judul, artis, durasi, thumbnail)
async function searchYouTube(query) {
    try {
        const searchResult = await yts(query);
        if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
            const video = searchResult.videos[0];
            return {
                videoId: video.videoId,
                title: video.title,
                artist: video.author?.name || 'YouTube Music',
                thumbnail: video.thumbnail || '',
                durationInSec: video.seconds || 0
            };
        }
    } catch (err) {
        console.warn("[SEARCH] yts error, mencoba fallback play-dl:", err.message);
    }

    try {
        const yt_info = await play.search(query, { limit: 1 });
        if (yt_info && yt_info.length > 0) {
            const video = yt_info[0];
            return {
                videoId: video.id,
                title: video.title,
                artist: video.channel?.name || 'YouTube Music',
                thumbnail: (video.thumbnails && video.thumbnails.length > 0) ? video.thumbnails[0].url : '',
                durationInSec: video.durationInSec || 0
            };
        }
    } catch (err) {
        console.error("[SEARCH] play-dl fallback error:", err.message);
    }

    return null;
}

// --- 2. MEMBACA KOMENTAR & PERINTAH ---
tiktokLiveConnection.on('chat', async data => {
    const { username, comment, isHost, isModerator, isSubscriber, followRole } = parseUserData(data);
    if (!comment) return;

    const lowerComment = comment.toLowerCase();

    // Command 1: !skip
    if (lowerComment === '!skip') {
        if (!isPlaying || !currentSong) {
            console.log(`[SKIP] Tidak ada lagu yang sedang berputar.`);
            return;
        }

        if (isModerator || isHost) {
            console.log(`[SKIP MOD] Lagu dilewati oleh moderator @${username}`);
            skipCurrentSong(username);
        } else if (isSubscriber) {
            if (!fanClubSkips[username]) fanClubSkips[username] = 0;

            if (fanClubSkips[username] < 2) {
                fanClubSkips[username]++;
                console.log(`[SKIP VIP] Dilewati oleh Fan Club @${username}. (Sisa jatah: ${2 - fanClubSkips[username]})`);
                skipCurrentSong(username);
            } else {
                console.log(`[DITOLAK] @${username} sudah menghabiskan jatah 2x skip.`);
            }
        } else {
            console.log(`[DITOLAK] @${username} mencoba skip, tapi bukan mod/fan club.`);
        }
        return;
    }

    // Command 2: !play (Hanya untuk Follower ke atas / VIP)
    if (lowerComment.startsWith('!play ')) {
        if (followRole === 0 && !isModerator && !isSubscriber && !isHost) {
            console.log(`[DITOLAK] @${username} mencoba request lagu, tapi belum follow.`);
            return;
        }

        let songQuery = comment.slice(6).trim();
        if (!songQuery) {
            console.log(`[DITOLAK] @${username} mengirim perintah !play tanpa judul lagu.`);
            return;
        }

        console.log(`[REQUEST] @${username} meminta lagu: "${songQuery}"`);
        await handleSongRequest(songQuery, username, isSubscriber || isModerator || isHost);
    }
});

// Fungsi penambahan lagu ke antrean
async function handleSongRequest(songQuery, username, isVip) {
    try {
        const video = await searchYouTube(songQuery);
        if (video) {
            let songData = {
                videoId: video.videoId,
                title: video.title,
                artist: video.artist || 'YouTube Music',
                requester: username,
                thumbnail: video.thumbnail,
                durationInSec: video.durationInSec,
                durationText: formatDuration(video.durationInSec),
                isVip: isVip
            };

            // SISTEM VIP / JALUR CEPAT
            if (isVip) {
                let lastVipIndex = -1;
                for (let i = 0; i < queue.length; i++) {
                    if (queue[i].isVip) lastVipIndex = i;
                }
                queue.splice(lastVipIndex + 1, 0, songData);
                console.log(`[VIP DITAMBAHKAN] "${video.title}" masuk prioritas VIP (posisi: ${lastVipIndex + 2}).`);
            } else {
                queue.push(songData);
                console.log(`[DITAMBAHKAN] "${video.title}" masuk antrean reguler (posisi: ${queue.length}).`);
            }

            checkQueue();
            return { success: true, song: songData };
        } else {
            console.log(`[REQUEST] Lagu tidak ditemukan untuk query: "${songQuery}"`);
            return { success: false, message: 'Lagu tidak ditemukan' };
        }
    } catch (error) {
        console.error("[ERROR] Gagal memproses permintaan lagu:", error.message);
        return { success: false, error: error.message };
    }
}

// --- 3. MENGATUR ANTREAN & PEMUTARAN ---
function checkQueue() {
    if (isPlaying || queue.length === 0) return;

    isPlaying = true;
    currentSong = queue.shift();
    // Identifier unik untuk mencegah double-skip dari banyak tab/overlay
    currentSong.playId = Date.now() + '_' + Math.random().toString(36).slice(2, 7);

    console.log(`[PUTAR] Memutar lagu: "${currentSong.title}" - ${currentSong.artist} (Request: @${currentSong.requester})`);
    io.emit('play_song', currentSong);

    // Timeout pengaman jika lagu macet / tidak ada respon dari client
    clearTimeout(songTimeoutTimer);
    const durationMs = ((currentSong.durationInSec > 0 ? currentSong.durationInSec : 240) + 15) * 1000;
    songTimeoutTimer = setTimeout(() => {
        console.warn(`[SISTEM] ⚠️ Waktu putar untuk "${currentSong?.title}" habis. Memajukan antrean...`);
        advanceQueue();
    }, durationMs);
}

function advanceQueue(playId) {
    if (playId && currentSong && playId !== currentSong.playId) {
        return;
    }

    clearTimeout(songTimeoutTimer);
    isPlaying = false;
    currentSong = null;
    checkQueue();
}

function skipCurrentSong(username) {
    if (!isPlaying || !currentSong) return;
    console.log(`[SKIP] Lagu "${currentSong.title}" dilewati oleh @${username}`);
    io.emit('skip_song');
    advanceQueue();
}

io.on('connection', (socket) => {
    console.log('[SISTEM] ✅ OBS / Streamlabs berhasil tersambung ke Overlay!');

    if (isPlaying && currentSong) {
        socket.emit('play_song', currentSong);
    }

    socket.on('song_ended', (data) => {
        advanceQueue(data?.playId);
    });
});

// --- 4. NOTIFIKASI FOLLOW ---
tiktokLiveConnection.on('follow', (data) => {
    const user = data.user || {};
    let username = user.uniqueId || data.uniqueId || user.nickname || "Follower";
    console.log(`[FOLLOW] 🎉 @${username} baru saja follow!`);
    io.emit('new_follower', { username: username });
});

// --- 5. ENDPOINT PENGUJIAN / TESTING OVERLAY ---
app.get('/test-play', async (req, res) => {
    const q = req.query.q || 'never gonna give you up';
    const user = req.query.user || 'test_user';
    const isVip = req.query.vip === '1';

    const result = await handleSongRequest(q, user, isVip);
    if (result.success) {
        res.json({ success: true, message: `Lagu "${result.song.title}" berhasil ditambahkan ke antrean.`, queueLength: queue.length });
    } else {
        res.status(400).json(result);
    }
});

app.get('/test-skip', (req, res) => {
    if (isPlaying && currentSong) {
        skipCurrentSong('admin_test');
        res.json({ success: true, message: 'Lagu saat ini berhasil di-skip.' });
    } else {
        res.json({ success: false, message: 'Tidak ada lagu yang sedang diputar.' });
    }
});

app.get('/test-follow', (req, res) => {
    const user = req.query.user || 'pengikut_baru';
    io.emit('new_follower', { username: user });
    res.json({ success: true, message: `Notifikasi follow @${user} dikirim ke overlay.` });
});

server.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
    console.log('Untuk tes di browser:');
    console.log('- Overlay OBS:  http://localhost:3000');
    console.log('- Tes lagu:     http://localhost:3000/test-play?q=judul_lagu');
    console.log('- Tes skip:     http://localhost:3000/test-skip');
    console.log('- Tes follower: http://localhost:3000/test-follow?user=nama_user');
});
