// Job journey bar: one slim, clickable progress line shared by the lead and
// quote pages (Enquiry → Details → Quote → Accepted → Invoice) with a single
// next-step action. Replaces the separate lead/quote trail and quote stepper.
(()=>{
const short=d=>new Date(d).toLocaleDateString('en-AU',{day:'numeric',month:'short'});
function stages(l,q){
 const inv=q&&(state.invoices||[]).find(i=>i.quoteId===q.id);
 const f=l.followupFlow,left=f?f.items.filter(i=>!i.answer?.trim()).length:0,total=f?.items.length||0;
 const measured=l.area>0;
 const detailsDone=measured&&!left;
 return [
  {key:'enquiry',label:'Enquiry',sub:`${l.source||'Lead'} · ${l.time||'received'}`,done:true,go:()=>openLead(l.id)},
  {key:'details',label:'Details',sub:left?(f.sent?`${total-left} of ${total} received`:`${left} to request`):measured?`${l.area} m² · ${l.pitch||'?'}°`:'Measure roof',done:detailsDone,go:()=>openLead(l.id)},
  {key:'quote',label:'Quote',sub:q?`QT-${q.id} · ${q.quoteDocument?'Shared':q.status}`:'Not started',done:!!q?.quoteDocument,go:q?()=>openQuote(q.id):null},
  {key:'accepted',label:'Accepted',sub:q?.acceptance?short(q.acceptance.acceptedAt):q?.quoteDocument?'With customer':'—',done:!!q?.acceptance,go:q?()=>openQuote(q.id):null},
  {key:'invoice',label:'Invoice',sub:inv?`${inv.number} · ${inv.status}`:'—',done:!!inv,go:inv&&typeof openInvoice==='function'?()=>openInvoice(inv.id):null},
 ];
}
function nextAction(l,q,st){
 const cur=st.find(s=>!s.done);const f=l.followupFlow,left=f?f.items.filter(i=>!i.answer?.trim()).length:0;
 const im=l.report?.imagery||l.researchImagery;
 if(!cur){const inv=(state.invoices||[]).find(i=>i.quoteId===q?.id);return inv?{label:'Open invoice',run:()=>openInvoice(inv.id)}:null}
 if(cur.key==='details'){if(left)return {label:f.sent?'View request':'Send request',run:()=>previewFollowup(l)};return {label:'Measure roof',run:()=>im?.available&&typeof openRoofEditor==='function'?openRoofEditor(l):editMeasurements(l)}}
 if(cur.key==='quote')return q?{label:'Prepare quote',run:()=>{if(page!=='quote'||currentId!==q.id)openQuote(q.id);setTimeout(()=>$('#prepare-quote')?.click(),50)}}:{label:'Create quote',run:()=>createQuote(l)};
 if(cur.key==='accepted')return {label:'Share with customer',run:()=>{if(page!=='quote'||currentId!==q.id)openQuote(q.id);setTimeout(()=>typeof shareQuotation==='function'&&shareQuotation(q),50)}};
 if(cur.key==='invoice')return {label:'Open quote',run:()=>openQuote(q.id)};
 return null;
}
let actions=[];
connectionTrail=function(l,q,active){
 const st=stages(l,q),cur=st.findIndex(s=>!s.done),here=active==='quotes'?2:1,nx=nextAction(l,q,st);
 const p=cur===-1?1:cur/(st.length-1);
 actions=st.map(s=>s.go);actions.next=nx?.run;
 return `<div class="journey" role="group" aria-label="Job progress"><ol class="journey-steps" style="--p:${p.toFixed(3)}">${st.map((s,i)=>{const state_=s.done?'done':i===cur?'current':'todo';return `<li class="journey-step ${state_} ${i===here?'here':''}">${s.go?`<button type="button" data-journey="${i}" ${i===here?'aria-current="page"':''}>`:'<div>'}<span class="journey-dot">${s.done?'✓':i+1}</span><span class="journey-text"><b>${s.label}</b><small>${esc(s.sub)}</small></span>${s.go?'</button>':'</div>'}</li>`}).join('')}</ol>${nx?`<button type="button" class="primary journey-next" data-journey="next">${esc(nx.label)} →</button>`:''}</div>`;
};
// The quote page's separate 4-step bar is now part of the journey.
if(typeof docFlow==='function')docFlow=()=>'';
document.addEventListener('click',e=>{const b=e.target.closest('[data-journey]');if(!b)return;e.preventDefault();const k=b.dataset.journey;const fn=k==='next'?actions.next:actions[+k];if(fn){fn();window.scrollTo({top:0,behavior:'smooth'})}});
if(page==='detail')renderDetail();if(page==='quote')renderQuote();
})();
