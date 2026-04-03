// =============================================================
// handlers/moderationHandler.js
// Moderasi otomatis: peringatan 3x → kick, validasi via Grok AI
// =============================================================

const config = require('../config');
const { checkViolation } = require('../utils/grokAI');
const {
  loadWarnings,
  addWarning,
  resetWarning,
  getWarningCount,
  loadStatus
} = require('../utils/storage');

// In-memory warnings (dimuat dari file saat startup)
let warnings = loadWarnings();

// Label & emoji kategori pelanggaran
const CATEGORY_INFO = {
  rude:   { emoji: '🤬', label: 'Kata Kasar / Makian' },
  racist: { emoji: '⚠️',  label: 'Konten Rasis' },
  sara:   { emoji: '🚫', label: 'Konten SARA' }
};

/**
 * Handler utama untuk setiap pesan masuk di grup
 */
async function handleMessage(client, message) {
  try {
    // ── Check Bot Status ─────────────────────────────────────
    const { isActive } = loadStatus();
    if (!isActive) return;

    // Hanya proses pesan grup
    const chat = await message.getChat();
    if (!chat.isGroup) return;

    // Identifikasi pengirim
    const senderId = message.author || message.from;

    // Abaikan pesan dari owner dan bot sendiri
    const ownerJid = config.OWNER_NUMBER + '@c.us';
    const botJid   = config.BOT_NUMBER   + '@c.us';
    if (senderId === ownerJid || senderId === botJid) return;

    // Abaikan pesan kosong, stiker, atau terlalu pendek
    const body = (message.body || '').trim();
    if (!body || body.length < 3) return;

    // Abaikan pesan dari admin grup
    const participant = chat.participants?.find(p => 
      p.id._serialized === senderId || p.id.user === senderId.split('@')[0]
    );
    if (participant?.isAdmin || participant?.isSuperAdmin) return;

    // ── Validasi ke Grok AI ──────────────────────────────────
    console.log(`[Moderation] Memeriksa pesan dari ${senderId}: "${body.substring(0, 60)}..."`);
    const result = await checkViolation(body);

    if (!result.is_violation) return; // Aman, tidak ada tindakan

    // ── Catat pelanggaran ────────────────────────────────────
    const groupId      = chat.id._serialized;
    const warningCount = addWarning(warnings, groupId, senderId);

    const contact = await client.getContactById(senderId);
    const name    = contact.pushname || contact.name || senderId.split('@')[0];
    const info    = CATEGORY_INFO[result.category] || { emoji: '⚠️', label: 'Konten Terlarang' };

    console.log(
      `[Moderation] Pelanggaran ke-${warningCount} oleh ${name} | Kategori: ${result.category} | Confidence: ${result.confidence}`
    );

    // Hapus pesan yang melanggar (butuh bot menjadi admin)
    try {
      await message.delete(true);
      console.log(`[Moderation] Pesan dari ${name} berhasil dihapus.`);
    } catch {
      console.warn(`[Moderation] Gagal menghapus pesan dari ${name} (bot mungkin bukan admin).`);
    }

    // ── Tindakan berdasarkan jumlah peringatan ───────────────
    if (warningCount <= config.MAX_WARNINGS) {
      // Masih dalam batas peringatan
      const remaining = config.MAX_WARNINGS - warningCount;
      const lastWarn  = remaining === 0 ? '\n🔴 *INI PERINGATAN TERAKHIR SEBELUM KICK!*' : '';

      const warnMsg = `
${info.emoji} *PERINGATAN ${warningCount}/${config.MAX_WARNINGS}* ${info.emoji}

@${senderId.split('@')[0]} melanggar aturan grup!
📂 Kategori  : *${info.label}*
📝 Keterangan: ${result.reason}

⚠️ Sisa peringatan: *${remaining}*${lastWarn}

Harap patuhi peraturan grup. Terima kasih. 🙏
*— ${config.BOT_NAME}*
`.trim();

      await chat.sendMessage(warnMsg, { mentions: [contact] });

    } else {
      // Pelanggaran ke-4 → KICK
      const kickMsg = `
🚫 *ANGGOTA DIKELUARKAN* 🚫

@${senderId.split('@')[0]} telah melanggar aturan grup sebanyak *${warningCount} kali*
dan telah *dikeluarkan otomatis* dari grup.

📂 Pelanggaran terakhir: *${info.label}*
📝 Alasan: ${result.reason}

*— ${config.BOT_NAME}*
`.trim();

      await chat.sendMessage(kickMsg, { mentions: [contact] });

      try {
        await chat.removeParticipants([senderId]);
        // Reset counter setelah kick agar bersih jika diundang kembali
        resetWarning(warnings, groupId, senderId);
        console.log(`[Moderation] ${name} berhasil dikick dari ${chat.name}.`);
      } catch (kickErr) {
        console.error(`[Moderation] Gagal kick ${name}:`, kickErr.message);
        await chat.sendMessage(
          `⚠️ Gagal mengeluarkan @${senderId.split('@')[0]}. Pastikan bot memiliki izin admin penuh.`
        );
      }
    }
  } catch (error) {
    console.error('[Moderation] Error:', error.message);
  }
}

/**
 * Reset peringatan manual oleh owner
 */
function resetMemberWarnings(groupId, userId) {
  resetWarning(warnings, groupId, userId);
}

/**
 * Ambil jumlah peringatan member tertentu
 */
function getMemberWarnings(groupId, userId) {
  return getWarningCount(warnings, groupId, userId);
}

module.exports = { handleMessage, resetMemberWarnings, getMemberWarnings };
