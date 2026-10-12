# 🎵 TikTok Live Song Request (Auto-DJ) & Alerts

Sistem bot otomatis untuk TikTok Live yang memungkinkan penonton me-*request* lagu via kolom komentar. Lagu otomatis dicari melalui YouTube dan diputar langsung melalui Streamlabs/OBS sebagai *Browser Source* menggunakan pemutar YouTube IFrame resmi yang stabil, bebas dari pemblokiran *cipher*, dan anti-macet.

Dilengkapi juga dengan sistem notifikasi *Follower* baru (pop-up animasi + efek suara "Ting!").

---

## ✨ Fitur Utama

- **Real-time Song Request**: Penonton cukup mengetik `!play [judul lagu]` di kolom komentar TikTok Live.
- **Sistem Prioritas VIP (Fast Track)**: Request dari Fan Club (Subscriber) dan Moderator otomatis diselipkan di depan antrean penonton reguler.
- **Batasan Akses Cerdas**:
  - `!play` hanya dapat digunakan oleh penonton yang sudah **Follow** akun streamer (mendorong penonton mem-follow).
  - `!skip` dibatasi untuk **Moderator/Host** (unlimited) dan **Fan Club** (maksimal 2x jatah skip).
- **Anti-Macet & Auto-Skip**: Jika video YouTube yang di-request terkena hak cipta (*copyright*), berstatus privat, atau tidak diizinkan di-*embed*, bot otomatis melompat ke lagu berikutnya tanpa menghentikan antrean.
- **Auto-Reconnect TikTok**: Server secara otomatis mencoba menyambung kembali jika streamer belum memulai live atau saat koneksi internet terputus.
- **Notifikasi Follower Baru**: Menampilkan animasi pop-up nama akun yang baru follow beserta efek suara.
- **OBS/Streamlabs Integration**: Menampilkan *overlay* interaktif (judul lagu, thumbnail, dan requester) langsung di layar stream Anda.

---

## 🛠️ Persyaratan Sistem

Sebelum menjalankan proyek ini, pastikan komputer Anda sudah terinstal:
- [Node.js](https://nodejs.org/) (Versi 16 ke atas)
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

3. **Konfigurasi Username TikTok**:
   Buka file `server.js`, cari baris berikut (sekitar baris ke-19) dan ubah dengan *username* TikTok Anda (tanpa tanda `@`):
   ```javascript
   let tiktokUsername = "username_tiktok_anda"; 
   ```

---

## 🎮 Cara Menjalankan

1. Buka Terminal di folder proyek ini.
2. Jalankan server:
   ```bash
   npm start
   ```
3. Buka **Streamlabs** atau **OBS Studio**.
4. Tambahkan source baru bertipe **Browser Source**:
   - **URL**: `http://localhost:3000`
   - **Width**: `1920` (atau sesuaikan dengan canvas Anda, misalnya `1080` x `1920` untuk live vertikal)
   - **Height**: `1080`
   - Centang opsi: **"Control audio via OBS / Streamlabs"** (agar suara lagu masuk ke mixer audio OBS).

---

## 🧪 Cara Mengetes Overlay (Tanpa Perlu Live TikTok)

Anda bisa menguji tampilan dan audio overlay secara langsung melalui browser:

1. Buka halaman overlay di browser: [http://localhost:3000](http://localhost:3000)
2. Buka tab baru di browser Anda untuk memicu perintah uji coba:
   - **Tes Putar Lagu**: [http://localhost:3000/test-play?q=coldplay+yellow](http://localhost:3000/test-play?q=coldplay+yellow)
   - **Tes Lagu VIP**: [http://localhost:3000/test-play?q=komang&vip=1](http://localhost:3000/test-play?q=komang&vip=1)
   - **Tes Skip Lagu**: [http://localhost:3000/test-skip](http://localhost:3000/test-skip)
   - **Tes Notifikasi Follow**: [http://localhost:3000/test-follow?user=budi_santoso](http://localhost:3000/test-follow?user=budi_santoso)

---

## 📜 Daftar Command Chat TikTok Live

| Command | Syarat Pengguna | Keterangan |
| :--- | :--- | :--- |
| `!play [judul lagu]` | Follower / Fan Club / Mod | Mencari lagu di YouTube dan memasukkannya ke antrean. |
| `!play [judul lagu]` | Fan Club (Subscriber) & Mod | **Jalur VIP**: lagu ditaruh di urutan paling depan antrean. |
| `!skip` | Moderator & Host | Melewati lagu yang sedang berputar (tanpa batas). |
| `!skip` | Fan Club (Subscriber) | Melewati lagu saat ini (maksimal jatah 2x skip per sesi). |

---

## 🔧 Panduan Kustomisasi

Semua pengaturan hak akses dapat disesuaikan di dalam file `server.js`:

### 1. Membebaskan `!play` untuk Semua Orang (Termasuk non-follower)
Di `server.js`, cari bagian berikut di dalam handler `chat`:
```javascript
// Cek status follow
if (followRole === 0 && !isModerator && !isSubscriber && !isHost) {
    console.log(`[DITOLAK] @${username} mencoba request lagu, tapi belum follow.`);
    return;
}
```
Cukup beri komentar (`//`) atau hapus blok kode di atas jika ingin membebaskan siapa saja untuk me-request lagu.

### 2. Mengubah Jatah Skip untuk Fan Club
Cari baris pengecekan jatah skip di `server.js`:
```javascript
if (fanClubSkips[username] < 2) {
```
Ubah angka `2` sesuai jumlah jatah skip yang ingin Anda berikan kepada member Fan Club (misalnya `3` atau `5`).

---

*Dibuat untuk mempermudah interaksi streamer TikTok Live dan penonton.*
