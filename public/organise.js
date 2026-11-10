// Keeps the lead and quotation pages focused on quoting: secondary cards fold
// away behind collapsible headers, and everything about getting a quotation to
// the customer (sending, the customer link and follow-ups) sits in one card.
(()=>{
const KEY='rooflead-ui-collapsed';
let memo={};try{memo=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{memo={}}
const remember=(k,v)=>{memo[k]=v;try{localStorage.setItem(KEY,JSON.stringify(memo))}catch{}};

function collapsible(card,key,open=true){if(!card||card.dataset.cc)return;let head=card.querySelector(':scope>.card-header')||card.querySelector(':scope>h2');if(!head)return;
 if(head.tagName==='H2'){const w=document.createElement('div');w.className='card-header';head.before(w);w.append(head);head=w}
 card.dataset.cc=key;head.classList.add('cc-head');head.setAttribute('role','button');head.tabIndex=0;
 const chev=document.createElement('span');chev.className='cc-chev';chev.setAttribute('aria-hidden','true');head.append(chev);
 const set=o=>{card.classList.toggle('cc-closed',!o);head.setAttribute('aria-expanded',String(o))};set(memo[key]??open);
 const toggle=()=>{const o=card.classList.contains('cc-closed');set(o);remember(key,o)};
 head.addEventListener('click',e=>{if(e.target.closest('button,a,input,select,textarea'))return;toggle()});
 head.addEventListener('keydown',e=>{if(e.target!==head)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
 card.ccOpen=()=>set(true)}
const sub=(title,nodes,open=false)=>{const d=document.createElement('details');d.className='cc-sub';d.open=open;d.innerHTML=`<summary>${esc(title)}</summary>`;const body=document.createElement('div');body.className='cc-sub-body';nodes.filter(Boolean).forEach(n=>body.append(n));d.append(body);return d};
const titled=(root,t)=>[...root.children].find(c=>c.querySelector(':scope>h2,:scope>.card-header>h2')?.textContent.trim()===t);

// ---- Lead page ----
function organiseLead(){const l=state.leads.find(x=>x.id===currentId);const main=$('.research-card')?.parentElement;if(!l||!main)return;
 const research=$('.research-card');
 // Imagery provenance and address matching are reference detail: fold them under the map.
 const status=research.querySelector('.inline-outline-status'),caption=research.querySelector('.aerial-caption');
 if((status||caption)&&!research.querySelector('.cc-sub')){const panel=research.querySelector('.aerial-panel');panel?.append(sub('Imagery source & address match',[status,caption]))}
 collapsible(research,'lead-property',true);
 collapsible($('.takeoff-card'),'lead-takeoff',true);
 const photos=$('.photos-card');collapsible(photos,'lead-photos',!!photos?.querySelector('img,.finding,.photo-grid'));
 const insp=$('.insp-card');collapsible(insp,'lead-inspection',!!insp&&!/Not started/i.test(insp.querySelector('.badge')?.textContent||'Not started'));
 collapsible(titled(main,'Research activity'),'lead-activity',false);
 collapsible($('.job-card'),'lead-job',true)}

// ---- Quotation page ----
function organiseQuote(){const side=$('.commercial-layout')?.children[1];if(!side)return;
 const qs=side.querySelector('.qs-card'),qf=side.querySelector('.qf-card'),portal=side.querySelector('.portal-card');
 if(qs){qs.querySelector('h2').textContent='Sending & follow-ups';
  if(qf){const list=qf.querySelector('.qf-list');if(list)qs.querySelector('.qf-list')?.replaceWith(list);const extra=[...qf.children].filter(c=>!c.classList.contains('card-header')&&c!==list);const after=qs.querySelector('.qs-sends')||qs.querySelector('.qf-list');extra.reverse().forEach(n=>after?.after(n));qf.remove()}
  if(portal){const nodes=[...portal.children].filter(c=>c.tagName!=='H2');const send=qs.querySelector('#qs-send');const box=sub('Customer link',nodes,false);send?send.before(box):qs.append(box);portal.remove()}
  // One row of actions at the bottom of the card.
  const send=qs.querySelector('#qs-send'),pause=[...qs.querySelectorAll(':scope>.inline-buttons')];if(send&&pause.length){qs.append(...pause);pause[0].prepend(send);send.classList.remove('full')}}
 collapsible(titled(side,'Property brief'),'quote-brief',false);
 collapsible(titled(side,'Document activity'),'quote-activity',false)}

// Section shortcuts on the lead page open a folded card before scrolling to it.
document.addEventListener('click',e=>{const b=e.target.closest('.section-nav [data-sec]');if(!b)return;const sel={Property:'.research-card','Take-off':'.takeoff-card',Photos:'.photos-card',Inspection:'.insp-card',Job:'.job-card'}[b.textContent.trim()];const card=sel&&$(sel);if(card?.ccOpen&&card.classList.contains('cc-closed')){card.ccOpen();remember(card.dataset.cc,true)}},true);

const baseDetail=renderDetail;renderDetail=function(){baseDetail();try{organiseLead()}catch(e){console.warn('organise lead',e)}};
const baseQuote=renderQuote;renderQuote=function(){baseQuote();try{organiseQuote()}catch(e){console.warn('organise quote',e)}};
if(page==='detail'||page==='quote')render();
})();
