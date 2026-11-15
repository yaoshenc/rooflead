// Customer information requests: readable email + SMS messages, a one-tap
// online answer form for the customer (answers sync back automatically),
// automatic sending for new leads and timed reminders that stop once the
// customer has answered.
(()=>{
const S=state.settings;
const DEFAULTS={
 reqSubject:'Your roofing quote for {address} — {count} quick questions',
 reqEmail:'Hi {first_name},\n\nThanks for getting in touch with {business} about your roof at {address}. To prepare an accurate quote, we just need a few details:\n\n{questions}\n\nYou can answer and add photos here — it takes about 2 minutes, no account needed:\n{link}\n\nPlease don’t climb onto the roof — photos from the ground or a window are perfect.\n\nThanks,\n{business}\n{phone}',
 reqSms:'Hi {first_name}, {business} here about your roof at {address}. {count} quick questions + photos (2 min): {link}',
 reminderEmail:'Hi {first_name},\n\nJust a friendly reminder — we’re ready to prepare your roofing quote for {address} as soon as we have a few details:\n\n{questions}\n\nAnswer here in about 2 minutes:\n{link}\n\nThanks,\n{business}\n{phone}',
 reminderSms:'Hi {first_name}, reminder from {business}: {count} quick questions for your roof quote: {link}',
 reminderHours:48,maxReminders:2,
};
for(const [k,v] of Object.entries(DEFAULTS))if(S[k]===undefined)S[k]=v;
const H=36e5;
const first=l=>(l.name||'').trim().split(/\s+/)[0]||'there';
const biz=()=>state.business?.name||'our team';
const shortAddr=l=>l.address||'your property';
const open=l=>outstanding(l);
const jobKey=l=>(l.photoKey ||= crypto.randomUUID());
const when=t=>new Date(t).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});

function fill(tpl,l,{numbered=true}={}){const qs=open(l);return tpl
 .replaceAll('{first_name}',first(l)).replaceAll('{business}',biz()).replaceAll('{phone}',state.business?.phone||'').replaceAll('{address}',shortAddr(l))
 .replaceAll('{count}',String(qs.length||'a few')).replaceAll('{questions}',qs.map((q,i)=>numbered?`${i+1}. ${q.label}`:q.label).join('\n'))
 .replaceAll('{link}',l.uploadLink||'(secure link is added when sent)').replace(/\n{3,}/g,'\n\n').trim()}
const isReminder=l=>(l.followupFlow?.sent||0)>0;
const message=(l,ch,reminder=isReminder(l))=>ch==='SMS'?fill(reminder?S.reminderSms:S.reqSms,l):fill(reminder?S.reminderEmail:S.reqEmail,l);
const subject=(l,reminder=isReminder(l))=>(reminder?'Reminder: ':'')+fill(S.reqSubject,l);
followupMessage=l=>message(l,'Email');
// Keep delivery history when the question list is rebuilt (e.g. after research), and send new automatic requests straight away.
const basePrepare=prepareFollowupFlow;
prepareFollowupFlow=function(l,manual=false){const old=l.followupFlow;basePrepare(l,manual);const f=l.followupFlow;if(old&&f&&f!==old){for(const k of ['sent','lastSentAt','messages','openedAt','answeredAt','channel'])if(old[k]!==undefined)f[k]=old[k];if(old.sent)f.reminderAt=old.reminderAt;f.items.forEach(q=>{const o=old.items?.find(x=>x.label===q.label);if(o?.online)q.online=true});save()}
 if(!manual&&f&&!f.sent&&S.autoRequest)setTimeout(()=>send(l,{auto:true}).then(ok=>{if(ok&&page==='detail'&&currentId===l.id)renderDetail()}),300)};

// Create (or reuse) the customer's secure request link with the current questions.
async function ensureLink(l){const qs=l.followupFlow?.items||[];
 const r=await fetch('/api/upload-links',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({job:jobKey(l),label:l.address+(l.suburb?', '+l.suburb:''),days:14,reuse:!!l.uploadLink,questions:qs.filter(q=>!q.answer?.trim()).map(q=>({id:q.id,label:q.label})),business:biz(),phone:state.business?.phone||''})});
 const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create the request link');if(d.url)l.uploadLink=d.url;l.uploadLinkActive=true;l.uploadLinkExpires=d.expiresAt;save();return l.uploadLink}
window.ensureInfoLink=ensureLink;

