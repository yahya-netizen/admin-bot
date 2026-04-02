// =============================================================
// handlers/prayerHandler.js
// Jadwal shalat 5 waktu: reminder, notifikasi adzan, kunci/buka grup
// =============================================================

const axios  = require('axios');
const config = require('../config');

// Simpan semua timeout aktif agar bisa dibatalkan saat refresh
let activeTimeouts = [];

/**
 * Ambil jadwal shalat hari ini dari Aladhan API
 */
async function fetchPrayerTimes() {
  try {
    const now   = new Date();
    const response = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
      params: {
        city:    config.CITY,
        country: config.COUNTRY,
        method:  config.PRAYER_METHOD,
        day:     now.getDate(),
        month:   now.getMonth() + 1,
        year:    now.getFullYear()
      },
      timeout: 15000
    });
    return response.data.data.timings;
  } catch (err) {
    console.error('[Prayer] Gagal mengambil jadwal shalat:', err.message);
    return null;
  }
}

/**
 * Hitung milidetik hingga waktu target hari ini (atau return -1 jika sudah lewat)
 */
function msUntil(timeStr, offsetMinutes = 0) {
  const [h, m] = timeStr.split(':').map(Number);
  const total  = h * 60 + m + offsetMinutes;
  const tH     = Math.floor(total / 60) % 24;
  const tM     = total % 60;

  const now    = new Date();
  const target = new Date();
  target.setHours(tH, tM, 0, 0);

  const diff = target - now;
  return diff > 0 ? diff : -1; // -1 = sudah lewat hari ini
}

/**
 * Jadwalkan satu event dengan setTimeout, simpan referensi
 */
function scheduleOnce(ms, fn) {
  if (ms < 0) return; // Sudah lewat, skip
  const t = setTimeout(fn, ms);
  activeTimeouts.push(t);
}

/**
 * Mulai / refresh scheduler shalat
 * Dipanggil saat bot ready dan setiap tengah malam
 */
async function startPrayerScheduler(client, getGroups) {
  // Batalkan semua timeout lama
  activeTimeouts.forEach(t => clearTimeout(t));
  activeTimeouts = [];

  const timings = await fetchPrayerTimes();
  if (!timings) {
    console.warn('[Prayer] Jadwal tidak tersedia, retry dalam 5 menit...');
    const retry = setTimeout(() => startPrayerScheduler(client, getGroups), 5 * 60 * 1000);
    activeTimeouts.push(retry);
    return;
  }

  const prayerKeys = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  for (const key of prayerKeys) {
    const timeStr = timings[key];
    const info    = config.PRAYER_MESSAGES[key];
    if (!timeStr || !info) continue;

    console.log(`[Prayer] ${info.name}: ${timeStr} WIB`);

    // ── 1. 5 menit sebelum adzan → reminder + kunci grup ─────
    scheduleOnce(msUntil(timeStr, -config.BEFORE_PRAYER), async () => {
      const groups = getGroups();
      console.log(`[Prayer] ${info.name}: kirim reminder & kunci ${groups.length} grup`);

      for (const groupId of groups) {
        try {
          const chat = await client.getChatById(groupId);

          const reminderMsg = `
🕌 *Grup Dikunci Sementara — Waktu Shalat ${info.name}* 🕌

Panggilan ibadah untuk shalat *${info.name}* akan segera tiba (sekitar *${config.BEFORE_PRAYER} menit* lagi).
Grup kami *kunci sementara* agar seluruh anggota dapat fokus menjalankan ibadah dengan tenang. 🙏

Grup akan dibuka kembali sekitar *10 menit* setelah adzan berkumandang.

*— ${config.BOT_NAME}*
`.trim();

          await chat.sendMessage(reminderMsg);
          await chat.setMessagesAdminsOnly(true);
        } catch (e) {
          console.error(`[Prayer] Pre-${info.name} error di ${groupId}:`, e.message);
        }
      }
    });

    // ── 2. Tepat waktu adzan → notifikasi ────────────────────
    scheduleOnce(msUntil(timeStr, 0), async () => {
      const groups = getGroups();
      console.log(`[Prayer] ${info.name}: kirim notifikasi adzan`);

      for (const groupId of groups) {
        try {
          const chat = await client.getChatById(groupId);

          const adzanMsg = `
${info.emoji} *Allahu Akbar!*  —  *Adzan ${info.name}* ${info.emoji}

${info.msg}

🕌 Mari tinggalkan sejenak aktivitas dunia.
Semoga ibadah kita diterima Allah SWT. Aamiin 🤲

*— ${config.BOT_NAME}*
`.trim();

          await chat.sendMessage(adzanMsg);
        } catch (e) {
          console.error(`[Prayer] Adzan-${info.name} error di ${groupId}:`, e.message);
        }
      }
    });

    // ── 3. 10 menit setelah adzan → buka grup (jika masih jam operasional) ─
    scheduleOnce(msUntil(timeStr, config.AFTER_PRAYER), async () => {
      const groups = getGroups();
      const nowH   = new Date().getHours();

      // Hanya buka jika masih dalam jam operasional (03:00–22:00)
      if (nowH < config.OPEN_HOUR || nowH >= config.CLOSE_HOUR) {
        console.log(`[Prayer] Post-${info.name}: di luar jam operasional, grup tetap terkunci.`);
        return;
      }

      console.log(`[Prayer] ${info.name}: buka kembali ${groups.length} grup`);
      for (const groupId of groups) {
        try {
          const chat = await client.getChatById(groupId);
          await chat.setMessagesAdminsOnly(false);

          const openMsg = `
✅ *Grup Dibuka Kembali — Selesai Ibadah* ✅

Waktu ibadah shalat *${info.name}* telah selesai. Grup kini telah *dibuka kembali* untuk umum.
Semoga amal ibadah kita semua diterima oleh Allah SWT. Aamiin 🤲

Silakan lanjutkan aktivitas diskusi Anda. Terima kasih! 😊

*— ${config.BOT_NAME}*
`.trim();

          await chat.sendMessage(openMsg);
        } catch (e) {
          console.error(`[Prayer] Post-${info.name} error di ${groupId}:`, e.message);
        }
      }
    });
  }

  // Tampilkan ringkasan jadwal hari ini
  console.log('\n[Prayer] ✅ Jadwal shalat berhasil dimuat:');
  for (const key of prayerKeys) {
    const t    = timings[key];
    const info = config.PRAYER_MESSAGES[key];
    if (t && info) console.log(`         ${info.emoji} ${info.name.padEnd(8)}: ${t} WIB`);
  }
  console.log('');
}

module.exports = { startPrayerScheduler, fetchPrayerTimes };
