/* Wanderlust Lash Bar — Punch Card v2.4 (reward hints + rules sync) */
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const storeKey = 'punchcard:v2_4';

function debounce(fn, delay=1500){ let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), delay); }; }

let state = load() || seed();

function load(){ try{ return JSON.parse(localStorage.getItem(storeKey)); } catch { return null; } }
function save(){
  localStorage.setItem(storeKey, JSON.stringify(state));
  try {
    document.documentElement.style.setProperty('--brand', state.settings?.brandColor || '#ff6ea6');
    $('#brandTitle').textContent = state.settings?.businessName || 'Wanderlust Lash Bar';
  } catch {}
  debouncedCloudBackup();
}

function uid(){ return Math.random().toString(36).slice(2, 10); }
function slug(){ return Math.random().toString(36).slice(2, 14); }
function nowISO(){ return new Date().toISOString(); }
function fmtDate(iso){ const d = new Date(iso); return d.toLocaleString(undefined, {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}); }
function escapeHTML(s){ return (s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

function seed(){
  return {
    settings:{ businessName:'Wanderlust Lash Bar', brandColor:'#ff6ea6', ownerKey: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2), rewardsRules: [] },
    clients:[], activity:[]
  };
}

function render(){
  renderClients($('#searchInput')?.value || '');
  renderRules();
  if ($('#businessName')) $('#businessName').value = state.settings.businessName || '';
  if ($('#brandColor')) $('#brandColor').value = state.settings.brandColor || '#ff6ea6';
}

// ---- Rewards helpers ----
function nextRewardHintFor(client){
  const rules = (state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  const current = client.punches||0;
  // find first rule with punches > current
  const upcoming = rules.find(r => r.punches > current);
  if (upcoming){
    const remaining = upcoming.punches - current;
    return `${remaining} more ${remaining===1?'punch':'punches'} until ${upcoming.label}`;
  }
  // otherwise, show highest achieved rule
  const achieved = rules.filter(r => r.punches <= current).sort((a,b)=>b.punches-a.punches)[0];
  if (achieved){
    return `Eligible: ${achieved.label}`;
  }
  return '';
}

// ---- Clients (clean list) ----
function renderClients(query){
  const wrap = $('#clientsList'); if (!wrap) return;
  wrap.innerHTML = '';
  const q = (query||'').trim().toLowerCase();
  const items = state.clients
    .filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone||'').toLowerCase().includes(q))
    .sort((a,b)=> (b.lastVisit||'').localeCompare(a.lastVisit||'') || a.name.localeCompare(b.name));
  if (!items.length){ wrap.innerHTML = `<div class="card"><div class="muted">No clients yet. Tap “New”.</div></div>`; return; }
  for (const c of items){
    const pct = c.goal ? Math.min(100, Math.round((c.punches / c.goal) * 100)) : 0;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = c.id;
    const hint = nextRewardHintFor(c);
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;gap:8px;">
        <h3>${escapeHTML(c.name)}</h3>
        <span class="badge">${c.punches}/${c.goal}</span>
      </div>
      <div class="muted">${c.phone ? escapeHTML(c.phone)+' · ' : ''}${c.totalRewards||0} rewards</div>
      <div class="progress" aria-label="Progress"><div style="width:${pct}%"></div></div>
      ${hint ? `<div class="muted" style="margin-top:4px">${escapeHTML(hint)}</div>` : ''}
    `;
    wrap.appendChild(card);
  }
}

// ---- Client detail dialog ----
let currentDetailId = null;
function openDetail(id){
  const c = state.clients.find(x=>x.id===id); if (!c) return;
  currentDetailId = id;
  $('#detailTitle').textContent = c.name;
  $('#detailInfo').textContent = (c.phone?c.phone+' · ':'') + `${c.punches}/${c.goal} punches`;
  const pct = c.goal ? Math.min(100, Math.round((c.punches / c.goal) * 100)) : 0;
  $('#detailProgress').style.width = pct + '%';
  $('#detailRedeemBtn').disabled = !(c.punches >= c.goal);
  const hint = nextRewardHintFor(c);
  $('#detailHint').textContent = hint || '';
  const feed = $('#detailHistory'); feed.innerHTML = '';
  for (const h of c.history.slice(0,50)){
    const row = document.createElement('div'); row.className='feed-item';
    const verb = h.type === 'punch' ? 'Punched' : h.type === 'redeem' ? 'Redeemed' : h.type;
    row.innerHTML = `<div>${verb}${h.amount?` (${h.amount})`:''}</div><small>${fmtDate(h.at)}</small>`;
    feed.appendChild(row);
  }
  $('#detailModal').showModal();
}

function detailPunch(){ if (!currentDetailId) return; punch(currentDetailId, 1); openDetail(currentDetailId); }
function detailRedeem(){ if (!currentDetailId) return; redeem(currentDetailId); openDetail(currentDetailId); }
function detailShare(){ if (!currentDetailId) return; openShareForClient(currentDetailId); }
function detailEdit(){ if (!currentDetailId) return; const c = state.clients.find(x=>x.id===currentDetailId); openClientModal(c); }

// ---- Rewards rules (CRUD + cloud sync) ----
function addRule(punches, label){
  state.settings.rewardsRules = state.settings.rewardsRules || [];
  const r = { id: uid(), owner_key: state.settings.ownerKey, punches: Math.max(1, Number(punches)||1), label: String(label||'Reward') };
  state.settings.rewardsRules.push(r);
  save(); renderRules();
  supabaseUpsertRule(r).catch(console.warn);
}
function deleteRule(id){
  state.settings.rewardsRules = (state.settings.rewardsRules||[]).filter(r=>r.id!==id);
  save(); renderRules();
  supabaseDeleteRule(id).catch(console.warn);
}
function renderRules(){
  const box = $('#rulesList'); if (!box) return;
  box.innerHTML = '';
  const list = (state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  if (!list.length){ box.innerHTML = `<div class="info">No rules yet. Add one above (e.g., 3 punches → 15% off).</div>`; return; }
  for (const r of list){
    const el = document.createElement('div'); el.className='rule';
    el.innerHTML = `<div><strong>${r.punches} punches</strong> → ${escapeHTML(r.label)}</div>
      <div class="row"><button class="btn" data-rule-del="${r.id}">Delete</button></div>`;
    box.appendChild(el);
  }
}

// ---- Data ops ----
function newClientPayload({name, phone='', goal=10}){
  return { id: uid(), name: name.trim(), phone: phone.trim(), goal: Math.max(1, Number(goal)||10), punches:0, totalRewards:0, lastVisit:nowISO(), public_slug: slug(), history:[{type:'create', amount:0, at: nowISO()}] };
}
function addClient({name, phone, goal}){ const c = newClientPayload({name, phone, goal}); state.clients.push(c); state.activity.unshift({id: uid(), clientId: c.id, clientName: c.name, type:'create', amount:0, at: nowISO()}); save(); render(); syncClient(c).catch(console.warn); }
function updateClient(id, fields){ const c = state.clients.find(x=>x.id===id); if (!c) return; Object.assign(c, fields); c.history.unshift({type:'edit', amount:0, at: nowISO()}); save(); render(); syncClient(c).catch(console.warn); }
function deleteClient(id){ const c = state.clients.find(x=>x.id===id); if (!c) return; if (!confirm(`Delete ${c.name}? This cannot be undone.`)) return; state.clients = state.clients.filter(x=>x.id!==id); save(); render(); deleteRemoteClient(c).catch(console.warn); }
function punch(id, amount=1){ const c = state.clients.find(x=>x.id===id); if (!c) return; c.punches = Math.max(0, c.punches + amount); c.lastVisit = nowISO(); c.history.unshift({type:'punch', amount, at: nowISO()}); state.activity.unshift({id: uid(), clientId: id, clientName: c.name, type:'punch', amount, at: nowISO()}); save(); render(); syncClient(c).catch(console.warn); }
function redeem(id){ const c = state.clients.find(x=>x.id===id); if (!c) return; if (c.punches < c.goal) return; c.punches = 0; c.totalRewards = (c.totalRewards||0)+1; c.lastVisit = nowISO(); c.history.unshift({type:'redeem', amount:1, at: nowISO()}); state.activity.unshift({id: uid(), clientId: id, clientName: c.name, type:'redeem', amount:1, at: nowISO()}); save(); render(); syncClient(c).catch(console.warn); }

// ---- Share / QR ----
const shareModal = $('#shareModal'); let currentShareLink = '';
function openShareForClient(id){
  const c = state.clients.find(x=>x.id===id); if (!c) return;
  const link = makePublicLink(c); currentShareLink = link;
  $('#shareLinkInput').value = link;
  const qrArea = $('#qrArea'); qrArea.innerHTML=''; new QRCode(qrArea, { text: link, width:192, height:192 });
  shareModal.showModal();
}
function makePublicLink(c){ const u = new URL('share.html', location.href); u.searchParams.set('c', c.public_slug); return u.toString(); }

// ---- Tabs (main + subtabs) ----
function activateTab(name){
  $$('.tab').forEach(b=>{ const on = b.dataset.tab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  $$('.tab-panel').forEach(p=>p.classList.remove('active'));
  const target = document.getElementById('tab-'+name); if (target) target.classList.add('active');
}
function activateSubtab(name){
  $$('.subtab').forEach(b=>{ const on = b.dataset.subtab===name; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); });
  $$('.subpanel').forEach(p=>p.classList.remove('active'));
  const target = document.getElementById('sub-'+name); if (target) target.classList.add('active');
}

// ---- PIN ----
function hasPin(){ return !!state.settings.pinHash; }
async function sha256(str){ const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(str))); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
async function setPin(raw){ if (!raw){ delete state.settings.pinHash; save(); return; } state.settings.pinHash = await sha256(raw); save(); }
async function verifyPin(raw){ if (!hasPin()) return true; return (await sha256(raw)) === state.settings.pinHash; }
function lockUI(isLocked){ document.body.dataset.locked = isLocked ? '1':'0'; /* could implement modal */ }
const clientModal = $('#clientModal'); const clientForm = $('#clientForm');
const detailModal = $('#detailModal');

function openClientModal(existing=null){
  $('#clientModalTitle').textContent = existing ? 'Edit Client' : 'New Client';
  $('#clientId').value   = existing?.id || '';
  $('#clientName').value = existing?.name || '';
  $('#clientPhone').value= existing?.phone || '';
  $('#clientGoal').value = existing?.goal || 10;
  clientModal.showModal();
}

// ---- Supabase REST helpers ----
function headers(){ return { 'apikey':window.PUNCH_CONFIG.SUPABASE_ANON_KEY, 'Authorization':`Bearer ${window.PUNCH_CONFIG.SUPABASE_ANON_KEY}`, 'Content-Type':'application/json' }; }

async function supabaseUpsertClient(c){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients`;
  const row = { id:c.id, owner_key: state.settings.ownerKey, name:c.name, phone:c.phone||null, goal:c.goal, punches:c.punches, total_rewards:c.totalRewards||0, last_visit:c.lastVisit, public_slug:c.public_slug, updated_at:new Date().toISOString() };
  const res = await fetch(url, { method:'POST', headers: headers(), body: JSON.stringify([row]) });
  if (!res.ok) throw new Error('Supabase upsert failed: '+res.status);
}
async function supabaseDeleteClient(c){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(c.id)}`;
  const res = await fetch(url, { method:'DELETE', headers: headers() });
  if (!res.ok) throw new Error('Supabase delete failed: '+res.status);
}
function syncClient(c){ return supabaseUpsertClient(c); }
function deleteRemoteClient(c){ return supabaseDeleteClient(c); }

// Rules sync
async function supabaseUpsertRule(r){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules`;
  const row = { id:r.id, owner_key: state.settings.ownerKey, punches:r.punches, label:r.label, updated_at:new Date().toISOString() };
  const res = await fetch(url, { method:'POST', headers: headers(), body: JSON.stringify([row]) });
  if (!res.ok) throw new Error('Supabase upsert rule failed: '+res.status);
}
async function supabaseDeleteRule(id){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, { method:'DELETE', headers: headers() });
  if (!res.ok) throw new Error('Supabase delete rule failed: '+res.status);
}
async function loadRulesFromCloud(){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules?select=id,punches,label&owner_key=eq.${encodeURIComponent(state.settings.ownerKey)}&order=punches.asc`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return;
  const rows = await res.json();
  if (Array.isArray(rows)){ state.settings.rewardsRules = rows; save(); renderRules(); renderClients($('#searchInput')?.value||''); }
}

// ---- Supabase: full-state backup ----
const setCloudStatus = (cls, emoji)=>{ const el=$('#cloudStatus'); if(!el) return; el.className='cloud-status '+cls; el.textContent=emoji; };
async function backupToCloud(){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL){ setCloudStatus('cloud-warn','⚠️'); return; }
  setCloudStatus('', '⏳');
  const payload = structuredClone(state);
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/states`;
  const row = { owner_key: state.settings.ownerKey, payload, updated_at: new Date().toISOString() };
  const res = await fetch(url, { method:'POST', headers: headers(), body: JSON.stringify([row]) });
  if (res.ok){ setCloudStatus('cloud-ok','✅'); } else { setCloudStatus('cloud-bad','❌'); console.warn('Cloud backup failed', await res.text()); }
}
const debouncedCloudBackup = debounce(backupToCloud, 1800);

