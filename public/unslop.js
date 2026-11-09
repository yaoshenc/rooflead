// RoofLead unslop pass (process by unslop, Damir Sokolovsky @heydamir, CC BY 4.0):
// one line-icon set in place of text glyphs, plain page titles and copy,
// sentence case, real dashboard figures, business identity in the shell and
// surveyor measurement tags for figures.
(()=>{
// ---- Icons (RoofLead line set, 24 grid, stroke via CSS) ----
const P={
 home:'<path d="M3 11 12 4l9 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
 roof:'<path d="M2.5 13 12 5l9.5 8"/><path d="M6 10.2V19h12v-8.8"/>',
 inbox:'<path d="M4 13h4.5l1.5 2.5h4l1.5-2.5H20"/><path d="M6.5 5h11L20 13v6H4v-6z"/>',
 file:'<path d="M14 3H6v18h12V7z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
 sliders:'<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
 search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
 phone:'<path d="M5 4h3.5l1.8 4.6-2.3 1.4a10.5 10.5 0 0 0 6 6l1.4-2.3L20 15.5V19a1 1 0 0 1-1 1A15 15 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
 mail:'<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="m3.5 7 8.5 6 8.5-6"/>',
 message:'<path d="M20.5 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 20.5 12z"/>',
 globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.3 3.5 5.2 3.5 8.5s-1.1 6.2-3.5 8.5c-2.4-2.3-3.5-5.2-3.5-8.5S9.6 5.8 12 3.5z"/>',
 pencil:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
 arrow:'<path d="M7 17 17 7"/><path d="M8.5 7H17v8.5"/>',
 clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 scan:'<path d="M4 8.5V5h3.5M16.5 5H20v3.5M20 15.5V19h-3.5M7.5 19H4v-3.5"/><path d="M8 12h8"/>',
 download:'<path d="M12 4v11"/><path d="m7 11 5 5 5-5"/><path d="M5 20h14"/>',
 target:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
 undo:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H12"/>',
 expand:'<path d="M14.5 4H20v5.5M9.5 20H4v-5.5M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
 map:'<path d="M9 4.5 3.5 6.5v13L9 17.5l6 2 5.5-2v-13L15 6.5z"/><path d="M9 4.5v13M15 6.5v13"/>',
 check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
 megaphone:'<path d="M4 10v4h3l7 4V6l-7 4z"/><path d="M17.5 9.5a3.5 3.5 0 0 1 0 5"/>',
 users:'<circle cx="9" cy="8.5" r="3.5"/><path d="M3 19.5c.6-3.3 3-5 6-5s5.4 1.7 6 5"/><path d="M15.5 5.2a3.3 3.3 0 0 1 0 6.6M17.5 14.8c1.9.6 3.1 2.2 3.5 4.7"/>',
 ruler:'<path d="M3.5 15.5 15.5 3.5l5 5-12 12z"/><path d="m7.5 11.5 2 2M10.5 8.5l2 2M13.5 5.5l2 2"/>',
};
const icon=(n,cls='')=>`<span class="ic ${cls}" aria-hidden="true"><svg viewBox="0 0 24 24">${P[n]}</svg></span>`;
window.rlIcon=icon;
// Text glyphs used as icons → line icons (null = drop the glyph).
const G={'⌂':'home','▤':'inbox','▧':'file','☷':'list','⚙':'sliders','⌕':'search','♧':'phone','☎':'phone','✉':'mail','◍':'message','◎':'globe','▱':'pencil','↗':'arrow','◷':'clock','＋':'plus','⤓':'download','⌖':'target','↶':'undo','⤢':'expand','✧':'scan','◉':'users'};
const GLYPH_RE=/[⌂▤▧☷⚙⌕♧☎✉◍◎▱↗◷＋⤓⌖↶⤢✧◉]/;
const SKIP='textarea,input,svg,script,style,.hub-bubble,.fb-msg,.mail-body,.phone-bubble,.request-message,code,pre,.palette-input,.ic,.paper-lines td:first-child';
function iconizeText(node){const t=node.nodeValue;if(!GLYPH_RE.test(t))return;const el=node.parentElement;if(!el||el.closest(SKIP))return;
 const inButton=!!el.closest('button,a,.filter,.sidebar-search,.top-search,label.search');
 const frag=document.createDocumentFragment();let buf='';
 for(const ch of t){const name=G[ch];if(!name){buf+=ch;continue}
  if(buf){frag.append(buf);buf=''}
  // AI sparkle: an icon only where it labels an action, otherwise dropped.
  if(ch==='✧'&&!inButton)continue;
  if(ch==='↗'&&!inButton)continue;
  const span=document.createElement('span');span.innerHTML=icon(name,ch==='↗'?'sm':'');frag.append(span.firstChild)}
 if(buf)frag.append(buf.replace(/^\s{2,}/,' ').replace(/ +/g,' '));
 node.replaceWith(frag)}

// Copy: plain titles, no slogans, no vendor tags.
const COPY={
 'Your next job starts here.':'Leads','From quotation to confirmed job.':'Quotes','Invoices, ready for the next step.':'Invoices',
 'Prepare a quotation, record customer acceptance, and create the invoice automatically.':'Quotations, and the invoices created when customers accept',
 'Your prices, ready to quote.':'Price book','Labour and material rates in AUD (ex GST), plus templates for the jobs you do every week.':'Labour, material and equipment rates in AUD, ex GST, and templates for common jobs',
 'Set it up. Make it yours.':'Settings','Your rates and workflow, ready for every new lead.':'Business details, pricing, automation and integrations',
 'Built for the work before the work.':'','Your rates. Your review. Your quote.':'','Keep the final checks in your hands.':'Check these before you send a final quote',
 'AI property report':'Property report','AI roof outline':'Roof outline','AI ROOF MEASUREMENT':'Roof measurement','OpenAI connected':'Not researched','OpenAI · Report ready':'Report ready',
 'Your accepted quotation and invoice stay linked to the original lead.':'Accepted quotations and their invoices stay linked to the lead',
 'Get a property-specific brief with public sources, roofing considerations, planning checks and the questions to ask before quoting.':'Research public sources, planning checks and the questions to ask before quoting',
};
const ACRONYM=new Set(['AI','QT','NSW','PDF','SMS','GST','AUD','ABN','ID','INV','URL']);
function sentence(s){return s.toLowerCase().replace(/\b[a-z]+\b/g,w=>ACRONYM.has(w.toUpperCase())?w.toUpperCase():w).replace(/^\s*([a-z])/,m=>m.toUpperCase())}
function copyText(node){const raw=node.nodeValue,t=raw.replace(/[⌂▤▧☷⚙⌕♧☎✉◍◎▱↗◷＋⤓⌖↶⤢✧◉]/g,'').replace(/\s+/g,' ').trim();if(!t)return;const el=node.parentElement;if(!el||el.closest(SKIP))return;
 if(Object.prototype.hasOwnProperty.call(COPY,t)){node.nodeValue=COPY[t];return}
 // Uppercase labels in the interface become sentence case.
 if(t.length>3&&/^[A-Z][A-Z &/,'·-]+$/.test(t)&&!ACRONYM.has(t)&&el.closest('.eyebrow,.nav-label,th,.cu-step,.connection-context,.req-steps,.document-paper,.paper-label,.palette-group,label,h3,.stat-label'))node.nodeValue=raw.replace(t,sentence(t))}

function sweep(root=document.body){const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(w.nextNode())nodes.push(w.currentNode);
 for(const n of nodes){copyText(n);if(n.isConnected)iconizeText(n)}
 root.querySelectorAll?.('.source').forEach(s=>{if(s.querySelector(':scope>.ic'))return;const t=s.textContent.trim();const name=/messenger/i.test(t)?'message':/facebook/i.test(t)?'megaphone':/website/i.test(t)?'globe':/phone/i.test(t)?'phone':'pencil';s.insertAdjacentHTML('afterbegin',icon(name))});
 const bi=$('.brand-icon');if(bi&&!bi.querySelector('.ic')){bi.textContent='';bi.innerHTML=icon('roof')}}
let queued=false;const mo=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;mo.disconnect();sweep();identity();observe()})});
const observe=()=>mo.observe(document.body,{childList:true,subtree:true,characterData:true});

// ---- Badges: a status dot instead of glyph prefixes ----
badge=function(status){const cls=({'Ready to quote':'ready','Awaiting customer':'waiting','Researching':'research','New lead':'new','Quoted':'quoted','Draft':'waiting','Reviewed':'ready','Accepted':'ready','Prepared':'quoted','Needs review':'waiting'})[status]||'new';return `<span class="badge ${cls}"><i class="badge-dot" aria-hidden="true"></i>${esc(status)}</span>`};

// ---- Shell identity from the business details ----
function identity(){const name=state.business?.name||'Your business';const ini=name.trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase()||'RL';
 const ws=$('.workspace');if(ws){const b=ws.querySelector('b'),s=ws.querySelector('small'),a=ws.querySelector('.avatar');if(b&&b.textContent!==name)b.textContent=name;if(s&&s.textContent!=='Workspace')s.textContent='Workspace';if(a&&a.textContent!==ini)a.textContent=ini}
 const av=$('.topbar .avatar');if(av&&av.textContent!==ini){av.textContent=ini;av.title=name}}

// ---- Measurement tags ----
const tag=(v,quiet)=>`<span class="mtag${quiet?' quiet':''}">${esc(v)}</span>`;
window.rlTag=tag;

// ---- Leads dashboard: real figures, one work queue ----
function ageDays(l){if(l.createdAt)return (Date.now()-l.createdAt)/864e5;if(l.id>1e12)return (Date.now()-l.id)/864e5;const t=(l.time||'').toLowerCase();
 if(/just now|min/.test(t))return 0;const h=t.match(/(\d+)\s*hour/);if(h)return +h[1]/24;if(/yesterday/.test(t))return 1;const d=t.match(/(\d+)\s*day/);if(d)return +d[1];const w=t.match(/(\d+)\s*week/);if(w)return +w[1]*7;return 30}
const money=n=>Number(n||0).toLocaleString('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});
function quoteTotal(q){try{return Commercial.totals(Commercial.lines(q),q.gst).total}catch{return 0}}
const baseLeads=renderLeads;
renderLeads=function(){baseLeads();
 const L=state.leads,ready=L.filter(l=>l.status==='Ready to quote').length,waiting=L.filter(l=>l.status==='Awaiting customer').length;
 const new7=L.filter(l=>ageDays(l)<7).length,prev7=L.filter(l=>{const a=ageDays(l);return a>=7&&a<14}).length;
 const out=state.quotes.filter(q=>q.quoteDocument&&!q.acceptance),accepted=state.quotes.filter(q=>q.acceptance);
 const h=$('.page-heading p');if(h)h.textContent=`${L.length} enquiries · ${new7} in the last 7 days`;
 const stats=$('.stats');if(stats){const q=document.createElement('div');q.className='queue';
  q.innerHTML=`<div><h2>Needs you</h2><div class="queue-split"><button type="button" data-q="Ready to quote"><b>${ready}</b><span>Ready to quote</span></button><button type="button" data-q="Awaiting customer"><b>${waiting}</b><span>Waiting on customers</span></button></div></div>
  <div><h2>New enquiries</h2><div class="queue-fig">${new7}</div><div class="queue-sub">in the last 7 days<small>${prev7} the week before</small></div></div>
  <div><h2>Quotes with customers</h2><div class="queue-fig">${money(out.reduce((s,x)=>s+quoteTotal(x),0))}</div><div class="queue-sub">${out.length} awaiting acceptance<small>${accepted.length} accepted · ${money(accepted.reduce((s,x)=>s+quoteTotal(x),0))}</small></div></div>`;
  stats.replaceWith(q);q.addEventListener('click',e=>{const b=e.target.closest('[data-q]');if(!b)return;filter=b.dataset.q;renderLeads();$('.panel')?.scrollIntoView({behavior:'smooth',block:'start'})})}
 $('.automation-banner')?.remove();
 $$('.filters .filter').forEach(f=>{if(f.dataset.filter==='Researching'&&/>0</.test(f.innerHTML)&&f.dataset.filter!==filter)f.remove()});
};
const baseRows=renderRows;
renderRows=function(){baseRows();$$('#lead-rows tr[data-lead]').forEach(tr=>{const l=state.leads.find(x=>x.id===+tr.dataset.lead);const td=tr.children[2];if(!l||!td||td.querySelector('.mtag'))return;
 td.innerHTML=`<div class="job-cell"><span>${esc(l.service)}</span>${l.area>0?tag(`${l.area} m² · ${l.pitch||'?'}°`,true):''}</div>`})};

// ---- Quiet motion ----
animateHandoff=function(){window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};

sweep();identity();observe();render();
})();
