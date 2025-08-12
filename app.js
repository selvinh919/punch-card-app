/* Punch Card Rewards — local-first PWA
   Data shape:
   {
     settings: { businessName, brandColor, pinHash? },
     clients: [
       {
         id, name, phone, goal, punches, totalRewards, lastVisit,
         history: [{ type: 'punch'|'redeem'|'edit'|'create', amount, at }]
       }
     ],
     activity: [ { id, clientId, clientName, type, amount, at } ] // newest first
   }
*/
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const storeKey = 'punchcard:v1';

let state = load() || seed();

function save() {
  localStorage.setItem(storeKey, JSON.stringify(state));
  // live update brand color/title
  if (state.settings?.brandColor) {
    document.documentElement.style.setProperty('--brand', state.settings.brandColor);
  }
  if (state.settings?.businessName) {
    $('#brandTitle').textContent = state.settings.businessName;
  }
}

function load() {
  try { return JSON.parse(localStorage.getItem(storeKey)); } catch { return null; }
}

function seed() {
  const s = {
    settings: { businessName: 'Punch Card', brandColor: '#7c3aed' },
    clients: [],
    activity: []
  };
  return s;
}

function uid() { return Math.random().toString(36).slice(2, 9); }
function nowISO() { return new Date().toISOString(); }
function fmtDate(iso) {
  const d = new Date(iso);
  const opts = { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return d.toLocaleString(undefined, opts);
}

// --- Rendering ---
function render() {
  renderClients($('#searchInput').value || '');
  renderActivity();
  // Settings bind
  $('#businessName').value = state.settings.businessName || '';
  $('#brandColor').value = state.settings.brandColor || '#7c3aed';
  $('#pinInput').value = ''; // never show current PIN
  document.documentElement.style.setProperty('--brand', state.settings.brandColor || '#7c3aed');
  $('#brandTitle').textContent = state.settings.businessName || 'Punch Card';
}
function renderClients(query) {
  const wrap = $('#clientsList');
  wrap.innerHTML = '';
  const q = query.trim().toLowerCase();
  const items = state.clients
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q))
    .sort((a,b)=> (b.lastVisit||'').localeCompare(a.lastVisit||'') || a.name.localeCompare(b.name));

  if (!items.length) {
    wrap.innerHTML = `<div class="card"><div class="muted">No clients yet. Click “New” to add one.</div></div>`;
    return;
  }

  for (const c of items) {
    const pct = Math.min(100, Math.round((c.punches / c.goal) * 100));
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;gap:8px;">
        <h3>${escapeHTML(c.name)}</h3>
        <span class="badge">${c.punches}/${c.goal} punches</span>
      </div>
      <div class="muted">${c.phone ? escapeHTML(c.phone) + ' · ' : ''}${c.totalRewards||0} rewards</div>
      <div class="progress" aria-label="Progress"><div style="width:${pct}%"></div></div>
      <div class="actions">
        <button class="btn primary" data-action="punch" data-id="${c.id}">Punch</button>
        <button class="btn" data-action="redeem" data-id="${c.id}" ${c.punches >= c.goal ? '' : 'disabled'}>Redeem</button>
        <button class="btn ghost" data-action="history" data-id="${c.id}">History</button>
        <button class="btn ghost" data-action="edit" data-id="${c.id}">Edit</button>
        <button class="btn danger" data-action="delete" data-id="${c.id}">Delete</button>
      </div>
    `;
    wrap.appendChild(card);
  }
}
function renderActivity() {
  const feed = $('#activityFeed');
  feed.innerHTML = '';
  const recent = state.activity.slice(0, 20);
  if (!recent.length) {
    feed.innerHTML = `<div class="info">No activity yet.</div>`;
    return;
  }
  for (const a of recent) {
    const line = document.createElement('div');
    line.className = 'feed-item';
    const verb = a.type === 'punch' ? 'Punched' : a.type === 'redeem' ? 'Redeemed' : a.type;
    line.innerHTML = `
      <div><strong>${escapeHTML(a.clientName)}</strong> — ${verb}${a.amount ? ` (${a.amount})` : ''}</div>
      <small>${fmtDate(a.at)}</small>
    `;
    feed.appendChild(line);
  }
}

// --- Actions ---
function addClient({ name, phone='', goal=10 }) {
  const c = {
    id: uid(), name: name.trim(), phone: phone.trim(), goal: Math.max(1, Number(goal)||10),
    punches: 0, totalRewards: 0, lastVisit: nowISO(),
    history: [{ type:'create', amount:0, at: nowISO() }]
  };
  state.clients.push(c);
  state.activity.unshift({ id: uid(), clientId: c.id, clientName: c.name, type:'create', amount:0, at: nowISO() });
  save(); render();
}

function updateClient(id, fields) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  Object.assign(c, fields);
  c.history.unshift({ type:'edit', amount:0, at: nowISO() });
  save(); render();
}

function deleteClient(id) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return;
  state.clients = state.clients.filter(x => x.id !== id);
  save(); render();
}

function punch(id, amount=1) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  c.punches = Math.max(0, c.punches + amount);
  c.lastVisit = nowISO();
  c.history.unshift({ type:'punch', amount, at: nowISO() });
  state.activity.unshift({ id: uid(), clientId: id, clientName: c.name, type:'punch', amount, at: nowISO() });
  save(); render();
}

function redeem(id) {
  const c = state.clients.find(x => x.id === id);
  if (!c) return;
  if (c.punches < c.goal) return;
  c.punches = 0;
  c.totalRewards = (c.totalRewards||0) + 1;
  c.lastVisit = nowISO();
  c.history.unshift({ type:'redeem', amount:1, at: nowISO() });
  state.activity.unshift({ id: uid(), clientId: id, clientName: c.name, type:'redeem', amount:1, at: nowISO() });
  save(); render();
}

// --- Utilities ---
function escapeHTML(s){return (s??'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

// --- PIN lock ---
function hasPin(){ return !!state.settings.pinHash; }
function sha256(str){
  // tiny hash (not crypto-strong) using Web Crypto
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(buf=>{
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  });
}
async function setPin(raw){
  if (!raw) { delete state.settings.pinHash; save(); return; }
  state.settings.pinHash = await sha256(String(raw));
  save();
}
async function verifyPin(raw){
  if (!hasPin()) return true;
  const h = await sha256(String(raw));
  return h === state.settings.pinHash;
}
function lockUI(isLocked){
  document.body.dataset.locked = isLocked ? '1' : '0';
  // Simple blur/lock overlay could be added; we’ll reuse the PIN modal.
  if (isLocked) openPinModal();
}

// --- Modals ---
const clientModal = $('#clientModal');
const clientForm  = $('#clientForm');
const pinModal    = $('#pinModal');
const pinForm     = $('#pinForm');

function openClientModal(existing=null){
  $('#clientModalTitle').textContent = existing ? 'Edit Client' : 'New Client';
  $('#clientId').value   = existing?.id || '';
  $('#clientName').value = existing?.name || '';
  $('#clientPhone').value= existing?.phone || '';
  $('#clientGoal').value = existing?.goal || 10;
  clientModal.showModal();
}
function openPinModal(){
  $('#pinCheck').value = '';
  pinModal.showModal();
}

// --- Event wiring ---
window.addEventListener('DOMContentLoaded', () => {
  // Tabs
  $$('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      $$('.tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $$('.tab-panel').forEach(p=>p.classList.remove('active'));
      $('#tab-'+tab).classList.add('active');
    });
  });

  // Search
  $('#searchInput').addEventListener('input', e => renderClients(e.target.value));

  // Add Client buttons
  $('#addClientBtn').addEventListener('click', ()=>openClientModal());
  $('#fabAdd').addEventListener('click', ()=>openClientModal());

  // Client form save
  clientForm.addEventListener('submit', e => {
    e.preventDefault();
    const id = $('#clientId').value.trim();
    const payload = {
      name: $('#clientName').value,
      phone: $('#clientPhone').value,
      goal: Number($('#clientGoal').value)
    };
    if (!payload.name) return alert('Name is required');
    if (id) updateClient(id, payload);
    else addClient(payload);
    clientModal.close();
  });

  // Client actions (event delegation)
  $('#clientsList').addEventListener('click', e=>{
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === 'punch') punch(id, 1);
    if (action === 'redeem') redeem(id);
    if (action === 'edit') {
      const c = state.clients.find(x=>x.id===id);
      openClientModal(c);
    }
    if (action === 'delete') deleteClient(id);
    if (action === 'history') {
      const c = state.clients.find(x=>x.id===id);
      if (!c) return;
      const lines = c.history.slice(0,25).map(h => `${h.type.toUpperCase()} ${h.amount?`(${h.amount})`:''} — ${fmtDate(h.at)}`);
      alert(`${c.name} — Last ${lines.length} events:\n\n` + lines.join('\n'));
    }
  });

  // Settings form
  $('#businessName').addEventListener('change', e=>{
    state.settings.businessName = e.target.value.trim() || 'Punch Card';
    save(); render();
  });
  $('#brandColor').addEventListener('input', e=>{
    state.settings.brandColor = e.target.value || '#7c3aed';
    save(); render();
  });
  $('#pinInput').addEventListener('change', async e=>{
    const raw = e.target.value.trim();
    if (raw && (raw.length < 4 || raw.length > 8 || !/^[0-9]+$/.test(raw))) {
      alert('PIN must be 4–8 digits.');
      e.target.value = '';
      return;
    }
    await setPin(raw);
    e.target.value = '';
    alert(raw ? 'PIN set for this device.' : 'PIN removed.');
  });

  // Backup / restore
  $('#backupBtn').addEventListener('click', ()=>{
    const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const dt = new Date().toISOString().replace(/[:.]/g,'-');
    a.download = `punchcard-backup-${dt}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#restoreFile').addEventListener('change', async e=>{
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = JSON.parse(text);
      if (!imported || !imported.clients || !imported.settings) throw new Error('Invalid backup');
      state = imported;
      save(); render();
      alert('Backup imported!');
    } catch(err){
      console.error(err);
      alert('Could not import backup.');
    } finally {
      e.target.value = '';
    }
  });

  // Demo & reset
  $('#demoBtn').addEventListener('click', ()=>{
    if (!confirm('Load demo clients? This will add sample data to your current list.')) return;
    const names = [
      ['Maria Lopez','(919) 555-0101',8],
      ['Jasmine Tran','(919) 555-0102',10],
      ['Ava Johnson','',6],
      ['Sophia Martinez','',10]
    ];
    for (const [n,p,g] of names) addClient({ name:n, phone:p, goal:g });
  });
  $('#resetBtn').addEventListener('click', ()=>{
    if (!confirm('Erase ALL data on this device?')) return;
    localStorage.removeItem(storeKey);
    state = seed();
    save(); render();
  });

  // Lock button
  $('#lockBtn').addEventListener('click', ()=>{
    if (!hasPin()) { alert('No PIN set. You can set one in Settings.'); return; }
    lockUI(true);
  });

  // PIN modal
  pinForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const ok = await verifyPin($('#pinCheck').value);
    if (!ok) { alert('Incorrect PIN'); return; }
    lockUI(false);
    pinModal.close();
  });

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(console.error);
  }

  render();

  // If returning with a set PIN, keep unlocked until user locks; on reload we don’t auto-lock.
});

// --- PWA install prompt (optional) ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  // You could show an “Install App” button here if you like
});

// Helpers for console use
window.__punch = { state: ()=>state, save, render, punch, redeem };

// --- Accessibility niceties ---
document.addEventListener('keydown', (e)=>{
  // quick punch: Enter on a focused card punches
  if (e.key === 'Enter') {
    const active = document.activeElement;
    if (active && active.classList.contains('card')) {
      const id = active.querySelector('button[data-action="punch"]')?.dataset.id;
      if (id) punch(id,1);
    }
  }
});
