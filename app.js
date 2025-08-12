/* Wanderlust Lash Bar v3.5 — bug fixes + full appearance */
const $ = s=>document.querySelector(s);
const $$ = s=>Array.from(document.querySelectorAll(s));
const storeKey='punchcard'; // stable so themes persist

// Resilience
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
    bar.style.cssText='position:fixed;left:0;right:0;top:0;z-index:9999;background:#fee2e2;color:#991b1b;padding:10px;border-bottom:1px solid #fecaca;font:14px system-ui';
    bar.textContent='App error: '+(err && (err.message||err));
    const b=document.createElement('button'); b.textContent='Hard Refresh'; b.onclick=hardRefresh; b.style.cssText='margin-left:8px';
    bar.appendChild(b); document.body.appendChild(bar);
  }catch{ alert('App error'); }
}
window.addEventListener('error',e=>showFatal(e.error||e.message));
window.addEventListener('unhandledrejection',e=>showFatal(e.reason||'Unhandled promise'));

function uid(){return Math.random().toString(36).slice(2,10)}
function slug(){return Math.random().toString(36).slice(2,14)}
function nowISO(){return new Date().toISOString()}
function escapeHTML(s){return (s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
const debounce=(fn,ms=1200)=>{let t;return (...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms)}};

// Load or seed
let state = null;
try{ state = JSON.parse(localStorage.getItem(storeKey)||'null'); }catch{}
if(!state){
  state = {
    settings:{
      businessName:'Wanderlust Lash Bar', brandColor:'#ff6ea6',
      ownerKey: Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2),
      headerTextColor:'#111111', headerBgColor:'#ffffff', headerLogoData:'', bgImageData:'',
      cardStyle:'classic', showBadges:true, showUpcoming:true,
      shareTheme:'classic', shareFont:'system-ui', emojiHeadings:false,
      rewardsRules:[]
    },
    clients:[], activity:[]
  };
}

function applyTheme(theme){
  document.body.style.backgroundImage=''; document.body.style.backgroundColor='#fff';
  if (state.settings.bgImageData){ document.body.style.backgroundImage=`url(${state.settings.bgImageData})`; return; }
  if (theme==='girly') document.body.style.backgroundImage='linear-gradient(180deg,#fff,#ffe4ef)';
  else if (theme==='minimal-blush') document.body.style.backgroundImage='linear-gradient(180deg,#fff6f9,#ffe1ee)';
  else if (theme==='candy-pop'){ document.body.style.backgroundImage='radial-gradient(#ffd1e6 1px, transparent 1px), radial-gradient(#ffd1e6 1px, transparent 1px)'; document.body.style.backgroundPosition='0 0, 8px 8px'; document.body.style.backgroundSize='16px 16px'; }
}
function applyFont(name){
  document.documentElement.style.setProperty('--app-font', name==='system-ui' ? "system-ui,-apple-system,Segoe UI,Roboto,Arial" : `"${name}", system-ui,-apple-system,Segoe UI,Roboto,Arial`);
  if(name!=='system-ui' && !document.getElementById('gf-'+name)){
    const map={'Poppins':'Poppins:wght@400;600','Quicksand':'Quicksand:wght@400;600','Nunito':'Nunito:wght@400;700','Playfair Display':'Playfair+Display:wght@400;700','Pacifico':'Pacifico'};
    const spec=map[name]; if(spec){ const l=document.createElement('link'); l.id='gf-'+name; l.rel='stylesheet'; l.href='https://fonts.googleapis.com/css2?family='+spec+'&display=swap'; document.head.appendChild(l); }
  }
}
function save(){
  localStorage.setItem(storeKey, JSON.stringify(state));
  document.documentElement.style.setProperty('--brand', state.settings.brandColor);
  document.documentElement.style.setProperty('--header-text', state.settings.headerTextColor);
  document.documentElement.style.setProperty('--header-bg', state.settings.headerBgColor);
  $('#brandTitle').textContent = state.settings.businessName || 'Wanderlust Lash Bar';
  $('#headerLogo').src = state.settings.headerLogoData || 'logo-lash.svg';
  applyTheme(state.settings.shareTheme); applyFont(state.settings.shareFont);
  debouncedBrandingSync();
}

function fmtDate(iso){ const d=new Date(iso); return d.toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) }