async function restoreFromCloud(){
  if (!window.PUNCH_CONFIG?.SUPABASE_URL) return alert('Cloud not configured');
  const url = `${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/states?select=payload&owner_key=eq.${encodeURIComponent(state.settings.ownerKey)}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) return alert('Cloud restore failed');
  const rows = await res.json();
  if (!rows.length) return alert('No cloud backup found for this device.');
  const incoming = rows[0].payload;
  if (incoming?.settings) incoming.settings.ownerKey = state.settings.ownerKey;
  state = incoming;
  save(); render();
  alert('Cloud restore complete!');
}

// ---- Events ----
window.addEventListener('DOMContentLoaded', ()=>{
  document.body.addEventListener('click', (e)=>{
    const tabBtn = e.target.closest('.tab'); if (tabBtn){ activateTab(tabBtn.dataset.tab); return; }
    const subtabBtn = e.target.closest('.subtab'); if (subtabBtn){ activateSubtab(subtabBtn.dataset.subtab); return; }
  });
  $('#clientsList')?.addEventListener('click', (e)=>{
    const card = e.target.closest('.card'); if (!card) return;
    openDetail(card.dataset.id);
  });
  $('#detailPunchBtn')?.addEventListener('click', detailPunch);
  $('#detailRedeemBtn')?.addEventListener('click', detailRedeem);
  $('#detailShareBtn')?.addEventListener('click', detailShare);
  $('#detailEditBtn')?.addEventListener('click', detailEdit);
  $('#detailCloseBtn')?.addEventListener('click', ()=> $('#detailModal').close());

  $('#searchInput')?.addEventListener('input', e=>renderClients(e.target.value));
  $('#addClientBtn')?.addEventListener('click', ()=>openClientModal());
  $('#fabAdd')?.addEventListener('click', ()=>openClientModal());

  const clientForm = $('#clientForm');
  clientForm?.addEventListener('submit', (e)=>{ e.preventDefault(); const id=$('#clientId').value.trim(); const payload={ name:$('#clientName').value, phone:$('#clientPhone').value, goal:Number($('#clientGoal').value) }; if(!payload.name) return alert('Name is required'); if(id) updateClient(id,payload); else addClient(payload); clientModal.close(); });

  // Rewards form
  $('#addRuleBtn')?.addEventListener('click', ()=>{
    const punches = Number($('#rulePunches').value);
    const label = $('#ruleLabel').value.trim();
    if (!label) return alert('Please enter a reward label');
    addRule(punches, label);
    $('#ruleLabel').value='';
  });
  document.body.addEventListener('click', (e)=>{
    const del = e.target.closest('[data-rule-del]'); if (del){ deleteRule(del.getAttribute('data-rule-del')); }
  });

  // Settings
  $('#businessName')?.addEventListener('change', e=>{ state.settings.businessName = e.target.value.trim() || 'Wanderlust Lash Bar'; save(); render(); });
  $('#brandColor')?.addEventListener('input', e=>{ state.settings.brandColor = e.target.value || '#ff6ea6'; save(); render(); });
  $('#pinInput')?.addEventListener('change', async e=>{ const raw=e.target.value.trim(); if(raw && (raw.length<4 || raw.length>8 || !/^[0-9]+$/.test(raw))){ alert('PIN must be 4–8 digits.'); e.target.value=''; return; } await setPin(raw); e.target.value=''; alert(raw ? 'PIN set.' : 'PIN removed.'); });

  // Cloud buttons
  $('#cloudNowBtn')?.addEventListener('click', ()=>backupToCloud());
  $('#backupCloudBtn')?.addEventListener('click', ()=>backupToCloud());
  $('#restoreCloudBtn')?.addEventListener('click', ()=>restoreFromCloud());

  // File export/import
  $('#backupBtn')?.addEventListener('click', ()=>{ const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); const dt=new Date().toISOString().replace(/[:.]/g,'-'); a.download=`wanderlust-punchcard-backup-${dt}.json`; a.click(); URL.revokeObjectURL(a.href); });
  $('#restoreFile')?.addEventListener('change', async e=>{ const file=e.target.files?.[0]; if(!file) return; try{ const text=await file.text(); const imported=JSON.parse(text); if(!imported||!imported.clients||!imported.settings) throw new Error('Invalid backup'); state=imported; save(); render(); alert('Backup imported!'); }catch(err){ console.error(err); alert('Could not import backup.'); } finally{ e.target.value=''; } });

  // Share modal
  $('#copyLinkBtn')?.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(currentShareLink); alert('Link copied!'); }catch{ alert('Copy failed. Long-press to copy.'); } });
  $('#shareNativeBtn')?.addEventListener('click', async ()=>{ if(navigator.share){ try{ await navigator.share({ title:'Reward progress', url: currentShareLink }); }catch{} } else { alert('Sharing not supported. Link is copied above.'); }});
  $('#closeShareBtn')?.addEventListener('click', ()=> $('#shareModal').close());

  // Lock
  $('#lockBtn')?.addEventListener('click', ()=>{ if(!hasPin()) return alert('No PIN set. You can set one in Settings → Security.'); lockUI(true); });

  if ('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js').catch(console.error); }

  // Initial render + try loading rules from cloud
  save(); render();
  loadRulesFromCloud().catch(()=>{});
});

// Expose for console
window.__punch = { state: ()=>state, backupToCloud, restoreFromCloud };
