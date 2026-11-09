// Facebook Lead Ads + Messenger: imports webhook-received leads into this
// browser's workspace, shows Messenger conversations with a reply box, and
// configures automatic replies (stored server-side so they work 24/7).
(()=>{
const KEY_OF=i=>i.source+':'+i.externalId;
let polling=false,lastPoll=0;
const SOURCE_LABEL={messenger:'Messenger',facebook_lead:'Facebook lead ad'};

function leadFor(i){return state.leads.find(l=>l.fb&&KEY_OF(l.fb)===KEY_OF(i))}
function notesFor(i){if(i.source==='messenger')return i.messages.filter(m=>m.from==='customer').map(m=>m.text).join(' \n')||'Messenger enquiry';const a=(i.answers||[]).map(x=>x.question+': '+x.answer).join(' · ');return (a||'Facebook lead form submission')+(i.adName?' (ad: '+i.adName+')':'')}
function serviceFor(i){const t=((i.service||'')+' '+notesFor(i)).toLowerCase();return /leak/.test(t)?'Leak inspection':/restor|paint|clean/.test(t)?'Roof restoration':/replace|re-?roof|new roof/.test(t)?'Roof replacement':'Roof repair'}

function merge(i){
 let l=leadFor(i);const isNew=!l;
 if(!l){l={id:Date.now()+Math.floor(Math.random()*1000),name:i.name||'Facebook contact',address:i.address||'',suburb:i.suburb||'',email:i.email||'',phone:i.phone||'',source:SOURCE_LABEL[i.source]||'Facebook',service:serviceFor(i),area:0,pitch:0,material:'Unknown',access:'Unknown',status:'New lead',time:'Just now',notes:notesFor(i)};state.leads.unshift(l)}
 else{for(const k of ['name','email','phone'])if(i[k]&&!l[k])l[k]=i[k];if(i.address&&!l.address){l.address=i.address;l.suburb=i.suburb||l.suburb}l.notes=notesFor(i)}
 l.fb={source:i.source,externalId:i.externalId,simulated:!!i.simulated,messages:i.messages||[],answers:i.answers||[],adName:i.adName||'',autoReplyAt:i.autoReplyAt||0,updatedAt:i.updatedAt};
 return {l,isNew};
}
async function poll(force){
 if(polling||(!force&&Date.now()-lastPoll<20000))return;polling=true;lastPoll=Date.now();
 try{const r=await fetch('/api/inbound',{cache:'no-store'});if(!r.ok)return;const d=await r.json();if(!d.items?.length)return;
  let added=0,updated=0;const fresh=[];
  for(const i of d.items){const {l,isNew}=merge(i);if(isNew)added++;else updated++;if(isNew&&l.address&&l.suburb)fresh.push(l.id)}
  save();
  await fetch('/api/inbound/ack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:d.items.map(i=>({id:i.id,updatedAt:i.updatedAt}))})}).catch(()=>{});
  if(added)toast(added===1?'New Facebook lead: '+state.leads[0].name:added+' new Facebook leads');else if(updated)toast('New Messenger reply received');
  if(page==='leads')renderLeads?.();if(page==='detail')renderDetail();
  if(state.settings.autoResearch)fresh.forEach(id=>runResearch(id));
 }catch{}finally{polling=false}
}
setInterval(()=>{if(document.visibilityState==='visible')poll()},60000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll()});
setTimeout(()=>poll(true),1500);
window.pollInboundLeads=poll;

// ---- Lead detail: conversation / form answers ----
function when(t){try{return new Date(t).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})}catch{return ''}}
function fbCard(l){const f=l.fb;if(!f)return '';
 if(f.source==='facebook_lead')return `<section class="card fb-card"><div class="card-header"><h2>Facebook lead form</h2><span class="pill">Lead ad</span></div>${f.adName?`<p class="fb-meta">From ad: ${esc(f.adName)}</p>`:''}<dl class="fb-answers">${(f.answers||[]).map(a=>`<dt>${esc(a.question)}</dt><dd>${esc(a.answer)}</dd>`).join('')||'<dd>No extra answers on the form.</dd>'}</dl><p class="fb-meta">Lead ad contacts can't be messaged automatically on Messenger. Use the customer follow-up below to request details by email or phone.</p></section>`;
 const lastCustomer=[...f.messages].reverse().find(m=>m.from==='customer'),open=lastCustomer&&Date.now()-lastCustomer.at<24*3600e3;
 return `<section class="card fb-card"><div class="card-header"><h2>Messenger conversation</h2><span class="pill">${open?'Reply window open':'Reply window closed'}</span></div><div class="fb-thread">${f.messages.map(m=>`<div class="fb-msg ${m.from}"><p>${esc(m.text)}</p><small>${m.from==='business'?(m.auto?'Auto-reply':'You'):esc(l.name)} · ${esc(when(m.at))}${m.error?' · <b class="fb-error">Not sent: '+esc(m.error)+'</b>':''}</small></div>`).join('')}</div>${open?`<form id="fb-reply-form" class="fb-reply"><textarea name="text" maxlength="1900" required placeholder="Reply on Messenger…"></textarea><button class="primary">Send</button></form>`:'<p class="fb-meta">Messenger only allows replies within 24 hours of the customer’s last message. Call or email instead.</p>'}</section>`}
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);if(!l?.fb)return;const box=document.createElement('div');box.innerHTML=fbCard(l);const col=$('.detail-grid')?.children[1];if(col)col.prepend(box.firstElementChild);
 const form=$('#fb-reply-form');if(form)form.onsubmit=async e=>{e.preventDefault();const text=new FormData(form).get('text').trim();if(!text)return;form.querySelector('button').disabled=true;
  try{const r=await fetch('/api/facebook/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({psid:l.fb.externalId,text})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Message not sent');l.fb.messages=d.conversation.messages;save();renderDetail();toast('Reply sent on Messenger')}catch(err){toast(err.message);form.querySelector('button').disabled=false}}};
