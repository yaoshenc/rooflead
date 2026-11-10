// Invoice payment tracking and automatic overdue reminders.
// Payments (deposits taken online, bank transfers, cash, card) are recorded
// against the invoice; status becomes Part paid / Paid / Overdue, and
// reminders go out 1, 7 and 14 days after the due date until it is paid.
(()=>{
const S=state.settings,DAY=864e5;
const DEFAULTS={irEnabled:true,irDays:'1,7,14',
 irEmail:'Hi {first_name},\n\nA friendly reminder that invoice {invoice} for the roofing work at {address} was due on {due_date}. The balance outstanding is {balance}.\n\n{payment_details}\n\nIf you’ve already paid, thank you, and please ignore this message.\n\nThanks,\n{business}\n{phone}',
 irSms:'Hi {first_name}, a reminder from {business}: invoice {invoice} ({balance}) was due {due_date}. Payment details are on the invoice. Thanks!'};
for(const [k,v] of Object.entries(DEFAULTS))if(S[k]===undefined)S[k]=v;
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n||0);
const today=()=>Commercial.date();
const fmt=d=>new Date(d+(d.length===10?'T12:00:00':'')).toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'});
const paidOf=i=>Math.round((i.payments||[]).reduce((s,p)=>s+(+p.amount||0),0)*100)/100;
const balanceOf=i=>Math.max(0,Math.round(((i.document?.total||0)-paidOf(i))*100)/100);
const daysLate=i=>i.dueDate?Math.floor((Date.parse(today()+'T12:00:00')-Date.parse(i.dueDate+'T12:00:00'))/DAY):0;
function statusOf(i){const bal=balanceOf(i);if(bal<=0.004)return 'Paid';if(i.status==='Issued'&&daysLate(i)>0)return 'Overdue';if(paidOf(i)>0)return 'Part paid';return i.status||'Draft'}
window.invoiceStatus=statusOf;window.invoiceBalance=balanceOf;
const cls=s=>s==='Paid'?'ready':s==='Overdue'?'urgent':s==='Part paid'?'research':s==='Issued'?'quoted':'new';
const pill=i=>{const s=statusOf(i);return `<span class="badge ${cls(s)}">${esc(s)}${s==='Overdue'?` · ${daysLate(i)}d`:''}</span>`};
const quoteOf=i=>state.quotes.find(q=>q.id===i.quoteId);
const reminderDays=()=>String(S.irDays).split(',').map(x=>+x.trim()).filter(n=>n>0&&n<120).sort((a,b)=>a-b);
function fill(t,i){const d=i.document,l=state.leads.find(x=>x.id===quoteOf(i)?.leadId)||{};return t.replaceAll('{first_name}',(d.customer.name||'').split(' ')[0]||'there').replaceAll('{invoice}',i.number).replaceAll('{address}',l.address||d.property).replaceAll('{due_date}',fmt(i.dueDate)).replaceAll('{balance}',money(balanceOf(i))).replaceAll('{payment_details}',state.business?.paymentDetails||'').replaceAll('{business}',state.business?.name||'').replaceAll('{phone}',state.business?.phone||'').replace(/\n{3,}/g,'\n\n').trim()}
function remind(i,n,{auto=true}={}){(i.reminders ||= []);if(n&&i.reminders.some(r=>r.day===n))return;const d=i.document;const ch=[d.customer.email&&'email',state.leads.find(x=>x.id===quoteOf(i)?.leadId)?.phone&&'SMS'].filter(Boolean).join(' and ')||'email';
 i.reminders.push({day:n||null,at:new Date().toISOString(),auto,channels:ch,email:fill(S.irEmail,i),sms:fill(S.irSms,i)});const q=quoteOf(i);if(q)docEvent(q,`${i.number} payment reminder sent ${auto?'automatically ':''}by ${ch}${n?` (${n} day${n>1?'s':''} overdue)`:''}`);save()}
function tick(){if(document.body.classList.contains('portal-mode')||!S.irEnabled)return;let any=false;
 for(const i of state.invoices||[]){if(statusOf(i)!=='Overdue'||i.remindersPaused)continue;const late=daysLate(i);for(const n of reminderDays())if(late>=n&&!(i.reminders||[]).some(r=>r.day===n)){remind(i,n);any=true;break}}
 if(any&&(page==='invoice'||page==='quotes'))render()}
setTimeout(tick,5500);setInterval(()=>{if(document.visibilityState==='visible')tick()},120000);

// ---- Invoice page: payments + reminders ----
function paymentsCard(i){const bal=balanceOf(i),paid=paidOf(i),s=statusOf(i);
 return `<section class="card pay-card"><div class="card-header"><h2>Payments</h2>${pill(i)}</div>
 <div class="pay-sum"><div><span>Invoice total</span><b>${money(i.document.total)}</b></div><div><span>Paid</span><b>${money(paid)}</b></div><div class="${bal>0&&s==='Overdue'?'late':''}"><span>Balance</span><b>${money(bal)}</b></div></div>
 <div class="pay-bar"><i style="width:${Math.min(100,paid/(i.document.total||1)*100)}%"></i></div>
 ${(i.payments||[]).length?`<ul class="pay-list">${i.payments.map(p=>`<li><div><b>${money(p.amount)}</b><small>${esc(p.kind||'Payment')} · ${esc(p.method||'')}${p.ref?' · '+esc(p.ref):''}</small></div><time>${esc(fmt((p.at||'').slice(0,10)))}</time>${p.kind!=='Deposit'||!p.ref?.startsWith('pi_')?`<button class="fu-link" data-unpay="${esc(p.id)}" aria-label="Remove payment">Remove</button>`:''}</li>`).join('')}</ul>`:'<p class="small-note">No payments recorded yet.</p>'}
 ${bal>0?`<div class="inline-buttons"><button class="primary" id="pay-record">Record payment</button><button class="secondary" id="pay-full">Mark paid in full</button></div>`:`<p class="completion-note">Paid in full${i.paidAt?' on '+esc(fmt(i.paidAt.slice(0,10))):''}. Reminders stopped.</p>`}</section>`}
function remindersCard(i){if(i.status!=='Issued')return '';const s=statusOf(i),sent=i.reminders||[];if(s==='Paid'&&!sent.length)return '';
 const sched=reminderDays().map(n=>{const r=sent.find(x=>x.day===n);const due=Date.parse(i.dueDate+'T09:00:00')+n*DAY;return `<li class="${r?'done':''}"><span class="qf-dot">${r?'✓':''}</span><div><b>${n} day${n>1?'s':''} overdue</b><small>${r?'Sent '+esc(new Date(r.at).toLocaleDateString('en-AU',{day:'numeric',month:'short'})):s==='Paid'||i.remindersPaused?'Not needed':'Scheduled '+esc(new Date(due).toLocaleDateString('en-AU',{day:'numeric',month:'short'}))}</small></div>${r?`<button class="fu-link" data-rem-view="${n}">View</button>`:''}</li>`}).join('');
 return `<section class="card qf-card"><div class="card-header"><h2>Payment reminders</h2><span class="badge ${s==='Paid'?'ready':i.remindersPaused?'waiting':'research'}">${s==='Paid'?'Stopped · paid':i.remindersPaused?'Paused':S.irEnabled?'Automatic':'Off'}</span></div><ol class="qf-list">${sched}</ol>${s!=='Paid'?`<div class="inline-buttons"><button class="fu-link" id="rem-now">Send reminder now</button><button class="fu-link" id="rem-pause">${i.remindersPaused?'Resume reminders':'Pause reminders'}</button></div>`:''}</section>`}
function recordPayment(i,full){const bal=balanceOf(i);
 modal(`<h2>${full?'Mark paid in full':'Record payment'}</h2><p>${esc(i.number)} · balance ${money(bal)}</p><form id="pay-form"><div class="form-row"><label class="field">Amount (AUD)<input name="amount" type="number" min="0.01" max="${bal}" step="0.01" required value="${bal}"></label><label class="field">Date received<input name="date" type="date" required value="${today()}" max="${today()}"></label></div><div class="form-row"><label class="field">Method<select name="method"><option>Bank transfer</option><option>Card</option><option>Cash</option><option>Cheque</option></select></label><label class="field">Reference (optional)<input name="ref" maxlength="60" placeholder="e.g. bank reference"></label></div><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save payment</button></div></form>`);
 $('#pay-form').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const amt=Math.round(+v.amount*100)/100;if(!(amt>0)||amt>bal+0.004)return toast('Enter an amount up to the balance.');
  (i.payments ||= []).push({id:crypto.randomUUID(),kind:amt>=bal-0.004?'Final payment':'Part payment',amount:amt,at:v.date+'T12:00:00',method:v.method,ref:v.ref.trim()});
  if(balanceOf(i)<=0.004){i.paidAt=v.date+'T12:00:00';const q=quoteOf(i);if(q)docEvent(q,`${i.number} paid in full`)}else{const q=quoteOf(i);if(q)docEvent(q,`${money(amt)} received for ${i.number}`)}
  save();$('#modal').close();renderInvoice();toast('Payment recorded.')}}
