// =============================================================
// index.js — Safety-Bot: Entry Point Utama
// Pemilik : 082254513920  |  Bot: 0895416132949
// =============================================================

require('dotenv').config();

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron   = require('node-cron');

const config             = require('./config');
const { handleNewMember }       = require('./handlers/welcomeHandler');
const { handleMessage, resetMemberWarnings, getMemberWarnings } = require('./handlers/moderationHandler');
const { startPrayerScheduler }  = require('./handlers/prayerHandler');
const { loadStatus, saveStatus } = require('./utils/storage');
const { getUsageStats }         = require('./utils/grokAI');

// ─── Daftar grup yang dikelola bot ─────────────────────────
let managedGroups = ['MAHASISWA MUSLIM UNSIL 2026','es bot' ];

const getGroups = () => managedGroups;

// ─── Inisialisasi Client WhatsApp ───────────────────────────
//untuk termux server
const client = new Client({
    puppeteer: {
        executablePath: '/data/data/com.termux/files/usr/bin/chromium-browser',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-extensions',
            '--single-process'
        ]
    }
});


//untuk vps
/*const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'safety-bot' }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  }
});*/

// ─── QR Code ────────────────────────────────────────────────
client.on('qr', (qr) => {
  console.log('\n' + '═'.repeat(55));
  console.log('  📱  Scan QR Code berikut dengan WhatsApp Bot:');
  console.log('═'.repeat(55) + '\n');
  qrcode.generate(qr, { small: true });
  console.log('\n' + '═'.repeat(55));
  console.log('  Menunggu scan... (timeout: 60 detik)');
  console.log('═'.repeat(55) + '\n');
});

// ─── Autentikasi Berhasil ────────────────────────────────────
client.on('authenticated', () => {
  console.log('✅ Autentikasi berhasil! Session disimpan.');
});

