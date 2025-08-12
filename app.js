/* Wanderlust Lash Bar — Punch Card v3.2 (compact) */
const $ = (s)=>document.querySelector(s);
const $$ = (s)=>Array.from(document.querySelectorAll(s));
const storeKey = 'punchcard:v3_2';

/* Stability helpers */
async function hardRefresh(){
  try{
    if('serviceWorker' in navigator){
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r=>r.unregister().catch(()=>{})));
      const keys = await caches.keys();
      await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})));
    }
  }catch{}
  const u = new URL(location.href); u.searchParams.set('v', Date.now()); location.href = u.toString();
}
function showFatal(err){
  try{
    const bar = document.createElement('div');
    bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9999;background:#fee2e2;color:#991b1b;border-bottom:1px solid #fecaca;padding:10px;font:14px/1.4 system-ui;';
    const b=document.createElement('button'); b.textContent='Hard Refresh'; b.onclick=hardRefresh;
    b.style.cssText='margin-left:10px;border:1px solid #991b1b;background:#fff;border-radius:8px;padding:6px 10px;';
    bar.textContent='App error: '+(err && (err.message||err))+' — '; bar.appendChild(b); document.body.appendChild(bar);
  }catch{ alert('App error. Force refresh.'); }
}
window.addEventListener('error', e=>showFatal(e.error||e.message));
window.addEventListener('unhandledrejection', e=>showFatal(e.reason||'Unhandled promise'));
try{ if(new URLSearchParams(location.search).get('clear')==='1') hardRefresh(); }catch{}

