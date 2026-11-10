// RoofLead UI refresh: command palette (⌘K / Ctrl+K / "/"), keyboard
// shortcuts, mobile bottom navigation, lead-page section navigation, tabbed
// Settings and aerial thumbnails in the leads list.
(()=>{
const store={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
const isMac=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent);
const typing=e=>{const t=e.target;return t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))};

// ---- Shell additions: search entry points + mobile bottom nav ----
const mod=isMac?'⌘K':'Ctrl K';
const sideSearch=document.createElement('button');sideSearch.className='sidebar-search';sideSearch.type='button';sideSearch.innerHTML=`<span aria-hidden="true">⌕</span> Search… <kbd>${mod}</kbd>`;
$('.sidebar .nav-label')?.before(sideSearch);sideSearch.onclick=()=>openPalette();
const topSearch=document.createElement('button');topSearch.className='top-search';topSearch.type='button';topSearch.setAttribute('aria-label','Search leads, quotes and actions');topSearch.innerHTML=`<span aria-hidden="true">⌕</span><span class="ts-label">Search leads, quotes…</span><span class="kbd">${mod}</span>`;
$('.top-right')?.prepend(topSearch);topSearch.onclick=()=>openPalette();
const bottom=document.createElement('nav');bottom.className='bottom-nav';bottom.setAttribute('aria-label','Main');
bottom.innerHTML=[['leads','▤','Leads'],['customers','◉','Customers'],['quotes','▧','Quotes'],['settings','⚙','Settings']].map(([k,i,t])=>`<button type="button" data-bnav="${k}"><span aria-hidden="true">${i}</span>${t}${k==='leads'?'<em id="bn-leads"></em>':''}</button>`).join('')+'<button type="button" data-bnav="search"><span aria-hidden="true">⌕</span>Search</button>';
document.body.append(bottom);
bottom.addEventListener('click',e=>{const b=e.target.closest('[data-bnav]');if(!b)return;const k=b.dataset.bnav;if(k==='search')return openPalette();nav(k)});
function syncBottom(){const active=page==='detail'?'leads':page==='customer'?'customers':page==='quote'||page==='invoice'?'quotes':page;$$('[data-bnav]').forEach(b=>b.classList.toggle('active',b.dataset.bnav===active));const n=state.leads.filter(l=>l.status==='New lead').length;const em=$('#bn-leads');if(em){em.textContent=n||'';em.hidden=!n}}

// ---- Aerial thumbnails in the leads list ----
function thumbUrl(im){if(!im?.available||!Number.isFinite(im.latitude))return null;try{const u=new URL(im.imageUrl);const dx=22/(111320*Math.cos(im.latitude*Math.PI/180)),dy=22/111320;u.searchParams.set('bbox',[im.longitude-dx,im.latitude-dy,im.longitude+dx,im.latitude+dy].join(','));u.searchParams.set('size','96,96');return u.href}catch{return null}}
const baseRows=renderRows;
renderRows=function(){baseRows();$$('#lead-rows tr[data-lead]').forEach(tr=>{const l=state.leads.find(x=>x.id===+tr.dataset.lead);const url=thumbUrl(l&&(l.report?.imagery||l.researchImagery));const t=tr.querySelector('.property-thumb');if(url&&t){t.innerHTML=`<img src="${esc(url)}" alt="" loading="lazy">`;t.firstChild.addEventListener('error',()=>{t.textContent='⌂'},{once:true})}})};

