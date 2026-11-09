// Customers: one profile per customer across all their projects. Leads that
// share an email or phone number (or a Messenger conversation) are grouped.
// Shows projects, combined history, insights from RoofLead's own data, and
// notes/tags kept with the workspace. No web look-ups of private people.
(()=>{
const DAY=864e5;
const icon=(n,c)=>window.rlIcon?rlIcon(n,c):'';
const tag=(v,q)=>window.rlTag?rlTag(v,q):`<span>${esc(v)}</span>`;
const digits=p=>String(p||'').replace(/\D/g,'').replace(/^61/,'0');
const money=n=>Number(n||0).toLocaleString('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0});
const initials=n=>(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
function ageDays(l){if(l.createdAt)return (Date.now()-l.createdAt)/DAY;if(l.id>1e12)return (Date.now()-l.id)/DAY;const t=(l.time||'').toLowerCase();
 if(/just now|min/.test(t))return 0;const h=t.match(/(\d+)\s*hour/);if(h)return +h[1]/24;if(/yesterday/.test(t))return 1;const d=t.match(/(\d+)\s*day/);if(d)return +d[1];const w=t.match(/(\d+)\s*week/);if(w)return +w[1]*7;return 30}
const leadAt=l=>l.fb?.messages?.[0]?.at||Date.now()-ageDays(l)*DAY;
function quoteTotal(q){try{return Commercial.totals(Commercial.lines(q),q.gst).total}catch{return 0}}
const when=t=>new Date(t).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
const ago=t=>{const d=Math.floor((Date.now()-t)/DAY);return d<1?'today':d===1?'yesterday':d<30?d+' days ago':when(t)};

// ---- Grouping (union by email, phone and Messenger id) ----
function customers(){const parent=new Map(),find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x)}return x},union=(a,b)=>{parent.set(find(a),find(b))};
 const keysOf=l=>[l.email&&'e:'+l.email.trim().toLowerCase(),digits(l.phone).length>=8&&'p:'+digits(l.phone),l.fb?.source==='messenger'&&'m:'+l.fb.externalId].filter(Boolean);
 for(const l of state.leads){const id='l:'+l.id;parent.set(id,id);for(const k of keysOf(l)){if(!parent.has(k))parent.set(k,k);union(id,k)}}
 const groups=new Map();for(const l of state.leads){const r=find('l:'+l.id);(groups.get(r)||groups.set(r,[]).get(r)).push(l)}
 return [...groups.values()].map(leads=>{leads.sort((a,b)=>leadAt(b)-leadAt(a));const latest=leads[0];
  const key=keysOf(leads.find(l=>l.email)||leads.find(l=>digits(l.phone).length>=8)||latest)[0]||'l:'+latest.id;
  const quotes=state.quotes.filter(q=>leads.some(l=>l.id===q.leadId)),invoices=(state.invoices||[]).filter(i=>quotes.some(q=>q.id===i.quoteId));
  const name=leads.find(l=>l.name&&!/facebook contact/i.test(l.name))?.name||latest.name||'Customer';
  return {key,name,email:leads.find(l=>l.email)?.email||'',phone:leads.find(l=>l.phone)?.phone||'',leads,latest,quotes,invoices,
   firstAt:Math.min(...leads.map(leadAt)),lastAt:Math.max(...leads.map(l=>Math.max(leadAt(l),l.followupFlow?.answeredAt||0,l.followupFlow?.lastSentAt||0,...(l.fb?.messages||[]).map(m=>m.at)))),
   quoted:quotes.filter(q=>q.quoteDocument&&!q.acceptance).reduce((s,q)=>s+quoteTotal(q),0),accepted:quotes.filter(q=>q.acceptance).reduce((s,q)=>s+quoteTotal(q),0)}})}
window.rlCustomers=customers;
const customerOf=leadId=>customers().find(c=>c.leads.some(l=>l.id===leadId));
window.openCustomerFor=leadId=>{const c=customerOf(leadId);if(c)openCustomer(c.key)};
const meta=k=>((state.customerNotes ||= {})[k] ||= {notes:'',tags:[]});

// ---- Customers list ----
let sort='recent',query='';
function renderCustomers(){const all=customers();const q=query.trim().toLowerCase();
 let list=all.filter(c=>!q||`${c.name} ${c.email} ${c.phone} ${c.leads.map(l=>l.address+' '+l.suburb).join(' ')} ${meta(c.key).tags.join(' ')}`.toLowerCase().includes(q));
 list.sort(sort==='value'?(a,b)=>b.accepted+b.quoted-(a.accepted+a.quoted):sort==='projects'?(a,b)=>b.leads.length-a.leads.length||b.lastAt-a.lastAt:sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>b.lastAt-a.lastAt);
 const repeat=all.filter(c=>c.leads.length>1).length;
 $('#content').innerHTML=`<div class="page-heading"><div><h1>Customers</h1><p>${all.length} customers · ${repeat} with more than one project</p></div><button class="primary" id="cust-new">${icon('plus')} New lead</button></div>
 <section class="panel cust-panel"><div class="toolbar"><div class="cust-sort" role="group" aria-label="Sort">${[['recent','Recent'],['projects','Most projects'],['value','Highest value'],['name','Name']].map(([k,t])=>`<button class="filter ${sort===k?'active':''}" data-sort="${k}">${t}</button>`).join('')}</div><label class="search">${icon('search')}<input id="cust-search" placeholder="Search customers" aria-label="Search customers" value="${esc(query)}"></label></div>
 <div class="table-wrap"><table class="cust-table"><thead><tr><th>Customer</th><th>Projects</th><th>Latest</th><th class="num">Quoted</th><th>Last activity</th></tr></thead><tbody>${list.map(c=>`<tr tabindex="0" data-cust="${esc(c.key)}"><td><div class="property"><span class="cust-avatar">${esc(initials(c.name))}</span><div><b>${esc(c.name)}</b><small>${esc(c.phone||c.email||'No contact details')}</small></div></div></td><td><span class="cust-count">${c.leads.length}</span> ${c.leads.length>1?'projects':'project'}${meta(c.key).tags.length?`<div class="cust-tags">${meta(c.key).tags.slice(0,3).map(t=>`<span>${esc(t)}</span>`).join('')}</div>`:''}</td><td><div class="job-cell"><span>${esc(c.latest.address)}</span>${badge(c.latest.status)}</div></td><td class="num">${c.accepted+c.quoted?esc(money(c.accepted+c.quoted)):'<span class="muted">—</span>'}</td><td class="muted">${esc(ago(c.lastAt))}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">No customers match.</td></tr>'}</tbody></table></div></section>`;
 $('#cust-new').onclick=()=>addLead();
 $$('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;renderCustomers()});
 const s=$('#cust-search');s.oninput=e=>{query=e.target.value;const pos=e.target.selectionStart;renderCustomers();const n=$('#cust-search');n.focus();n.setSelectionRange(pos,pos)};
 $$('[data-cust]').forEach(r=>{r.onclick=()=>openCustomer(r.dataset.cust);r.onkeydown=e=>{if(e.key==='Enter')r.click()}});
}

// ---- Customer profile ----
let currentCustomer=null;
function openCustomer(key){currentCustomer=key;page='customer';$$('[data-nav]').forEach(b=>b.classList.toggle('active',b.dataset.nav==='customers'));$('#breadcrumb').textContent='Customers / Profile';renderCustomer();scrollTo({top:0})}
window.openCustomer=openCustomer;
function history(c){const ev=[];for(const l of c.leads){const a=`<button class="cust-link" data-lead="${l.id}">${esc(l.address)}</button>`;
  ev.push({at:leadAt(l),icon:l.fb?.source==='messenger'?'message':l.source==='Phone call'?'phone':l.source==='Website'?'globe':l.fb?'megaphone':'pencil',text:`${l.fb?.source==='messenger'?'Messaged on Messenger':l.fb?'Submitted a Facebook lead form':'Enquired by '+(l.source||'').toLowerCase()} about ${a}`,detail:l.notes&&!l.fb?l.notes:''});
  const f=l.followupFlow;if(f?.lastSentAt)ev.push({at:f.lastSentAt,icon:'mail',text:`Asked for details on ${a}`,detail:f.sent>1?`${f.sent-1} reminder${f.sent>2?'s':''} sent`:''});
  if(f?.answeredAt)ev.push({at:f.answeredAt,icon:'check',text:`Answered ${f.items.filter(q=>q.online&&q.answer).length} questions online for ${a}`});
  if(l.roofMeasurement)ev.push({at:Date.parse(l.roofMeasurement.reviewedAt)||leadAt(l),icon:'ruler',text:`Roof measured at ${a}`,detail:`${l.roofMeasurement.surface} m² · ${l.roofMeasurement.pitch}°`});}
 for(const q of c.quotes){const l=c.leads.find(x=>x.id===q.leadId);for(const e of q.documentEvents||[])if(/prepared|accept|drafted|invoice/i.test(e.event))ev.push({at:Date.parse(e.at),icon:/accept/i.test(e.event)?'check':'file',text:`QT-${q.id}: ${e.event.replace(/ in preview/,'')}`,detail:l?l.address:''})}
 return ev.filter(e=>Number.isFinite(e.at)).sort((a,b)=>b.at-a.at)}
function insights(c){const out=[];const srcs=[...new Set(c.leads.map(l=>l.fb?.source==='messenger'?'Messenger':l.source))];
 const answered=c.leads.map(l=>l.followupFlow).filter(f=>f?.answeredAt&&f.lastSentAt);
 const owing=c.invoices.filter(i=>!/paid/i.test(i.status||'')).reduce((s,i)=>s+(i.document?.total||0),0);
 out.push(['Customer since',when(c.firstAt)]);
 out.push(['Reaches out via',srcs.join(', ')||'—']);
 out.push(['Best contact',c.phone?'Phone '+c.phone:c.email?'Email':c.leads.some(l=>l.fb?.source==='messenger')?'Messenger':'—']);
 if(answered.length){const h=answered.map(f=>(f.answeredAt-f.lastSentAt)/36e5).reduce((a,b)=>a+b,0)/answered.length;out.push(['Replies to requests',h<1?'within an hour':h<24?`in about ${Math.round(h)} hours`:`in about ${Math.round(h/24)} days`])}
 out.push(['Total quoted',c.quoted+c.accepted?money(c.quoted+c.accepted):'—']);out.push(['Accepted',c.accepted?money(c.accepted):'—']);if(c.quoted)out.push(['Awaiting decision',money(c.quoted)]);
 if(c.invoices.length)out.push(['Invoices',`${c.invoices.length} · ${money(owing)} outstanding`]);
 const roofs=c.leads.filter(l=>l.area>0);if(roofs.length)out.push(['Measured roofs',roofs.map(l=>`${l.area} m²`).join(', ')]);
 return out}
function projectCard(l){const im=l.report?.imagery||l.researchImagery;const q=state.quotes.find(x=>x.leadId===l.id);
 let thumb='';if(im?.available&&Number.isFinite(im.latitude)){try{const u=new URL(im.imageUrl),dx=24/(111320*Math.cos(im.latitude*Math.PI/180)),dy=24/111320;u.searchParams.set('bbox',[im.longitude-dx,im.latitude-dy,im.longitude+dx,im.latitude+dy].join(','));u.searchParams.set('size','240,240');thumb=`<img src="${esc(u.href)}" alt="" loading="lazy">`}catch{}}
 return `<button class="proj" data-lead="${l.id}"><span class="proj-img">${thumb||icon('home')}</span><span class="proj-body"><b>${esc(l.address)}</b><small>${esc((l.suburb||'').split(',')[0])} · ${esc(l.service)}</small><span class="proj-meta">${badge(l.status)}${l.area>0?tag(`${l.area} m² · ${l.pitch||'?'}°`,true):''}${q?`<span class="proj-q">QT-${q.id}${q.acceptance?' · accepted':q.quoteDocument?' · with customer':' · draft'}</span>`:''}</span></span></button>`}
function renderCustomer(){const c=customers().find(x=>x.key===currentCustomer)||customers().find(x=>x.leads.some(l=>('l:'+l.id)===currentCustomer));if(!c){nav('customers');return}currentCustomer=c.key;const m=meta(c.key),ev=history(c);
 $('#content').innerHTML=`<button class="back" id="cust-back">← All customers</button>
 <div class="cust-head"><span class="cust-avatar lg">${esc(initials(c.name))}</span><div><h1>${esc(c.name)}</h1><p>${c.leads.length} ${c.leads.length>1?'projects':'project'} · customer since ${esc(when(c.firstAt))}</p>
 <div class="hub-contacts">${c.phone?`<a class="hub-contact" href="tel:${esc(digits(c.phone))}">${icon('phone')}${esc(c.phone)}</a>`:''}${c.email?`<a class="hub-contact" href="mailto:${esc(c.email)}">${icon('mail')}${esc(c.email)}</a>`:''}${c.leads.some(l=>l.fb?.source==='messenger')?`<span class="hub-contact">${icon('message')}Messenger</span>`:''}</div></div>
 <div class="cust-actions"><button class="secondary" id="cust-edit">Edit details</button><button class="primary" id="cust-project">${icon('plus')} New project</button></div></div>
 <div class="detail-grid cust-grid"><div>
  <section class="card"><div class="card-header"><h2>Projects</h2><span class="pill">${c.leads.length}</span></div><div class="proj-list">${c.leads.map(projectCard).join('')}</div></section>
  <section class="card"><div class="card-header"><h2>History</h2><span class="pill">All projects</span></div><ol class="cust-history">${ev.map(e=>`<li><span class="ch-ic">${icon(e.icon)}</span><div><p>${e.text}</p>${e.detail?`<small>${esc(e.detail)}</small>`:''}</div><time>${esc(when(e.at))}</time></li>`).join('')||'<li class="muted">No activity yet.</li>'}</ol></section>
 </div><div>
  <section class="card"><div class="card-header"><h2>About this customer</h2></div><dl class="cust-facts">${insights(c).map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl><p class="fb-meta">From this customer’s enquiries, messages, requests and quotes in RoofLead.</p></section>
  <section class="card"><div class="card-header"><h2>Notes</h2>${m.updatedAt?`<small class="muted">Saved ${esc(when(m.updatedAt))}</small>`:''}</div><form id="cust-notes"><div class="cust-tags edit">${m.tags.map((t,i)=>`<span>${esc(t)}<button type="button" data-untag="${i}" aria-label="Remove ${esc(t)}">×</button></span>`).join('')}<input id="cust-tag" placeholder="Add tag" maxlength="24" aria-label="Add tag"></div><textarea name="notes" rows="5" maxlength="4000" placeholder="Gate code, dog in the yard, prefers mornings…">${esc(m.notes)}</textarea><button class="secondary">Save notes</button></form></section>
 </div></div>`;
 $('#cust-back').onclick=()=>nav('customers');
 $$('[data-lead]').forEach(b=>b.onclick=()=>openLead(+b.dataset.lead));
 $('#cust-edit').onclick=()=>editCustomer(c);
 $('#cust-project').onclick=()=>newProject(c);
 $('#cust-notes').onsubmit=e=>{e.preventDefault();m.notes=new FormData(e.target).get('notes').trim();m.updatedAt=Date.now();save();renderCustomer();toast('Notes saved.')};
 const ti=$('#cust-tag');ti.onkeydown=e=>{if(e.key==='Enter'||e.key===','){e.preventDefault();const v=ti.value.trim().replace(/,$/,'');if(v&&!m.tags.includes(v)&&m.tags.length<8){m.tags.push(v);m.updatedAt=Date.now();save();renderCustomer();$('#cust-tag').focus()}}};
 $$('[data-untag]').forEach(b=>b.onclick=()=>{m.tags.splice(+b.dataset.untag,1);save();renderCustomer()});
}
function editCustomer(c){modal(`<h2>Customer details</h2><p>Updates all ${c.leads.length} of ${esc(c.name.split(' ')[0])}’s projects.</p><form id="cust-form"><label class="field">Name<input name="name" required maxlength="120" value="${esc(c.name)}"></label><div class="form-row"><label class="field">Mobile<input name="phone" type="tel" maxlength="40" value="${esc(c.phone)}"></label><label class="field">Email<input name="email" type="email" maxlength="160" value="${esc(c.email)}"></label></div><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save</button></div></form>`);
 $('#cust-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const oldKey=c.key;c.leads.forEach(l=>{l.name=d.name.trim();l.phone=d.phone.trim();l.email=d.email.trim()});save();
  const nc=customers().find(x=>x.leads.some(l=>l.id===c.leads[0].id));if(nc&&nc.key!==oldKey&&state.customerNotes?.[oldKey]){state.customerNotes[nc.key]=state.customerNotes[oldKey];delete state.customerNotes[oldKey];save()}
  $('#modal').close();openCustomer(nc?.key||oldKey);toast('Customer details saved.')}}
function newProject(c){addLead();const f=$('#lead-form');if(!f)return;for(const [k,v] of [['name',c.name],['email',c.email],['phone',c.phone]]){const i=f.querySelector(`[name=${k}]`);if(i&&v)i.value=v}f.querySelector('[name=address]')?.focus();const h=$('#modal h2');if(h)h.textContent=`New project for ${c.name}`}

// ---- Wiring: nav, routing, lead panel link ----
const navBtn=document.createElement('button');navBtn.dataset.nav='customers';navBtn.innerHTML=`<span>${icon('users')||'◉'}</span> Customers`;$('nav [data-nav="quotes"]')?.before(navBtn);navBtn.onclick=()=>nav('customers');
const baseRender=render;render=function(){if(page==='customers'){updateCounts();renderCustomers();return}if(page==='customer'){updateCounts();renderCustomer();return}baseRender()};
const baseNav=nav;nav=function(p){baseNav(p);if(p==='customers')$('#breadcrumb').textContent='Customers'};
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);const head=$('.hub-head');if(!l||!head||head.querySelector('.hub-profile'))return;const c=customerOf(l.id);if(!c)return;
 const who=head.querySelector('.hub-who');const link=document.createElement('button');link.className='hub-profile';link.type='button';
 link.innerHTML=`View profile${c.leads.length>1?` · ${c.leads.length} projects`:''}`;who.append(link);link.onclick=()=>openCustomer(c.key)};
if(page==='customers'||page==='customer')render();
})();
