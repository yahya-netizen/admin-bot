// =============================================================
// utils/grokAI.js — Validasi konten via Grok AI (xAI)
// DIOPTIMALKAN: Zero-cost semaksimal mungkin
//   • Model    : grok-3-mini (paling murah / gratis)
//   • Input    : Potong pesan maks 120 karakter → hemat input token
//   • Output   : max_tokens = 60 (JSON pendek cukup)
//   • Cache    : TTL 24 jam per teks unik → tidak hit API 2x untuk pesan sama
//   • Pre-filter lokal : ~80% pesan biasa langsung lolos tanpa API call
//   • Daily cap: Batasi 40 panggilan/hari agar tidak melebihi free tier
// =============================================================

const axios  = require('axios');
const config = require('../config');

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

// ─── Cache 24 jam (key = teks ternormalisasi) ───────────────
const responseCache = new Map();
const CACHE_TTL     = 24 * 60 * 60 * 1000; // 24 jam

// ─── Daily request counter ──────────────────────────────────
let dailyCallCount = 0;
let dailyResetDate = new Date().toDateString();
const DAILY_API_CAP = 40; // Maks 40 panggilan Grok per hari

// ─── Kata kasar lokal (pre-filter tanpa API) ────────────────
// Daftar minimal — hanya kata yang SANGAT jelas agar tidak
// ada false-positive. Kata ambigu tetap dikirim ke Grok.
const LOCAL_BLOCKLIST = new Set([
  // Makian umum Indonesia
  'anjing','anjir','anj','bangsat','bgs','brengsek',
  'kampret','keparat','bajingan','bedebah','setan',
  'goblok','goblog','tolol','idiot','bodoh bgt',
  'kontol','memek','ngentot','jancok','dancok',
  'cok','jancuk','asu','asuu',
  // Variasi leet/typo umum
  'b4ngsat','k0ntol','g0blok','t0lol',
]);

// Regex pola kasar yang jelas (tanpa false-positive)
const RUDE_PATTERNS = [
  /\b(f+u+c+k|s+h+i+t)\b/i,          // English kasar jelas
  /b+a+n+g+s+a+t/i,
  /k+o+n+t+o+l/i,
  /n+g+e+n+t+o+t/i,
];

// ─── Safe-list: pesan yang PASTI aman, skip semua cek ───────
const SAFE_PATTERNS = [
  /^[\d\s\+\-\.\,\!\?]+$/,            // Hanya angka/simbol
  /^(ok|oke|iya|ya|sip|siap|makasih|thanks|noted|done|haha|hehe|wkwk|😊|👍|🙏)+$/i,
  /^https?:\/\//i,                     // URL saja
  /^\s*$/,                             // Kosong
];

/**
 * Hasil aman (tidak perlu API call)
 */
const SAFE_RESULT = {
  is_violation: false, category: 'none', confidence: 1, reason: 'Lolos filter lokal'
};

/**
 * Normalisasi teks: lowercase, strip spasi ganda, potong 120 karakter
 */
function normalizeText(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 120);
}

/**
 * Cek daily cap & reset otomatis tengah malam
 */
function checkDailyCap() {
  const today = new Date().toDateString();
  if (today !== dailyResetDate) {
    dailyCallCount = 0;
    dailyResetDate = today;
    console.log('[GrokAI] Daily counter direset.');
  }
  return dailyCallCount < DAILY_API_CAP;
}

/**
 * Pre-filter lokal sebelum hit API
 * Return: { skip: true, result } jika bisa diselesaikan lokal
 *         { skip: false }        jika perlu Grok
 */