async function send(l,{auto=false}={}){const f=l.followupFlow;if(!f||!open(l).length)return false;
 if(!l.email&&!l.phone){if(!auto)toast('Add an email or mobile number for '+first(l)+' first.');return false}
 try{await ensureLink(l)}catch(e){if(!auto)toast(e.message);return false}
 const reminder=isReminder(l),channels=[l.email&&'email',l.phone&&'SMS'].filter(Boolean).join(' and ');
 f.sent=(f.sent||0)+1;f.lastSentAt=Date.now();f.reminderAt=Date.now()+(+S.reminderHours||48)*H;f.reminderPrepared=false;f.channel=channels;
 (f.messages ||= []).push({at:Date.now(),reminder,auto,channels,subject:subject(l,reminder),email:l.email?message(l,'Email',reminder):'',sms:l.phone?message(l,'SMS',reminder):''});
 f.history.push({event:`${reminder?'Reminder':'Information request'} sent ${auto?'automatically ':''}by ${channels}`,at:Date.now()});
 l.request=true;if(l.status!=='Quoted'&&l.status!=='Accepted')l.status='Awaiting customer';save();
 if(!auto)toast(`${reminder?'Reminder':'Request'} sent to ${first(l)} by ${channels}.`);return true}

// Apply answers the customer gave on their request form.
const syncing=new Set();
async function syncAnswers(l,{quiet=false}={}){const f=l.followupFlow;if(!f||!l.photoKey||syncing.has(l.id))return;syncing.add(l.id);
 try{const r=await fetch('/api/photos?job='+encodeURIComponent(l.photoKey),{cache:'no-store'});if(!r.ok)return;const d=await r.json();const link=d.link;if(!link)return;let changed=false;
  if(link.openedAt&&!f.openedAt){f.openedAt=link.openedAt;f.history.push({event:'Customer opened the request form',at:link.openedAt});changed=true}
  if(link.answeredAt&&link.answeredAt!==f.answeredAt){let n=0;for(const q of f.items){const a=link.answers?.[q.id];if(a&&a!==q.answer){q.answer=a;q.online=true;n++}}f.answeredAt=link.answeredAt;
   if(n){const left=open(l).length;f.history.push({event:`Customer answered ${n} question${n>1?'s':''} online${left?' · '+left+' still needed':''}`,at:link.answeredAt});
    if(!left){f.paused=true;l.request=false;if(l.status==='Awaiting customer')l.status=l.area?'Ready to quote':'Needs review';f.history.push({event:'All details received · reminders stopped',at:Date.now()})}
    if(!quiet)toast(`${first(l)} answered ${n} question${n>1?'s':''} online${left?'':' — all details received'}.`)}changed=true}
  if(changed){save();if(page==='detail'&&currentId===l.id)renderDetail();else if(page==='leads')render()}
 }catch{}finally{syncing.delete(l.id)}}

// Automation tick: send requests for new leads, send due reminders, collect answers.
async function tick(){if(document.body.classList.contains('portal-mode'))return;for(const l of state.leads){const f=l.followupFlow;if(!f)continue;
  if(f.sent)await syncAnswers(l,{quiet:false});
  if(f.paused||!open(l).length||!S.autoRequest)continue;
  if(!f.sent)await send(l,{auto:true});
  else if(Date.now()>=f.reminderAt&&(f.sent-1)<(+S.maxReminders||0))await send(l,{auto:true})}}