function viewReminder(i,n){const r=(i.reminders||[]).find(x=>x.day===n);if(!r)return;
 modal(`<span class="eyebrow">PAYMENT REMINDER</span><h2>Sent ${esc(new Date(r.at).toLocaleString('en-AU'))}</h2><p>By ${esc(r.channels)}${r.auto?' · automatically':''}</p><div class="mail"><div class="mail-body">${r.email.split('\n').map(x=>x.trim()?`<p>${esc(x)}</p>`:'').join('')}</div></div><div class="phone" style="margin-top:12px"><div class="phone-bubble">${esc(r.sms)}</div></div><div class="modal-actions"><button class="primary" data-close>Close</button></div>`)}
const baseInvoice=renderInvoice;
renderInvoice=function(){baseInvoice();const i=state.invoices.find(x=>x.id===currentId);if(!i)return;const side=$('.commercial-layout')?.children[1];if(!side)return;
 const box=document.createElement('div');box.innerHTML=paymentsCard(i)+remindersCard(i);[...box.children].reverse().forEach(c=>side.insertBefore(c,side.children[1]||null));
 const intro=side.querySelector('.card p');if(intro&&/No payment has been collected/.test(intro.textContent))intro.textContent='Track payments below. Reminders go out automatically if the invoice becomes overdue.';
 const head=$('.page-heading .inline-buttons');if(head){const b=head.querySelector('.badge');if(b)b.outerHTML=pill(i)}
 if(i.acceptance?.signatureImage){const appr=[...side.children].find(c=>/Customer approval/.test(c.textContent));const name=appr?.querySelector('b');if(name)name.insertAdjacentHTML('beforebegin',`<img class="sig-img" src="${i.acceptance.signatureImage}" alt="Signature">`)}
 $('#pay-record')&&($('#pay-record').onclick=()=>recordPayment(i,false));$('#pay-full')&&($('#pay-full').onclick=()=>recordPayment(i,true));
 $$('[data-unpay]').forEach(b=>b.onclick=()=>{if(!confirm('Remove this payment?'))return;i.payments=i.payments.filter(p=>p.id!==b.dataset.unpay);delete i.paidAt;save();renderInvoice()});
 $('#rem-now')&&($('#rem-now').onclick=()=>{remind(i,null,{auto:false});renderInvoice();toast('Payment reminder sent.')});
 $('#rem-pause')&&($('#rem-pause').onclick=()=>{i.remindersPaused=!i.remindersPaused;save();renderInvoice()});
 $$('[data-rem-view]').forEach(b=>b.onclick=()=>viewReminder(i,+b.dataset.remView))};

