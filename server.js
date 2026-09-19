require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { fetchCandles } = require('./lib/dataProvider');
const { detectLatestFVG } = require('./lib/fvg');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';

const DATA_FILE = path.join(__dirname, 'signals.json');
const SETTINGS_FILE = path.join(__dirname, 'settings.json');

// ---------- Helpers: signals storage ----------
function loadSignals() {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Error loading signals.json:', err);
    return [];
  }
}

function saveSignals(signals) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(signals, null, 2), 'utf-8');
}

// ---------- Helpers: auto-scan settings storage ----------
const DEFAULT_SETTINGS = {
  autoScanEnabled: false,
  pairs: ['EURUSD', 'GBPUSD', 'XAUUSD'],
  timeframe: '15min',
  intervalMinutes: 15,
};

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return { ...DEFAULT_SETTINGS };
    const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
  } catch (err) {
    console.error('Error loading settings.json:', err);
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

// Very simple in-memory session tokens (fine for a single-admin personal tool).
// Restarting the server invalidates all sessions.
const activeSessions = new Set();

function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (token && activeSessions.has(token)) return next();
  return res.status(401).json({ error: 'Unauthorized. សូមចូលប្រើម្ដងទៀត។' });
}

// ---------- Telegram message builders ----------
function buildTelegramMessage(signal) {
  const dirEmoji = signal.direction === 'BUY' ? '🟢 BUY' : '🔴 SELL';
  const lines = [
    `🔥 *SIGNAL FOREX* 🔥`,
    ``,
    `💱 *Pair:* ${signal.pair}`,
    `${dirEmoji}`,
    `🎯 *Entry:* ${signal.entry}`,
    `🛑 *Stop Loss:* ${signal.sl}`,
  ];
  if (signal.tp1) lines.push(`✅ *TP1:* ${signal.tp1}`);
  if (signal.tp2) lines.push(`✅ *TP2:* ${signal.tp2}`);
  if (signal.tp3) lines.push(`✅ *TP3:* ${signal.tp3}`);
  if (signal.note) {
    lines.push(``, `📝 *Note:* ${signal.note}`);
  }
  lines.push(``, `🕒 ${new Date(signal.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}`);
  return lines.join('\n');
}

function buildFvgMessage(signal, fvg) {
  const dirLabel = signal.direction === 'BUY' ? '🟢 BUY (Bullish FVG)' : '🔴 SELL (Bearish FVG)';
  const lines = [
    `📊 *AUTO FVG SIGNAL* 📊`,
    ``,
    `💱 *Pair:* ${signal.pair}`,
    `${dirLabel}`,
    `⏱ *Timeframe:* ${signal.timeframe}`,
    `📐 *Gap Zone:* ${fvg.gapBottom} — ${fvg.gapTop}`,
    ``,
    `🕒 ${new Date(signal.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' })}`,
    ``,
    `_Auto-detected — សូមផ្ទៀងផ្ទាត់មុនចូល Trade_`,
  ];
  return lines.join('\n');
}

async function sendToTelegram(text) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('BOT_TOKEN ឬ CHAT_ID មិនទាន់បានកំណត់នៅក្នុង .env ទេ');
  }
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: 'Markdown',
    }),
  });
  const data = await resp.json();
  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error');
  }
  return data;
}

// ---------- Auto FVG scan engine ----------
// Dedupe key set, seeded from history so a restart doesn't resend old FVGs.
const seenFvgKeys = new Set();
(function seedSeenKeys() {
  loadSignals().forEach((s) => {
    if (s.source === 'auto-fvg' && s.fvgKey) seenFvgKeys.add(s.fvgKey);
  });
})();

async function runAutoScan() {
  const settings = loadSettings();
  if (!settings.autoScanEnabled) return { scanned: 0, found: 0 };

  let found = 0;
  for (const pair of settings.pairs) {
    try {
      const candles = await fetchCandles(pair, settings.timeframe, 30);
      const fvg = detectLatestFVG(candles);
      if (!fvg) continue;

      const key = `${pair}_${fvg.time}_${fvg.type}`;
      if (seenFvgKeys.has(key)) continue;
      seenFvgKeys.add(key);
      found++;

      const signal = {
        id: crypto.randomUUID(),
        pair,
        direction: fvg.type === 'bullish' ? 'BUY' : 'SELL',
        entry: '-',
        sl: '-',
        tp1: '',
        tp2: '',
        tp3: '',
        note: `FVG ${fvg.type} zone: ${fvg.gapBottom} – ${fvg.gapTop}`,
        createdAt: Date.now(),
        status: 'pending',
        source: 'auto-fvg',
        fvgKey: key,
        timeframe: settings.timeframe,
      };

      const message = buildFvgMessage(signal, fvg);
      try {
        await sendToTelegram(message);
        signal.status = 'sent';
      } catch (err) {
        signal.status = 'failed';
        signal.error = err.message;
      }

      const signals = loadSignals();
      signals.push(signal);
      saveSignals(signals);
    } catch (err) {
      console.error(`⚠️  FVG scan error for ${pair}:`, err.message);
    }
  }
  return { scanned: settings.pairs.length, found };
}

