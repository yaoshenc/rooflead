// Customer hub: one panel beside the AI property report that brings the
// customer, every message (enquiry, Messenger, information requests and
// answers), the details still needed and quote readiness together in tabs.
(()=>{
const tabByLead=new Map();
const when=t=>new Date(t).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).replace(/,? at /,', ');
const initials=n=>(n||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
const telHref=p=>'tel:'+String(p).replace(/[^\d+]/g,'');

// One chronological timeline from every source we have for this lead.
function timeline(l){const items=[];const f=l.followupFlow,fb=l.fb;
 const firstAt=fb?.messages?.[0]?.at||f?.createdAt||Date.now();
 if(!(fb?.source==='messenger'))items.push({at:firstAt-1,kind:'in',who:l.name,via:l.source||'Enquiry',text:fb?.source==='facebook_lead'?null:l.notes,answers:fb?.source==='facebook_lead'?fb.answers:null,label:fb?.source==='facebook_lead'?'Lead form submitted':'Enquiry'});
 for(const m of fb?.messages||[])items.push({at:m.at,kind:m.from==='customer'?'in':'out',who:m.from==='customer'?l.name:(m.auto?'Auto-reply':'You'),via:'Messenger',text:m.text,error:m.error});
 for(const s of f?.messages||[])items.push({at:s.at,kind:'event',text:`${s.reminder?'Reminder':'Information request'} sent${s.auto?' automatically':''} by ${s.channels}`,detail:s.subject,action:'preview'});
 if(f?.openedAt)items.push({at:f.openedAt,kind:'event',text:'Customer opened the request form'});
 if(f?.answeredAt){const a=f.items.filter(q=>q.online&&q.answer);if(a.length)items.push({at:f.answeredAt,kind:'in',who:l.name,via:'Request form',label:`Answered ${a.length} question${a.length>1?'s':''}`,answers:a.map(q=>({question:q.label,answer:q.answer}))})}
 return items.sort((a,b)=>a.at-b.at)}
function bubble(it){
 if(it.kind==='event')return `<li class="hub-event"><span aria-hidden="true">•</span><div><b>${esc(it.text)}</b>${it.detail?`<small>${esc(it.detail)}</small>`:''}</div><time>${esc(when(it.at))}</time></li>`;
 const answers=it.answers?.length?`<dl>${it.answers.map(a=>`<dt>${esc(a.question)}</dt><dd>${esc(a.answer)}</dd>`).join('')}</dl>`:'';
 return `<li class="hub-msg ${it.kind}"><div class="hub-bubble">${it.label?`<span class="hub-label">${esc(it.label)}</span>`:''}${it.text?`<p>${esc(it.text)}</p>`:''}${answers}</div><small>${esc(it.who)} · ${esc(it.via)} · ${esc(when(it.at))}${it.error?` · <b class="fb-error">Not sent</b>`:''}</small></li>`}

function header(l){const fbLead=l.fb?.source==='messenger';
 const contact=[l.phone&&`<a class="hub-contact" href="${esc(telHref(l.phone))}"><span aria-hidden="true">☎</span>${esc(l.phone)}</a>`,l.email&&`<a class="hub-contact" href="mailto:${esc(l.email)}"><span aria-hidden="true">✉</span>${esc(l.email)}</a>`,fbLead&&`<span class="hub-contact"><span aria-hidden="true">◍</span>Messenger</span>`].filter(Boolean).join('');
 return `<div class="hub-head"><span class="hub-avatar" aria-hidden="true">${esc(initials(l.name))}</span><div class="hub-who"><h2>${esc(l.name)}</h2><small>${esc(l.source||'Lead')} · ${esc(l.time||'')}</small></div><button class="fu-link" data-hub="edit">Edit</button></div>
 <div class="hub-contacts">${contact||'<span class="hub-missing">No phone or email yet</span>'}</div>`}

function counts(l){const f=l.followupFlow;const left=f?f.items.filter(q=>!q.answer?.trim()).length:0;return {left,total:f?.items.length||0}}

const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);const side=$('.detail-grid>div:last-child');if(!l||!side)return;
 const find=re=>[...side.children].find(c=>re.test(c.querySelector('h2')?.textContent||''));
 const customer=find(/^Customer$/),fbCard=side.querySelector('.fb-card'),follow=side.querySelector('.followup-card'),ready=find(/Quote readiness/);
 if(!customer)return;
 const {left,total}=counts(l),q=state.quotes.find(x=>x.leadId===l.id);
 let tab=tabByLead.get(l.id)||(l.fb?.source==='messenger'?'talk':left?'details':'talk');
 const hub=document.createElement('section');hub.className='card hub';hub.setAttribute('aria-label','Customer');
 const tl=timeline(l);
 hub.innerHTML=`${header(l)}<div class="hub-tabs" role="tablist">
  <button role="tab" data-hubtab="talk">Conversation${tl.length>1?` <em>${tl.length}</em>`:''}</button>
  <button role="tab" data-hubtab="details">Details${total?` <em class="${left?'warn':'ok'}">${total-left}/${total}</em>`:''}</button>
  <button role="tab" data-hubtab="quote">Quote${q?` <em>QT-${q.id}</em>`:''}</button></div>
  <div class="hub-panel" data-panel="talk"><ol class="hub-timeline">${tl.map(bubble).join('')}</ol><div class="hub-compose"></div></div>
  <div class="hub-panel" data-panel="details"></div><div class="hub-panel" data-panel="quote"></div>`;
 side.prepend(hub);
 // Compose area: Messenger reply when possible, otherwise the information request.
 const compose=hub.querySelector('.hub-compose'),form=fbCard?.querySelector('#fb-reply-form');
 if(form){compose.append(form);const note=document.createElement('p');note.className='fb-meta';note.textContent='Replies go to Messenger. Messenger allows replies within 24 hours of the customer’s last message.';compose.append(note)}
 else if(fbCard?.querySelector('.fb-meta')&&l.fb?.source==='messenger'){compose.innerHTML=`<p class="fb-meta">The Messenger reply window has closed. Call or email ${esc((l.name||'').split(' ')[0]||'the customer')} instead.</p>`}
 else compose.innerHTML=left?`<button class="primary full" data-hub="request">${l.followupFlow?.sent?'Send a reminder':'Ask for missing details'}</button><p class="fb-meta">They answer on a short mobile form. Answers appear here automatically.</p>`:(l.followupFlow?'':`<button class="secondary full" data-hub="request">Ask the customer for details</button>`);
 // Move the existing cards (and their bound handlers) into the tabs.
 if(follow){follow.classList.add('in-hub');hub.querySelector('[data-panel=details]').append(follow)}else hub.querySelector('[data-panel=details]').innerHTML='<p class="fb-meta">No details requested yet.</p>';
 if(ready){ready.classList.add('in-hub');hub.querySelector('[data-panel=quote]').append(ready)}
 fbCard?.remove();customer.remove();
 [...side.children].forEach(c=>{if(c!==hub&&!c.textContent.trim()&&!c.querySelector('img,svg,input,button'))c.remove()});
 // The original enquiry now opens the conversation, so the separate card goes.
 [...$$('.detail-grid>div:first-child>section')].find(c=>/^Enquiry$/.test(c.querySelector('h2')?.textContent||''))?.remove();
 const show=t=>{tab=t;tabByLead.set(l.id,t);hub.querySelectorAll('[data-hubtab]').forEach(b=>{b.classList.toggle('active',b.dataset.hubtab===t);b.setAttribute('aria-selected',b.dataset.hubtab===t)});hub.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==t);if(t==='talk'){const tlEl=hub.querySelector('.hub-timeline');tlEl.scrollTop=tlEl.scrollHeight}};
 hub.addEventListener('click',e=>{const b=e.target.closest('[data-hubtab],[data-hub]');if(!b)return;if(b.dataset.hubtab)return show(b.dataset.hubtab);
  if(b.dataset.hub==='request')previewFollowup(l);if(b.dataset.hub==='edit')editContact(l)});
 show(tab);
};
function editContact(l){modal(`<h2>Customer details</h2><form id="contact-form"><label class="field">Name<input name="name" required maxlength="120" value="${esc(l.name||'')}"></label><div class="form-row"><label class="field">Mobile<input name="phone" type="tel" maxlength="40" value="${esc(l.phone||'')}" placeholder="04xx xxx xxx"></label><label class="field">Email<input name="email" type="email" maxlength="160" value="${esc(l.email||'')}" placeholder="name@example.com"></label></div><div class="modal-actions"><button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save</button></div></form>`);
 $('#contact-form').onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));l.name=d.name.trim();l.phone=d.phone.trim();l.email=d.email.trim();save();$('#modal').close();renderDetail();toast('Customer details saved.')}}
window.openCustomerTab=(id,t)=>{tabByLead.set(id,t)};
if(page==='detail')renderDetail();
})();
