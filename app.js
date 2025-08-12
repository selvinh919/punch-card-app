/* Wanderlust Lash Bar — Punch Card (light theme) with robust tabs + share */
(function() {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));
  const storeKey = 'punchcard:v1';

  let state = load() || seed();
  save(); // ensure CSS vars/title set on first run

  function save() {
    localStorage.setItem(storeKey, JSON.stringify(state));
    if (state.settings?.brandColor) {
      document.documentElement.style.setProperty('--brand', state.settings.brandColor);
    }
    if (state.settings?.businessName) {
      const el = document.getElementById('brandTitle');
      if (el) el.textContent = state.settings.businessName;
    }
  }
  function load() { try { return JSON.parse(localStorage.getItem(storeKey)); } catch { return null; } }
  function seed() { return { settings: { businessName: 'Wanderlust Lash Bar', brandColor: '#ff6ea6' }, clients: [], activity: [] }; }
  function uid() { return Math.random().toString(36).slice(2, 9); }
  function nowISO() { return new Date().toISOString(); }
  function fmtDate(iso) { const d = new Date(iso); return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
  function escapeHTML(s) { return (s??'').replace(/[&<>\"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  // === Tabs (robust) ===
  function initTabs() {
    const tabs = $$('.tab');
    const panels = $$('.tab-panel');
    function show(tabName) {
      tabs.forEach(b => { b.classList.toggle('active', b.dataset.tab===tabName); b.setAttribute('aria-selected', b.dataset.tab===tabName ? 'true' : 'false'); });
      panels.forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabName));
    }
    tabs.forEach(btn => btn.addEventListener('click', () => show(btn.dataset.tab)));
    // ensure default visible
    show('clients');
  }

  // === Rendering ===
  function render() {
    renderClients($('#searchInput')?.value || '');
    renderActivity();
    const bn = $('#businessName'); if (bn) bn.value = state.settings.businessName || '';
    const bc = $('#brandColor'); if (bc) bc.value = state.settings.brandColor || '#ff6ea6';
    const pin = $('#pinInput'); if (pin) pin.value = '';
    document.documentElement.style.setProperty('--brand', state.settings.brandColor || '#ff6ea6');
    const bt = $('#brandTitle'); if (bt) bt.textContent = state.settings.businessName || 'Wanderlust Lash Bar';
  }

  function renderClients(query) {
    const wrap = $('#clientsList');
    if (!wrap) return;
    wrap.innerHTML = '';
    const q = (query||'').trim().toLowerCase();
    const items = state.clients
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q))
      .sort((a,b)=> (b.lastVisit||'').localeCompare(a.lastVisit||'') || a.name.localeCompare(b.name));

    if (!items.length) { wrap.innerHTML = `<div class="card"><div class="muted">No clients yet. Click “New” to add one.</div></div>`; return; }

    for (const c of items) {
      const pct = Math.min(100, Math.round((c.punches / c.goal) * 100));
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="row" style="justify-content:space-between;gap:8px;">
          <h3>` + escapeHTML(c.name) + `</h3>
          <span class="badge">` + c.punches + `/` + c.goal + ` punches</span>
        </div>
        <div class="muted">` + (c.phone ? escapeHTML(c.phone) + ' · ' : '') + (c.totalRewards||0) + ` rewards</div>
        <div class="progress" aria-label="Progress"><div style="width:` + pct + `%"></div></div>
        <div class="actions">
          <button class="btn primary" data-action="punch" data-id="` + c.id + `">Punch</button>
          <button class="btn" data-action="redeem" data-id="` + c.id + `" ` + (c.punches >= c.goal ? '' : 'disabled') + `>Redeem</button>
          <button class="btn ghost" data-action="history" data-id="` + c.id + `">History</button>
          <button class="btn ghost" data-action="share" data-id="` + c.id + `">Share</button>
          <button class="btn ghost" data-action="edit" data-id="` + c.id + `">Edit</button>
          <button class="btn danger" data-action="delete" data-id="` + c.id + `">Delete</button>
        </div>`;
      wrap.appendChild(card);
    }
  }

  function renderActivity() {
    const feed = $('#activityFeed');
    if (!feed) return;
    feed.innerHTML = '';
    const recent = state.activity.slice(0, 20);
    if (!recent.length) { feed.innerHTML = `<div class="info">No activity yet.</div>`; return; }
    for (const a of recent) {
      const line = document.createElement('div');
      line.className = 'feed-item';
      const verb = a.type === 'punch' ? 'Punched' : a.type === 'redeem' ? 'Redeemed' : a.type;
      line.innerHTML = `<div><strong>` + escapeHTML(a.clientName) + `</strong> — ` + verb + (a.amount ? ' ('+a.amount+')' : '') + `</div><small>` + fmtDate(a.at) + `</small>`;
      feed.appendChild(line);
    }
  }

  // === Actions ===
  function addClient({ name, phone='', goal=10 }) {
    const c = { id: uid(), name: name.trim(), phone: phone.trim(), goal: Math.max(1, Number(goal)||10),
      punches: 0, totalRewards: 0, lastVisit: nowISO(), history: [{ type:'create', amount:0, at: nowISO() }] };
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
    if (!confirm('Delete ' + c.name + '? This cannot be undone.')) return;
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

  // === Share: link + QR (snapshot link) ===
  function shareClient(id) {
    const c = state.clients.find(x=>x.id===id);
    if (!c) return;
    const payload = {
      business: state.settings.businessName || 'Wanderlust Lash Bar',
      brandColor: state.settings.brandColor || '#ff6ea6',
      clientName: c.name,
      punches: c.punches,
      goal: c.goal,
      rewards: c.totalRewards||0,
      ts: Date.now()
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    const url = base + 'progress.html#' + encodeURIComponent(b64);

    const linkEl = document.getElementById('shareLink');
    const openBtn = document.getElementById('openShareBtn');
    const qrImg = document.getElementById('qrImg');
    const dlBtn = document.getElementById('downloadQRBtn');
    if (linkEl) linkEl.value = url;
    if (openBtn) openBtn.href = url;
    const qrURL = 'https://chart.googleapis.com/chart?cht=qr&chs=220x220&chl=' + encodeURIComponent(url);
    if (qrImg) { qrImg.src = qrURL; }
    if (dlBtn) dlBtn.href = qrURL;

    const modal = document.getElementById('shareModal');
    if (modal && typeof modal.showModal === 'function') modal.showModal();

    const copyBtn = document.getElementById('copyLinkBtn');
    if (copyBtn) copyBtn.onclick = function(e){ e.preventDefault(); navigator.clipboard.writeText(url).then(function(){ alert('Link copied'); }); };
    const nativeShare = document.getElementById('nativeShareBtn');
    if (nativeShare) nativeShare.onclick = async function(e){ e.preventDefault(); if (navigator.share) { try { await navigator.share({ title: 'Reward progress — ' + c.name, text: c.name + ' — ' + c.punches + '/' + c.goal + ' punches', url: url }); } catch (err) {} } else { alert('Sharing not supported on this device. Use Copy Link.'); } };
  }

  // === Modals ===
  function openClientModal(existing) {
    const m = document.getElementById('clientModal');
    if (!m) return;
    document.getElementById('clientModalTitle').textContent = existing ? 'Edit Client' : 'New Client';
    document.getElementById('clientId').value   = (existing && existing.id) || '';
    document.getElementById('clientName').value = (existing && existing.name) || '';
    document.getElementById('clientPhone').value= (existing && existing.phone) || '';
    document.getElementById('clientGoal').value = (existing && existing.goal) || 10;
    m.showModal();
  }
  function openPinModal(){
    const m = document.getElementById('pinModal');
    if (!m) return;
    document.getElementById('pinCheck').value = '';
    m.showModal();
  }

  // === Init wiring after DOM ready ===
  window.addEventListener('DOMContentLoaded', function() {
    initTabs();

    const si = document.getElementById('searchInput'); if (si) si.addEventListener('input', function(e){ renderClients(e.target.value); });
    const add1 = document.getElementById('addClientBtn'); if (add1) add1.addEventListener('click', function(){ openClientModal(null); });
    const add2 = document.getElementById('fabAdd'); if (add2) add2.addEventListener('click', function(){ openClientModal(null); });

    const clientForm  = document.getElementById('clientForm');
    if (clientForm) clientForm.addEventListener('submit', function(e) {
      e.preventDefault();
      const id = (document.getElementById('clientId').value||'').trim();
      const payload = {
        name: document.getElementById('clientName').value,
        phone: document.getElementById('clientPhone').value,
        goal: Number(document.getElementById('clientGoal').value)
      };
      if (!payload.name) { alert('Name is required'); return; }
      if (id) updateClient(id, payload); else addClient(payload);
      document.getElementById('clientModal').close();
    });

    const cl = document.getElementById('clientsList');
    if (cl) cl.addEventListener('click', function(e){
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'punch') punch(id, 1);
      if (action === 'redeem') redeem(id);
      if (action === 'edit') { const c = state.clients.find(function(x){return x.id===id;}); openClientModal(c); }
      if (action === 'delete') deleteClient(id);
      if (action === 'history') { const c = state.clients.find(function(x){return x.id===id;}); if (!c) return; const lines = c.history.slice(0,25).map(function(h){ return h.type.toUpperCase() + (h.amount ? ' ('+h.amount+')' : '') + ' — ' + fmtDate(h.at); }); alert(c.name + ' — Last ' + lines.length + ' events:\n\n' + lines.join('\n')); }
      if (action === 'share') shareClient(id);
    });

    const bn = document.getElementById('businessName'); if (bn) bn.addEventListener('change', function(e){ state.settings.businessName = e.target.value.trim() || 'Wanderlust Lash Bar'; save(); render(); });
    const bc = document.getElementById('brandColor'); if (bc) bc.addEventListener('input', function(e){ state.settings.brandColor = e.target.value || '#ff6ea6'; save(); render(); });
    const pin = document.getElementById('pinInput'); if (pin) pin.addEventListener('change', async function(e){ const raw = e.target.value.trim(); if (raw && (raw.length < 4 || raw.length > 8 || !/^[0-9]+$/.test(raw))) { alert('PIN must be 4–8 digits.'); e.target.value = ''; return; } await setPin(raw); e.target.value=''; alert(raw ? 'PIN set for this device.' : 'PIN removed.'); });

    const backup = document.getElementById('backupBtn'); if (backup) backup.addEventListener('click', function(){ const blob = new Blob([JSON.stringify(state, null, 2)], { type:'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); const dt = new Date().toISOString().replace(/[:.]/g,'-'); a.download = 'wanderlust-punchcard-backup-' + dt + '.json'; a.click(); URL.revokeObjectURL(a.href); });
    const restore = document.getElementById('restoreFile'); if (restore) restore.addEventListener('change', async function(e){ const file = e.target.files && e.target.files[0]; if (!file) return; try { const text = await file.text(); const imported = JSON.parse(text); if (!imported || !imported.clients || !imported.settings) throw new Error('Invalid backup'); state = imported; save(); render(); alert('Backup imported!'); } catch(err) { console.error(err); alert('Could not import backup.'); } finally { e.target.value=''; } });

    const demo = document.getElementById('demoBtn'); if (demo) demo.addEventListener('click', function(){ if (!confirm('Load demo clients? This will add sample data to your current list.')) return; const names = [['Ava Johnson','(919) 555-0101',8],['Maya Rivera','(919) 555-0102',10],['Lila Chen','',6],['Noelle Brooks','',10]]; names.forEach(function(n){ addClient({ name:n[0], phone:n[1], goal:n[2] }); }); });
    const reset = document.getElementById('resetBtn'); if (reset) reset.addEventListener('click', function(){ if (!confirm('Erase ALL data on this device?')) return; localStorage.removeItem(storeKey); state = seed(); save(); render(); });

    const lock = document.getElementById('lockBtn'); if (lock) lock.addEventListener('click', function(){ if (!hasPin()) { alert('No PIN set. You can set one in Settings.'); return; } lockUI(true); });

    const pinForm = document.getElementById('pinForm');
    if (pinForm) pinForm.addEventListener('submit', async function(e){ e.preventDefault(); const ok = await verifyPin(document.getElementById('pinCheck').value); if (!ok) { alert('Incorrect PIN'); return; } lockUI(false); document.getElementById('pinModal').close(); });

    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('service-worker.js').catch(console.error); }
    render();
  });

  function hasPin(){ return !!state.settings.pinHash; }
  function sha256(str){ return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function(buf){ return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0');}).join(''); }); }
  async function setPin(raw){ if (!raw) { delete state.settings.pinHash; save(); return; } state.settings.pinHash = await sha256(String(raw)); save(); }
  async function verifyPin(raw){ if (!hasPin()) return true; const h = await sha256(String(raw)); return h === state.settings.pinHash; }
  function lockUI(isLocked){ document.body.dataset.locked = isLocked ? '1' : '0'; if (isLocked) openPinModal(); }

})();