function localFilter(normalized) {
  // 1. Pasti aman
  for (const pat of SAFE_PATTERNS) {
    if (pat.test(normalized)) return { skip: true, result: SAFE_RESULT };
  }

  // 2. Kata kasar jelas dari blocklist
  const words = normalized.split(/\s+/);
  for (const w of words) {
    if (LOCAL_BLOCKLIST.has(w)) {
      return {
        skip: true,
        result: { is_violation: true, category: 'rude', confidence: 0.95, reason: `Kata kasar terdeteksi: "${w}"` }
      };
    }
  }

  // 3. Pola regex kasar jelas
  for (const pat of RUDE_PATTERNS) {
    if (pat.test(normalized)) {
      return {
        skip: true,
        result: { is_violation: true, category: 'rude', confidence: 0.95, reason: 'Pola kata kasar terdeteksi' }
      };
    }
  }

  // 4. Pesan sangat pendek & tidak ada kata berbahaya → aman
  if (normalized.length < 8) return { skip: true, result: SAFE_RESULT };

  return { skip: false };
}

/**
 * Validasi pesan dengan Grok AI
 * Hanya dipanggil jika lolos pre-filter lokal
 */
async function checkViolation(messageText) {
  const normalized = normalizeText(messageText);

  // ── 1. Pre-filter lokal ─────────────────────────────────
  const local = localFilter(normalized);
  if (local.skip) {
    if (local.result.is_violation) {
      console.log(`[GrokAI] Lokal hit: "${normalized.substring(0,40)}"`);
    }
    return local.result;
  }

  // ── 2. Cache 24 jam ─────────────────────────────────────
  if (responseCache.has(normalized)) {
    const cached = responseCache.get(normalized);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[GrokAI] Cache hit: "${normalized.substring(0,40)}"`);
      return cached.result;
    }
    responseCache.delete(normalized);
  }

  // ── 3. Cek daily cap ────────────────────────────────────
  if (!checkDailyCap()) {
    console.warn(`[GrokAI] Daily cap (${DAILY_API_CAP}) tercapai. Skip API call.`);
    return SAFE_RESULT; // Gagal aman daripada salah kick
  }

  // ── 4. Panggil Grok API ─────────────────────────────────
  try {
    dailyCallCount++;
    console.log(`[GrokAI] API call #${dailyCallCount}/${DAILY_API_CAP}: "${normalized.substring(0,50)}"`);

    const response = await axios.post(
      GROK_API_URL,
      {
        // grok-3-mini = model paling murah xAI (free tier friendly)
        model:      'grok-3-mini',
        max_tokens: 60,        // JSON pendek cukup {"is_violation":x,"category":"x","confidence":x}
        temperature: 0,        // Deterministik = konsisten + hemat
        messages: [
          {
            role: 'system',
            // Prompt sesingkat mungkin untuk hemat input token
            content:
              'Moderasi WA Indonesia. Cek: rude(kata kasar/makian), racist(rasis), sara(SARA). ' +
              'Konteks normal/olahraga/berita bukan pelanggaran. ' +
              'Jawab JSON saja: {"is_violation":bool,"category":"rude|racist|sara|none","confidence":0.0-1.0}'
          },
          {
            role: 'user',
            // Pesan sudah dipotong 120 karakter di normalizeText()
            content: normalized
          }
        ]
      },
      {
        headers: {
          Authorization:  `Bearer ${process.env.GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 12000
      }
    );

    const raw   = response.data.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    // Pastikan struktur valid
    if (typeof result.is_violation !== 'boolean') throw new Error('Struktur JSON tidak valid');

    // Tambahkan reason default jika tidak ada
    if (!result.reason) result.reason = result.category !== 'none' ? 'Terdeteksi oleh AI' : 'Tidak ada pelanggaran';

    // Terapkan threshold confidence
    if ((result.confidence || 0) < config.GROK_CONFIDENCE) {
      result.is_violation = false;
      result.category     = 'none';
    }

    // Cache hasil
    responseCache.set(normalized, { result, timestamp: Date.now() });

    return result;

  } catch (error) {
    console.error('[GrokAI] Error:', error.message);
    dailyCallCount = Math.max(0, dailyCallCount - 1); // Rollback jika gagal
    return { is_violation: false, category: 'none', confidence: 0, reason: 'API error' };
  }
}

/**
 * Info penggunaan hari ini (untuk command !apistats)
 */
function getUsageStats() {
  return { used: dailyCallCount, cap: DAILY_API_CAP, date: dailyResetDate };
}

module.exports = { checkViolation, getUsageStats };