// ─── Bot Siap ────────────────────────────────────────────────
client.on('ready', async () => {
  console.log('\n' + '═'.repeat(55));
  console.log(`  🤖  ${config.BOT_NAME} Aktif!`);
  console.log(`  📅  ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`);
  console.log('═'.repeat(55));

  // Kumpulkan semua grup yang dikelola
  try {
    const chats = await client.getChats();
    managedGroups = chats
      .filter(c => c.isGroup)
      .map(c => c.id._serialized);
    console.log(`  📊  Memantau ${managedGroups.length} grup`);
    managedGroups.forEach(id => console.log(`       • ${id}`));
    console.log('═'.repeat(55) + '\n');
  } catch (e) {
    console.error('Gagal mengambil daftar grup:', e.message);
  }

  // Jalankan scheduler jadwal shalat
  await startPrayerScheduler(client, getGroups);

  // Jalankan scheduler jam operasional grup
  startGroupOperationalScheduler();

  // Cek jam operasional sekarang (antisipasi bot baru nyala di jam tidur)
  await checkCurrentOperationalHours();

  // Kirim notifikasi ke owner bahwa bot aktif
  try {
    await client.sendMessage(
      config.OWNER_NUMBER + '@c.us',
      `✅ *${config.BOT_NAME} Aktif!*\n\n` +
      `🕐 Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
      `📊 Grup dikelola: ${managedGroups.length}\n\n` +
      `Ketik *!help* untuk daftar perintah.`
    );
  } catch {
    console.log('[Info] Tidak dapat kirim notifikasi ke owner.');
  }
});

// ─── Scheduler Jam Operasional Grup ─────────────────────────
function startGroupOperationalScheduler() {
  // Buka grup pukul 03:00 WIB
  cron.schedule('0 3 * * *', async () => {
    console.log('[Scheduler] Membuka grup (03:00 WIB)');
    for (const groupId of managedGroups) {
      try {
        const chat = await client.getChatById(groupId);
        await chat.setMessagesAdminsOnly(false);
        await chat.sendMessage(
          `🌅 *SELAMAT PAGI! — GRUP DIBUKA* ☀️\n\n` +
          `Waktu menunjukkan pukul 03.00 WIB. Sesuai jadwal operasional, grup kini telah *dibuka kembali*.\n\n` +
          `Selamat beraktivitas, tetap jaga kesopanan dan semangat pagi! 💪😊\n\n` +
          `*— ${config.BOT_NAME}*`
        );
      } catch (e) {
        console.error('[Scheduler] Gagal buka grup:', e.message);
      }
    }
  }, { timezone: 'Asia/Jakarta' });

  // Tutup grup pukul 22:00 WIB
  cron.schedule('0 22 * * *', async () => {
    console.log('[Scheduler] Menutup grup (22:00 WIB)');
    for (const groupId of managedGroups) {
      try {
        const chat = await client.getChatById(groupId);
        await chat.sendMessage(
          `🌙 *SELAMAT ISTIRAHAT — GRUP DITUTUP* 💤\n\n` +
          `Waktu menunjukkan pukul 22.00 WIB. Sesuai jadwal operasional, grup kini kami *tutup sementara* untuk waktu istirahat.\n\n` +
          `Grup akan dibuka kembali besok pagi pukul 03.00 WIB. Sampai jumpa besok! 👋😴\n\n` +
          `*— ${config.BOT_NAME}*`
        );
        await chat.setMessagesAdminsOnly(true);
      } catch (e) {
        console.error('[Scheduler] Gagal tutup grup:', e.message);
      }
    }
  }, { timezone: 'Asia/Jakarta' });

  // Refresh jadwal shalat setiap tengah malam
  cron.schedule('1 0 * * *', async () => {
    console.log('[Scheduler] Refresh jadwal shalat (00:01 WIB)');
    await startPrayerScheduler(client, getGroups);
  }, { timezone: 'Asia/Jakarta' });

  console.log('[Scheduler] Jam operasional & refresh jadwal aktif.\n');
}

/**
 * Cek apakah jam sekarang masuk jam tidur grup
 */
async function checkCurrentOperationalHours() {
  const now   = new Date();
  const hour  = now.getHours();
  
  // Jika jam sekarang >= 22 ATAU jam < 3 (Waktu Tidur)
  if (hour >= config.CLOSE_HOUR || hour < config.OPEN_HOUR) {
    console.log(`[Operational] Jam sekarang ${hour}:00, otomatis mengunci grup (Waktu Tidur).`);
    for (const groupId of managedGroups) {
      try {
        const chat = await client.getChatById(groupId);
        await chat.setMessagesAdminsOnly(true);
        
        // Kirim keterangan agar anggota tahu kenapa grup terkunci
        await chat.sendMessage(
          `🌙 *INFO OTOMATIS — GRUP TETAP DITUTUP* 💤\n\n` +
          `Bot baru saja aktif. Karena saat ini sudah memasuki waktu istirahat (pukul ${hour}.00 WIB), maka grup *tetap dikunci* sesuai jadwal operasional.\n\n` +
          `Grup akan dibuka kembali besok pagi pukul 03.00 WIB. Selamat beristirahat! 😴\n\n` +
          `*— ${config.BOT_NAME}*`
        );
      } catch (e) {
        console.error(`[Operational] Gagal kunci grup ${groupId}:`, e.message);
      }
    }
  } else {
    console.log(`[Operational] Jam sekarang ${hour}:00, masuk jam operasional.`);
  }
}

// ─── Event: Anggota Baru Masuk ───────────────────────────────
client.on('group_join', async (notification) => {
  const ids = notification.recipientIds || [];

  // Jika bot sendiri yang baru diundang → tambahkan ke daftar kelola
  if (ids.includes(config.BOT_NUMBER + '@c.us')) {
    if (!managedGroups.includes(notification.chatId)) {
      managedGroups.push(notification.chatId);
      console.log(`[Group] Bot ditambahkan ke grup baru: ${notification.chatId}`);
      await startPrayerScheduler(client, getGroups); // Refresh dengan grup baru
    }
  }

  // Sambut anggota baru (fitur ini tetap jalan meskipun moderasi mati)
  await handleNewMember(client, notification);
});

// ─── Event: Anggota Keluar ───────────────────────────────────
client.on('group_leave', async (notification) => {
  const ids = notification.recipientIds || [];

  // Jika bot yang dikeluarkan → hapus dari daftar kelola
  if (ids.includes(config.BOT_NUMBER + '@c.us')) {
    managedGroups = managedGroups.filter(id => id !== notification.chatId);
    console.log(`[Group] Bot dikeluarkan dari grup: ${notification.chatId}`);
  }
});

// ─── Event: Pesan Masuk ──────────────────────────────────────
client.on('message', async (message) => {
  const senderId = message.author || message.from;
  const senderNo = senderId.split('@')[0];
  const body     = (message.body || '').trim().toLowerCase();
  const isOwner  = senderNo === config.OWNER_NUMBER;
  const chat     = await message.getChat();

  // ── Perintah Umum (!help) ────────────────────────────────
  if (body === '!help') {
    if (chat.isGroup || isOwner) {
      let helpMsg = `📋 *Menu ${config.BOT_NAME}*\n\n` +
                    `*!status*    — Cek status aktif bot\n` +
                    `*!apistats*  — Penggunaan AI hari ini\n`;
      
      if (isOwner) {
        helpMsg += `\n👑 *Owner Only:*\n` +
                   `*bot-bangun*  — Aktifkan bot\n` +
                   `*bot-tidur*   — Matikan bot\n` +
                   `*!groups*      — Daftar grup\n` +
                   `*!reset <id> <no>* — Reset warn\n` +
                   `*!lock/unlock <id>* — Kontrol grup\n`;
      }
      
      helpMsg += `\n_Ketik perintah sesuai daftar di atas._`;
      await message.reply(helpMsg);
      return;
    }
  }

  // ── Perintah Umum (!status) ────────────────────────────────
  if (body === '!status') {
    const { isActive } = loadStatus();
    await message.reply(
      `✅ *${config.BOT_NAME} Status*\n\n` +
      `🕐 Waktu   : ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
      `🤖 Moderasi: ${isActive ? 'Aktif (Bangun) ✅' : 'Mati (Tidur) 💤'}\n` +
      `🤖 Versi   : 1.0.0`
    );
    return;
  }

  // ── Perintah Umum (!apistats) ─────────────────────────────
  if (body === '!apistats') {
    const stats = getUsageStats();
    const pct   = Math.round((stats.used / stats.cap) * 100);
    const bar   = '█'.repeat(Math.round(pct/10)) + '░'.repeat(10 - Math.round(pct/10));
    await message.reply(
      `📊 *Grok AI Usage Hari Ini*\n\n` +
      `Model  : grok-3-mini (free tier)\n` +
      `Tanggal: ${stats.date}\n` +
      `${bar} ${pct}%\n` +
      `Pakai  : *${stats.used}* / ${stats.cap} panggilan\n` +
      `Sisa   : *${stats.cap - stats.used}* panggilan\n\n` +
      `_Counter reset otomatis tiap tengah malam._`
    );
    return;
  }

  // ── Perintah bot-bangun & bot-tidur (Grup/DM) ──────────────
  if (body === 'bot-bangun' || body === 'bot-tidur') {
    let canToggle = isOwner;

    // Jika di grup dan bukan owner, cek apakah pengirim adalah admin
    if (!canToggle && chat.isGroup) {
      const participant = chat.participants?.find(p => 
        p.id._serialized === senderId || p.id.user === senderNo
      );
      if (participant?.isAdmin || participant?.isSuperAdmin) canToggle = true;
    }

    if (canToggle) {
      const isActivating = body === 'bot-bangun';
      saveStatus(isActivating);
      const statusMsg = isActivating
        ? '☀️ *Bot Bangun!* Bot kembali aktif memantau grup. 🤖✅'
        : '🌙 *Bot Tidur.* Bot dinonaktifkan sementara. 🤖💤';
      await message.reply(statusMsg);
      return;
    }
  }

  // ── Perintah Khusus Owner (DM & Grup) ───────────────────
  if (isOwner) {
    if (body === '!groups') {
      const list = managedGroups.length
        ? managedGroups.map((g, i) => `${i + 1}. ${g}`).join('\n')
        : 'Tidak ada grup.';
      await message.reply(`📋 *Grup yang dikelola:*\n\n${list}`);
      return;
    }

    const parts = body.split(' ');
    if (body.startsWith('!reset ') && parts.length >= 3) {
      const groupId = parts[1];
      const userId  = parts[2] + '@c.us';
      resetMemberWarnings(groupId, userId);
      await message.reply(`✅ Peringatan untuk *${parts[2]}* berhasil direset.`);
      return;
    }

    if (body.startsWith('!lock ') && parts.length >= 2) {
      try {
        const chatLock = await client.getChatById(parts[1]);
        await chatLock.setMessagesAdminsOnly(true);
        await message.reply('✅ Grup berhasil dikunci.');
      } catch (e) {
        await message.reply(`❌ Gagal mengunci grup: ${e.message}`);
      }
      return;
    }

    if (body.startsWith('!unlock ') && parts.length >= 2) {
      try {
        const chatUnlock = await client.getChatById(parts[1]);
        await chatUnlock.setMessagesAdminsOnly(false);
        await message.reply('✅ Grup berhasil dibuka.');
      } catch (e) {
        await message.reply(`❌ Gagal membuka grup: ${e.message}`);
      }
      return;
    }
  }

  // ── Moderasi Pesan Grup ──────────────────────────────────
  if (chat.isGroup) {
    await handleMessage(client, message);
  }
});

// ─── Auth Failure ────────────────────────────────────────────
client.on('auth_failure', (msg) => {
  console.error('❌ Autentikasi gagal:', msg);
  process.exit(1);
});

// ─── Koneksi Terputus ────────────────────────────────────────
client.on('disconnected', (reason) => {
  console.warn('⚠️  Bot terputus:', reason);
  console.log('🔄  Menghubungkan kembali dalam 5 detik...');
  setTimeout(() => client.initialize(), 5000);
});

// ─── Mulai Bot ───────────────────────────────────────────────
console.log(`\n🚀 Memulai ${config.BOT_NAME}...\n`);
client.initialize();

// ─── Graceful Shutdown ───────────────────────────────────────
process.on('SIGINT', async () => {
  console.log('\n🛑 Menghentikan bot...');
  try { await client.destroy(); } catch {}
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Error] Unhandled rejection:', reason);
});