function uid(){ return Math.random().toString(36).slice(2,10); }
function slug(){ return Math.random().toString(36).slice(2,14); }
function nowISO(){ return new Date().toISOString(); }
function escapeHTML(s){ return (s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function fmtDate(iso){ const d=new Date(iso); return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); }
function debounce(fn,ms=1200){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

let state = load() || seed();
function load(){ try{ return JSON.parse(localStorage.getItem(storeKey)); }catch{return null;} }
function save(){
  localStorage.setItem(storeKey, JSON.stringify(state));
  document.documentElement.style.setProperty('--brand', state.settings.brandColor||'#ff6ea6');
  $('#brandTitle').textContent = state.settings.businessName || 'Wanderlust Lash Bar';
  applyTheme(state.settings.shareTheme || 'classic');
  debouncedBrandingSync();
}

function seed(){
  return {
    settings:{
      businessName:'Wanderlust Lash Bar',
      brandColor:'#ff6ea6',
      shareTheme:'classic',
      emojiHeadings:false,
      ownerKey: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2),
      rewardsRules: []
    },
    clients:[]
  };
}

function applyTheme(theme){
  document.body.style.backgroundImage=''; document.body.style.backgroundColor='';
  if (theme==='girly') document.body.style.backgroundImage='linear-gradient(180deg,#fff,#ffe4ef)';
  else if (theme==='minimal-blush') document.body.style.backgroundImage='linear-gradient(180deg,#fff6f9,#ffe1ee)';
  else if (theme==='candy-pop'){ document.body.style.backgroundImage='radial-gradient(#ffd1e6 1px, transparent 1px), radial-gradient(#ffd1e6 1px, transparent 1px)'; document.body.style.backgroundPosition='0 0, 8px 8px'; document.body.style.backgroundSize='16px 16px'; }
  else if (theme==='luxe-mono') document.body.style.backgroundColor='#ffffff';
}

// Rewards helpers
function getTallies(c){ return c.redeemTallies || {}; }
function setTally(c, ruleId, n){ c.redeemTallies = c.redeemTallies || {}; c.redeemTallies[ruleId] = n; }
function redeemedCount(c, ruleId){ const t = getTallies(c); return Number(t[ruleId]||0); }
function eligibleRewardsFor(c){
  const rules = (state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  const current = c.punches||0; const list=[];
  for (const r of rules){ const earned=Math.floor(current/r.punches), used=redeemedCount(c,r.id); if(earned-used>0) list.push({rule:r,available:earned-used}); }
  return list;
}
function topEligibleLabel(c){ const l=eligibleRewardsFor(c); return l.length?l[l.length-1].rule.label:''; }
function nextRewardHintFor(c){
  const rules=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  const cur=c.punches||0; const up=rules.find(r=>r.punches>cur);
  if (up){ const n=up.punches-cur; return `${n} more ${n===1?'punch':'punches'} until ${up.label}`; }
  const l=eligibleRewardsFor(c); if(l.length) return `Eligible: ${l[l.length-1].rule.label}`;
  return '';
}
function upcomingListFor(c){
  const rules=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  const cur=c.punches||0; const ups=rules.filter(r=>r.punches>cur);
  return ups.length ? 'Next: '+ups.slice(0,3).map(r=>`${r.punches-cur}→${r.label}`).join('; ') : '';
}

// Clients
function newClient({name, phone='', goal=10}){
  return { id:uid(), name:name.trim(), phone:phone.trim(), goal:Math.max(1,Number(goal)||10), punches:0, totalRewards:0, lastVisit:nowISO(), public_slug:slug(), history:[{type:'create',at:nowISO()}] };
}
function addClient(p){ const c=newClient(p); state.clients.push(c); save(); render(); syncClient(c).catch(console.warn); }
function updateClient(id, fields){ const c=state.clients.find(x=>x.id===id); if(!c) return; Object.assign(c, fields); c.history.unshift({type:'edit',at:nowISO()}); save(); render(); syncClient(c).catch(console.warn); }
function deleteClient(id){ const c=state.clients.find(x=>x.id===id); if(!c) return; if(!confirm(`Delete ${c.name}?`)) return; state.clients=state.clients.filter(x=>x.id!==id); save(); render(); deleteRemoteClient(c).catch(console.warn); }
function punch(id){ const c=state.clients.find(x=>x.id===id); if(!c) return; c.punches=Math.max(0,(c.punches||0)+1); c.lastVisit=nowISO(); c.history.unshift({type:'punch',at:nowISO()}); save(); render(); syncClient(c).catch(console.warn); }
function redeem(id, ruleId){
  const c=state.clients.find(x=>x.id===id); if(!c) return;
  const list=eligibleRewardsFor(c); if(!list.length) return alert('No rewards eligible yet.');
  let chosen=list[list.length-1].rule; if(ruleId){ const f=list.find(x=>x.rule.id===ruleId); if(f) chosen=f.rule; }
  if(!confirm(`Redeem “${chosen.label}” for ${c.name}?`)) return;
  const used=redeemedCount(c, chosen.id); setTally(c, chosen.id, used+1);
  c.totalRewards=(c.totalRewards||0)+1; c.lastVisit=nowISO(); c.lastRedeemLabel=chosen.label; c.lastRedeemAt=nowISO();
  c.history.unshift({type:'redeem',label:chosen.label,at:nowISO()}); save(); render(); toast('Redeemed 🎁 '+chosen.label); syncClient(c).catch(console.warn);
}

function renderClients(q){
  const wrap=$('#clientsList'); wrap.innerHTML='';
  const query=(q||'').toLowerCase().trim();
  const items=state.clients.filter(c=>!query||c.name.toLowerCase().includes(query)||(c.phone||'').toLowerCase().includes(query)).sort((a,b)=> (b.lastVisit||'').localeCompare(a.lastVisit||'') || a.name.localeCompare(b.name));
  if(!items.length){ wrap.innerHTML='<div class="card"><div class="muted">No clients yet. Tap “New”.</div></div>'; return; }
  for(const c of items){
    const pct=c.goal?Math.min(100,Math.round((c.punches/c.goal)*100)):0;
    const card=document.createElement('div'); card.className='card'; card.dataset.id=c.id;
    const hint=nextRewardHintFor(c), upcoming=upcomingListFor(c), badge=topEligibleLabel(c);
    card.innerHTML=`
      ${badge?`<span class="badge">Eligible: ${escapeHTML(badge)}</span>`:''}
      <div class="row" style="justify-content:space-between">
        <h3>${escapeHTML(c.name)}</h3>
        <span class="badge">${c.punches}/${c.goal}</span>
      </div>
      <div class="muted">${c.phone?escapeHTML(c.phone)+' · ':''}${c.totalRewards||0} rewards</div>
      <div class="progress"><div style="width:${pct}%"></div></div>
      ${hint?`<div class="muted">${escapeHTML(hint)}</div>`:''}
      ${upcoming?`<div class="muted">${escapeHTML(upcoming)}</div>`:''}
      ${badge?`<div class="actions"><button class="btn primary" data-redeem-id="${c.id}">Redeem ${escapeHTML(badge)}</button></div>`:''}
    `;
    wrap.appendChild(card);
  }
}

let currentDetailId=null;
function openDetail(id){
  const c=state.clients.find(x=>x.id===id); if(!c) return; currentDetailId=id;
  $('#detailTitle').textContent=(state.settings.emojiHeadings?'💖 ':'')+c.name;
  $('#detailInfo').textContent=`${c.phone?c.phone+' · ':''}${c.punches}/${c.goal} punches`;
  $('#detailProgress').style.width = (c.goal?Math.min(100,Math.round((c.punches/c.goal)*100)):0)+'%';
  $('#detailHint').textContent=nextRewardHintFor(c)||'';
  $('#detailUpcoming').textContent=upcomingListFor(c)||'';
  const lbl=topEligibleLabel(c); $('#detailRedeemBtn').textContent=lbl?('Redeem '+lbl):'Redeem'; $('#detailRedeemBtn').disabled=!lbl;
  const feed=$('#detailHistory'); feed.innerHTML='';
  for(const h of c.history.slice(0,50)){
    const row=document.createElement('div'); row.className='feed-item';
    const verb=h.type==='punch'?'Punched':h.type==='redeem'?`Redeemed${h.label?' ('+escapeHTML(h.label)+')':''}`:h.type;
    row.innerHTML=`<div>${verb}</div><small>${fmtDate(h.at)}</small>`; feed.appendChild(row);
  }
  $('#detailModal').showModal();
}

// Modals & inputs
function openClientModal(c=null){
  $('#clientModalTitle').textContent = c?'Edit Client':'New Client';
  $('#clientId').value = c?c.id:'';
  $('#clientName').value = c?c.name:'';
  $('#clientPhone').value = c?c.phone||'':'';
  $('#clientGoal').value = c?c.goal:10;
  $('#clientModal').showModal();
}

function toast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'), 1800);
}

// Share
function makePublicLink(c){ const u=new URL('share.html', location.href); u.searchParams.set('c', c.public_slug); return u.toString(); }
function openShareForClient(id){
  const c=state.clients.find(x=>x.id===id); if(!c) return;
  const link=makePublicLink(c); $('#shareLinkInput').value=link; const qr=$('#qrArea'); qr.innerHTML=''; new QRCode(qr, { text: link, width:192, height:192 });
  $('#shareModal').showModal();
}

// Settings
function applyInputs(){
  $('#businessName').value = state.settings.businessName;
  $('#brandColor').value = state.settings.brandColor;
  $('#shareTheme').value = state.settings.shareTheme || 'classic';
  $('#emojiHeadings').checked = !!state.settings.emojiHeadings;
}
const debouncedBrandingSync = debounce(()=>supabaseUpsertBranding().catch(console.warn), 1200);

// Supabase REST
function headers(){ const k=window.PUNCH_CONFIG?.SUPABASE_ANON_KEY||''; return { apikey:k, Authorization:'Bearer '+k, 'Content-Type':'application/json' }; }

async function supabaseUpsertClient(c){
  if(!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients`;
  const row={ id:c.id, owner_key:state.settings.ownerKey, name:c.name, phone:c.phone||null, goal:c.goal, punches:c.punches, total_rewards:c.totalRewards||0, last_visit:c.lastVisit, public_slug:c.public_slug, redeem_tallies:c.redeemTallies||{}, last_redeem_label:c.lastRedeemLabel||null, last_redeem_at:c.lastRedeemAt||null, updated_at:new Date().toISOString() };
  const r=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([row])}); if(!r.ok) console.warn('upsert client',r.status,await r.text());
}
async function deleteRemoteClient(c){
  if(!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(c.id)}`;
  const r=await fetch(url,{method:'DELETE',headers:headers()}); if(!r.ok) console.warn('delete client',r.status);
}
async function supabaseUpsertRule(r){
  if(!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules`;
  const row={ id:r.id, owner_key:state.settings.ownerKey, punches:r.punches, label:r.label, updated_at:new Date().toISOString() };
  const res=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([row])}); if(!res.ok) console.warn('upsert rule',res.status);
}
async function supabaseDeleteRule(id){
  if(!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules?id=eq.${encodeURIComponent(id)}`;
  const res=await fetch(url,{method:'DELETE',headers:headers()}); if(!res.ok) console.warn('del rule',res.status);
}
async function supabaseUpsertBranding(){
  if(!window.PUNCH_CONFIG?.SUPABASE_URL) return;
  const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/branding`;
  const b={ owner_key:state.settings.ownerKey, business_name:state.settings.businessName, brand_color:state.settings.brandColor, share_theme:state.settings.shareTheme, emoji_headings:Boolean(state.settings.emojiHeadings), updated_at:new Date().toISOString() };
  const res=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([b])}); if(!res.ok) console.warn('branding upsert',res.status);
}

// Rewards UI
function addRule(punches,label){
  const r={ id:uid(), punches:Math.max(1,Number(punches)||1), label:String(label||'Reward') };
  state.settings.rewardsRules = state.settings.rewardsRules || []; state.settings.rewardsRules.push(r);
  save(); renderRules(); supabaseUpsertRule({ ...r, owner_key: state.settings.ownerKey }).catch(console.warn);
}
function deleteRule(id){
  state.settings.rewardsRules = (state.settings.rewardsRules||[]).filter(x=>x.id!==id); save(); renderRules(); supabaseDeleteRule(id).catch(console.warn);
}
function renderRules(){
  const box=$('#rulesList'); box.innerHTML='';
  const list=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches);
  if(!list.length){ box.innerHTML='<div class="info">No rules yet.</div>'; return; }
  for(const r of list){
    const el=document.createElement('div'); el.className='rule';
    el.innerHTML=`<div><strong>${r.punches} punches</strong> → ${escapeHTML(r.label)}</div><div class="row"><button class="btn" data-rule-del="${r.id}">Delete</button></div>`;
    box.appendChild(el);
  }
}

// INIT
window.addEventListener('DOMContentLoaded', ()=>{ try {
  // Tabs
  document.body.addEventListener('click', (e)=>{
    const t=e.target.closest('.tab'); if(t){ $$('.tab').forEach(b=>b.classList.toggle('active', b===t)); $$('.tab-panel').forEach(p=>p.classList.remove('active')); $('#tab-'+t.dataset.tab).classList.add('active'); }
  });

  // Search
  $('#searchInput')?.addEventListener('input', e=>renderClients(e.target.value));

  // Add client
  $('#addClientBtn')?.addEventListener('click', ()=>openClientModal());
  $('#fabAdd')?.addEventListener('click', ()=>openClientModal());
  $('#clientForm')?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const id=$('#clientId').value.trim();
    const payload={ name:$('#clientName').value.trim(), phone:$('#clientPhone').value.trim(), goal:Number($('#clientGoal').value||10) };
    if(!payload.name) return alert('Name is required');
    id?updateClient(id,payload):addClient(payload);
    $('#clientModal').close();
  });

  // List clicks
  $('#clientsList')?.addEventListener('click', (e)=>{
    const rbtn=e.target.closest('[data-redeem-id]'); if(rbtn){ openRedeemPicker(rbtn.getAttribute('data-redeem-id')); return; }
    const card=e.target.closest('.card'); if(card){ openDetail(card.dataset.id); }
  });

  // Detail actions
  $('#detailPunchBtn')?.addEventListener('click', ()=>{ if(!currentDetailId) return; punch(currentDetailId); openDetail(currentDetailId); });
  $('#detailRedeemBtn')?.addEventListener('click', ()=>{ if(!currentDetailId) return; openRedeemPicker(currentDetailId); });
  $('#detailShareBtn')?.addEventListener('click', ()=>{ if(!currentDetailId) return; openShareForClient(currentDetailId); });
  $('#detailEditBtn')?.addEventListener('click', ()=>{ if(!currentDetailId) return; const c=state.clients.find(x=>x.id===currentDetailId); openClientModal(c); });
  $('#detailDeleteBtn')?.addEventListener('click', ()=>{ if(!currentDetailId) return; deleteClient(currentDetailId); $('#detailModal').close(); });
  $('#detailCloseBtn')?.addEventListener('click', ()=>$('#detailModal').close());

  // Redeem picker
  $('#redeemCancelBtn')?.addEventListener('click', ()=>$('#redeemPicker').close());
  $('#redeemPicker')?.addEventListener('click', (e)=>{
    const btn=e.target.closest('[data-redeem-rule]'); if(!btn) return;
    redeem($('#redeemPicker').dataset.clientId, btn.getAttribute('data-redeem-rule'));
    $('#redeemPicker').close();
  });

  // Share modal
  $('#copyLinkBtn')?.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText($('#shareLinkInput').value); toast('Link copied'); }catch{ alert('Copy failed'); } });
  $('#closeShareBtn')?.addEventListener('click', ()=>$('#shareModal').close());

  // Rewards form
  $('#addRuleBtn')?.addEventListener('click', ()=>{
    const punches=Number($('#rulePunches').value||1), label=$('#ruleLabel').value.trim(); if(!label) return alert('Enter a label'); addRule(punches,label); $('#ruleLabel').value='';
  });
  document.body.addEventListener('click', (e)=>{ const del=e.target.closest('[data-rule-del]'); if(del) deleteRule(del.getAttribute('data-rule-del')); });

  // Settings
  $('#businessName')?.addEventListener('change', e=>{ state.settings.businessName=e.target.value.trim()||'Wanderlust Lash Bar'; save(); render(); });
  $('#brandColor')?.addEventListener('input', e=>{ state.settings.brandColor=e.target.value||'#ff6ea6'; save(); render(); });
  $('#shareTheme')?.addEventListener('change', e=>{ state.settings.shareTheme=e.target.value; save(); render(); });
  $('#emojiHeadings')?.addEventListener('change', e=>{ state.settings.emojiHeadings=e.target.checked; save(); render(); });
  $('#copyOwnerKeyBtn')?.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(state.settings.ownerKey); toast('Owner key copied'); }catch{ alert('Copy failed'); } });
  $('#forceRefreshBtn')?.addEventListener('click', hardRefresh);

  applyInputs(); render(); renderRules();

} catch(e){ showFatal(e); } });

function render(){
  renderClients($('#searchInput')?.value||'');
  document.documentElement.style.setProperty('--brand', state.settings.brandColor||'#ff6ea6');
}

// Redeem picker open
function openRedeemPicker(id){
  const c=state.clients.find(x=>x.id===id); if(!c) return;
  const list=eligibleRewardsFor(c); if(!list.length){ alert('No rewards eligible yet.'); return; }
  if(list.length===1){ redeem(id, list[0].rule.id); return; }
  const box=$('#redeemOptions'); box.innerHTML=''; for(const it of list){ const b=document.createElement('button'); b.className='btn primary'; b.style.display='block'; b.style.width='100%'; b.style.margin='6px 0'; b.textContent=`${it.rule.label} (${it.available} available)`; b.setAttribute('data-redeem-rule', it.rule.id); box.appendChild(b); }
  $('#redeemPicker').dataset.clientId=id; $('#redeemPicker').showModal();
}
