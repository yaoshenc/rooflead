// Automatic quote follow-ups: a friendly nudge on day 3 and day 7 after a
// quotation is shared, stopped as soon as the customer accepts. Uses the same
// delivery records as customer information requests.
(()=>{
const S=state.settings,DAY=864e5;
const DEFAULTS={
 qfEnabled:true,qfDays:'3,7',
 qfEmail3:'Hi {first_name},\n\nJust checking you received your quotation for {address} ({total} incl. GST).\n\nIf you have any questions about the scope, materials or timing, reply to this email or call us on {phone}. When you’re ready, you can accept and pay the deposit online here:\n{link}\n\nThanks,\n{business}',
 qfSms3:'Hi {first_name}, {business} here. Any questions about your roof quote for {address}? Happy to help. Accept online: {link}',
 qfEmail7:'Hi {first_name},\n\nYour quotation for {address} is valid until {valid_until}. We’d love to get you booked in — if you’d like to go ahead, you can accept and pay the deposit online in a couple of minutes:\n{link}\n\nIf anything needs changing, just reply and we’ll update the quote.\n\nThanks,\n{business}\n{phone}',
 qfSms7:'Hi {first_name}, your roof quote for {address} is valid until {valid_until}. Accept online in 2 mins: {link} — {business}',
};
for(const [k,v] of Object.entries(DEFAULTS))if(S[k]===undefined)S[k]=v;
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',maximumFractionDigits:0}).format(n||0);
const dayList=()=>String(S.qfDays).split(',').map(x=>+x.trim()).filter(n=>n>0&&n<60).sort((a,b)=>a-b);
const short=t=>new Date(t).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
const baseAt=q=>Date.parse(q.sharedAt||q.quoteDocument?.preparedAt||0);
const leadOf=q=>state.leads.find(l=>l.id===q.leadId)||{};
const tplFor=n=>{const ds=dayList();const late=n>=ds[ds.length-1]&&ds.length>1;return late?['qfEmail7','qfSms7']:['qfEmail3','qfSms3']};
function fill(t,q){const l=leadOf(q),d=q.quoteDocument||{};return t.replaceAll('{first_name}',(l.name||'').split(' ')[0]||'there').replaceAll('{address}',l.address||d.property||'your property').replaceAll('{total}',money(d.total)).replaceAll('{valid_until}',d.validUntil?new Date(d.validUntil+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long'}):'soon').replaceAll('{link}',window.quoteLink?quoteLink(q):'').replaceAll('{business}',state.business?.name||'our team').replaceAll('{phone}',state.business?.phone||'').trim()}
const active=q=>q.quoteDocument&&!q.acceptance&&!q.followups?.paused&&baseAt(q);
function send(q,n,{auto=true}={}){const l=leadOf(q);const f=(q.followups ||= {sent:[]});if(f.sent.some(s=>s.day===n))return;
 const ch=[l.email&&'email',l.phone&&'SMS'].filter(Boolean).join(' and ')||'email';const [e,s]=tplFor(n);
 f.sent.push({day:n,at:new Date().toISOString(),auto,channels:ch,email:fill(S[e],q),sms:fill(S[s],q)});
 docEvent(q,`Follow-up (day ${n}) sent ${auto?'automatically ':''}by ${ch}`);save()}
function tick(){if(document.body.classList.contains('portal-mode')||!S.qfEnabled)return;let any=false;
 for(const q of state.quotes){if(!active(q))continue;for(const n of dayList()){if(Date.now()>=baseAt(q)+n*DAY&&!q.followups?.sent?.some(s=>s.day===n)){send(q,n);any=true}}}
 if(any&&(page==='quote'||page==='quotes'))render()}
setTimeout(tick,5000);setInterval(()=>{if(document.visibilityState==='visible')tick()},120000);
window.quoteFollowupTick=tick;

function nextFor(q){if(!active(q))return null;const n=dayList().find(n=>!q.followups?.sent?.some(s=>s.day===n));return n?{day:n,at:baseAt(q)+n*DAY}:null}
window.quoteNextFollowup=nextFor;

// ---- Quote page card ----
function card(q){if(!q.quoteDocument)return '';const f=q.followups||{sent:[]};const base=baseAt(q),acc=q.acceptance;
 const rows=[[`Sent to customer`,base],[`Viewed online`,q.viewedAt?Date.parse(q.viewedAt)||null:null],...dayList().map(n=>{const s=f.sent.find(x=>x.day===n);return [`Day ${n} follow-up`,s?Date.parse(s.at):null,!s&&!acc&&!f.paused?base+n*DAY:null,n]}),['Accepted',acc?Date.parse(acc.acceptedAt):null]];
 return `<section class="card qf-card"><div class="card-header"><h2>Quote follow-ups</h2><span class="badge ${acc?'ready':f.paused?'waiting':'research'}">${acc?'Stopped · accepted':f.paused?'Paused':S.qfEnabled?'Automatic':'Off'}</span></div>
 <ol class="qf-list">${rows.map(([label,at,due,n])=>`<li class="${at?'done':''}"><span class="qf-dot">${at?'✓':''}</span><div><b>${label}</b><small>${at?esc(short(at)):due?'Scheduled '+esc(short(due)):'—'}</small></div>${n&&!at&&!acc?`<button class="fu-link" data-qf-send="${n}">Send now</button>`:''}${n&&at?`<button class="fu-link" data-qf-view="${n}">View</button>`:''}</li>`).join('')}</ol>
 ${acc?'':`<div class="inline-buttons"><button class="fu-link" data-qf="pause">${f.paused?'Resume follow-ups':'Pause follow-ups'}</button></div>`}</section>`}
function view(q,n){const s=q.followups?.sent?.find(x=>x.day===n);if(!s)return;const l=leadOf(q);
 modal(`<span class="eyebrow">QUOTE FOLLOW-UP · DAY ${n}</span><h2>Sent ${esc(new Date(s.at).toLocaleString('en-AU'))}</h2><p>By ${esc(s.channels)}${s.auto?' · automatically':''}</p>${l.email?`<div class="mail"><div class="mail-head"><div><span>To</span><b>${esc(l.email)}</b></div><div><span>Subject</span><b>${esc('Your roofing quotation '+(q.quoteDocument?.number||''))}</b></div></div><div class="mail-body">${s.email.split('\n').map(x=>/^https?:/.test(x.trim())?`<p><a class="mail-button" href="${esc(x.trim())}" target="_blank" rel="noopener">View and accept quotation →</a></p>`:x.trim()?`<p>${esc(x)}</p>`:'').join('')}</div></div>`:''}${l.phone?`<div class="phone" style="margin-top:12px"><div class="phone-top"><b>${esc(state.business?.name||'')}</b><span>To ${esc(l.phone)}</span></div><div class="phone-bubble">${esc(s.sms)}</div></div>`:''}<div class="modal-actions"><button class="primary" data-close>Close</button></div>`)}
const baseQuote=renderQuote;
renderQuote=function(){baseQuote();const q=state.quotes.find(x=>x.id===currentId);if(!q)return;const html=card(q);if(!html)return;const side=$('.commercial-layout')?.children[1];if(!side)return;
 const box=document.createElement('div');box.innerHTML=html;const act=[...side.children].find(c=>/Document activity/.test(c.textContent));side.insertBefore(box.firstElementChild,act||null);
 $$('[data-qf-send]').forEach(b=>b.onclick=()=>{send(q,+b.dataset.qfSend,{auto:false});renderQuote();toast('Follow-up sent.')});
 $$('[data-qf-view]').forEach(b=>b.onclick=()=>view(q,+b.dataset.qfView));
 $$('[data-qf]').forEach(b=>b.onclick=()=>{q.followups ||= {sent:[]};q.followups.paused=!q.followups.paused;docEvent(q,q.followups.paused?'Quote follow-ups paused':'Quote follow-ups resumed');save();renderQuote()})};

// ---- Quotes list: show the next follow-up ----
const baseQuotes=renderQuotes;
renderQuotes=function(){baseQuotes();$$('[data-open-commercial]').forEach(tr=>{const q=state.quotes.find(x=>x.id===+tr.dataset.openCommercial);const n=q&&nextFor(q);const cell=tr.children[4];if(!q||!cell||!q.quoteDocument||q.acceptance)return;
 const last=q.followups?.sent?.at(-1);cell.innerHTML=`Customer review<small class="doc-row-sub">${n?`Follow-up ${esc(short(n.at))}`:last?`Followed up ${esc(short(last.at))}`:''}${q.viewedAt?' · viewed':''}</small>`})};

// ---- Settings ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card';
 card.innerHTML=`<h2>Quote follow-ups</h2><p>Friendly nudges after a quotation is shared. They stop as soon as the customer accepts.</p><div class="connection"><div><b>Send follow-ups automatically</b><p>Days after sharing: ${esc(S.qfDays)}</p></div><button type="button" class="toggle ${S.qfEnabled?'on':''}" id="qf-toggle" role="switch" aria-checked="${S.qfEnabled}" aria-label="Send quote follow-ups automatically"></button></div>
 <label class="field">Days after sharing<input name="qfDays" value="${esc(S.qfDays)}" pattern="[0-9, ]+"></label><label class="field">First follow-up email<textarea name="qfEmail3" rows="7">${esc(S.qfEmail3)}</textarea></label><label class="field">First follow-up SMS<textarea name="qfSms3" rows="2">${esc(S.qfSms3)}</textarea></label>
 <details><summary class="fb-meta">Final follow-up messages</summary><label class="field">Final follow-up email<textarea name="qfEmail7" rows="7">${esc(S.qfEmail7)}</textarea></label><label class="field">Final follow-up SMS<textarea name="qfSms7" rows="2">${esc(S.qfSms7)}</textarea></label></details>
 <p class="fb-meta">Placeholders: {first_name} {address} {total} {valid_until} {link} {business} {phone}</p><button class="primary">Save follow-ups</button>`;
 grid.append(card);$('#qf-toggle').onclick=e=>{S.qfEnabled=!S.qfEnabled;e.currentTarget.classList.toggle('on',S.qfEnabled);save()};
 card.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(card));for(const k of Object.keys(d))S[k]=String(d[k]).trim()||DEFAULTS[k];if(!dayList().length)S.qfDays=DEFAULTS.qfDays;save();toast('Quote follow-ups saved.')}};
})();