// Rewards
function getTallies(c){return c.redeemTallies||{}}
function setTally(c,id,n){c.redeemTallies=c.redeemTallies||{}; c.redeemTallies[id]=n}
function redeemedCount(c,id){return Number((c.redeemTallies||{})[id]||0)}
function eligibleRewardsFor(c){ const rules=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches); const cur=c.punches||0; const out=[]; for(const r of rules){ const earned=Math.floor(cur/r.punches), used=redeemedCount(c,r.id); if(earned-used>0) out.push({rule:r,available:earned-used}); } return out; }
function topEligibleLabel(c){ const l=eligibleRewardsFor(c); return l.length?l[l.length-1].rule.label:'' }
function nextRewardHintFor(c){ const rules=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches); const cur=c.punches||0; const up=rules.find(r=>r.punches>cur); if(up){ const n=up.punches-cur; return `${n} more ${n===1?'punch':'punches'} until ${up.label}`; } const e=eligibleRewardsFor(c); return e.length?`Eligible: ${e[e.length-1].rule.label}`:'' }
function upcomingListFor(c){ if(!state.settings.showUpcoming) return ''; const rules=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches); const cur=c.punches||0; const ups=rules.filter(r=>r.punches>cur); return ups.length?('Next: '+ups.slice(0,3).map(r=>`${r.punches-cur}→${r.label}`).join('; ')):'' }
function achievedBadgeFor(c){ if(!state.settings.showBadges) return ''; const l=eligibleRewardsFor(c); if(!l.length) return ''; return `Eligible: ${l[l.length-1].rule.label}` }

// Clients
function newClientPayload({name,phone='',goal=10}){return {id:uid(),name:name.trim(),phone:phone.trim(),goal:Math.max(1,Number(goal)||10),punches:0,totalRewards:0,lastVisit:nowISO(),public_slug:slug(),history:[{type:'create',at:nowISO()}]}}
function addClient(p){const c=newClientPayload(p); state.clients.push(c); save(); render(); syncClient(c).catch(console.warn)}
function updateClient(id,fields){const c=state.clients.find(x=>x.id===id); if(!c) return; Object.assign(c,fields); c.history.unshift({type:'edit',at:nowISO()}); save(); render(); syncClient(c).catch(console.warn)}
function deleteClient(id){const c=state.clients.find(x=>x.id===id); if(!c)return; if(!confirm(`Delete ${c.name}?`)) return; state.clients=state.clients.filter(x=>x.id!==id); save(); render(); deleteRemoteClient(c).catch(console.warn)}
function punch(id){const c=state.clients.find(x=>x.id===id); if(!c)return; c.punches=(c.punches||0)+1; c.lastVisit=nowISO(); c.history.unshift({type:'punch',at:nowISO()}); save(); render(); syncClient(c).catch(console.warn)}
function redeem(id,ruleId){const c=state.clients.find(x=>x.id===id); if(!c) return; const list=eligibleRewardsFor(c); if(!list.length){alert('No rewards eligible yet.'); return;} let chosen=list[list.length-1].rule; if(ruleId){const f=list.find(x=>x.rule.id===ruleId); if(f) chosen=f.rule;} if(!confirm(`Redeem “${chosen.label}” for ${c.name}?`)) return; const used=redeemedCount(c,chosen.id); setTally(c,chosen.id,used+1); c.totalRewards=(c.totalRewards||0)+1; c.lastRedeemLabel=chosen.label; c.lastRedeemAt=nowISO(); c.history.unshift({type:'redeem',label:chosen.label,at:nowISO()}); save(); render(); syncClient(c).catch(console.warn); toast('Redeemed 🎁 '+chosen.label); }