// ---- Lead page: section navigation ----
// The sticky bar sits directly under the (sticky) top bar; offsets are
// measured, not hard-coded, so it never slides underneath it.
const root=document.documentElement;
function measure(){const tb=$('.topbar');root.style.setProperty('--topbar-h',(tb?Math.round(tb.getBoundingClientRect().height):0)+'px');const c=$('#content');if(c)root.style.setProperty('--content-pad',getComputedStyle(c).paddingLeft);const sn=$('.section-nav');root.style.setProperty('--secnav-h',(sn?Math.round(sn.getBoundingClientRect().height):0)+'px')}
addEventListener('resize',measure);
const SECTIONS=[['.job-card','Job'],['.research-card','Property'],['.takeoff-card','Take-off'],['.photos-card','Photos'],['.insp-card','Inspection'],['.hub','Customer']];
let secItems=[],spyRaf=0;
const offset=()=>{const tb=$('.topbar')?.getBoundingClientRect().height||0,sn=$('.section-nav')?.getBoundingClientRect().height||0;return tb+sn+12};
// When the customer column sits beside the main column it is always on screen,
// so it is only a scroll target in the stacked (mobile) layout.
const sideBySide=()=>{const g=$('.detail-grid');if(!g||g.children.length<2)return false;return g.children[1].getBoundingClientRect().left>g.children[0].getBoundingClientRect().left+20};
function spy(){spyRaf=0;const navEl=$('.section-nav');if(!navEl||!secItems.length)return;
 navEl.classList.toggle('stuck',navEl.getBoundingClientRect().top<=(($('.topbar')?.getBoundingClientRect().height)||0)+1);
 const side=sideBySide(),line=offset()+8;let active=-1;
 secItems.forEach(([el,,isSide],i)=>{if(side&&isSide)return;if(el.isConnected&&el.getBoundingClientRect().top<=line)active=i});
 if(innerHeight+scrollY>=document.documentElement.scrollHeight-4){const last=secItems.map((x,i)=>[x,i]).filter(([x])=>!(side&&x[2])).pop();if(last)active=last[1]}
 if(active<0)active=0;
 $$('.section-nav button').forEach((b,j)=>{b.classList.toggle('active',j===active);b.setAttribute('aria-current',j===active?'true':'false')})}
