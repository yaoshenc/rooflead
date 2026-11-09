// Price book (AUD labour/material/equipment rates with units and last-updated
// dates) and reusable quote templates. Templates are applied to a job's quote
// through an editable preview; nothing is saved until the roofer confirms.
(()=>{
const today=()=>new Date().toISOString().slice(0,10);
const uid=p=>p+'-'+crypto.randomUUID().slice(0,8);
const money=n=>Number(n||0).toLocaleString('en-AU',{style:'currency',currency:'AUD'});
const CATS=['Labour','Material','Equipment','Other'];
const SEED_DATE='2026-11-01';
const seedItems=[
 ['callout','Leak investigation call-out','Labour','item',220],['roofer','Roofer labour','Labour','hour',95],['labourer','Labourer','Labour','hour',65],
 ['tile-replace','Replace broken tile','Labour','each',35],['rebed','Re-bed & re-point ridge capping','Labour','m',45],['strip-tile','Strip & dispose tile roof','Labour','m²',22],
 ['strip-metal','Strip & dispose metal roof','Labour','m²',14],['install-metal','Install metal roof sheeting','Labour','m²',34],['install-sarking','Install sarking / insulation blanket','Labour','m²',9],
 ['pressure-clean','Pressure clean roof','Labour','m²',6],['coat','Apply roof membrane coating (2 coats)','Labour','m²',18],['gutter-remove','Remove old gutter','Labour','m',8],
 ['gutter-install','Install gutter','Labour','m',22],['downpipe-install','Install downpipe','Labour','each',75],
 ['sheet','Colorbond roof sheeting','Material','m²',38],['tile-concrete','Concrete roof tile','Material','each',4.2],['tile-terracotta','Terracotta roof tile','Material','each',6.5],
 ['blanket','Anticon insulation blanket','Material','m²',11],['ridge-metal','Metal ridge capping','Material','m',24],['pointing','Flexible pointing compound','Material','m',12],
 ['sealant','Roof sealant / silicone','Material','each',18],['gutter','Colorbond Quad 115 gutter','Material','m',26],['downpipe','Downpipe 90 mm','Material','each',45],
 ['valley','Valley iron','Material','m',30],['coating','Roof membrane coating','Material','m²',8],
 ['edge','Edge protection / safety rail','Equipment','m',22],['skip','Skip bin 6 m³','Equipment','item',480],['ewp','Elevated work platform hire','Equipment','day',450],
].map(([id,name,category,unit,rate])=>({id,name,category,unit,rate,updatedAt:SEED_DATE,sample:true}));
const R=(item,qty,rule='fixed',factor=1)=>({item,qty,rule,factor});
const seedTemplates=[
 {id:'tpl-leak',name:'Leak repair',jobType:'Leak inspection',notes:'Locate and repair a roof leak; replace damaged tiles and seal.',items:[R('callout',1),R('roofer',3),R('tile-replace',6),R('tile-concrete',6),R('sealant',2),R('pointing',3)]},
 {id:'tpl-replace',name:'Roof replacement — tile to Colorbond',jobType:'Roof replacement',notes:'Strip existing tiles, supply and install Colorbond with insulation blanket.',items:[R('strip-tile',180,'roofArea'),R('sheet',190,'orderArea'),R('install-metal',180,'roofArea'),R('blanket',180,'roofArea'),R('install-sarking',180,'roofArea'),R('ridge-metal',30,'ridgeCapping'),R('valley',0,'valleys'),R('edge',60,'perimeter'),R('skip',2)]},
 {id:'tpl-gutter',name:'Gutter & downpipe replacement',jobType:'Roof repair',notes:'Remove old gutters; supply and install Colorbond gutters and downpipes.',items:[R('gutter-remove',40,'eaves'),R('gutter',40,'eaves'),R('gutter-install',40,'eaves'),R('downpipe',4,'downpipes'),R('downpipe-install',4,'downpipes'),R('edge',40,'perimeter')]},
 {id:'tpl-restore',name:'Tile roof restoration',jobType:'Roof restoration',notes:'Clean, repair, re-point and coat an existing tile roof.',items:[R('pressure-clean',180,'roofArea'),R('tile-replace',20),R('tile-concrete',20),R('rebed',30,'ridgeCapping'),R('pointing',30,'ridgeCapping'),R('coat',180,'roofArea'),R('coating',180,'roofArea'),R('edge',60,'perimeter')]},
];
let seeded=false;
if(!Array.isArray(state.priceBook)){state.priceBook=structuredClone(seedItems);seeded=true}
if(!Array.isArray(state.quoteTemplates)){state.quoteTemplates=structuredClone(seedTemplates);seeded=true}
if(seeded)save();

const RULES={fixed:'Fixed quantity',roofArea:'Roof surface area (m²)',orderArea:'Order area incl. waste (m²)',eaves:'Gutter / eaves length (m)',ridgeCapping:'Ridge + hip length (m)',valleys:'Valley length (m)',downpipes:'Downpipe count',perimeter:'Roof perimeter (m)'};
function measured(l,rule){const t=l?.roofEstimate?.quantities;if(rule==='roofArea')return l?.area||t?.surface||null;if(!t)return rule==='orderArea'&&l?.area?Math.round(l.area*1.1*10)/10:null;return {orderArea:t.orderArea,eaves:t.eaves,ridgeCapping:t.ridgeCapping,valleys:t.valleys,downpipes:t.downpipes,perimeter:t.edgeProtection}[rule]??null}
function quantity(l,row){if(row.rule==='fixed')return row.qty;const m=measured(l,row.rule);return m==null?row.qty:Math.round(m*(row.factor||1)*100)/100}
const itemById=id=>state.priceBook.find(i=>i.id===id);
const ageDays=d=>Math.floor((Date.now()-Date.parse(d+'T00:00:00'))/864e5);

// ---- Price book page ----
let tab='items',query='';
function renderPriceBook(){
 const items=state.priceBook.filter(i=>!query||(i.name+' '+i.category).toLowerCase().includes(query.toLowerCase()));
 $('#content').innerHTML=`<div class="page-heading"><div><h1>Your prices, ready to quote.</h1><p>Labour and material rates in AUD (ex GST), plus templates for the jobs you do every week.</p></div><button class="primary" id="pb-add">＋ ${tab==='items'?'Add price item':'New template'}</button></div>
 <div class="card pb-card"><div class="pb-tabs" role="tablist"><button role="tab" aria-selected="${tab==='items'}" class="${tab==='items'?'active':''}" data-pbtab="items">Price book <em>${state.priceBook.length}</em></button><button role="tab" aria-selected="${tab==='templates'}" class="${tab==='templates'?'active':''}" data-pbtab="templates">Quote templates <em>${state.quoteTemplates.length}</em></button>${tab==='items'?`<input class="pb-search" id="pb-search" placeholder="Search items…" value="${esc(query)}" aria-label="Search price items">`:''}</div>
 ${tab==='items'?`<div class="table-scroll"><table class="pb-table"><thead><tr><th>Item</th><th>Category</th><th>Unit</th><th class="num">Rate (AUD)</th><th>Last updated</th><th></th></tr></thead><tbody>${items.map(i=>{const age=ageDays(i.updatedAt);return `<tr><td><b>${esc(i.name)}</b></td><td>${esc(i.category)}</td><td>${esc(i.unit)}</td><td class="num">${money(i.rate)}</td><td><span class="${age>180?'pb-stale':''}">${esc(new Date(i.updatedAt+'T00:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'}))}</span>${age>180?' <span class="pb-stale">· review</span>':''}</td><td class="num"><button class="secondary" data-pbedit="${esc(i.id)}">Edit</button></td></tr>`}).join('')||'<tr><td colspan="6">No items match.</td></tr>'}</tbody></table></div>`
 :`<div class="tpl-grid">${state.quoteTemplates.map(t=>{const est=t.items.reduce((s,r)=>s+(itemById(r.item)?.rate||0)*r.qty,0);return `<article class="tpl-card"><div><span class="eyebrow">${esc(t.jobType)}</span><h3>${esc(t.name)}</h3><p>${esc(t.notes||'')}</p><ul>${t.items.slice(0,5).map(r=>`<li>${esc(itemById(r.item)?.name||'Missing item')} <span>${r.rule==='fixed'?r.qty+' '+esc(itemById(r.item)?.unit||''):'from '+esc(RULES[r.rule].split(' (')[0].toLowerCase())}</span></li>`).join('')}${t.items.length>5?`<li>+ ${t.items.length-5} more</li>`:''}</ul></div><div class="tpl-foot"><small>${t.items.length} items · typical ≈ ${money(est)} ex GST before markup</small><div class="inline-buttons"><button class="secondary" data-tpledit="${esc(t.id)}">Edit</button><button class="secondary" data-tplcopy="${esc(t.id)}">Duplicate</button></div></div></article>`}).join('')}</div>`}</div>`;
 $$('[data-pbtab]').forEach(b=>b.onclick=()=>{tab=b.dataset.pbtab;renderPriceBook()});
 $('#pb-add').onclick=()=>tab==='items'?editItem(null):editTemplate(null);
 const s=$('#pb-search');if(s)s.oninput=e=>{query=e.target.value;const pos=e.target.selectionStart;renderPriceBook();const n=$('#pb-search');n.focus();n.setSelectionRange(pos,pos)};
 $$('[data-pbedit]').forEach(b=>b.onclick=()=>editItem(itemById(b.dataset.pbedit)));
 $$('[data-tpledit]').forEach(b=>b.onclick=()=>editTemplate(state.quoteTemplates.find(t=>t.id===b.dataset.tpledit)));
 $$('[data-tplcopy]').forEach(b=>b.onclick=()=>{const t=structuredClone(state.quoteTemplates.find(t=>t.id===b.dataset.tplcopy));t.id=uid('tpl');t.name+=' (copy)';state.quoteTemplates.push(t);save();renderPriceBook();toast('Template duplicated.')});
}
function editItem(item){
 modal(`<h2>${item?'Edit price item':'Add price item'}</h2><p>Rates are in AUD, excluding GST. Your workspace markup is applied when items go on a quote.</p><form id="pb-form"><label class="field">Name<input name="name" required maxlength="120" value="${esc(item?.name||'')}"></label><div class="form-row"><label class="field">Category<select name="category">${CATS.map(c=>`<option ${c===item?.category?'selected':''}>${c}</option>`).join('')}</select></label><label class="field">Unit<input name="unit" required maxlength="20" list="pb-units" value="${esc(item?.unit||'each')}"><datalist id="pb-units">${['each','m','m²','hour','day','item','litre','sheet'].map(u=>`<option value="${u}">`).join('')}</datalist></label></div><label class="field">Rate (AUD, ex GST)<input name="rate" type="number" min="0" max="1000000" step="0.01" required value="${item?.rate??''}"></label>${item?`<p class="fb-meta">Last updated ${esc(item.updatedAt)}. Saving a new rate records today’s date.</p>`:''}<div class="modal-actions">${item?'<button type="button" class="secondary danger" id="pb-delete">Delete</button>':''}<button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save item</button></div></form>`);
 $('#pb-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));const v={name:d.name.trim(),category:d.category,unit:d.unit.trim(),rate:Math.round(+d.rate*100)/100};
  if(item){const changed=v.rate!==item.rate||v.unit!==item.unit||v.name!==item.name;Object.assign(item,v);if(changed){item.updatedAt=today();item.sample=false}}else state.priceBook.push({id:uid('pb'),...v,updatedAt:today()});
  save();$('#modal').close();renderPriceBook();toast('Price book saved.')};
 if(item)$('#pb-delete').onclick=()=>{const used=state.quoteTemplates.filter(t=>t.items.some(r=>r.item===item.id));if(!confirm(used.length?`Delete “${item.name}”? It is used in ${used.length} template(s); those rows will be removed.`:`Delete “${item.name}”?`))return;state.priceBook=state.priceBook.filter(i=>i!==item);used.forEach(t=>t.items=t.items.filter(r=>r.item!==item.id));save();$('#modal').close();renderPriceBook()};
}
function editTemplate(t){
 const rows=structuredClone(t?.items||[R(state.priceBook[0]?.id,1)]);$('#modal').classList.add('wide-document-dialog');
 modal(`<h2>${t?'Edit template':'New quote template'}</h2><p>Choose price-book items and how each quantity is worked out. Measured quantities use the job’s roof take-off when available, otherwise the default quantity.</p><form id="tpl-form"><div class="form-row"><label class="field">Template name<input name="name" required maxlength="80" value="${esc(t?.name||'')}"></label><label class="field">Job type<select name="jobType">${['Roof repair','Roof replacement','Roof restoration','Leak inspection'].map(j=>`<option ${j===t?.jobType?'selected':''}>${j}</option>`).join('')}</select></label></div><label class="field">Scope notes<textarea name="notes" maxlength="400">${esc(t?.notes||'')}</textarea></label><div id="tpl-rows"></div><button type="button" class="secondary" id="tpl-add-row">＋ Add item</button><div class="modal-actions">${t?'<button type="button" class="secondary danger" id="tpl-delete">Delete template</button>':''}<button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save template</button></div></form>`);
 function read(){$$('#tpl-rows .tpl-row').forEach((el,i)=>{rows[i]={item:el.querySelector('[data-r=item]').value,rule:el.querySelector('[data-r=rule]').value,qty:+el.querySelector('[data-r=qty]').value||0,factor:rows[i]?.factor||1}})}
 function draw(){$('#tpl-rows').innerHTML=rows.map((r,n)=>`<div class="tpl-row"><label class="field">Item<select data-r="item">${state.priceBook.map(i=>`<option value="${esc(i.id)}" ${i.id===r.item?'selected':''}>${esc(i.name)} · ${money(i.rate)}/${esc(i.unit)}</option>`).join('')}</select></label><label class="field">Quantity from<select data-r="rule">${Object.entries(RULES).map(([k,v])=>`<option value="${k}" ${k===r.rule?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">${r.rule==='fixed'?'Quantity':'Default qty'}<input data-r="qty" type="number" min="0" step="0.01" value="${r.qty}"></label><button type="button" class="remove-line" data-rm="${n}" aria-label="Remove row ${n+1}">×</button></div>`).join('');$$('[data-rm]').forEach(b=>b.onclick=()=>{read();rows.splice(+b.dataset.rm,1);draw()});$$('#tpl-rows [data-r=rule]').forEach(s=>s.onchange=()=>{read();draw()})}
 draw();$('#tpl-add-row').onclick=()=>{read();rows.push(R(state.priceBook[0]?.id,1));draw()};
 $('#tpl-form').onsubmit=e=>{e.preventDefault();read();const d=Object.fromEntries(new FormData(e.target));if(!rows.length)return toast('Add at least one item.');const v={name:d.name.trim(),jobType:d.jobType,notes:d.notes.trim(),items:rows};if(t)Object.assign(t,v);else state.quoteTemplates.push({id:uid('tpl'),...v});save();$('#modal').close();renderPriceBook();toast('Template saved.')};
 if(t)$('#tpl-delete').onclick=()=>{if(!confirm(`Delete template “${t.name}”?`))return;state.quoteTemplates=state.quoteTemplates.filter(x=>x!==t);save();$('#modal').close();renderPriceBook()};
}

// ---- Apply a template to a job's quote ----
function applyTemplate(q,l,preset){
 const markup=+state.settings.margin||0;let tpl=state.quoteTemplates.find(t=>t.id===preset)||state.quoteTemplates.find(t=>t.jobType===l.service)||state.quoteTemplates[0];let rows=[];
 if(!tpl)return toast('Create a quote template in the Price book first.');
 $('#modal').classList.add('wide-document-dialog');
 modal(`<span class="eyebrow">APPLY QUOTE TEMPLATE</span><h2>${esc(l.address)}</h2><p>Check every quantity and rate. Measured quantities come from this job’s ${l.roofEstimate?'aerial take-off':'property brief'}${l.roofEstimate?'':' (no take-off yet — defaults used where missing)'}.</p><form id="apply-form"><div class="form-row"><label class="field">Template<select id="apply-tpl">${state.quoteTemplates.map(t=>`<option value="${esc(t.id)}" ${t===tpl?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label class="field" ${q?.pricingLines||q?.area>0?'':'hidden'}>How to add<select name="mode"><option value="replace">Replace existing line items</option><option value="append">Add to existing line items</option></select></label></div><label class="review-outline"><input type="checkbox" name="markup" ${markup?'checked':''}> Apply workspace markup (${markup}%) to price-book rates</label><div class="table-scroll"><table class="pb-table apply-table"><thead><tr><th>Description</th><th class="num">Qty</th><th>Unit</th><th class="num">Rate (AUD)</th><th class="num">Amount</th><th></th></tr></thead><tbody id="apply-rows"></tbody></table></div><div class="apply-total"><span>Subtotal (ex GST)</span><b id="apply-subtotal"></b></div><label class="review-outline"><input type="checkbox" name="saveRates"> Save changed base rates back to the price book (records today’s date)</label><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save to quote</button></div></form>`);
 const factor=()=>$('#apply-form [name=markup]').checked?1+markup/100:1;
 function build(){rows=tpl.items.map(r=>{const it=itemById(r.item);return it&&{priceItemId:it.id,description:it.name,quantity:quantity(l,r),unit:it.unit,base:it.rate,rate:Math.round(it.rate*factor()*100)/100,rule:r.rule,measured:r.rule!=='fixed'&&measured(l,r.rule)!=null}}).filter(Boolean)}
 function read(){$$('#apply-rows tr').forEach((tr,i)=>{const r=rows[i];r.description=tr.querySelector('[data-a=d]').value;r.quantity=+tr.querySelector('[data-a=q]').value;r.rate=+tr.querySelector('[data-a=r]').value})}
 function draw(){$('#apply-rows').innerHTML=rows.map((r,i)=>`<tr><td><input data-a="d" maxlength="200" value="${esc(r.description)}" aria-label="Description"><small>${r.rule==='fixed'?'Fixed quantity':r.measured?'Measured: '+esc(RULES[r.rule].split(' (')[0].toLowerCase()):'Default — no measurement yet'}</small></td><td class="num"><input data-a="q" type="number" min="0" step="0.01" value="${r.quantity}" aria-label="Quantity"></td><td>${esc(r.unit)}</td><td class="num"><input data-a="r" type="number" min="0" step="0.01" value="${r.rate}" aria-label="Rate"></td><td class="num" data-amount="${i}">${money(r.quantity*r.rate)}</td><td><button type="button" class="remove-line" data-arm="${i}" aria-label="Remove ${esc(r.description)}">×</button></td></tr>`).join('');totals();$$('#apply-rows input').forEach(i=>i.oninput=()=>{read();totals()});$$('[data-arm]').forEach(b=>b.onclick=()=>{read();rows.splice(+b.dataset.arm,1);draw()})}
 function totals(){rows.forEach((r,i)=>{const c=$(`[data-amount="${i}"]`);if(c)c.textContent=money(r.quantity*r.rate)});$('#apply-subtotal').textContent=money(rows.reduce((s,r)=>s+r.quantity*r.rate,0))}
 build();draw();
 $('#apply-tpl').onchange=e=>{tpl=state.quoteTemplates.find(t=>t.id===e.target.value);build();draw()};
 $('#apply-form [name=markup]').onchange=()=>{read();rows.forEach(r=>{r.rate=Math.round(r.base*factor()*100)/100});draw()};
 $('#apply-form').onsubmit=e=>{e.preventDefault();read();const d=new FormData(e.target);const keep=rows.filter(r=>r.quantity>0&&r.description.trim());if(!keep.length)return toast('Add at least one item with a quantity.');
  try{Commercial.totals(keep.map(r=>({description:r.description,quantity:r.quantity,unit:r.unit,rate:r.rate})),q?q.gst:state.settings.gst)}catch(err){return toast(err.message)}
  if(d.get('saveRates')){const f=factor();keep.forEach(r=>{const it=itemById(r.priceItemId),base=Math.round(r.rate/f*100)/100;if(it&&Math.abs(base-it.rate)>=0.01){it.rate=base;it.updatedAt=today();it.sample=false}})}
  const lines=keep.map(r=>({description:r.description.trim(),quantity:r.quantity,unit:r.unit,rate:r.rate,priceItemId:r.priceItemId,templateId:tpl.id,areaLinked:r.rule==='roofArea'}));
  if(!q){q={id:Math.max(1000,...state.quotes.map(x=>x.id))+1,leadId:l.id,status:'Draft',area:l.area||0,...state.settings};state.quotes.unshift(q)}
  const existing=q.pricingLines?structuredClone(q.pricingLines):q.area>0?Commercial.lines(q):[];q.pricingLines=d.get('mode')==='append'?[...existing,...lines]:lines;
  if(tpl.notes&&!q.documentDetails?.scope){q.documentDetails={...(q.documentDetails||{}),scope:tpl.notes}}
  if(q.quoteDocument)q.revision=(q.revision||1)+1;q.quoteDocument=null;q.status='Draft';q.templateId=tpl.id;if(typeof docEvent==='function')docEvent(q,'Template applied: '+tpl.name);
  save();$('#modal').close();openQuote(q.id);toast('Template applied. Review the quotation before sharing.')};
}
window.applyQuoteTemplate=applyTemplate;

// ---- Wiring: nav, quote page, lead page ----
const navBtn=document.createElement('button');navBtn.dataset.nav='pricebook';navBtn.innerHTML='<span>☷</span> Price book';$('nav [data-nav="settings"]')?.before(navBtn);navBtn.onclick=()=>nav('pricebook');
const baseRender=render;render=function(){if(page==='pricebook'){updateCounts();renderPriceBook();return}baseRender()};
const baseNav=nav;nav=function(p){baseNav(p);if(p==='pricebook')$('#breadcrumb').textContent='Price book'};
const baseQuote=renderQuote;renderQuote=function(){baseQuote();const q=state.quotes.find(x=>x.id===currentId);if(!q||q.acceptance)return;const l=state.leads.find(x=>x.id===q.leadId);const edit=$('#edit-commercial');if(!edit||!l)return;const b=document.createElement('button');b.className='secondary full';b.id='apply-template';b.style.marginTop='10px';b.textContent='☷ Apply quote template';edit.after(b);b.onclick=()=>applyTemplate(q,l)};
const baseDetail=renderDetail;renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);if(!l||state.quotes.some(q=>q.leadId===l.id))return;const anchor=$('#open-roof-editor')?.closest('.roof-measure-entry')||$('.research-card');if(!anchor)return;const box=document.createElement('div');box.className='tpl-start';box.innerHTML=`<div><b>Start a quote from a template</b><span>${state.quoteTemplates.length} templates · rates from your price book</span></div><button class="secondary" id="quote-from-template">Choose template</button>`;anchor.after(box);
 $('#quote-from-template').onclick=()=>applyTemplate(null,l)};
if(page==='pricebook')render();
})();
