// public/app.v6.js  (build: 2025-11-15-05)
const API_BASE = 'https://thirst-bet-backend.onrender.com';
const uidKey = 'thirst_uid';
const walletKey = 'thirst_wallet';

// Polyfill for CSS.escape (older Safari)
window.CSS = window.CSS || {};
CSS.escape = CSS.escape || (s => String(s).replace(/("|'|\\|\.|#|\[|\]|:|\(|\)|\s)/g, '\\$1'));

if (!localStorage.getItem(uidKey)) localStorage.setItem(uidKey, 'user-' + Math.random().toString(36).slice(2));
const USER_ID = localStorage.getItem(uidKey);
let CURRENT_WALLET = localStorage.getItem(walletKey) || '';

function fetchJSON(url, opts) {
  opts = opts || {};
  opts.headers = Object.assign({
    'x-user-id': USER_ID,
    'Content-Type': 'application/json'
  }, opts.headers || {});
  return fetch(url, opts).then(async r => {
    if (!r.ok) {
      const t = await r.text().catch(()=> '');
      throw new Error(t || ('HTTP ' + r.status));
    }
    return r.json();
  });
}

// Wallet verify
async function verifyWallet(addr) {
  return fetchJSON(API_BASE + '/wallet/verify', {
    method: 'POST',
    body: JSON.stringify({ address: addr })
  });
}

// Leaderboard weekly
async function loadLeaderboard() {
  const body = document.getElementById('leaderboardBody');
  if (!body) return;
  body.textContent = 'Loading...';
  try {
    const res = await fetchJSON(API_BASE + '/leaderboard/weekly');
    body.innerHTML = (res.leaderboard || []).map(r =>
      '<div>#' + r.rank + ' ' + (r.name || r.userId.slice(0,5)) + ' — $' + Math.round(r.bankroll) + '</div>'
    ).join('') || 'No players yet.';
  } catch {
    body.textContent = 'Error loading leaderboard';
  }
}

// My week (bankroll + bets)
async function refreshMyWeek() {
  if (!CURRENT_WALLET) return;
  const j = await fetchJSON(API_BASE + '/bets/wallet?wallet=' + encodeURIComponent(CURRENT_WALLET));
  const bankrollEl = document.getElementById('bankroll');
  if (bankrollEl) bankrollEl.textContent = 'Bankroll: ' + Math.round(j.remainingBankroll);
  const body = document.getElementById('myBetsBody');
  if (!body) return;
  body.innerHTML = (j.bets||[]).map(b => {
    const pay = (b.payout != null) ? (' · Payout ' + b.payout) : '';
    return `<div>#${b.lineId} · ${b.side} · Stake ${b.stake} · ${b.status}${pay}</div>`;
  }).join('') || '<div class="muted">No bets yet.</div>';
}

// Helpers
function asTime(s){try{return new Date(s).toLocaleString()}catch(_){return''}}
function escapeHtml(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}
function formatPrice(x){if(x===null||x===undefined||x==='')return'';var n=Number(x);if(!isFinite(n))return String(x);return(n>0?'+':'')+Math.round(n)}

// Lines
async function fetchLines(sport){
  try {
    const res = await fetchJSON(`${API_BASE}/contests/open?sport=${encodeURIComponent(sport)}`);
    if (res && Array.isArray(res.data) && res.data.length) return res.data;
  } catch {}
  const r2 = await fetchJSON(`${API_BASE}/odds?sport=${encodeURIComponent(sport)}`);
  return Array.isArray(r2) ? r2 : (r2.data || r2.lines || []);
}

function renderLines(target, items, sport){
  if (!items || !items.length) { target.textContent = 'No lines available right now.'; return; }
  let html = '';
  const max = Math.min(items.length, 50);
  for (let i=0;i<max;i++){
    const c = items[i];
    const L = (c && c.line) || c || {};
    const a = L.selectionA || c?.bestLine?.selectionA || 'A';
    const b = L.selectionB || c?.bestLine?.selectionB || 'B';
    const pa = formatPrice(L.priceA ?? c?.bestLine?.priceA);
    const pb = formatPrice(L.priceB ?? c?.bestLine?.priceB);
    const ts = asTime(c.startsAt || c.start || c.commenceTime);
    const lineId = L.id || L.lineId || c.lineId || c.id;
    const contestId = c.id || c.contestId || L.contestId;

    html += `
      <div class="line-row">
        <div class="teams">${escapeHtml(a)} vs ${escapeHtml(b)}</div>
        <div class="prices">${escapeHtml(pa)} · ${escapeHtml(pb)}</div>
        <div class="time">${ts}</div>
        <div class="stake-row">
          <input type="number" min="1" step="1" placeholder="Stake" class="stake-input" data-line="${escapeHtml(String(lineId||''))}" data-contest="${escapeHtml(String(contestId||''))}">
          <button class="betA" data-line="${escapeHtml(String(lineId||''))}" data-contest="${escapeHtml(String(contestId||''))}">Bet ${escapeHtml(a)}</button>
          <button class="betB" data-line="${escapeHtml(String(lineId||''))}" data-contest="${escapeHtml(String(contestId||''))}">Bet ${escapeHtml(b)}</button>
        </div>
      </div>`;
  }
  target.innerHTML = html;

  target.querySelectorAll('.betA, .betB').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      if (!CURRENT_WALLET) return alert('Verify wallet first');
      const side = btn.classList.contains('betA') ? 'A' : 'B';
      const lineId = btn.getAttribute('data-line');
      const contestId = btn.getAttribute('data-contest');
      const input = target.querySelector(`.stake-input[data-line="${CSS.escape(lineId||'')}"]`);
      const stake = Number(input && input.value ? input.value : '0');
      if (!Number.isInteger(stake) || stake <= 0) return alert('Enter a valid integer stake');

      try {
        await fetchJSON(API_BASE + '/bets/wallet', {
          method: 'POST',
          body: JSON.stringify({ wallet: CURRENT_WALLET, lineId, side, stake, contestId })
        });
        alert(`Bet placed: ${side} for ${stake}`);
        if (input) input.value = '';
        await refreshMyWeek();
      } catch (e) {
        alert((e && e.message) || String(e));
      }
    });
  });
}