// Supabase helpers
function headers(){const k=window.PUNCH_CONFIG?.SUPABASE_ANON_KEY||''; return {apikey:k,Authorization:'Bearer '+k,'Content-Type':'application/json'}}
async function supabaseUpsertClient(c){ if(!window.PUNCH_CONFIG?.SUPABASE_URL) return; const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients`; const row={id:c.id,owner_key:state.settings.ownerKey,name:c.name,phone:c.phone||null,goal:c.goal,punches:c.punches,total_rewards:c.totalRewards||0,last_visit:c.lastVisit,public_slug:c.public_slug,redeem_tallies:c.redeemTallies||{},last_redeem_label:c.lastRedeemLabel||null,last_redeem_at:c.lastRedeemAt||null,updated_at:new Date().toISOString()}; const r=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([row])}); if(!r.ok) console.warn('upsert client',r.status,await r.text()); }
function syncClient(c){ return supabaseUpsertClient(c); } // prevents "not defined" error
async function deleteRemoteClient(c){ if(!window.PUNCH_CONFIG?.SUPABASE_URL) return; const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/clients?id=eq.${encodeURIComponent(c.id)}`; await fetch(url,{method:'DELETE',headers:headers()}); }
async function supabaseUpsertRule(r){ if(!window.PUNCH_CONFIG?.SUPABASE_URL) return; const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules`; const row={id:r.id,owner_key:state.settings.ownerKey,punches:Math.max(1,Number(r.punches)||1),label:String(r.label||'Reward'),updated_at:new Date().toISOString()}; await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([row])}); }
async function supabaseDeleteRule(id){ if(!window.PUNCH_CONFIG?.SUPABASE_URL) return; const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/rules?id=eq.${encodeURIComponent(id)}`; await fetch(url,{method:'DELETE',headers:headers()}); }
async function supabaseUpsertBranding(){ if(!window.PUNCH_CONFIG?.SUPABASE_URL) return; const url=`${window.PUNCH_CONFIG.SUPABASE_URL}/rest/v1/branding`; const b={owner_key:state.settings.ownerKey,business_name:state.settings.businessName,brand_color:state.settings.brandColor,header_text_color:state.settings.headerTextColor,header_bg_color:state.settings.headerBgColor,share_theme:state.settings.shareTheme,share_font:state.settings.shareFont,emoji_headings:!!state.settings.emojiHeadings,card_style:state.settings.cardStyle,show_badges:!!state.settings.showBadges,show_upcoming:!!state.settings.showUpcoming,header_logo_data:state.settings.headerLogoData||null,bg_image_data:state.settings.bgImageData||null,updated_at:new Date().toISOString()}; const r=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify([b])}); if(!r.ok) console.warn('branding upsert',await r.text()); }
const debouncedBrandingSync = debounce(supabaseUpsertBranding, 1000);

// UI helpers
function toast(m){const el=$('#toast'); if(!el) return; el.textContent=m; el.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>el.classList.remove('show'),1600);}

function renderClients(q){const wrap=$('#clientsList'); wrap.innerHTML=''; const query=(q||'').toLowerCase(); const items=state.clients.filter(c=>!query||c.name.toLowerCase().includes(query)||(c.phone||'').toLowerCase().includes(query)).sort((a,b)=>(b.lastVisit||'').localeCompare(a.lastVisit||'')||a.name.localeCompare(b.name)); if(!items.length){wrap.innerHTML='<div class="card"><div class="muted">No clients yet. Tap “New”.</div></div>'; return;} for(const c of items){const pct=c.goal?Math.min(100,Math.round(100*c.punches/c.goal)):0; const hint=nextRewardHintFor(c), upcoming=upcomingListFor(c), badge=achievedBadgeFor(c); const canRedeem=!!topEligibleLabel(c); const style=state.settings.cardStyle||'classic'; const div=document.createElement('div'); div.className='card '+(style!=='classic'?style:''); div.dataset.id=c.id; div.innerHTML=`${badge?`<span class="elig">${escapeHTML(badge)}</span>`:''}<div class="row" style="justify-content:space-between"><h3>${escapeHTML(c.name)}</h3><span class="badge">${c.punches}/${c.goal}</span></div><div class="muted">${c.phone?escapeHTML(c.phone)+' · ':''}${c.totalRewards||0} rewards</div><div class="progress"><div style="width:${pct}%"></div></div>${hint?`<div class="muted">${escapeHTML(hint)}</div>`:''}${upcoming?`<div class="muted">${escapeHTML(upcoming)}</div>`:''}${canRedeem?`<div class="actions"><button class="btn primary" data-redeem-id="${c.id}">Redeem ${escapeHTML(topEligibleLabel(c))}</button></div>`:''}`; wrap.appendChild(div);}}

let currentDetailId=null;
function openDetail(id){const c=state.clients.find(x=>x.id===id); if(!c) return; currentDetailId=id; $('#detailTitle').textContent=(state.settings.emojiHeadings?'💖 ':'')+c.name; $('#detailInfo').textContent=`${c.phone?c.phone+' · ':''}${c.punches}/${c.goal} punches`; $('#detailProgress').style.width=(c.goal?Math.min(100,Math.round(100*c.punches/c.goal)):0)+'%'; $('#detailHint').textContent=nextRewardHintFor(c)||''; $('#detailUpcoming').textContent=upcomingListFor(c)||''; const lbl=topEligibleLabel(c); $('#detailRedeemBtn').textContent=lbl?('Redeem '+lbl):'Redeem'; $('#detailRedeemBtn').disabled=!lbl; const feed=$('#detailHistory'); feed.innerHTML=''; for(const h of c.history.slice(0,50)){const row=document.createElement('div'); row.className='feed-item'; const verb=h.type==='punch'?'Punched':h.type==='redeem'?`Redeemed${h.label?' ('+escapeHTML(h.label)+')':''}`:h.type; row.innerHTML=`<div>${verb}</div><small>${fmtDate(h.at)}</small>`; feed.appendChild(row);} $('#detailModal').showModal();}

