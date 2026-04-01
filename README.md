# Stockbit-Reverse API

Sebuah *unofficial scraper* dan API Server berbasis Node.js untuk mengekstrak data JSON Bandarmology (Broker Summary dan Broker Flow Chart) dari platform Stockbit secara terprogram melewati proteksi *Cloudflare*. Proyek ini ideal digunakan sebagai penyedia data pendukung untuk Algorithmic Trading, Bot Telegram/Discord, atau Pipeline Data Eksternal.

> **⚠️ PERINGATAN (Disclaimer):** Proyek ini murni dibuat untuk tujuan edukasi. Aplikasi ini tidak berafiliasi secara resmi dengan Stockbit. Penggunaan *bot* atau melakukan pengikisan otomatis yang berlebihan mungkin melanggar Ketentuan Layanan *(Terms of Service)* Stockbit. Pihak pengembang sistem ini tidak bertanggung jawab atas akun/akun yang diblokir oleh pihak aplikasi utama.

---

## 🚀 Fitur Utama

- **Header Fingerprint Sync:** Menduplikasi parameter header web *browser* asli secara sempurna untuk memastikan keamanan bypass *Cloudflare*.
- **Token Monitor (Keep-Alive):** Token secara proaktif diperbarui sebelum kedaluwarsa di latar belakang untuk sesi jangka panjang.
- **RESTful JSON API:** Membuka port internal `3000` Anda sehingga data dapat dijangkau oleh bahasa pemrograman lain (Python, Go, dll).
- **Built-in CLI:** Terminal interface yang mendukung *piping* output JSON untuk *Power Users*.

---

## 🛠 Instalasi & Menjalankan

### Persyaratan Sistem
* Node.js versi terbaru (Disarankan `v18+`)
* Akun Stockbit aktif

### 1. Kloning Repositori
```bash
git clone https://github.com/ghrs19/Stockbit-Reverse.git
cd Stockbit-Reverse
npm install
```

### 2. Konfigurasi Sistem (*Environment Variables*)
Buat (atau ubah file `.env.example` menjadi) sebuah file `.env` di direktori terbawah yang berisi kredensial Anda:

```env
# Gunakan fitur auto-login jika dirasa aman (dapat gagal memicu New Device PIN)
STOCKBIT_USERNAME="email/username"
STOCKBIT_PASSWORD="password123"

# ATAU: Lebih direkomendasikan bypass menggunakan Bearer Token dari Network Tab
STOCKBIT_TOKEN="eyJhbGciOiJSUz..."
STOCKBIT_PLAYER_ID="pc_browser_custom-..."

# Header Browser WAJIB
STOCKBIT_USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36..."

PORT=3000
```

### 3. Menjalankan Server
Jalankan perintah berikut untuk mengaktifkan API server dan *Auto-Token-Monitoring*:
```bash
npm run dev
# (Atau) npm start
```

---

## 🖥 Terminal CLI Usage

Sebagai ganti antarmuka, Anda bisa langsung mengakses program dari terminal:

```bash
# Data satu hari spesifik
npm run cli -- HRUM 2026-03-31 --json

# Data menggunakan rentang tanggal
npm run cli -- BBCA 2026-03-01 2026-03-31 --json
```

---

## 🌐 Dokumentasi API

Seluruh rute API berjalan di `http://localhost:3000`.

### 1. `GET /api/broker-summary`
Menarik data *Broker Summary* (Ringkasan Broker) `Market Detector` untuk rentang atau hari tertentu secara persis seperti API pusat Stockbit tanpa di-agregasi (Mentah).

**Parameter Query (Query Params):**
- `symbol` *(Wajib)*: Kode saham (Contoh: `MSTI`, `BBCA`)
- `date` *(Opsional)*: Tanggal dalam format `YYYY-MM-DD` (Gunakan ini jika hanya mengambil data 1 hari).
- `startDate` & `endDate` *(Opsional)*: Gunakan kombo rentang ini jika data membentang beberapa hari.

**Contoh URL:**
`http://localhost:3000/api/broker-summary?symbol=HRUM&date=2026-03-31`

---

### 2. `GET /api/broker-flow-chart`
Menarik data *Running Trade / Broker Flow Chart* dari Exodus Stockbit API.

**Parameter Query (Query Params):**
Selain parameter `symbol`, `date`, `startDate`, & `endDate` yang wajib, Anda bisa menyematkan parameter filter tambahan:
- `investorType` *(Opsional, default: `INVESTOR_TYPE_ALL`)*
  Opsi valid: `INVESTOR_TYPE_ALL`, `INVESTOR_TYPE_DOMESTIC`, `INVESTOR_TYPE_FOREIGN`
- `marketBoard` *(Opsional, default: `BOARD_TYPE_REGULAR`)*
  Opsi valid: `BOARD_TYPE_ALL`, `BOARD_TYPE_REGULAR`, `BOARD_TYPE_CASH`, `BOARD_TYPE_NEGOTIATION`

**Contoh URL:**
`http://localhost:3000/api/broker-flow-chart?symbol=MSTI&startDate=2026-02-01&endDate=2026-03-31&investorType=INVESTOR_TYPE_FOREIGN`

---

### Fitur API Lainnya:

| Endpoint | Method | Deskripsi |
|---|---|---|
| `/api/health` | `GET` | Memeriksa apakah *Node.js* menyala dan Autentikasi berjalan baik. |
| `/api/auth/status` | `GET` | Cek status autentikasi/sesi sesi Stockbit di belakang layar. |
| `/api/auth/login` | `POST` | Tembak JSON Payload `{ "username": "...", "password": "..." }` untuk manual triggger *login*. |
| `/api/auth/token` | `POST` | Menulis/menimpa manual Bearer Token dengan Payload `{ "token": "..." }`. | 

---

## 💡 Troubleshooting *Rate-Limit*

Seperti selayaknya API *Private*, Stockbit akan memblokir (*Force Logout / Cloudflare HTTP 429*) IP/Token Anda jika mengirim terlalu banyak tarikan dengan cepat. 
Sangat disarankan menanam waktu tunda (*delay*) sebesar **1 hingga 1.5 detik per panggilan antrean** dari antarmuka luar Anda.
