# 🎵 TikTok Live Song Request (Auto-DJ)

Sebuah sistem otomatis (*bot*) untuk TikTok Live yang memungkinkan penonton melakukan *request* lagu via kolom komentar. Lagu akan otomatis dicari melalui YouTube, diambil audionya, dan diputar langsung melalui Streamlabs/OBS sebagai *Browser Source*.

Versi bawaan (*default*) dari kode ini membebaskan **siapa saja** untuk melakukan *request* dan *skip* lagu.

---

## ✨ Fitur Utama

- **Real-time Song Request**: Penonton cukup mengetik `!play [judul]` dan lagu akan masuk ke antrean.
- **Skip Lagu**: Ketik `!skip` untuk melewati lagu yang sedang berputar.
- **OBS/Streamlabs Integration**: Menampilkan *overlay* interaktif (judul lagu, *thumbnail*, dan *username* pe-request) langsung di layar *live* Anda tanpa perlu membuka browser secara manual.

---

## 🛠️ Persyaratan Sistem

Sebelum menjalankan proyek ini, pastikan komputer Anda sudah terinstal:
- [Node.js](https://nodejs.org/) (Versi 14 ke atas disarankan)
- Software *streaming* (OBS Studio, Streamlabs Desktop, atau TikTok Live Studio)

---

## 🚀 Cara Instalasi

1. **Clone repositori ini**:
   ```bash
   git clone https://github.com/USERNAME_ANDA/tiktok-song-request.git
   cd tiktok-song-request
   ```

2. **Install dependensi**:
   ```bash
   npm install
   ```

3. **Konfigurasi Username**:
   Buka file `server.js`. Cari baris ke-18 dan ubah menjadi *username* TikTok Anda:
   ```javascript
   let tiktokUsername = "isi_dengan_username_tiktok_anda"; 
   ```

---

## 🎮 Cara Menjalankan

1. Buka Terminal di folder proyek ini.
2. Jalankan server: `npm start` (atau `node server.js`).
3. Buka **Streamlabs** atau **OBS**.
4. Tambahkan **Browser Source** baru, masukkan URL: `http://localhost:3000`.
5. Centang **"Control audio via OBS / Streamlabs"**.

---

## 📜 Daftar Command (Bawaan)

| Command | Siapa yang bisa pakai? | Fungsi |
| :--- | :--- | :--- |
| `!play [judul lagu]` | Semua Penonton | Mencari dan memasukkan lagu ke antrean. |
| `!skip` | Semua Penonton | Melewati lagu saat ini. |

---

## 🔧 Panduan Kustomisasi Hak Akses (Permissions)

Ingin membuat bot ini lebih eksklusif? Anda bisa memodifikasi kode di `server.js` (di dalam fungsi `tiktokLiveConnection.on('chat', ...)`). Berikut beberapa kode tambahan yang bisa Anda gunakan:

### 1. Membatasi `!skip` HANYA untuk Moderator & Host
Sangat disarankan agar penonton usil tidak sembarangan melewakan lagu. 
**Ganti** blok logika `if (comment === '!skip') { ... }` dengan kode berikut:

```javascript
    let isModOrHost = data.isModerator || username === tiktokUsername;
    
    if (comment === '!skip') {
        if (isModOrHost) {
            console.log(`[SKIP] Lagu dilewati oleh moderator ${username}`);
            io.emit('skip_song'); 
        } else {
            console.log(`[DITOLAK] ${username} mencoba skip, tapi bukan moderator.`);
        }
        return; 
    }
```

### 2. Membatasi `!play` HANYA untuk Follower
Agar penonton terdorong untuk mem-follow Anda sebelum bisa me-request lagu.
**Tambahkan** pengecekan status `data.followRole` tepat di bawah `if (comment.startsWith('!play ')) {`:

```javascript
    if (comment.startsWith('!play ')) {
        // Cek apakah belum follow (0 = belum follow, 1 = follower, 2 = mutual)
        let isModOrHost = data.isModerator || username === tiktokUsername;
        if (data.followRole === 0 && !isModOrHost) {
            console.log(`[DITOLAK] ${username} mencoba request lagu, tapi belum follow.`);
            return;
        }
        
        // ... (kode let songQuery dan seterusnya)
```

### 3. Fitur VIP Fast Track (Khusus Fan Club)
Ingin lagu *request*-an keanggotaan Fan Club (Love Oren) langsung ditaruh di antrean paling depan? 
**Ganti** baris `queue.push(songData);` di dalam blok `!play` dengan logika ini:

```javascript
        let isModOrHost = data.isModerator || username === tiktokUsername;
        let isFanClub = data.isSubscriber; // Cek status keanggotaan

        if (isFanClub || isModOrHost) {
            // Taruh di urutan PALING DEPAN
            queue.unshift(songData);
            console.log(`[VIP] Lagu diselipkan ke depan antrean!`);
        } else {
            // Taruh di antrean reguler (paling belakang)
            queue.push(songData);
        }
```

---
*Dibuat untuk mempermudah interaksi streamer dan penonton.*