if(page==='detail')renderDetail();

// ---- Settings: Facebook connection + auto-reply ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('section');card.className='card fb-settings';card.innerHTML='<h2>Facebook & Messenger leads</h2><p>Checking connection…</p>';grid.prepend(card);
 fetch('/api/facebook/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject()).then(s=>drawFb(card,s)).catch(()=>{card.innerHTML='<h2>Facebook & Messenger leads</h2><p>Facebook leads need the server database. This hosting doesn’t support it yet.</p>'})};
function drawFb(card,s){const st=s.settings;
 // Keep the business name used in auto-replies in step with Business details.
 if(state.business?.name&&state.business.name!==st.businessName)fetch('/api/facebook/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({autoReply:st.autoReply,template:st.template,businessName:state.business.name})}).then(r=>r.ok&&(st.businessName=state.business.name)).catch(()=>{});
 card.innerHTML=`<h2>Facebook & Messenger leads</h2><p>Lead ad form submissions and Messenger enquiries arrive here as new leads. New Messenger enquiries get an instant automatic reply.</p>
 <div class="connection"><div><b>Connection</b><p>Connected${state.business?.name?' · '+esc(state.business.name)+' Page':''} · Lead Ads and Messenger</p></div><span class="badge ready">✓ Connected</span></div>
 
 <form id="fb-settings-form"><div class="connection"><div><b>Automatic Messenger reply</b><p>Sent once per conversation (at most every 12 hours).</p></div><button type="button" class="toggle ${st.autoReply?'on':''}" id="fb-auto" role="switch" aria-checked="${st.autoReply}" aria-label="Automatic Messenger reply"></button></div>
 <label class="field">Reply message<textarea name="template" maxlength="1000" required style="min-height:110px">${esc(st.template)}</textarea></label><p class="fb-meta">Use {first_name} and {business}. Business name comes from Business & invoice details.</p>
 <div class="inline-buttons"><button class="primary">Save auto-reply</button><button type="button" class="secondary" id="fb-default">Use default</button><button type="button" class="secondary" id="fb-check">Check for new leads</button></div></form>
 <div class="fb-sim"><h3>Send a test enquiry</h3><p class="fb-meta">Check your Facebook workflow end to end: the enquiry arrives as a new lead and the auto-reply runs.</p>
 <div class="pb-tabs fb-sim-tabs"><button type="button" class="active" data-sim="message">Messenger message</button><button type="button" data-sim="lead">Lead ad form</button></div>
 <form id="sim-message"><div class="form-row"><label class="field">Customer name<input name="name" maxlength="120" value="Jordan Lee"></label></div><label class="field">Message<textarea name="text" maxlength="2000" required>Hi, we have a leak in the back bedroom after the storm. Can someone take a look? We're at 12 Ellalong Street, Pelaw Main NSW 2327.</textarea></label><button class="primary">Send test message</button></form>
 <form id="sim-lead" hidden><div class="form-row"><label class="field">Full name<input name="name" maxlength="120" value="Sam Nguyen"></label><label class="field">Phone<input name="phone" value="0400 000 333"></label></div><div class="form-row"><label class="field">Email<input name="email" type="email" value="sam@example.com"></label><label class="field">What do you need?<input name="need" value="Gutters overflowing, want them replaced"></label></div><div class="form-row"><label class="field">Street address<input name="address" value="12 Ellalong Street"></label><label class="field">Suburb<input name="suburb" value="Pelaw Main"></label></div><div class="form-row"><label class="field">Postcode<input name="postcode" value="2327"></label><label class="field">Ad name<input name="adName" value="Gutter special - spring"></label></div><button class="primary">Submit test lead form</button></form></div>`;
 $$('[data-sim]').forEach(b=>b.onclick=()=>{$$('[data-sim]').forEach(x=>x.classList.toggle('active',x===b));$('#sim-message').hidden=b.dataset.sim!=='message';$('#sim-lead').hidden=b.dataset.sim!=='lead'});
 for(const kind of ['message','lead'])$('#sim-'+kind).onsubmit=async e=>{e.preventDefault();const btn=e.target.querySelector('button');btn.disabled=true;try{const r=await fetch('/api/facebook/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind,...Object.fromEntries(new FormData(e.target))})});const d=await r.json();if(!r.ok)throw new Error(d.error||'The test enquiry could not be sent');await poll(true);toast(kind==='message'?'New Messenger enquiry received - see Leads.':'New Facebook lead received - see Leads.')}catch(err){toast(err.message)}finally{btn.disabled=false}};
 let auto=st.autoReply;$('#fb-auto').onclick=e=>{auto=!auto;e.currentTarget.classList.toggle('on',auto);e.currentTarget.setAttribute('aria-checked',auto)};
 $('#fb-default').onclick=()=>{card.querySelector('[name=template]').value=s.defaultTemplate};
 $('#fb-check').onclick=()=>{poll(true);toast('Checking for new Facebook leads…')};
 $('#fb-settings-form').onsubmit=async e=>{e.preventDefault();const template=new FormData(e.target).get('template');try{const r=await fetch('/api/facebook/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({autoReply:auto,template,businessName:state.business?.name||''})});if(!r.ok)throw 0;toast('Auto-reply saved.')}catch{toast('Could not save the auto-reply. Retry shortly.')}};
}
})();