setTimeout(()=>tick().then(()=>{if(page==='leads')render()}),4000);setInterval(()=>{if(document.visibilityState==='visible')tick()},120000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')tick()});

// ---- Readable previews ----
function emailHtml(l,reminder){const body=message(l,'Email',reminder);const lines=body.split('\n');let html='',list=[];
 const flush=()=>{if(list.length){html+=`<ol class="mail-list">${list.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`;list=[]}};
 for(const line of lines){const m=line.match(/^\d+\.\s+(.*)$/);if(m){list.push(m[1]);continue}flush();
  if(/^https?:\/\//.test(line.trim())||line.includes('(secure link'))html+=`<p><a class="mail-button" href="${esc(/^https?:/.test(line.trim())?line.trim():'#')}" target="_blank" rel="noopener">Answer & add photos →</a></p>`;
  else if(line.trim())html+=`<p>${esc(line)}</p>`}
 flush();return html}
function smsSegments(t){const n=[...t].length,uni=/[^\x00-\x7F]/.test(t);const per=uni?67:153;return n<=(uni?70:160)?1:Math.ceil(n/per)}
function preview(l,ch,reminder){const to=ch==='Email'?l.email:l.phone;
 if(ch==='Email')return `<div class="mail"><div class="mail-head"><div><span>From</span><b>${esc(biz())}</b></div><div><span>To</span><b>${esc(to||'No email on file')}</b></div><div><span>Subject</span><b>${esc(subject(l,reminder))}</b></div></div><div class="mail-body">${emailHtml(l,reminder)}</div></div>`;
 const text=message(l,'SMS',reminder);return `<div class="phone"><div class="phone-top"><b>${esc(biz())}</b><span>To ${esc(to||'no mobile on file')}</span></div><div class="phone-bubble">${esc(text).replace(/(https?:\/\/\S+)/g,'<u>$1</u>')}</div><small>${[...text].length} characters · ${smsSegments(text)} SMS</small></div>`}

previewFollowup=function(l){if(!l.followupFlow)prepareFollowupFlow(l,true);const f=l.followupFlow,reminder=isReminder(l),left=open(l);let ch=l.email?'Email':'SMS';
 modal(`<span class="eyebrow">${reminder?'REMINDER':'CUSTOMER INFORMATION REQUEST'}</span><h2>${left.length?`${left.length} quick question${left.length>1?'s':''} for ${esc(first(l))}`:'All details received'}</h2><p>${esc(l.address)} · ${esc(l.suburb||'')}</p>
 <div class="req-steps"><span class="${f.sent?'done':''}">1 · Sent</span><span class="${f.openedAt?'done':''}">2 · Opened</span><span class="${!left.length?'done':''}">3 · Answered</span></div>
 <div class="request-channel-tabs"><button data-channel="Email">Email</button><button data-channel="SMS">SMS</button></div><div id="request-preview"></div>
 <p class="fb-meta">The customer answers on a simple mobile form with quick-tap options and can add photos. Answers appear in this lead automatically.${S.autoRequest?` Reminders go out after ${S.reminderHours} hours (up to ${S.maxReminders}) until they answer.`:''}</p>
 <div class="modal-actions"><button class="secondary" id="req-copy">Copy message</button><button class="secondary" id="record-reply">Record reply manually</button>${left.length?`<button class="primary" id="req-send">${reminder?'Send reminder':'Send request'} by ${[l.email&&'email',l.phone&&'SMS'].filter(Boolean).join(' + ')||'…'}</button>`:''}</div>`);
 const draw=c=>{ch=c;$$('[data-channel]').forEach(b=>b.classList.toggle('active',b.dataset.channel===c));$('#request-preview').innerHTML=preview(l,c,reminder)};
 const ready=()=>(l.uploadLink?Promise.resolve():ensureLink(l)).then(()=>draw(ch)).catch(()=>draw(ch));
 draw(ch);ready();$$('[data-channel]').forEach(b=>b.onclick=()=>draw(b.dataset.channel));
 $('#req-copy').onclick=async()=>{const t=ch==='Email'?subject(l,reminder)+'\n\n'+message(l,'Email',reminder):message(l,'SMS',reminder);try{await navigator.clipboard.writeText(t);toast('Message copied.')}catch{prompt('Copy the message:',t)}};
 $('#record-reply').onclick=()=>{$('#modal').close();recordFollowupReply(l)};
 const sendBtn=$('#req-send');if(sendBtn)sendBtn.onclick=async()=>{sendBtn.disabled=true;if(await send(l)){$('#modal').close();renderDetail()}else sendBtn.disabled=false};
};
requestDetails=l=>previewFollowup(l);

// ---- Lead card ----
followupCard=function(l){const f=l.followupFlow;
 if(!f)return `<section class="card followup-card fu"><div class="card-header"><h2>Customer follow-ups</h2><span class="pill">Automatic</span></div><p class="fu-intro">Ask the customer for missing details with one tap. They answer on a simple form — no texting back and forth.</p><button class="primary full" data-req="prepare">Ask customer for details</button></section>`;
 const left=open(l),total=f.items.length,done=total-left.length,complete=!left.length;
 const badge_=complete?['ready','All details received']:f.paused?['waiting','Paused']:f.openedAt&&f.sent?['research','Opened by customer']:f.sent?['waiting','Waiting for customer']:['new','Ready to send'];
 const short=t=>new Date(t).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).replace(/,? at /,', ');
 const steps=[['Sent',f.lastSentAt],['Opened',f.openedAt],['Answered',complete?(f.answeredAt||f.history.at(-1)?.at):null]];
 const next=!complete&&!f.paused&&f.sent&&S.autoRequest&&(f.sent-1)<S.maxReminders?`Next reminder ${short(f.reminderAt)}`:f.paused&&!complete?'Automation paused':'';
 return `<section class="card followup-card fu"><div class="card-header"><h2>Customer follow-ups</h2><span class="badge ${badge_[0]}">${badge_[1]}</span></div>
 <ol class="fu-track" aria-label="Request progress">${steps.map(([label,at])=>`<li class="${at?'done':''}"><span class="fu-dot" aria-hidden="true">${at?'✓':''}</span><b>${label}</b><small>${at?esc(short(at)):'—'}</small></li>`).join('')}</ol>
 <div class="fu-progress"><span>${done} of ${total} details received</span><div class="fu-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${total?done/total*100:0}%"></i></div></div>
 <ul class="fu-list">${f.items.map((q,i)=>`<li class="${q.answer?'done':''}"><span class="fu-num" aria-hidden="true">${q.answer?'✓':i+1}</span><div><p>${esc(q.label)}</p>${q.answer?`<small>${esc(q.answer)}${q.online?' · answered online':''}</small>`:''}</div></li>`).join('')}</ul>
 ${complete?'<p class="fu-done">✓ All details received. Reminders have stopped.</p>':`<div class="fu-actions"><button class="primary" data-req="preview">${f.sent?'Send reminder':'Preview & send'}</button><button class="fu-link" data-req="reply">Record reply</button><button class="fu-link" data-req="pause">${f.paused?'Resume':'Pause'}</button></div>${next?`<p class="fu-next"><span aria-hidden="true">◷</span> ${esc(next)}</p>`:''}`}
 <details class="fu-history"><summary>Activity · ${f.history.length}</summary><ul>${f.history.slice(-6).reverse().map(h=>`<li><b>${esc(h.event)}</b><small>${esc(short(h.at))}</small></li>`).join('')}</ul></details></section>`};
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);if(!l)return;
 $$('[data-req]').forEach(b=>b.onclick=()=>{const a=b.dataset.req;if(a==='prepare'){prepareFollowupFlow(l,true);previewFollowup(l)}if(a==='preview')previewFollowup(l);if(a==='reply')recordFollowupReply(l);if(a==='pause'){l.followupFlow.paused=!l.followupFlow.paused;l.followupFlow.history.push({event:l.followupFlow.paused?'Automation paused':'Automation resumed',at:Date.now()});save();renderDetail()}});
 if(l.followupFlow?.sent&&!syncing.has(l.id))syncAnswers(l)};

