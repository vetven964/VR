const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const signalForm = document.getElementById('signalForm');
const submitBtn = document.getElementById('submitBtn');
const formMessage = document.getElementById('formMessage');
const historyList = document.getElementById('historyList');
const refreshBtn = document.getElementById('refreshBtn');

let authToken = localStorage.getItem('signalBotToken') || null;
let currentDirection = 'BUY';

// ---------- Auth ----------
function showDashboard() {
  loginScreen.classList.add('hidden');
  dashboardScreen.classList.remove('hidden');
  loadHistory();
  loadSettings();
}

function showLogin() {
  dashboardScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  passwordInput.value = '';
  passwordInput.focus();
}

async function login() {
  const password = passwordInput.value;
  if (!password) return;
  loginBtn.disabled = true;
  loginError.textContent = '';
  try {
    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'ចូលប្រើមិនបាន');
    authToken = data.token;
    localStorage.setItem('signalBotToken', authToken);
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn.addEventListener('click', login);
passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

logoutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/logout', { method: 'POST', headers: { 'x-auth-token': authToken } });
  } catch (e) { /* ignore */ }
  authToken = null;
  localStorage.removeItem('signalBotToken');
  showLogin();
});

// ---------- Direction toggle ----------
document.querySelectorAll('.dir-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dir-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentDirection = btn.dataset.dir;
  });
});

// ---------- Submit signal ----------
signalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMessage.textContent = '';
  formMessage.className = 'form-message';

  const payload = {
    pair: document.getElementById('pair').value,
    direction: currentDirection,
    entry: document.getElementById('entry').value,
    sl: document.getElementById('sl').value,
    tp1: document.getElementById('tp1').value,
    tp2: document.getElementById('tp2').value,
    tp3: document.getElementById('tp3').value,
    note: document.getElementById('note').value,
  };

  submitBtn.disabled = true;
  submitBtn.textContent = '⏳ កំពុងផ្ញើ...';

  try {
    const resp = await fetch('/api/signals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();

    if (resp.status === 401) { showLogin(); return; }
    if (!resp.ok) throw new Error(data.error || 'ផ្ញើ Signal មិនបាន');

    formMessage.textContent = '✅ បានផ្ញើ Signal ទៅ Telegram ដោយជោគជ័យ';
    formMessage.classList.add('success');
    signalForm.reset();
    document.querySelectorAll('.dir-btn').forEach((b) => b.classList.remove('active'));
    document.querySelector('.dir-btn.buy').classList.add('active');
    currentDirection = 'BUY';
    loadHistory();
  } catch (err) {
    formMessage.textContent = '❌ ' + err.message;
    formMessage.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '🚀 ផ្ញើ Signal ទៅ Telegram';
  }
});

// ---------- History ----------
async function loadHistory() {
  try {
    const resp = await fetch('/api/signals', { headers: { 'x-auth-token': authToken } });
    if (resp.status === 401) { showLogin(); return; }
    const signals = await resp.json();
    renderHistory(signals);
  } catch (err) {
    historyList.innerHTML = `<p class="empty-state">មិនអាចផ្ទុកប្រវត្តិបានទេ</p>`;
  }
}