function openClientModal(c=null){ $('#clientModalTitle').textContent = c?'Edit Client':'New Client'; $('#clientId').value=c?c.id:''; $('#clientName').value=c?c.name:''; $('#clientPhone').value=c?c.phone||''; $('#clientGoal').value=c?c.goal:10; $('#clientModal').showModal(); }

function openRedeemPicker(id){ const c=state.clients.find(x=>x.id===id); if(!c){alert('Client not found');return;} const list=eligibleRewardsFor(c); if(!list.length){alert('No rewards eligible yet.');return;} if(list.length===1){redeem(id,list[0].rule.id);return;} const box=$('#redeemOptions'); box.innerHTML=''; for(const it of list){const b=document.createElement('button'); b.className='btn primary'; b.textContent=`${it.rule.label} (${it.available} available)`; b.setAttribute('data-redeem-rule',it.rule.id); b.style.display='block'; b.style.width='100%'; b.style.margin='6px 0'; box.appendChild(b);} $('#redeemPicker').dataset.clientId=id; $('#redeemPicker').showModal(); }

function makePublicLink(c){ const u=new URL('share.html', location.href); u.searchParams.set('c', c.public_slug); return u.toString(); }
function openShareForClient(id){ const c=state.clients.find(x=>x.id===id); if(!c) return; const link=makePublicLink(c); $('#shareLinkInput').value=link; const qr=$('#qrArea'); qr.innerHTML=''; new QRCode(qr,{text:link,width:192,height:192}); $('#shareModal').showModal(); }