let scanTimer = null;
function scheduleScan() {
  if (scanTimer) clearInterval(scanTimer);
  const settings = loadSettings();
  if (settings.autoScanEnabled && settings.intervalMinutes > 0) {
    scanTimer = setInterval(() => {
      runAutoScan().catch((err) => console.error('Auto-scan error:', err.message));
    }, settings.intervalMinutes * 60 * 1000);
    console.log(`🔎 Auto FVG scan scheduled every ${settings.intervalMinutes} min for [${settings.pairs.join(', ')}]`);
  } else {
    console.log('⏸  Auto FVG scan is disabled.');
  }
}

// ---------- Routes: auth ----------
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password && password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(24).toString('hex');
    activeSessions.add(token);
    return res.json({ token });
  }
  return res.status(401).json({ error: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ' });
});

app.post('/api/logout', requireAuth, (req, res) => {
  const token = req.headers['x-auth-token'];
  activeSessions.delete(token);
  res.json({ ok: true });
});

// ---------- Routes: signals ----------
app.get('/api/signals', requireAuth, (req, res) => {
  const signals = loadSignals().sort((a, b) => b.createdAt - a.createdAt);
  res.json(signals);
});

app.post('/api/signals', requireAuth, async (req, res) => {
  const { pair, direction, entry, sl, tp1, tp2, tp3, note } = req.body || {};

  if (!pair || !direction || !entry || !sl) {
    return res.status(400).json({ error: 'សូមបំពេញ Pair, Direction, Entry និង Stop Loss' });
  }
  if (!['BUY', 'SELL'].includes(direction)) {
    return res.status(400).json({ error: 'Direction ត្រូវតែជា BUY ឬ SELL' });
  }

  const signal = {
    id: crypto.randomUUID(),
    pair: String(pair).toUpperCase().trim(),
    direction,
    entry: String(entry).trim(),
    sl: String(sl).trim(),
    tp1: tp1 ? String(tp1).trim() : '',
    tp2: tp2 ? String(tp2).trim() : '',
    tp3: tp3 ? String(tp3).trim() : '',
    note: note ? String(note).trim() : '',
    createdAt: Date.now(),
    status: 'pending',
    source: 'manual',
  };

  const message = buildTelegramMessage(signal);

  try {
    await sendToTelegram(message);
    signal.status = 'sent';
  } catch (err) {
    signal.status = 'failed';
    signal.error = err.message;
  }

  const signals = loadSignals();
  signals.push(signal);
  saveSignals(signals);

  if (signal.status === 'failed') {
    return res.status(502).json({ error: signal.error, signal });
  }
  res.json({ ok: true, signal });
});

app.delete('/api/signals/:id', requireAuth, (req, res) => {
  const signals = loadSignals();
  const next = signals.filter((s) => s.id !== req.params.id);
  saveSignals(next);
  res.json({ ok: true });
});

// ---------- Routes: auto FVG scan settings ----------
app.get('/api/settings', requireAuth, (req, res) => {
  res.json(loadSettings());
});

app.post('/api/settings', requireAuth, (req, res) => {
  const { autoScanEnabled, pairs, timeframe, intervalMinutes } = req.body || {};
  const settings = loadSettings();

  if (typeof autoScanEnabled === 'boolean') settings.autoScanEnabled = autoScanEnabled;
  if (Array.isArray(pairs) && pairs.length) {
    settings.pairs = pairs.map((p) => String(p).toUpperCase().trim()).filter(Boolean);
  }
  if (timeframe) settings.timeframe = String(timeframe);
  if (intervalMinutes) settings.intervalMinutes = Math.max(5, parseInt(intervalMinutes, 10));

  saveSettings(settings);
  scheduleScan();
  res.json({ ok: true, settings });
});

app.post('/api/scan-now', requireAuth, async (req, res) => {
  try {
    const result = await runAutoScan();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check (useful for Railway/Render)
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`✅ Signal Bot Dashboard running on port ${PORT}`);
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('⚠️  BOT_TOKEN or CHAT_ID not set — signals will fail to send until configured in .env');
  }
  scheduleScan();
});
