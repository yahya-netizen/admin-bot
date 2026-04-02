// =============================================================
// utils/storage.js — Penyimpanan data peringatan (warnings)
// =============================================================

const fs   = require('fs');
const path = require('path');

const DATA_DIR      = path.join(__dirname, '..', 'data');
const WARNINGS_FILE = path.join(DATA_DIR, 'warnings.json');

/** Pastikan direktori data tersedia */
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Muat data warnings dari file JSON
 * @returns {{ [groupId: string]: { [userId: string]: number } }}
 */
function loadWarnings() {
  ensureDataDir();
  if (!fs.existsSync(WARNINGS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(WARNINGS_FILE, 'utf8'));
  } catch {
    console.warn('[Storage] File warnings korup, direset.');
    return {};
  }
}

/**
 * Simpan data warnings ke file JSON
 * @param {object} warnings
 */
function saveWarnings(warnings) {
  ensureDataDir();
  fs.writeFileSync(WARNINGS_FILE, JSON.stringify(warnings, null, 2), 'utf8');
}

/**
 * Tambah 1 peringatan untuk user di grup tertentu
 * @returns {number} jumlah peringatan setelah penambahan
 */
function addWarning(warnings, groupId, userId) {
  if (!warnings[groupId])         warnings[groupId] = {};
  if (!warnings[groupId][userId]) warnings[groupId][userId] = 0;
  warnings[groupId][userId]++;
  saveWarnings(warnings);
  return warnings[groupId][userId];
}

/**
 * Reset peringatan user di grup tertentu
 */
function resetWarning(warnings, groupId, userId) {
  if (warnings[groupId] && warnings[groupId][userId] !== undefined) {
    delete warnings[groupId][userId];
    saveWarnings(warnings);
  }
}

/**
 * Ambil jumlah peringatan user di grup tertentu
 */
function getWarningCount(warnings, groupId, userId) {
  return (warnings[groupId] && warnings[groupId][userId]) || 0;
}

module.exports = { loadWarnings, saveWarnings, addWarning, resetWarning, getWarningCount };