addEventListener('scroll',()=>{if(!spyRaf)spyRaf=requestAnimationFrame(spy)},{passive:true});
addEventListener('resize',()=>{if(!spyRaf)spyRaf=requestAnimationFrame(spy)});
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();secItems=[];const grid=$('.detail-grid');if(!grid)return;
 const side=grid.children[1];
 secItems=SECTIONS.map(([sel,label])=>{const el=document.querySelector(sel);return el&&[el,label,!!side&&side.contains(el)]}).filter(Boolean);
 if(secItems.length<3){secItems=[];return}
 const navEl=document.createElement('div');navEl.className='section-nav';navEl.setAttribute('role','navigation');navEl.setAttribute('aria-label','Sections');
 navEl.innerHTML=secItems.map(([,label,isSide],i)=>`<button type="button" data-sec="${i}" ${isSide?'data-side="1"':''}>${label}</button>`).join('');grid.before(navEl);
 navEl.onclick=e=>{const b=e.target.closest('[data-sec]');if(!b)return;const el=secItems[+b.dataset.sec][0];
  // Side-by-side, the customer column is already visible: highlight it instead of scrolling.
  if(b.dataset.side&&sideBySide()){el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash');return}
  scrollTo({top:el.getBoundingClientRect().top+scrollY-offset(),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
 measure();spy();
};

// ---- Settings: group cards into tabs ----
const GROUPS=[['business','Business',/Business & invoice/i],['pricing','Pricing',/estimate rates|Take-off rates|Online acceptance/i],['automation','Automation',/^Automation$|information requests|Sending quotations|Quote follow-ups|Invoice reminders/i],['integrations','Integrations',/Facebook|Lead channels/i],['team','Team',/Crews|Weather check/i],['data','Data',/Backup/i]];
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();queueMicrotask(tabSettings)};
function tabSettings(){const grid=$('.settings-grid');if(!grid||grid.classList.contains('tabbed'))return;
 // Flatten wrapper columns so every card can be grouped.
 [...grid.children].forEach(c=>{if(!c.classList.contains('card')&&c.querySelector('.card')){[...c.children].forEach(x=>grid.insertBefore(x,c));c.remove()}});
 const cards=[...grid.children];const groupOf=c=>{const h=c.querySelector('h2')?.textContent.trim()||'';return (GROUPS.find(g=>g[2].test(h))||GROUPS[0])[0]};
 cards.forEach(c=>c.dataset.group=groupOf(c));
 const present=GROUPS.filter(g=>cards.some(c=>c.dataset.group===g[0]));
 let tab=store.get('rooflead-settings-tab');if(!present.some(g=>g[0]===tab))tab=present[0][0];
 const bar=document.createElement('div');bar.className='settings-tabs';bar.setAttribute('role','tablist');bar.setAttribute('aria-label','Settings sections');
 bar.innerHTML=present.map(g=>`<button type="button" role="tab" data-stab="${g[0]}">${g[1]}</button>`).join('');grid.before(bar);grid.classList.add('tabbed');
 const show=t=>{tab=t;store.set('rooflead-settings-tab',t);cards.forEach(c=>c.hidden=c.dataset.group!==t);$$('[data-stab]').forEach(b=>{b.classList.toggle('active',b.dataset.stab===t);b.setAttribute('aria-selected',b.dataset.stab===t)})};
 bar.onclick=e=>{const b=e.target.closest('[data-stab]');if(b)show(b.dataset.stab)};show(tab);
 // Cards added later (async) join their group.
 new MutationObserver(ms=>{for(const m of ms)for(const n of m.addedNodes)if(n.nodeType===1&&n.parentElement===grid&&!n.dataset.group){n.dataset.group=groupOf(n);n.hidden=n.dataset.group!==tab}}).observe(grid,{childList:true});
}

// ---- Command palette ----
const pal=document.createElement('div');pal.className='palette';pal.hidden=true;pal.innerHTML=`<div class="palette-box" role="dialog" aria-modal="true" aria-label="Search"><div class="palette-input"><span aria-hidden="true">⌕</span><input id="palette-q" placeholder="Search leads, addresses, customers, quotes or actions…" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palette-list"><span class="kbd">Esc</span></div><ul class="palette-list" id="palette-list" role="listbox"></ul><div class="palette-foot"><span><span class="kbd">↑</span> <span class="kbd">↓</span> to move</span><span><span class="kbd">Enter</span> to open</span><span><span class="kbd">N</span> new lead</span></div></div>`;
document.body.append(pal);
let results=[],sel=0;
const ACTIONS=()=>[
 {g:'Actions',i:'＋',t:'Add a lead',s:'New enquiry',run:()=>{nav('leads');addLead()}},
 {g:'Actions',i:'▧',t:'Create a quote',s:'From a lead',run:()=>{nav('quotes');setTimeout(()=>$('#new-document')?.click(),50)}},
 {g:'Actions',i:'⤓',t:'Download a backup',s:'Settings · Data',run:()=>{store.set('rooflead-settings-tab','data');nav('settings');setTimeout(()=>$('#backup-download')?.click(),80)}},
 {g:'Go to',i:'▤',t:'Leads',run:()=>nav('leads')},{g:'Go to',i:'◉',t:'Customers',run:()=>nav('customers')},{g:'Go to',i:'▧',t:'Quotes & invoices',run:()=>nav('quotes')},{g:'Go to',i:'▦',t:'Schedule',run:()=>nav('schedule')},{g:'Go to',i:'✉',t:'Messages',run:()=>nav('messages')},{g:'Go to',i:'☷',t:'Price book',run:()=>nav('pricebook')},{g:'Go to',i:'⚙',t:'Settings',run:()=>nav('settings')},
];
function search(q){q=q.trim().toLowerCase();const words=q.split(/\s+/).filter(Boolean);const match=s=>words.every(w=>s.includes(w));
 const leads=state.leads.filter(l=>!q||match(`${l.address} ${l.suburb} ${l.name} ${l.service} ${l.status} ${l.source}`.toLowerCase())).slice(0,q?8:5).map(l=>({g:'Leads',i:'⌂',t:l.address,s:`${l.name} · ${(l.suburb||'').split(',')[0]} · ${l.service}`,b:l.status,run:()=>openLead(l.id)}));
 const quotes=state.quotes.filter(x=>{const l=state.leads.find(y=>y.id===x.leadId);return q&&match(`qt-${x.id} ${x.status} ${l?.address||''} ${l?.name||''}`.toLowerCase())}).slice(0,5).map(x=>{const l=state.leads.find(y=>y.id===x.leadId);return {g:'Quotes',i:'▧',t:`QT-${x.id}`,s:`${l?.address||''} · ${l?.name||''}`,b:x.acceptance?'Accepted':x.quoteDocument?'Prepared':x.status,run:()=>openQuote(x.id)}});
 const custs=(window.rlCustomers?.()||[]).filter(c=>q&&match(`${c.name} ${c.email} ${c.phone}`.toLowerCase())).slice(0,4).map(c=>({g:'Customers',i:'◉',t:c.name,s:`${c.leads.length} project${c.leads.length>1?'s':''} · ${c.phone||c.email||''}`,run:()=>openCustomer(c.key)}));
 const inv=(state.invoices||[]).filter(i=>q&&match(`${i.number} ${i.document?.customer?.name||''} ${i.document?.property||''}`.toLowerCase())).slice(0,3).map(i=>({g:'Invoices',i:'$',t:i.number,s:i.document?.property||'',b:i.status,run:()=>openInvoice(i.id)}));
 const acts=ACTIONS().filter(a=>!q||match((a.t+' '+(a.s||'')).toLowerCase()));
 return [...(q?[]:acts.filter(a=>a.g==='Actions')),...custs,...leads,...quotes,...inv,...(q?acts:acts.filter(a=>a.g==='Go to'))]}
function draw(){const list=$('#palette-list');if(!results.length){list.innerHTML='<li class="palette-empty">No matches. Try an address, customer name or QT number.</li>';return}
 let g='';list.innerHTML=results.map((r,i)=>{const head=r.g!==g?`<li class="palette-group" role="presentation">${esc(r.g)}</li>`:'';g=r.g;return head+`<li class="palette-item" role="option" id="pi-${i}" aria-selected="${i===sel}" data-pi="${i}"><i aria-hidden="true">${r.i}</i><span><b>${esc(r.t)}</b>${r.s?`<small>${esc(r.s)}</small>`:''}</span>${r.b?badge(r.b):''}</li>`}).join('');
 $('#palette-q').setAttribute('aria-activedescendant','pi-'+sel);document.getElementById('pi-'+sel)?.scrollIntoView({block:'nearest'})}
function update(){results=search($('#palette-q').value);sel=0;draw()}
function openPalette(){if($('#modal').open)$('#modal').close();pal.hidden=false;const i=$('#palette-q');i.value='';update();i.focus()}
function closePalette(){pal.hidden=true}
function choose(i){const r=results[i];if(!r)return;closePalette();r.run();scrollTo({top:0})}
window.openPalette=openPalette;
$('#palette-q').addEventListener('input',update);
$('#palette-q').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();sel=Math.min(results.length-1,sel+1);draw()}else if(e.key==='ArrowUp'){e.preventDefault();sel=Math.max(0,sel-1);draw()}else if(e.key==='Enter'){e.preventDefault();choose(sel)}else if(e.key==='Escape'){e.preventDefault();closePalette()}});
pal.addEventListener('mousedown',e=>{if(e.target===pal)closePalette()});
pal.addEventListener('click',e=>{const it=e.target.closest('[data-pi]');if(it)choose(+it.dataset.pi)});
pal.addEventListener('mousemove',e=>{const it=e.target.closest('[data-pi]');if(it&&+it.dataset.pi!==sel){sel=+it.dataset.pi;$$('.palette-item').forEach(x=>x.setAttribute('aria-selected',x.dataset.pi==sel))}});

// ---- Keyboard shortcuts ----
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();pal.hidden?openPalette():closePalette();return}
 if(typing(e)||e.metaKey||e.ctrlKey||e.altKey||$('#modal').open||!pal.hidden)return;
 if(e.key==='/'){e.preventDefault();openPalette()}
 else if(e.key==='n'||e.key==='N'){e.preventDefault();nav('leads');addLead()}
});

// Keep the bottom nav in step with navigation.
const baseRender=render;render=function(){baseRender();syncBottom()};
for(const fn of ['openLead','openQuote','openInvoice']){const base=window[fn];if(typeof base!=='function')continue;window[fn]=function(...a){const r=base.apply(this,a);syncBottom();return r}}
const baseNav=nav;nav=function(p){baseNav(p);syncBottom()};
syncBottom();if(page==='leads')renderRows();
})();