async function fileToDataURLCompressed(file, maxW=1600, quality=0.86){
  const img = new Image(), rd = new FileReader();
  const data = await new Promise((res,rej)=>{ rd.onload=()=>res(rd.result); rd.onerror=rej; rd.readAsDataURL(file); });
  return await new Promise((res)=>{ img.onload=()=>{ const scale=Math.min(1, maxW/img.width); const w=Math.max(1,Math.round(img.width*scale)); const h=Math.max(1,Math.round(img.height*scale)); const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d'); ctx.drawImage(img,0,0,w,h); res(c.toDataURL('image/jpeg',quality)); }; img.src=data; });
}

// Events
window.addEventListener('DOMContentLoaded', ()=>{ try{
  document.body.addEventListener('click', e=>{ const t=e.target.closest('.tab'); if(t){ $$('.tab').forEach(b=>b.classList.toggle('active',b===t)); $$('.tab-panel').forEach(p=>p.classList.remove('active')); $('#tab-'+t.dataset.tab).classList.add('active'); } });
  $('#searchInput')?.addEventListener('input',e=>renderClients(e.target.value));
  $('#addClientBtn')?.addEventListener('click',()=>openClientModal());
  $('#fabAdd')?.addEventListener('click',()=>openClientModal());
  $('#clientsList')?.addEventListener('click',e=>{ const r=e.target.closest('[data-redeem-id]'); if(r){openRedeemPicker(r.getAttribute('data-redeem-id')); return;} const card=e.target.closest('.card'); if(card) openDetail(card.dataset.id); });

  // Save + Cancel (fixed)
  $('#clientForm')?.addEventListener('submit',e=>{ e.preventDefault(); const id=$('#clientId').value.trim(); const payload={name:$('#clientName').value.trim(),phone:$('#clientPhone').value.trim(),goal:Number($('#clientGoal').value||10)}; if(!payload.name) return alert('Name is required'); id?updateClient(id,payload):addClient(payload); $('#clientModal').close(); });
  $('#clientCancelBtn')?.addEventListener('click',()=>$('#clientModal').close());
  $('#clientModal')?.addEventListener('click',e=>{ const box=e.currentTarget.querySelector('.modal-card'); if(!box.contains(e.target)) e.currentTarget.close(); });

  $('#detailPunchBtn')?.addEventListener('click',()=>{ if(!currentDetailId) return; punch(currentDetailId); openDetail(currentDetailId);} );
  $('#detailRedeemBtn')?.addEventListener('click',()=>{ if(!currentDetailId) return; openRedeemPicker(currentDetailId);} );
  $('#detailShareBtn')?.addEventListener('click',()=>{ if(!currentDetailId) return; openShareForClient(currentDetailId);} );
  $('#detailEditBtn')?.addEventListener('click',()=>{ if(!currentDetailId) return; const c=state.clients.find(x=>x.id===currentDetailId); openClientModal(c);} );
  $('#detailDeleteBtn')?.addEventListener('click',()=>{ if(!currentDetailId) return; deleteClient(currentDetailId); $('#detailModal').close(); });
  $('#detailCloseBtn')?.addEventListener('click',()=>$('#detailModal').close());
  $('#redeemCancelBtn')?.addEventListener('click',()=>$('#redeemPicker').close());
  $('#redeemPicker')?.addEventListener('click',e=>{ const btn=e.target.closest('[data-redeem-rule]'); if(!btn) return; const id=$('#redeemPicker').dataset.clientId; $('#redeemPicker').close(); redeem(id, btn.getAttribute('data-redeem-rule')); });

  // Settings
  $('#businessName')?.addEventListener('change',e=>{ state.settings.businessName=e.target.value.trim()||'Wanderlust Lash Bar'; save(); render(); });
  $('#brandColor')?.addEventListener('input',e=>{ state.settings.brandColor=e.target.value||'#ff6ea6'; save(); render(); });
  $('#headerTextColor')?.addEventListener('input',e=>{ state.settings.headerTextColor=e.target.value||'#111111'; save(); render(); });
  $('#headerBgColor')?.addEventListener('input',e=>{ state.settings.headerBgColor=e.target.value||'#ffffff'; save(); render(); });
  $('#cardStyle')?.addEventListener('change',e=>{ state.settings.cardStyle=e.target.value; save(); render(); });
  $('#showBadges')?.addEventListener('change',e=>{ state.settings.showBadges=!!e.target.checked; save(); render(); });
  $('#showUpcoming')?.addEventListener('change',e=>{ state.settings.showUpcoming=!!e.target.checked; save(); render(); });
  $('#shareTheme')?.addEventListener('change',e=>{ state.settings.shareTheme=e.target.value; save(); applyTheme(state.settings.shareTheme); });
  $('#shareFont')?.addEventListener('change',e=>{ state.settings.shareFont=e.target.value; save(); applyFont(state.settings.shareFont); });
  $('#emojiHeadings')?.addEventListener('change',e=>{ state.settings.emojiHeadings=!!e.target.checked; save(); render(); });

  $('#headerLogoInput')?.addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; state.settings.headerLogoData=await fileToDataURLCompressed(f,512,0.9); save(); render(); });
  $('#bgImageInput')?.addEventListener('change',async e=>{ const f=e.target.files&&e.target.files[0]; if(!f) return; state.settings.bgImageData=await fileToDataURLCompressed(f,1600,0.86); save(); render(); });
  $('#removeBgBtn')?.addEventListener('click',()=>{ state.settings.bgImageData=''; save(); render(); });
  $('#copyOwnerKeyBtn')?.addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(state.settings.ownerKey); toast('Owner key copied'); }catch{ alert('Copy failed'); } });
  $('#forceRefreshBtn')?.addEventListener('click',hardRefresh);

  // Reward rules
  document.getElementById('addRuleBtn')?.addEventListener('click',()=>{
    const punches = Number(document.getElementById('rulePunches').value||0);
    const label = String(document.getElementById('ruleLabel').value||'').trim();
    if(punches<1 || !label){ alert('Enter punches (>=1) and a reward label.'); return; }
    addRule(punches, label); document.getElementById('ruleLabel').value='';
  });
  document.body.addEventListener('click',e=>{ const del=e.target.closest('[data-rule-del]'); if(del){ deleteRule(del.getAttribute('data-rule-del')); }});

  // First paint
  save(); render(); renderRules();
} catch(e){ showFatal(e); } });

function render(){ renderClients($('#searchInput')?.value||''); }

// Rules UI
function addRule(punches,label){ const r={id:uid(),owner_key:state.settings.ownerKey,punches:Math.max(1,Number(punches)||1),label:String(label||'Reward')}; (state.settings.rewardsRules||=[]).push(r); save(); renderRules(); supabaseUpsertRule(r).catch(console.warn); }
function deleteRule(id){ state.settings.rewardsRules=(state.settings.rewardsRules||[]).filter(x=>x.id!==id); save(); renderRules(); supabaseDeleteRule(id).catch(console.warn); }
function renderRules(){ const box=$('#rulesList'); box.innerHTML=''; const list=(state.settings.rewardsRules||[]).slice().sort((a,b)=>a.punches-b.punches); if(!list.length){ box.innerHTML='<div class="info">No rules yet. Add one above.</div>'; return;} for(const r of list){ const el=document.createElement('div'); el.className='rule'; el.innerHTML=`<div><strong>${r.punches} punches</strong> → ${escapeHTML(r.label)}</div><div class="row"><button class="btn" data-rule-del="${r.id}">Delete</button></div>`; box.appendChild(el);} }
