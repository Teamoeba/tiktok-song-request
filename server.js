const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const play = require('play-dl');

// Setup Web Server & WebSocket
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); 

let queue = [];
let isPlaying = false;

// --- 1. SETUP TIKTOK ---
let tiktokUsername = "username_tiktok_anda"; 
let tiktokLiveConnection = new WebcastPushConnection(tiktokUsername);

tiktokLiveConnection.connect().then(state => {
    console.info(`Berhasil terhubung ke live ${state.roomInfo.owner.display_id}`);
}).catch(err => {
    console.error('Gagal terhubung ke TikTok', err);
});

// --- 2. MEMBACA KOMENTAR ---
tiktokLiveConnection.on('chat', async data => {
    let comment = data.comment.toLowerCase();
    let username = data.uniqueId;
    
    // Command 1: !skip (Bebas untuk semua orang pada versi dasar)
    if (comment === '!skip') {
        console.log(`[SKIP] Lagu dilewati oleh ${username}`);
        io.emit('skip_song'); 
        return; 
    }

    // Command 2: !play (Bebas untuk semua orang pada versi dasar)
    if (comment.startsWith('!play ')) {
        let songQuery = comment.replace('!play ', '').trim();
        console.log(`[REQUEST] ${username} meminta lagu: ${songQuery}`);
        
        try {
            let yt_info = await play.search(songQuery, { limit: 1 });
            if(yt_info.length > 0) {
                let video = yt_info[0];
                let stream = await play.stream(video.url);
                
                let songData = {
                    title: video.title,
                    url: stream.url,
                    requester: username,
                    thumbnail: video.thumbnails[0].url
                };

                queue.push(songData);
                console.log(`[DITAMBAHKAN] ${video.title} masuk antrean reguler.`);
                
                checkQueue();
            }
        } catch (error) {
            console.log("Gagal mencari lagu:", error.message);
        }
    }
});

// --- 3. MENGATUR ANTREAN ---
function checkQueue() {
    if (!isPlaying && queue.length > 0) {
        isPlaying = true;
        let nextSong = queue.shift(); 
        io.emit('play_song', nextSong); 
    }
}

io.on('connection', (socket) => {
    socket.on('song_ended', () => {
        isPlaying = false;
        checkQueue(); 
    });
});

server.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});
