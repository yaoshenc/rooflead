// Online quote acceptance with signature and deposit (customer portal).
// Each shared quote gets a customer link (/?quote=<token>). The customer
// reviews the quotation, accepts it, signs, and pays a deposit by card.
// Card payments run in Stripe-style test mode: card numbers are never
// stored or sent anywhere; only the brand and last four digits are kept.
(()=>{
const S=state.settings;
if(S.depositPct===undefined)S.depositPct=10;
const money=n=>new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD'}).format(n||0);
const round2=n=>Math.round(n*100)/100;
const tokenOf=q=>(q.shareToken ||= [...crypto.getRandomValues(new Uint8Array(12))].map(b=>b.toString(16).padStart(2,'0')).join(''));
const linkOf=q=>`${location.origin}/?quote=${tokenOf(q)}`;
const depositFor=q=>{const pct=+S.depositPct||0;return pct>0?round2((q.quoteDocument?.total||0)*pct/100):0};
const first=n=>(n||'').trim().split(/\s+/)[0]||'there';
window.quoteLink=q=>{const l=linkOf(q);save();return l};
window.quoteDepositFor=depositFor;

// ---- Workspace: customer link on the quote page and in the share step ----
function linkCard(q){const l=state.leads.find(x=>x.id===q.leadId);const d=q.deposit;
 if(q.acceptance)return `<section class="card portal-card"><h2>Customer acceptance</h2>${q.acceptance.signatureImage?`<img class="sig-img" src="${q.acceptance.signatureImage}" alt="Signature of ${esc(q.acceptance.name)}">`:''}<p><b>${esc(q.acceptance.name)}</b> accepted online · ${esc(new Date(q.acceptance.acceptedAt).toLocaleString('en-AU'))}</p>${d?`<div class="paid-row"><span>Deposit paid</span><b>${money(d.amount)}</b><small>${esc(d.method)} · ${esc(new Date(d.at).toLocaleDateString('en-AU'))} · ${esc(d.ref)}</small></div>`:'<p class="small-note">No deposit was taken for this quotation.</p>'}</section>`;
 if(!q.quoteDocument)return '';
 return `<section class="card portal-card"><h2>Customer link</h2><p>${esc(first(l?.name))} reviews the quotation, signs and pays the ${S.depositPct?S.depositPct+'% deposit ('+money(depositFor(q))+')':'quotation'} online.</p><div class="link-row"><input readonly value="${esc(linkOf(q))}" aria-label="Customer link" id="portal-link"><button class="secondary" id="portal-copy">Copy</button></div><div class="inline-buttons"><button class="primary" id="portal-open">Open customer view ↗</button></div><p class="small-note">${q.viewedAt?`Viewed by the customer ${esc(new Date(q.viewedAt).toLocaleString('en-AU'))}`:'Not opened by the customer yet'}</p></section>`}
const baseQuote=renderQuote;
renderQuote=function(){baseQuote();const q=state.quotes.find(x=>x.id===currentId);if(!q)return;const html=linkCard(q);if(!html)return;
 const side=$('.commercial-layout')?.children[1];if(!side)return;const box=document.createElement('div');box.innerHTML=html;side.insertBefore(box.firstElementChild,side.children[1]||null);
 $('#portal-copy')&&($('#portal-copy').onclick=async()=>{const v=linkOf(q);save();try{await navigator.clipboard.writeText(v);toast('Customer link copied.')}catch{$('#portal-link').select()}});
 $('#portal-open')&&($('#portal-open').onclick=()=>{markShared(q);window.open(linkOf(q),'_blank','noopener')})};
function markShared(q){if(!q.sharedAt){q.sharedAt=new Date().toISOString();docEvent(q,'Quotation sent to the customer with an online acceptance link')}save()}
window.markQuoteShared=markShared;
const baseShare=shareQuotation;
shareQuotation=function(q){baseShare(q);markShared(q);const actions=$('#modal .modal-actions');const box=document.createElement('div');box.className='link-row share-link';
 box.innerHTML=`<input readonly value="${esc(linkOf(q))}" aria-label="Customer link"><button type="button" class="secondary" id="share-copy">Copy link</button>`;(actions||$('#modal')).before(box);
 $('#share-copy').onclick=async()=>{try{await navigator.clipboard.writeText(linkOf(q));toast('Customer link copied.')}catch{}};
 const prev=$('#customer-preview');if(prev){prev.textContent='Open customer view ↗';prev.onclick=()=>{$('#modal').close();window.open(linkOf(q),'_blank','noopener')}}};
openCustomerQuote=q=>window.open(linkOf(q),'_blank','noopener');
// The customer finishes in another tab: refresh this workspace when it changes.
// The customer finishes in the portal tab: that tab signals the workspace,
// which refreshes once. Other cross-tab edits only show a reload prompt, so
// open tabs never reload each other in a loop or save over newer changes.
const portalTab=()=>document.body.classList.contains('portal-mode');
const signal=t=>{try{localStorage.setItem('rooflead-portal-event',JSON.stringify({t,at:Date.now()}))}catch{}};
window.rlPortalSignal=signal;
let stale=false;
addEventListener('storage',e=>{if(portalTab())return;
 if(e.key==='rooflead-portal-event'){toast('Customer update received. Refreshing…');setTimeout(()=>location.reload(),900);return}
 if(e.key==='rooflead-v1'&&!stale){stale=true;window.rlStale=true;if(document.visibilityState==='hidden')return;showStale()}});
document.addEventListener('visibilitychange',()=>{if(stale&&document.visibilityState==='visible'&&!$('#modal').open&&!$('#insp'))location.reload()});
function showStale(){if($('.stale-bar'))return;const bar=document.createElement('div');bar.className='stale-bar';bar.setAttribute('role','status');bar.innerHTML='<span>This workspace was updated in another tab.</span><button class="primary" type="button">Reload</button>';bar.querySelector('button').onclick=()=>location.reload();document.body.append(bar)}

// ---- Settings: deposit ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card';
 card.innerHTML=`<h2>Online acceptance & deposits</h2><p>Customers accept, sign and pay a deposit from the quote link.</p><label class="field">Deposit (% of quote total)<input name="depositPct" type="number" min="0" max="100" step="1" value="${S.depositPct}"></label><p class="small-note">In NSW, a deposit for residential building work over $20,000 can’t be more than 10% of the contract price. Set 0 to accept without a deposit.</p><button class="primary">Save deposit setting</button>`;
 grid.append(card);card.onsubmit=e=>{e.preventDefault();S.depositPct=Math.max(0,Math.min(100,+new FormData(card).get('depositPct')||0));save();toast('Deposit setting saved.')}};

// ---- Customer portal ----
const params=new URLSearchParams(location.search);const token=params.get('quote');
if(token)portal(token);
function portal(token){const q=state.quotes.find(x=>x.shareToken===token);document.body.classList.add('portal-mode');
 const root=document.createElement('div');root.className='portal';document.body.append(root);document.title='Your quotation';
 if(!q||!q.quoteDocument){root.innerHTML=`<main class="portal-empty"><h1>This quotation link isn’t available</h1><p>Please contact your roofer for an updated link.</p></main>`;return}
 const d=q.quoteDocument,l=state.leads.find(x=>x.id===q.leadId)||{},b=d.business||state.business||{};
 if(!q.viewedAt&&!q.acceptance){q.viewedAt=new Date().toISOString();docEvent(q,'Customer viewed the quotation online');save()}
 const dep=q.deposit?.amount??depositFor(q);
 let step=q.acceptance?(q.deposit||!dep?3:2):0,acc={name:d.customer.name||'',email:d.customer.email||''},sig=null;
 const steps=['Review','Sign','Deposit','Done'];
 function frame(inner){root.innerHTML=`<header class="portal-top"><div class="portal-brand"><span class="paper-roof">⌂</span><div><b>${esc(b.name||'Your roofer')}</b><small>${esc(b.phone||b.email||'')}</small></div></div><span class="portal-secure">Secure link</span></header>
  <main class="portal-main"><section class="portal-doc"><div class="portal-summary"><span>Quotation ${esc(d.number)}</span><h1>${esc(d.property)}</h1><p>${esc(d.scope||d.service||'Roofing works')}</p><div class="portal-total"><b>${money(d.total)}</b><small>incl. GST · valid until ${esc(new Date(d.validUntil+'T12:00:00').toLocaleDateString('en-AU',{day:'numeric',month:'long',year:'numeric'}))}</small></div></div>
  <details class="portal-full" open><summary>Full quotation</summary>${paper(d,null,q.acceptance)}</details></section>
  <aside class="portal-panel"><ol class="portal-steps">${steps.filter((s,i)=>i!==2||dep>0).map((s,i,arr)=>{const real=steps.indexOf(s);return `<li class="${real<step?'done':real===step?'current':''}"><span>${real<step?'✓':i+1}</span>${s}</li>`}).join('')}</ol><div class="portal-body">${inner}</div></aside></main>
  <footer class="portal-foot">${esc(b.name||'')}${b.abn?' · ABN '+esc(b.abn):''}${b.licence?' · '+esc(b.licence):''}</footer>`}
 function render(){if(step===0)return review();if(step===1)return sign();if(step===2)return pay();return done()}
 function review(){frame(`<h2>Ready to go ahead?</h2><p>Check the scope and price, then confirm your details.</p><form id="p-review"><label class="field">Full name<input name="name" required minlength="2" maxlength="120" autocomplete="name" value="${esc(acc.name)}"></label><label class="field">Email<input name="email" type="email" required autocomplete="email" value="${esc(acc.email)}"></label><label class="check"><input type="checkbox" name="consent" required> I’ve read the quotation, scope, exclusions and terms, and I’d like to proceed.</label>${dep?`<div class="portal-dep"><span>Deposit to confirm your booking</span><b>${money(dep)}</b><small>${S.depositPct}% now · ${money(d.total-dep)} on completion</small></div>`:''}<button class="primary full">Continue to sign</button></form>`);
  $('#p-review').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));acc={name:v.name.trim(),email:v.email.trim()};step=1;render()}}
 function sign(){frame(`<h2>Sign to accept</h2><p>Sign with your finger or mouse.</p><div class="sig-pad"><canvas id="sig" aria-label="Signature pad"></canvas><span class="sig-line">${esc(acc.name)}</span></div><div class="inline-buttons"><button type="button" class="secondary" id="sig-clear">Clear</button></div><p class="small-note">By signing you accept quotation ${esc(d.number)} (revision ${d.revision}) for ${money(d.total)} incl. GST.</p><button class="primary full" id="sig-ok">${dep?'Accept and continue to deposit':'Accept quotation'}</button><button class="link-btn" id="sig-back">← Back</button>`);
  const c=$('#sig'),ctx=c.getContext('2d'),ratio=devicePixelRatio||1;const fit=()=>{const r=c.getBoundingClientRect();c.width=r.width*ratio;c.height=r.height*ratio;ctx.scale(ratio,ratio);ctx.lineWidth=2.2;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#1d2b44'};fit();
  let drawing=false,marks=0,last=null;const pt=e=>{const r=c.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
  c.onpointerdown=e=>{drawing=true;last=pt(e);c.setPointerCapture(e.pointerId)};c.onpointermove=e=>{if(!drawing)return;const p=pt(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;marks++};c.onpointerup=()=>{drawing=false};
  $('#sig-clear').onclick=()=>{ctx.clearRect(0,0,c.width,c.height);marks=0};$('#sig-back').onclick=()=>{step=0;render()};
  $('#sig-ok').onclick=()=>{if(marks<8){alert('Please sign in the box to accept.');return}sig=c.toDataURL('image/png');
   try{recordAcceptance(q,acc.name,acc.email,true);q.acceptance.signatureImage=sig;q.acceptance.method='Signed online';const inv=state.invoices.find(i=>i.quoteId===q.id&&i.quoteRevision===d.revision);if(inv){inv.acceptance.signatureImage=sig;inv.acceptance.method='Signed online'}
    docEvent(q,'Customer signed and accepted online');if(l.id){l.status='Accepted'}save();signal('accepted');step=dep?2:3;render()}catch(err){alert(err.message)}}}
 function pay(){frame(`<h2>Pay your deposit</h2><p>Secures your booking. The balance of ${money(d.total-dep)} is due on completion.</p><div class="portal-dep"><span>Deposit</span><b>${money(dep)}</b><small>${esc(d.number)} · ${esc(b.name||'')}</small></div>
  <form id="p-pay" class="pay-form" autocomplete="on" novalidate><div class="pay-head"><b>Card details</b><span class="pay-test">Test mode</span></div>
  <div class="card-field"><input id="cc-num" inputmode="numeric" autocomplete="cc-number" placeholder="1234 1234 1234 1234" aria-label="Card number" maxlength="23"><span class="cc-brand" id="cc-brand">Card</span></div>
  <div class="card-split"><input id="cc-exp" inputmode="numeric" autocomplete="cc-exp" placeholder="MM / YY" aria-label="Expiry" maxlength="7"><input id="cc-cvc" inputmode="numeric" autocomplete="cc-csc" placeholder="CVC" aria-label="CVC" maxlength="4"></div>
  <label class="field">Name on card<input id="cc-name" autocomplete="cc-name" value="${esc(acc.name)}"></label><label class="field">Postcode<input id="cc-zip" inputmode="numeric" autocomplete="postal-code" maxlength="4" placeholder="2000"></label>
  <p class="pay-error" id="pay-error" role="alert"></p><button class="primary full pay-btn" id="pay-btn">Pay ${money(dep)}</button>
  <p class="pay-note">Test mode — use card 4242 4242 4242 4242, any future date and any CVC. No real payment is taken. <span class="stripe-mark">Powered by <b>stripe</b></span></p></form>`);
  const num=$('#cc-num'),exp=$('#cc-exp');
  num.oninput=()=>{const v=num.value.replace(/\D/g,'').slice(0,19);num.value=v.replace(/(.{4})/g,'$1 ').trim();$('#cc-brand').textContent=/^4/.test(v)?'Visa':/^(5[1-5]|2[2-7])/.test(v)?'Mastercard':/^3[47]/.test(v)?'Amex':'Card'};
  exp.oninput=()=>{const v=exp.value.replace(/\D/g,'').slice(0,4);exp.value=v.length>2?v.slice(0,2)+' / '+v.slice(2):v};
  const luhn=s=>{let sum=0,alt=false;for(let i=s.length-1;i>=0;i--){let n=+s[i];if(alt){n*=2;if(n>9)n-=9}sum+=n;alt=!alt}return sum%10===0};
  $('#p-pay').onsubmit=async e=>{e.preventDefault();const err=$('#pay-error');err.textContent='';const n=num.value.replace(/\D/g,''),[mm,yy]=exp.value.split('/').map(x=>+x.trim()),cvc=$('#cc-cvc').value.replace(/\D/g,'');
   if(n.length<13||!luhn(n))return err.textContent='Your card number is invalid.';
   if(!mm||mm>12||!yy||new Date(2000+yy,mm)<=new Date())return err.textContent='Your card’s expiry date is invalid.';
   if(cvc.length<3)return err.textContent='Your card’s security code is incomplete.';
   if(n==='4000000000000002')return err.textContent='Your card was declined.';
   const btn=$('#pay-btn');btn.disabled=true;btn.innerHTML='<span class="research-spinner"></span> Processing…';await new Promise(r=>setTimeout(r,1700));
   const brand=$('#cc-brand').textContent,ref='pi_'+[...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join('');
   const payment={id:crypto.randomUUID(),kind:'Deposit',amount:dep,at:new Date().toISOString(),method:`Card · ${brand} •••• ${n.slice(-4)}`,ref,receipt:'RL-'+Math.floor(100000+Math.random()*900000)};
   q.deposit=payment;const inv=state.invoices.find(i=>i.quoteId===q.id&&i.quoteRevision===d.revision);if(inv){(inv.payments ||= []).push(payment)}
   docEvent(q,`Deposit of ${money(dep)} paid online (${payment.method})`);save();signal('deposit');step=3;render()}}
 function done(){const p=q.deposit;frame(`<div class="portal-done"><span class="accepted-check">✓</span><h2>Thanks, ${esc(first(q.acceptance?.name||acc.name))}. You’re booked in.</h2><p>Your acceptance of ${esc(d.number)} has been recorded${p?' and your deposit has been received':''}.</p>
  <dl class="portal-receipt"><dt>Quotation</dt><dd>${money(d.total)}</dd>${p?`<dt>Deposit paid</dt><dd>${money(p.amount)}</dd><dt>Payment</dt><dd>${esc(p.method)}</dd><dt>Receipt</dt><dd>${esc(p.receipt)}</dd><dt>Balance on completion</dt><dd>${money(d.total-p.amount)}</dd>`:''}</dl>
  <h3>What happens next</h3><p>${esc(b.name||'Your roofer')} will contact you within one business day to schedule the work.${b.phone?' Questions? Call '+esc(b.phone)+'.':''}</p><button class="secondary full" id="p-pdf">Download quotation (PDF)</button></div>`);
  $('#p-pdf').onclick=()=>Commercial.pdf(d,null,q.acceptance).save(d.number+'.pdf')}
 render();scrollTo(0,0);
}
})();
