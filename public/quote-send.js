// Sending quotations to customers by email and SMS, automatically when a
// quotation is prepared (or manually with a preview), plus a Messages page
// listing every message RoofLead sends: information requests, quotations,
// quote follow-ups, invoice reminders, job sheets and weather reschedules.
(()=>{
const S=state.settings;
const DEFAULTS={qsAuto:true,
 qsSubject:'Your roofing quotation for {address} — {number}',
 qsEmail:'Hi {first_name},\n\nThanks for having us out to look at your roof. Your quotation for {address} is ready.\n\n{summary}\n\nYou can view the full quotation, accept it and pay the {deposit} deposit online here — it takes about two minutes:\n{link}\n\nThe quotation is also attached as a PDF. It’s valid until {valid_until}. If you have any questions or would like anything changed, just reply to this email or call {phone}.\n\nThanks,\n{business}',
 qsSms:'Hi {first_name}, {business} here. Your roof quote for {address} is ready: {total} incl. GST. View and accept online: {link}'};
for(const [k,v] of Object.entries(DEFAULTS))if(S[k]===undefined)S[k]=v;
// Quotations shared before email/SMS sending existed get a delivery record from their shared date.
function backfill(){if(document.body.classList.contains("portal-mode"))return;let n=0;for(const q of state.quotes){if(q.sends?.length||!q.sharedAt||!q.quoteDocument)continue;const l=state.leads.find(x=>x.id===q.leadId)||{};const channels=[],to=[];if(l.email){channels.push('email');to.push(l.email)}if(l.phone){channels.push('SMS');to.push(l.phone)}if(!channels.length)continue;try{q.sends=[{at:q.sharedAt,auto:true,channels,to,subject:fill(S.qsSubject,q),email:l.email?fill(S.qsEmail,q):'',sms:l.phone?fill(S.qsSms,q):''}];n++}catch{}}if(n)save()}
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n||0);
const when=t=>new Date(t).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});
const leadOf=q=>state.leads.find(l=>l.id===q.leadId)||{};
const chan=a=>[].concat(a||[]).filter(Boolean).map(c=>c==='email'?'Email':c).join(' + ');
const first=n=>(n||'').trim().split(/\s+/)[0]||'there';
function fill(t,q){const d=q.quoteDocument,l=leadOf(q),dep=window.quoteDepositFor?quoteDepositFor(q):0;
 const top=(d.items||[]).slice().sort((a,b)=>b.amount-a.amount).slice(0,3).map(i=>`• ${i.description}`).join('\n');
 const summary=`Scope: ${d.scope||l.service||'Roofing works'}\n${top}${(d.items||[]).length>3?`\n• …and ${d.items.length-3} more items`:''}\nTotal: ${money(d.total)} incl. GST`;
 return t.replaceAll('{first_name}',first(d.customer.name)).replaceAll('{address}',l.address||d.property).replaceAll('{number}',d.number).replaceAll('{total}',money(d.total)).replaceAll('{deposit}',dep?money(dep):'').replace(/ and pay the\s+deposit/,'').replaceAll('{valid_until}',new Date(d.validUntil+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'})).replaceAll('{link}',window.quoteLink?quoteLink(q):'').replaceAll('{summary}',summary).replaceAll('{scope}',d.scope||'').replaceAll('{business}',d.business?.name||state.business?.name||'').replaceAll('{phone}',d.business?.phone||state.business?.phone||'us').trim()}
function emailHtml(text,q,pdfSize){return text.split('\n').map(line=>{const t=line.trim();if(/^https?:\/\//.test(t))return `<p><a class="mail-button" href="${esc(t)}" target="_blank" rel="noopener">View and accept quotation →</a></p>`;if(/^•/.test(t))return `<p class="mail-li">${esc(t.slice(1).trim())}</p>`;if(/^(Scope|Total):/.test(t)){const [k,...v]=t.split(':');return `<p class="mail-kv"><span>${esc(k)}</span><b>${esc(v.join(':').trim())}</b></p>`}return t?`<p>${esc(line)}</p>`:''}).join('')+`<div class="mail-attach"><span class="pdf-ic">PDF</span><div><b>${esc(q.quoteDocument.number)}.pdf</b><small>${pdfSize?Math.max(1,Math.round(pdfSize/1024))+' KB':'Quotation'}</small></div></div>`}
async function pdfSize(q){try{return Commercial.pdf(q.quoteDocument).output('blob').size}catch{return 0}}

function record(q,{auto,channels,to,subject,email,sms}){const l=leadOf(q);(q.sends ||= []).push({at:new Date().toISOString(),auto,channels,to,subject,email,sms});
 if(window.markQuoteShared)markQuoteShared(q);else if(!q.sharedAt)q.sharedAt=new Date().toISOString();
 docEvent(q,`Quotation ${q.sends.length>1?'re-sent':'sent'}${auto?' automatically':''} by ${channels.join(' and ')} to ${to.join(' and ')}`);
 if(l.id&&!['Accepted','Quoted'].includes(l.status))l.status='Quoted';else if(l.id&&l.status!=='Accepted')l.status='Quoted';save()}
function compose(q){const l=leadOf(q),d=q.quoteDocument;return {email:l.email||d.customer.email||'',phone:l.phone||'',subject:fill(S.qsSubject,q),text:fill(S.qsEmail,q),sms:fill(S.qsSms,q)}}
function sendNow(q,{auto=false,useEmail=true,useSms=true,email,phone,subject,text,sms}={}){const c=compose(q);email=email??c.email;phone=phone??c.phone;
 const channels=[],to=[];if(useEmail&&email){channels.push('email');to.push(email)}if(useSms&&phone){channels.push('SMS');to.push(phone)}
 if(!channels.length)return false;record(q,{auto,channels,to,subject:subject??c.subject,email:useEmail&&email?(text??c.text):'',sms:useSms&&phone?(sms??c.sms):''});return true}
window.sendQuotation=sendNow;

// Prepare → send automatically (when enabled) or open the send window.
let autoFor=null;
const basePrepare=prepareQuotation;
prepareQuotation=async function(q,l){autoFor=!q.quoteDocument&&S.qsAuto?q.id:null;return basePrepare(q,l)};
shareQuotation=function(q){if(!q.quoteDocument)return;if(autoFor===q.id){autoFor=null;const c=compose(q);if(c.email||c.phone){sendNow(q,{auto:true});renderQuote();openSend(q,{justSent:true});return}}openSend(q,{})};
async function openSend(q,{justSent}){const c=compose(q),last=q.sends?.at(-1),size=await pdfSize(q);let ch='email';
 modal(`<span class="eyebrow">${justSent?'SENT AUTOMATICALLY':'SEND QUOTATION'}</span><h2>${justSent?`Sent to ${esc(first(q.quoteDocument.customer.name))}`:'Send to your customer'}</h2><p>${justSent?`${esc(q.quoteDocument.number)} went out by ${esc(last.channels.join(' and '))} ${esc(when(last.at))}. Follow-ups are scheduled automatically.`:`${esc(q.quoteDocument.number)} · ${money(q.quoteDocument.total)} incl. GST`}</p>
 <form id="qs-form"><div class="qs-to"><label class="qs-ch"><input type="checkbox" name="useEmail" ${c.email?'checked':''} ${justSent?'disabled':''}> Email<input name="email" type="email" value="${esc(c.email)}" placeholder="Customer email" ${justSent?'disabled':''}></label><label class="qs-ch"><input type="checkbox" name="useSms" ${c.phone?'checked':''} ${justSent?'disabled':''}> SMS<input name="phone" type="tel" value="${esc(c.phone)}" placeholder="Customer mobile" ${justSent?'disabled':''}></label></div>
 <div class="request-channel-tabs"><button type="button" data-qsch="email" class="active">Email</button><button type="button" data-qsch="sms">SMS</button></div><div id="qs-prev"></div>
 <div class="modal-actions"><button type="button" class="secondary" id="qs-pdf">Download PDF</button><button type="button" class="secondary" id="qs-open">Open customer view ↗</button>${justSent?'<button type="button" class="primary" data-close>Done</button>':`<button class="primary">${q.sends?.length?'Send again':'Send quotation'}</button>`}</div></form>`);
 const f=$('#qs-form');const wide=matchMedia('(min-width:900px)');
 const mailView=to=>`<div class="mail"><div class="mail-head"><div><span>From</span><b>${esc(state.business?.name||'')}${state.business?.email?' &lt;'+esc(state.business.email)+'&gt;':''}</b></div><div><span>To</span><b>${esc(to||'No email')}</b></div><div><span>Subject</span><b>${esc(c.subject)}</b></div></div><div class="mail-body">${emailHtml(c.text,q,size)}</div></div>`;
 const smsView=to=>`<div class="phone"><div class="phone-top"><b>${esc(state.business?.name||'')}</b><span>To ${esc(to||'no mobile')}</span></div><div class="phone-bubble">${esc(c.sms).replace(/(https?:\/\/\S+)/g,'<u>$1</u>')}</div><small>${[...c.sms].length} characters · ${[...c.sms].length<=160?1:Math.ceil([...c.sms].length/153)} SMS</small></div>`;
 // Wide screens show the email and the SMS side by side; narrow screens use the Email / SMS tabs.
 const draw=()=>{if(!$('#qs-prev'))return wide.removeEventListener('change',draw);const both=wide.matches;$('#qs-form .request-channel-tabs').style.display=both?'none':'';$$('[data-qsch]').forEach(b=>b.classList.toggle('active',b.dataset.qsch===ch));
  $('#qs-prev').innerHTML=both?`<div class="qs-both"><section><h3>Email</h3>${mailView(f.email.value)}</section><section><h3>SMS</h3>${smsView(f.phone.value)}</section></div>`:ch==='email'?mailView(f.email.value):smsView(f.phone.value)};
 draw();wide.addEventListener('change',draw);$$('[data-qsch]').forEach(b=>b.onclick=()=>{ch=b.dataset.qsch;draw()});f.email.oninput=draw;f.phone.oninput=draw;
 $('#qs-pdf').onclick=()=>Commercial.pdf(q.quoteDocument).save(q.quoteDocument.number+'.pdf');
 $('#qs-open').onclick=()=>{$('#modal').close();window.open(window.quoteLink?quoteLink(q):'#','_blank','noopener')};
 f.onsubmit=e=>{e.preventDefault();if(justSent)return;const v=Object.fromEntries(new FormData(f));const ok=sendNow(q,{useEmail:!!v.useEmail,useSms:!!v.useSms,email:v.email.trim(),phone:v.phone.trim()});
  if(!ok)return toast('Add an email or mobile number to send the quotation.');const l=leadOf(q);if(v.email.trim()&&!l.email)l.email=v.email.trim();if(v.phone.trim()&&!l.phone)l.phone=v.phone.trim();save();$('#modal').close();renderQuote();toast(`Quotation sent to ${first(q.quoteDocument.customer.name)}.`)}}

// ---- Quote page: delivery card ----
function viewMsg(m,title){modal(`<span class="eyebrow">${esc(title)}</span><h2>Sent ${esc(when(m.at))}</h2><p>By ${esc((m.channels||[]).join(' and ')||m.channels||'')}${m.auto?' · automatically':''}${m.to?' · to '+esc([].concat(m.to).join(', ')):''}</p>${m.email?`<div class="mail">${m.subject?`<div class="mail-head"><div><span>Subject</span><b>${esc(m.subject)}</b></div></div>`:''}<div class="mail-body">${m.email.split('\n').map(x=>/^https?:/.test(x.trim())?`<p><a class="mail-button" href="${esc(x.trim())}" target="_blank" rel="noopener">Open link →</a></p>`:x.trim()?`<p>${esc(x)}</p>`:'').join('')}</div></div>`:''}${m.sms?`<div class="phone" style="margin-top:12px"><div class="phone-bubble">${esc(m.sms)}</div></div>`:''}${m.text&&!m.email&&!m.sms?`<div class="phone"><div class="phone-bubble">${esc(m.text)}</div></div>`:''}<div class="modal-actions"><button class="primary" data-close>Close</button></div>`)}
window.rlViewMessage=viewMsg;
const baseQuote=renderQuote;
renderQuote=function(){baseQuote();const q=state.quotes.find(x=>x.id===currentId);if(!q?.quoteDocument)return;const side=$('.commercial-layout')?.children[1];if(!side)return;const sends=q.sends||[];
 const steps=[['Sent',sends[0]?.at],['Opened by customer',q.viewedAt],['Accepted',q.acceptance?.acceptedAt]];
 const card=document.createElement('section');card.className='card qs-card';
 card.innerHTML=`<div class="card-header"><h2>Quotation delivery</h2><span class="badge ${q.acceptance?'ready':q.viewedAt?'research':sends.length?'quoted':'new'}">${q.acceptance?'Accepted':q.viewedAt?'Opened':sends.length?'Sent':'Not sent'}</span></div>
 <ol class="qf-list">${steps.map(([k,t])=>`<li class="${t?'done':''}"><span class="qf-dot">${t?'✓':''}</span><div><b>${k}</b><small>${t?esc(when(t)):'—'}</small></div></li>`).join('')}</ol>
 ${sends.length?`<ul class="qs-sends">${sends.map((s,i)=>`<li><div><b>${esc(chan(s.channels))}</b><small>${esc(s.to.join(', '))} · ${esc(when(s.at))}${s.auto?' · automatic':''}</small></div><button class="fu-link" data-qs-view="${i}">View</button></li>`).join('')}</ul>`:''}
 ${q.acceptance?'':`<button class="${sends.length?'secondary':'primary'} full" id="qs-send">${sends.length?'Send again':'Send quotation'}</button>`}`;
 const after=side.querySelector('.portal-card')||side.children[0];after.after(card);
 $('#qs-send')&&($('#qs-send').onclick=()=>openSend(q,{}));$$('[data-qs-view]').forEach(b=>b.onclick=()=>viewMsg(sends[+b.dataset.qsView],'QUOTATION '+q.quoteDocument.number))};

// ---- Settings ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card';
 card.innerHTML=`<h2>Sending quotations</h2><p>How quotations reach your customers by email and SMS.</p><div class="connection"><div><b>Send automatically when prepared</b><p>Turn off to review each email and SMS before it goes.</p></div><button type="button" class="toggle ${S.qsAuto?'on':''}" id="qs-toggle" role="switch" aria-checked="${S.qsAuto}" aria-label="Send quotations automatically"></button></div>
 <label class="field">Email subject<input name="qsSubject" maxlength="160" value="${esc(S.qsSubject)}"></label><label class="field">Email message<textarea name="qsEmail" rows="9">${esc(S.qsEmail)}</textarea></label><label class="field">SMS message<textarea name="qsSms" rows="2">${esc(S.qsSms)}</textarea></label>
 <p class="fb-meta">Placeholders: {first_name} {address} {number} {summary} {total} {deposit} {valid_until} {link} {business} {phone}. The quotation PDF is attached to the email.</p><div class="inline-buttons"><button class="primary">Save</button><button type="button" class="secondary" id="qs-default">Restore defaults</button></div>`;
 grid.append(card);$('#qs-toggle').onclick=e=>{S.qsAuto=!S.qsAuto;e.currentTarget.classList.toggle('on',S.qsAuto);e.currentTarget.setAttribute('aria-checked',S.qsAuto);save()};
 $('#qs-default').onclick=()=>{for(const k of ['qsSubject','qsEmail','qsSms'])S[k]=DEFAULTS[k];save();renderSettings()};
 card.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(card));for(const k of Object.keys(d))S[k]=String(d[k]).trim()||DEFAULTS[k];save();toast('Quotation messages saved.')}};

// ---- Messages page: everything RoofLead has sent ----
function allMessages(){const out=[];const L=id=>state.leads.find(l=>l.id===id);
 for(const l of state.leads){for(const m of l.followupFlow?.messages||[])out.push({at:+new Date(m.at),type:m.reminder?'Information reminder':'Information request',lead:l,auto:m.auto,channels:String(m.channels||'').split(' and '),subject:m.subject,email:m.email,sms:m.sms});
  for(const m of l.fb?.messages||[])if(m.from==='business')out.push({at:m.at,type:m.auto?'Messenger auto-reply':'Messenger reply',lead:l,auto:m.auto,channels:['Messenger'],text:m.text});
  if(l.job?.sentAt)out.push({at:l.job.sentAt,type:'Job sheet',lead:l,auto:false,channels:['SMS'],to:state.crews?.find(c=>c.id===l.job.crewId)?.contact,text:`Job sheet for ${l.address}`});
  for(const m of l.job?.messages||[])out.push({at:m.at,type:m.to==='crew'?'Reschedule (crew)':'Reschedule (customer)',lead:l,auto:false,channels:['SMS'],text:m.text})}
 for(const q of state.quotes){const l=L(q.leadId);if(!l)continue;for(const s of q.sends||[])out.push({at:+new Date(s.at),type:'Quotation',lead:l,auto:s.auto,channels:s.channels,to:s.to,subject:s.subject,email:s.email,sms:s.sms,ref:q.quoteDocument?.number});
  for(const s of q.followups?.sent||[])out.push({at:+new Date(s.at),type:`Quote follow-up (day ${s.day})`,lead:l,auto:s.auto,channels:String(s.channels).split(' and '),email:s.email,sms:s.sms,ref:q.quoteDocument?.number})}
 for(const i of state.invoices||[]){const q=state.quotes.find(x=>x.id===i.quoteId),l=q&&L(q.leadId);if(!l)continue;for(const r of i.reminders||[])out.push({at:+new Date(r.at),type:'Invoice reminder',lead:l,auto:r.auto,channels:String(r.channels).split(' and '),email:r.email,sms:r.sms,ref:i.number})}
 return out.filter(m=>Number.isFinite(m.at)).sort((a,b)=>b.at-a.at)}
window.rlMessages=allMessages;
let msgFilter='All';
function renderMessages(){const all=allMessages();const types=['All','Quotation','Quote follow-up','Information','Invoice reminder','Messenger','Job sheet','Reschedule'];const list=all.filter(m=>msgFilter==='All'||m.type.startsWith(msgFilter));
 const day=Date.now()-864e5,week=Date.now()-7*864e5;
 $('#content').innerHTML=`<div class="page-heading"><div><h1>Messages</h1><p>Everything RoofLead has sent to customers and crews · ${all.filter(m=>m.at>day).length} in the last 24 hours · ${all.filter(m=>m.at>week&&m.auto).length} automatic this week</p></div></div>
 <section class="panel"><div class="toolbar"><div class="filters">${types.filter(t=>t==='All'||t===msgFilter||all.some(m=>m.type.startsWith(t))).map(t=>`<button class="filter ${t===msgFilter?'active':''}" data-mf="${esc(t)}">${esc(t)}<span>${t==='All'?all.length:all.filter(m=>m.type.startsWith(t)).length}</span></button>`).join('')}</div></div>
 <ul class="msg-list">${list.map((m,i)=>`<li tabindex="0" data-mi="${i}"><span class="msg-type">${esc(m.type)}</span><div class="msg-main"><b>${esc(m.lead.name)} · ${esc(m.lead.address)}</b><small>${esc((m.subject||m.sms||m.text||m.email||'').split('\n')[0].slice(0,120))}</small></div><div class="msg-meta"><span>${esc(chan(m.channels))}</span><small>${esc(when(m.at))}${m.auto?' · auto':''}</small></div></li>`).join('')||'<li class="empty">No messages yet.</li>'}</ul></section>`;
 $$('[data-mf]').forEach(b=>b.onclick=()=>{msgFilter=b.dataset.mf;renderMessages()});
 $$('[data-mi]').forEach(r=>{const m=list[+r.dataset.mi];r.onclick=()=>viewMsg({...m,channels:m.channels},m.type.toUpperCase()+(m.ref?' · '+m.ref:''));r.onkeydown=e=>{if(e.key==='Enter')r.click()}})}
const navBtn=document.createElement('button');navBtn.dataset.nav='messages';navBtn.innerHTML='<span>✉</span> Messages';$('nav [data-nav="pricebook"]')?.before(navBtn);navBtn.onclick=()=>nav('messages');
const baseRender=render;render=function(){if(page==='messages'){updateCounts();renderMessages();return}baseRender()};
const baseNav=nav;nav=function(p){baseNav(p);if(p==='messages')$('#breadcrumb').textContent='Messages'};
backfill();setTimeout(backfill,4000);
if(page==='messages')render();
})();