// ---- Settings: message templates + automation ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card req-settings';
 card.innerHTML=`<h2>Customer information requests</h2><p>Sent automatically when a new lead is missing details. Customers answer on a short mobile form; reminders stop as soon as they reply.</p>
 <div class="form-row"><label class="field">Reminder after<select name="reminderHours">${[24,48,72].map(h=>`<option value="${h}" ${+S.reminderHours===h?'selected':''}>${h} hours</option>`).join('')}</select></label><label class="field">Reminders<select name="maxReminders">${[0,1,2,3].map(n=>`<option value="${n}" ${+S.maxReminders===n?'selected':''}>${n===0?'None':'Up to '+n}</option>`).join('')}</select></label></div>
 <label class="field">Email subject<input name="reqSubject" maxlength="160" value="${esc(S.reqSubject)}"></label><label class="field">Email message<textarea name="reqEmail" rows="9" maxlength="2000">${esc(S.reqEmail)}</textarea></label><label class="field">SMS message<textarea name="reqSms" rows="3" maxlength="400">${esc(S.reqSms)}</textarea></label>
 <details><summary class="fb-meta">Reminder messages</summary><label class="field">Reminder email<textarea name="reminderEmail" rows="7" maxlength="2000">${esc(S.reminderEmail)}</textarea></label><label class="field">Reminder SMS<textarea name="reminderSms" rows="3" maxlength="400">${esc(S.reminderSms)}</textarea></label></details>
 <p class="fb-meta">Placeholders: {first_name} {address} {questions} {count} {link} {business} {phone}. Automatic sending follows <b>Prepare missing-detail requests</b> under Automation.</p>
 <div class="inline-buttons"><button class="primary">Save messages</button><button type="button" class="secondary" id="req-defaults">Restore defaults</button></div>`;
 const anchor=$('#takeoff-rates')||$('#rates-form');if(anchor)anchor.after(card);else grid.append(card);
 card.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(card));for(const k of Object.keys(d))S[k]=['reminderHours','maxReminders'].includes(k)?+d[k]:String(d[k]).trim()||DEFAULTS[k];save();toast('Request messages saved.')};
 $('#req-defaults').onclick=()=>{for(const [k,v] of Object.entries(DEFAULTS))S[k]=v;save();renderSettings();toast('Default messages restored.')}};
if(page==='detail')renderDetail();
})();
