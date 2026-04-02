# 🛡️ Safety-Bot — WhatsApp Admin Bot

Bot admin otomatis WhatsApp untuk moderasi grup dengan fitur lengkap:
pengawasan konten, jadwal shalat, dan jam operasional grup.

---

## ✨ Fitur Utama

| No | Fitur | Keterangan |
|----|-------|------------|
| 1 | **Sambutan Anggota Baru** | Menyambut otomatis + menampilkan deskripsi & aturan grup |
| 2 | **Pengingat Shalat 5 Waktu** | Notifikasi reminder + adzan untuk Subuh, Dzuhur, Ashar, Maghrib, Isya |
| 3 | **Jam Operasional Grup** | Buka 03:00–22:00 WIB, kunci 5 menit sebelum adzan & buka 10 menit setelah adzan |
| 4 | **Sistem Moderasi** | Peringatan hingga 3x, pelanggaran ke-4 → kick otomatis |
| 5 | **Validasi Grok AI** | Deteksi kata kasar, rasis, dan SARA menggunakan xAI Grok agar akurasi tinggi |

---

## 🗂️ Struktur Proyek

```
safety-bot/
├── index.js                    # Entry point utama
├── config.js                   # Konfigurasi & teks pesan
├── package.json
├── .env                        # Variabel rahasia (buat dari .env.example)
├── .env.example
├── handlers/
│   ├── welcomeHandler.js       # Sambutan anggota baru
│   ├── moderationHandler.js    # Sistem peringatan & kick
│   └── prayerHandler.js        # Jadwal shalat & kunci/buka grup
├── utils/
│   ├── grokAI.js               # Integrasi Grok AI (xAI)
│   └── storage.js              # Simpan/muat data peringatan
└── data/
    └── warnings.json           # Data peringatan (auto-generated)
```

---

## 📋 Prasyarat

- **Node.js** ≥ 18.0.0  
- **npm** ≥ 9.0.0  
- **Google Chrome / Chromium** (untuk Puppeteer)  
- **API Key Grok AI** dari [console.x.ai](https://console.x.ai)  
- Nomor WhatsApp khusus untuk bot

---

## 🚀 Instalasi

### 1. Clone / Download proyek
```bash
git clone <repo-url> safety-bot
cd safety-bot
```

### 2. Install dependensi
```bash
npm install
```

### 3. Konfigurasi `.env`
```bash
cp .env.example .env
```
Edit file `.env`:
```env
GROK_API_KEY=xai-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4. Sesuaikan `config.js` (opsional)
Semua teks pesan, jam operasional, dan pengaturan lainnya ada di `config.js`.

### 5. Jalankan bot
```bash
npm start
```

### 6. Scan QR Code
Saat pertama kali dijalankan, terminal akan menampilkan QR Code.  
Scan menggunakan **WhatsApp nomor bot** (`0895416132949`).

---

## 📱 Perintah Owner

Kirim perintah berikut via **DM langsung ke bot**:

| Perintah | Keterangan |
|----------|-----------|
| `!help` | Tampilkan daftar perintah |
| `!status` | Status bot & jumlah grup |
| `!groups` | Daftar ID grup yang dikelola |
| `!warn <groupId> <nomor>` | Cek peringatan member |
| `!reset <groupId> <nomor>` | Reset peringatan member |
| `!lock <groupId>` | Kunci grup secara manual |
| `!unlock <groupId>` | Buka grup secara manual |

**Contoh:**
```
!warn 120363xxxxxxxx@g.us 6281234567890
!reset 120363xxxxxxxx@g.us 6281234567890
```

---

## ⚙️ Konfigurasi Utama (`config.js`)

```js
OWNER_NUMBER: '6282254513920',   // Pemilik bot
BOT_NUMBER:   '62895416132949',  // Nomor bot

OPEN_HOUR:  3,    // Buka grup jam 03:00
CLOSE_HOUR: 22,   // Tutup grup jam 22:00

BEFORE_PRAYER: 5,  // Kunci grup N menit sebelum adzan
AFTER_PRAYER:  10, // Buka grup N menit setelah adzan

MAX_WARNINGS: 3,   // Pelanggaran ke-4 → kick

GROK_CONFIDENCE: 0.75  // Threshold akurasi AI (0.0–1.0)
```

---

## 🤖 Cara Kerja Moderasi

```
Pesan diterima
    │
    ▼
Kirim ke Grok AI untuk analisis
    │
    ├── AMAN → Tidak ada tindakan
    │
    └── PELANGGARAN
            │
            ├─ Warning 1 → ⚠️ Peringatan 1/3
            ├─ Warning 2 → ⚠️ Peringatan 2/3
            ├─ Warning 3 → 🔴 PERINGATAN TERAKHIR 3/3
            └─ Warning 4 → 🚫 KICK otomatis
```

Kategori yang terdeteksi:
- `rude` — Kata kasar / makian
- `racist` — Konten rasis
- `sara` — SARA (Suku, Agama, Ras, Antar-golongan)

---

## 🕌 Jadwal Jam Operasional

```
03:00  ─── Grup DIBUKA ─────────────────────────────┐
                                                     │
[Setiap Waktu Shalat]:                              BUKA
  H-5 menit  → Reminder + Grup DIKUNCI             │
  Tepat Adzan → Notifikasi adzan                    │
  H+10 menit → Grup DIBUKA kembali ──────────────┘

22:00  ─── Grup DIKUNCI ─────────────────────────────
```

---

## 🔧 Syarat Bot Menjadi Admin

Agar semua fitur berjalan sempurna, bot **wajib dijadikan admin** di setiap grup dengan izin:
- ✅ Kirim pesan
- ✅ Edit info grup (untuk kunci/buka)
- ✅ Hapus pesan anggota
- ✅ Keluarkan anggota (kick)

---

## 📦 Dependensi

| Package | Kegunaan |
|---------|---------|
| `whatsapp-web.js` | Library WhatsApp Web automation |
| `qrcode-terminal` | Tampilkan QR Code di terminal |
| `node-cron` | Scheduler jam operasional & refresh harian |
| `axios` | HTTP request ke Grok AI & Aladhan API |
| `dotenv` | Manajemen variabel environment |

---

## ❓ Troubleshooting

**Bot tidak bisa kunci/hapus pesan/kick member:**
> Pastikan bot sudah dijadikan admin grup dengan izin penuh.

**Grok AI selalu error:**
> Cek `GROK_API_KEY` di file `.env`. Pastikan API key valid dan quota mencukupi.

**Jadwal shalat tidak muncul:**
> Cek koneksi internet. Bot menggunakan [Aladhan API](https://aladhan.com/prayer-times-api) untuk data jadwal shalat.

**Session expired / harus scan ulang:**
> Hapus folder `.wwebjs_auth/` dan jalankan ulang bot.

---

## 📝 Lisensi

MIT License — Bebas digunakan dan dimodifikasi.