// Paid to date on the invoice document itself.
const basePaper=paper;
paper=function(doc,invoice,signature){let html=basePaper(doc,invoice,signature);
 if(signature?.signatureImage){html=html.replace(/(<div class="paper-signature"><span>[^<]*<\/span>)<b>/,`$1<img class="sig-img" src="${signature.signatureImage}" alt="Signature of ${esc(signature.name)}"><b>`);if(signature.method==='Signed online')html=html.replace('Typed signature recorded in customer preview','Signed online with the customer link')}if(invoice&&(invoice.payments||[]).length){const block=`<div class="paper-paid"><div><span>Paid to date</span><b>${money(paidOf(invoice))}</b></div><div class="paper-total"><span>Balance due</span><b>${money(balanceOf(invoice))}</b></div></div>`;const k=html.lastIndexOf('</article>');html=html.slice(0,k)+block+html.slice(k)}return html};

// ---- Invoices list: status, balance and totals ----
const baseQuotes=renderQuotes;
renderQuotes=function(){baseQuotes();if(commercialTab!=='invoices')return;const inv=state.invoices||[];
 $$('[data-open-invoice]').forEach(tr=>{const i=inv.find(x=>x.id===+tr.dataset.openInvoice);if(!i)return;tr.children[2].innerHTML=pill(i);const bal=balanceOf(i);tr.children[3].innerHTML=`${money(i.document.total)}${bal>0&&bal<i.document.total?`<small class="doc-row-sub">${money(bal)} outstanding</small>`:bal<=0?'<small class="doc-row-sub">Paid</small>':''}`;
  const late=statusOf(i)==='Overdue';tr.children[4].innerHTML=`${esc(fmt(i.dueDate))}${late?`<small class="doc-row-sub late">${daysLate(i)} days overdue${(i.reminders||[]).length?' · reminded':''}</small>`:''}`});
 const out=inv.filter(i=>statusOf(i)!=='Draft').reduce((s,i)=>s+balanceOf(i),0),over=inv.filter(i=>statusOf(i)==='Overdue'),paid30=inv.flatMap(i=>i.payments||[]).filter(p=>Date.now()-Date.parse(p.at)<30*DAY).reduce((s,p)=>s+(+p.amount||0),0);
 const sum=document.createElement('div');sum.className='inv-summary';sum.innerHTML=`<div><span>Outstanding</span><b>${money(out)}</b></div><div class="${over.length?'late':''}"><span>Overdue</span><b>${money(over.reduce((s,i)=>s+balanceOf(i),0))}</b><small>${over.length} invoice${over.length===1?'':'s'}</small></div><div><span>Received, last 30 days</span><b>${money(paid30)}</b></div>`;
 $('.document-switch')?.after(sum)};

