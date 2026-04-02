// =============================================================
// handlers/welcomeHandler.js — Sambut anggota baru secara otomatis
// =============================================================

const config = require('../config');

/**
 * Kirim pesan sambutan ke anggota baru yang bergabung ke grup
 */
async function handleNewMember(client, notification) {
  try {
    const chat = await notification.getChat();
    if (!chat.isGroup) return;

    const newMemberIds = notification.recipientIds || [];
    if (newMemberIds.length === 0) return;

    // Jangan kirim welcome jika bot sendiri yang bergabung
    const botJid = config.BOT_NUMBER + '@c.us';
    const realNewMembers = newMemberIds.filter(id => id !== botJid);
    if (realNewMembers.length === 0) return;

    for (const memberId of realNewMembers) {
      try {
        const contact  = await client.getContactById(memberId);
        const name     = contact.pushname || contact.name || memberId.split('@')[0];
        const mentions = [contact];

        const welcomeMsg = `
🎉 *Selamat Datang di Grup, @${memberId.split('@')[0]}!* 🎉

${config.GROUP_DESCRIPTION}

━━━━━━━━━━━━━━━━━━━━━━━━

${config.GROUP_RULES}

━━━━━━━━━━━━━━━━━━━━━━━━

📌 *Info Jam Operasional Grup:*
🕐 Buka  : 03.00 – 22.00 WIB
🔕 Tutup : 22.00 – 03.00 WIB
🕌 Grup juga dikunci ±5 mnt sebelum & 10 mnt setelah setiap adzan shalat.

Selamat bergabung, semoga betah! 🤝
*— ${config.BOT_NAME}*
`.trim();

        await chat.sendMessage(welcomeMsg, { mentions });
        console.log(`[Welcome] Menyambut ${name} di grup ${chat.name}`);
      } catch (err) {
        console.error(`[Welcome] Gagal menyambut ${memberId}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Welcome] Error:', error.message);
  }
}

module.exports = { handleNewMember };
