// public/app.v6.js
// Drop-in loader for contests/open -> renders NFL & NBA cards.
// Replace the old file with this exact content and commit to main.

const API_BASE = 'https://thirst-bet-backend.onrender.com';

async function fetchJSON(url) {
  const r = await fetch(url, { credentials: 'omit' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function asTime(s) {
  try { return new Date(s).toLocaleString(); }
  catch { return ''; }
}

function renderLines(target, items) {
  if (!items || !items.length) {
    target.textContent = 'No lines available right now.';
    return;
  }

  const rows = items.slice(0, 8).map(c => {
    const L = c.line || {};
    const a = L.selectionA || 'A';
    const b = L.selectionB || 'B';
    const pa = (L.priceA !== undefined && L.priceA !== null) ? L.priceA : '';
    const pb = (L.priceB !== undefined && L.priceB !== null) ? L.priceB : '';
    return `
      <div class="line-row">
        <div class="teams">${escapeHtml(a)} vs ${escapeHtml(b)}</div>
        <div class="prices">${escapeHtml(String(pa))} · ${escapeHtml(String(pb))}</div>
        <div class="time">${asTime(c.startsAt)}</div>
      </div>
    `;
  }).join('');

  target.innerHTML = rows;
}

async function loadSport(sport) {
  const box = document.querySelector(`[data-sport="${sport}"] .lines`);
  if (!box) return;
  box.textContent = 'Loading...';
  try {
    const res = await fetchJSON(`${API_BASE}/contests/open?sport=${encodeURIComponent(sport)}`);
    renderLines(box, (res && res.data) || []);
  } catch (e) {
    console.error('loadSport error', e);
    box.textContent = 'Failed to load lines.';
  }
}

function bindRefresh() {
  document.querySelectorAll('[data-action="refresh"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.getAttribute('data-sport');
      loadSport(s);
    });
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', () => {
  bindRefresh();
  loadSport('NFL');
  loadSport('NBA');
});