function setBusy(sport,busy){
  const btn=document.querySelector('[data-action="refresh"][data-sport="'+sport+'"]');
  if (!btn) return;
  btn.disabled = !!busy;
  btn.textContent = busy ? 'Loading…' : 'Refresh';
}

async function loadSport(sport){
  const box = document.querySelector('[data-sport="'+sport+'"] .lines');
  if (!box) return;
  setBusy(sport,true); box.textContent = 'Loading...';
  try {
    const lines = await fetchLines(sport);
    renderLines(box, lines, sport);
  } catch {
    box.textContent = 'Failed to load lines.';
  } finally {
    setBusy(sport,false);
  }
}

function bindRefresh(){
  document.querySelectorAll('[data-action="refresh"]').forEach(btn=>{
    btn.addEventListener('click', ()=> loadSport(btn.getAttribute('data-sport') || 'NFL'));
  });
}

// Boot
document.addEventListener('DOMContentLoaded', async ()=>{
  const verifyBtn = document.getElementById('verifyBtn');
  const walletInput = document.getElementById('walletAddr');
  const walletStatus = document.getElementById('walletStatus');

  if (CURRENT_WALLET && walletInput) walletInput.value = CURRENT_WALLET;

  if (verifyBtn) {
    verifyBtn.addEventListener('click', async ()=>{
      const addr = (walletInput && walletInput.value ? walletInput.value : '').trim();
      if (!addr) return alert('Enter wallet address');
      verifyBtn.disabled = true;
      walletStatus.textContent = 'Checking balance...';
      try {
        const res = await verifyWallet(addr);
        CURRENT_WALLET = addr;
        localStorage.setItem(walletKey, addr);
        if (res.verified) {
          walletStatus.innerHTML = '✅ Verified! $500 weekly bankroll ready.';
          document.getElementById('leaderboardCard')?.setAttribute('style','display:block;');
          document.getElementById('myBetsCard')?.setAttribute('style','display:block;');
          await Promise.all([loadLeaderboard(), refreshMyWeek()]);
          await Promise.all([loadSport('NFL'), loadSport('NBA')]); // reload with buttons
        } else {
          walletStatus.textContent = '❌ Needs at least ' + res.required + ' $THIRST tokens.';
        }
      } catch (e) {
        walletStatus.textContent = 'Error: ' + (e.message || e);
      } finally {
        verifyBtn.disabled = false;
      }
    });
  }

  bindRefresh();
  loadSport('NFL'); loadSport('NBA');

  document.getElementById('refreshBoard')?.addEventListener('click', loadLeaderboard);
  document.getElementById('refreshMine')?.addEventListener('click', refreshMyWeek);

  if (CURRENT_WALLET) {
    document.getElementById('leaderboardCard')?.setAttribute('style','display:block;');
    document.getElementById('myBetsCard')?.setAttribute('style','display:block;');
    await Promise.all([loadLeaderboard(), refreshMyWeek()]);
  }
});