// ---- Settings ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card';
 card.innerHTML=`<h2>Invoice reminders</h2><p>Sent automatically after an issued invoice’s due date until it’s paid.</p><div class="connection"><div><b>Send overdue reminders automatically</b><p>Days after the due date: ${esc(S.irDays)}</p></div><button type="button" class="toggle ${S.irEnabled?'on':''}" id="ir-toggle" role="switch" aria-checked="${S.irEnabled}" aria-label="Send overdue reminders automatically"></button></div>
 <label class="field">Days after the due date<input name="irDays" value="${esc(S.irDays)}" pattern="[0-9, ]+"></label><label class="field">Reminder email<textarea name="irEmail" rows="8">${esc(S.irEmail)}</textarea></label><label class="field">Reminder SMS<textarea name="irSms" rows="2">${esc(S.irSms)}</textarea></label>
 <p class="fb-meta">Placeholders: {first_name} {invoice} {address} {due_date} {balance} {payment_details} {business} {phone}</p><button class="primary">Save reminders</button>`;
 grid.append(card);$('#ir-toggle').onclick=e=>{S.irEnabled=!S.irEnabled;e.currentTarget.classList.toggle('on',S.irEnabled);save()};
 card.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(card));for(const k of Object.keys(d))S[k]=String(d[k]).trim()||DEFAULTS[k];save();toast('Invoice reminders saved.')}};
})();