function renderHistory(signals) {
  if (!signals.length) {
    historyList.innerHTML = `<p class="empty-state">មិនទាន់មាន Signal ទេ</p>`;
    return;
  }

  historyList.innerHTML = signals.map((s) => {
    const dirClass = s.direction === 'BUY' ? 'buy' : 'sell';
    const statusClass = s.status === 'sent' ? 'sent' : 'failed';
    const statusText = s.status === 'sent' ? 'បានផ្ញើ' : 'បរាជ័យ';
    const tps = [s.tp1, s.tp2, s.tp3].filter(Boolean).join(' / ');
    const time = new Date(s.createdAt).toLocaleString('en-GB', { timeZone: 'Asia/Phnom_Penh' });

    return `
      <div class="history-item" data-id="${s.id}">
        <div class="hi-left">
          <div class="hi-pair-row">
            <span>${escapeHtml(s.pair)}</span>
            <span class="hi-dir ${dirClass}">${s.direction}</span>
            ${s.source === 'auto-fvg' ? '<span class="source-tag">AUTO FVG</span>' : ''}
          </div>
          <div class="hi-details">
            Entry ${escapeHtml(s.entry)} · SL ${escapeHtml(s.sl)}${tps ? ' · TP ' + escapeHtml(tps) : ''}
          </div>
          <div class="hi-time">${time}</div>
        </div>
        <div class="hi-right">
          <span class="hi-status ${statusClass}">${statusText}</span>
          <button class="hi-delete" data-id="${s.id}" title="លុប">✕</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.hi-delete').forEach((btn) => {
    btn.addEventListener('click', () => deleteSignal(btn.dataset.id));
  });
}

async function deleteSignal(id) {
  try {
    await fetch(`/api/signals/${id}`, { method: 'DELETE', headers: { 'x-auth-token': authToken } });
    loadHistory();
  } catch (err) { /* ignore */ }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

refreshBtn.addEventListener('click', loadHistory);

// ---------- Auto-Scan FVG settings ----------
const autoScanToggle = document.getElementById('autoScanToggle');
const fvgPairs = document.getElementById('fvgPairs');
const fvgDataSource = document.getElementById('fvgDataSource');
const fvgTimeframe = document.getElementById('fvgTimeframe');
const fvgInterval = document.getElementById('fvgInterval');
const fvgMinGap = document.getElementById('fvgMinGap');
const fvgCooldown = document.getElementById('fvgCooldown');
const fvgSlBuffer = document.getElementById('fvgSlBuffer');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const scanNowBtn = document.getElementById('scanNowBtn');
const fvgMessage = document.getElementById('fvgMessage');

async function loadSettings() {
  try {
    const resp = await fetch('/api/settings', { headers: { 'x-auth-token': authToken } });
    if (resp.status === 401) { showLogin(); return; }
    const settings = await resp.json();
    autoScanToggle.checked = !!settings.autoScanEnabled;
    fvgPairs.value = (settings.pairs || []).join(', ');
    fvgDataSource.value = settings.dataSource || 'twelvedata';
    fvgTimeframe.value = settings.timeframe || '15min';
    fvgInterval.value = settings.intervalMinutes || 15;
    fvgMinGap.value = settings.minGapPercent ?? 0.1;
    fvgCooldown.value = settings.cooldownMinutes ?? 60;
    fvgSlBuffer.value = settings.slBufferPercent ?? 0.15;
  } catch (err) { /* ignore */ }
}

async function saveSettings() {
  fvgMessage.textContent = '';
  fvgMessage.className = 'form-message';
  saveSettingsBtn.disabled = true;

  const pairs = fvgPairs.value.split(',').map((p) => p.trim()).filter(Boolean);
  const payload = {
    autoScanEnabled: autoScanToggle.checked,
    pairs,
    dataSource: fvgDataSource.value,
    timeframe: fvgTimeframe.value,
    intervalMinutes: parseInt(fvgInterval.value, 10) || 15,
    minGapPercent: parseFloat(fvgMinGap.value),
    cooldownMinutes: parseInt(fvgCooldown.value, 10),
    slBufferPercent: parseFloat(fvgSlBuffer.value),
  };

  try {
    const resp = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': authToken },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'រក្សាទុកមិនបាន');
    fvgMessage.textContent = '✅ បានរក្សាទុកការកំណត់';
    fvgMessage.classList.add('success');
  } catch (err) {
    fvgMessage.textContent = '❌ ' + err.message;
    fvgMessage.classList.add('error');
  } finally {
    saveSettingsBtn.disabled = false;
  }
}

async function scanNow() {
  fvgMessage.textContent = '';
  fvgMessage.className = 'form-message';
  scanNowBtn.disabled = true;
  scanNowBtn.textContent = '⏳ កំពុងស្កេន...';

  try {
    const resp = await fetch('/api/scan-now', { method: 'POST', headers: { 'x-auth-token': authToken } });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'ស្កេនមិនបាន');
    fvgMessage.textContent = `✅ ស្កេនរួច — រកឃើញ FVG ថ្មី ${data.found} (រំលង ${data.skipped || 0}, ក្នុងចំណោម ${data.scanned} pair)`;
    fvgMessage.classList.add('success');
    loadHistory();
  } catch (err) {
    fvgMessage.textContent = '❌ ' + err.message;
    fvgMessage.classList.add('error');
  } finally {
    scanNowBtn.disabled = false;
    scanNowBtn.textContent = '⚡ ស្កេនឥឡូវនេះ';
  }
}

saveSettingsBtn.addEventListener('click', saveSettings);
scanNowBtn.addEventListener('click', scanNow);

// ---------- Init ----------
if (authToken) {
  showDashboard();
} else {
  showLogin();
}
