// =============================================================
// config.js — Konfigurasi utama Safety-Bot
// =============================================================

module.exports = {
  // ─── Identitas Bot ──────────────────────────────────────────
  BOT_NAME: 'Safety-Bot',

  // Format: 62 + nomor tanpa awalan 0  (contoh: 08xxx → 628xxx)
  OWNER_NUMBER: '6282254513920',   // Pemilik: 082254513920
  BOT_NUMBER:   '62895416132949', // Nomor bot: 0895416132949

  // ─── Jam Operasional Grup ───────────────────────────────────
  OPEN_HOUR:  3,   // Buka pukul 03:00 WIB
  CLOSE_HOUR: 22,  // Tutup pukul 22:00 WIB

  // ─── Buffer Waktu Shalat (menit) ────────────────────────────
  BEFORE_PRAYER: 5,   // Kunci grup 5 menit SEBELUM adzan
  AFTER_PRAYER:  10,  // Buka grup 10 menit SETELAH adzan

  // ─── Lokasi untuk Jadwal Shalat ─────────────────────────────
  CITY:           'Jakarta',
  COUNTRY:        'Indonesia',
  PRAYER_METHOD:  11,  // Kemenag RI

  // ─── Sistem Peringatan ──────────────────────────────────────
  MAX_WARNINGS: 3, // Peringatan ke-4 langsung kick

  // ─── Grok AI ────────────────────────────────────────────────
  GROK_MODEL:      'grok-3-mini', // Model paling murah xAI (free tier)
  GROK_CONFIDENCE: 0.75, // Threshold confidence minimum (0-1)

  // ─── Pesan Sambutan & Aturan ────────────────────────────────
  GROUP_DESCRIPTION: `
🛡️ *SELAMAT DATANG DI GRUP KAMI!*

Grup ini adalah komunitas yang aman, nyaman, dan saling menghormati.
Kami menjunjung tinggi nilai-nilai kesopanan, toleransi, dan kebersamaan
dalam bingkai keberagaman Indonesia. 🇮🇩
`.trim(),

  GROUP_RULES: `
📋 *PERATURAN GRUP*

1️⃣  Dilarang berkata kasar, makian, atau tidak sopan
2️⃣  Dilarang menyebarkan konten *RASIS*
3️⃣  Dilarang menyebarkan konten *SARA* (Suku, Agama, Ras, Antar-golongan)
4️⃣  Dilarang spam dan promosi/iklan tanpa izin admin
5️⃣  Dilarang menyebarkan hoaks dan berita bohong
6️⃣  Saling menghormati sesama anggota
7️⃣  Grup akan *dikunci* saat waktu shalat dan di luar jam operasional

⚠️  *Konsekuensi Pelanggaran:*
     ├─ Pelanggaran 1–3 → Peringatan otomatis
     └─ Pelanggaran ke-4 → *KICK* dari grup

🤖  Safety-Bot aktif 24 jam memantau grup ini.
`.trim(),

  // ─── Pesan Adzan per Waktu Shalat ───────────────────────────
  PRAYER_MESSAGES: {
    Fajr:    { emoji: '🌙', name: 'Subuh',   msg: 'Saatnya bangun dan awali hari dengan ibadah. Shalat Subuh menentukan keberkahan hari ini!' },
    Dhuhr:   { emoji: '☀️', name: 'Dzuhur',  msg: 'Istirahat sejenak dari kesibukan untuk memenuhi panggilan Allah. Yuk shalat Dzuhur!' },
    Asr:     { emoji: '🌤️', name: 'Ashar',   msg: 'Jangan sampai terlewat! Waktu Ashar sangat singkat, segera tunaikan shalat.' },
    Maghrib: { emoji: '🌅', name: 'Maghrib', msg: 'Alhamdulillah, hari masih diberi kesempatan. Segerakan shalat Maghrib sebelum terlambat!' },
    Isha:    { emoji: '🌙', name: 'Isya',    msg: 'Tutup malam ini dengan shalat Isya. Semoga kita semua mendapat istirahat yang berkah.' }
  }
};
