/**
 * Detects which trading session (Phnom Penh local time) the current
 * moment falls in — mirrors the same session windows used in the
 * "V-TRADE AI — XAUUSD PHNOM PENH SESSION ENGINE" Pine Script indicator:
 *
 *   🟣 NEW YORK : 00:00 → 03:00  (Phnom Penh time)
 *   🔵 ASIA     : 07:00 → 10:00
 *   🟠 LONDON   : 12:00 → 15:00
 *
 * Phnom Penh is UTC+7 year-round (no daylight saving), so this is
 * computed with a fixed offset rather than a timezone database lookup —
 * safe to run on any server regardless of its own local timezone.
 */

const NY_START_MIN = 0;
const NY_END_MIN = 180;
const ASIA_START_MIN = 420;
const ASIA_END_MIN = 600;
const LONDON_START_MIN = 720;
const LONDON_END_MIN = 900;

const PHNOM_PENH_UTC_OFFSET_MIN = 7 * 60;

function getPhnomPenhMinutesOfDay(date = new Date()) {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (utcMinutes + PHNOM_PENH_UTC_OFFSET_MIN) % 1440;
}

function getCurrentSession(date = new Date()) {
  const m = getPhnomPenhMinutesOfDay(date);
  if (m >= NY_START_MIN && m < NY_END_MIN) return 'NEW YORK';
  if (m >= ASIA_START_MIN && m < ASIA_END_MIN) return 'ASIA';
  if (m >= LONDON_START_MIN && m < LONDON_END_MIN) return 'LONDON';
  return 'NONE';
}

function getSessionEmoji(session) {
  return { 'NEW YORK': '🟣', ASIA: '🔵', LONDON: '🟠', NONE: '⚪' }[session] || '⚪';
}

module.exports = { getCurrentSession, getSessionEmoji, getPhnomPenhMinutesOfDay };
