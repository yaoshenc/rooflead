// Crews, job scheduling, crew job sheets and the daily weather check.
// - Team: crews and subcontractors (Settings → Team).
// - Job & crew card on each lead: crew, date, start, days, task list built
//   from the quote and inspection findings, "Send job sheet".
// - Crew job sheet (/?job=<token>): phone page with directions, customer,
//   access notes and gate code, roof measurements, scope, findings, photos and
//   tasks to tick off. Works offline like inspection mode.
// - Schedule page: next two weeks by day and crew, with weather.
// - Weather check: forecast per job site; flags rain, wind or heat on the job
//   days, and a day ahead offers "Reschedule?" with drafted messages.
(()=>{
const S=state.settings,DAY=864e5;
const WX={wxRainChance:60,wxRainMm:2,wxWind:40,wxGust:60,wxHeat:35,wxSunday:false};
for(const [k,v] of Object.entries(WX))if(S[k]===undefined)S[k]=v;
if(!Array.isArray(state.crews)){state.crews=[
 {id:'crew-a',name:'Crew A',type:'Crew',contact:'Dave Morris',phone:'0400 000 201',email:'dave@example.com',colour:'#2f6fde',licence:'Roof plumber · 000000C',insuranceExpiry:''},
 {id:'crew-b',name:'Crew B',type:'Crew',contact:'Tom Nguyen',phone:'0400 000 202',email:'tom@example.com',colour:'#15803d',licence:'Roof tiler · 000000C',insuranceExpiry:''},
 {id:'sub-gutters',name:'Coastal Gutters',type:'Subcontractor',contact:'Ben Walsh',phone:'0400 000 203',email:'ben@example.com',colour:'#b45309',licence:'Contractor · 000000C',insuranceExpiry:''}];save()}

const pad=n=>String(n).padStart(2,'0');
const ymd=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>ymd(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const fmtDay=s=>new Date(s+'T12:00:00').toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short'});
const fmtLong=s=>new Date(s+'T12:00:00').toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'});
const fmtTime=t=>{if(!t)return '';const [h,m]=t.split(':').map(Number);return `${h%12||12}:${pad(m)}${h<12?'am':'pm'}`};
const crewOf=id=>state.crews.find(c=>c.id===id);
const first=n=>(n||'').trim().split(/\s+/)[0]||'there';
const jobDays=j=>[...Array(Math.max(1,+j.days||1)).keys()].map(i=>addDays(j.date,i));
const token=()=>[...crypto.getRandomValues(new Uint8Array(12))].map(b=>b.toString(16).padStart(2,'0')).join('');
const sheetLink=l=>`${location.origin}/?job=${(l.job.sheetToken ||= token())}`;
const quoteOf=l=>state.quotes.find(q=>q.leadId===l.id);
const custNotes=l=>{const N=state.customerNotes||{};try{const c=window.rlCustomers?.().find(c=>c.leads.some(x=>x.id===l.id));if(c&&N[c.key]?.notes)return N[c.key].notes}catch{}
 const keys=[l.email&&'e:'+l.email.trim().toLowerCase(),l.phone&&'p:'+String(l.phone).replace(/\D/g,'').replace(/^61/,'0')].filter(Boolean);for(const k of keys)if(N[k]?.notes)return N[k].notes;return ''};
const gateCode=t=>(t.match(/gate\s*(?:code)?\s*(?:is|:|#|-)?\s*([A-Za-z0-9*#]{3,10})/i)||[])[1]||'';
const addHistory=(j,event)=>{(j.history ||= []).push({event,at:Date.now()})};

// ---- Task list from the quote and findings ----
function buildTasks(l){const t=['Set up edge protection and ladder access','Take before photos'];const q=quoteOf(l);
 const lines=q?(q.pricingLines||(()=>{try{return Commercial.lines(q)}catch{return []}})()):[];
 for(const x of lines){const d=String(x.description||'').replace(/^Take-off:\s*/,'');if(/^(access|removal|skip|edge protection)/i.test(d))continue;t.push(`${d}${x.quantity&&x.unit&&x.unit!=='item'?` — ${x.quantity} ${x.unit}`:''}`)}
 for(const f of l.findings||[])t.push(`Fix ${f.code}: ${[f.location,f.defect].filter(Boolean).join(' — ')}`);
 t.push('Clean roof, gutters and site','Take after photos','Walk the customer through the finished work');
 return [...new Set(t)].slice(0,24).map((label,i)=>({id:'t'+i,label,done:false}))}

// ---- Weather ----
const wxCache=new Map();
async function forecastFor(l){const im=l.report?.imagery||l.researchImagery;const q=im?.latitude?`lat=${im.latitude}&lon=${im.longitude}`:`place=${encodeURIComponent(l.suburb||l.address||'')}`;
 if(wxCache.has(q)&&Date.now()-wxCache.get(q).at<30*60e3)return wxCache.get(q).data;
 const r=await fetch('/api/weather?'+q);const d=await r.json();if(!r.ok)throw new Error(d.error||'Weather unavailable');wxCache.set(q,{at:Date.now(),data:d});return d}
function risks(day){if(!day)return [];const r=[];
 if((day.rainChance??0)>=S.wxRainChance||(day.rainMm??0)>=S.wxRainMm)r.push({k:'rain',t:`rain ${day.rainChance??'?'}%${day.rainMm?` (${day.rainMm} mm)`:''}`});
 if((day.windMax??0)>=S.wxWind||(day.gustMax??0)>=S.wxGust)r.push({k:'wind',t:`wind ${Math.round(day.windMax??0)} km/h, gusts ${Math.round(day.gustMax??0)} km/h`});
 if((day.tempMax??0)>=S.wxHeat)r.push({k:'heat',t:`${Math.round(day.tempMax)}°C heat`});return r}
const goodDay=(d,date)=>!risks(d).length&&(S.wxSunday||new Date(date+'T12:00:00').getDay()!==0);
async function checkJob(l,{force=false}={}){const j=l.job;if(!j?.date||j.status==='Completed')return;const last=j.weather?.checkedAt||0;if(!force&&Date.now()-last<3*36e5&&j.weather?.forDate===j.date)return;
 const end=addDays(j.date,(+j.days||1)-1);if(j.date>addDays(today(),9)||end<today())return;
 try{const fc=await forecastFor(l);const days=jobDays(j).map(date=>({date,day:fc.days.find(x=>x.date===date)}));const flagged=days.map(x=>({date:x.date,day:x.day,risks:risks(x.day)})).filter(x=>x.risks.length);
  j.weather={checkedAt:Date.now(),forDate:j.date,source:fc.attribution,days:days.map(x=>({date:x.date,...(x.day||{})})),flags:flagged.map(f=>({date:f.date,reasons:f.risks.map(r=>r.t),kinds:f.risks.map(r=>r.k)})),decision:j.weather?.forDate===j.date?j.weather.decision:null,outlook:fc.days};save()}catch{}}
let pendingCheck=null;let wxRunning=null;function ensureChecked(){if(pendingCheck)return;const need=state.leads.some(l=>l.job?.date&&l.job.status!=='Completed'&&l.job.date<=addDays(today(),9)&&addDays(l.job.date,(+l.job.days||1)-1)>=today()&&(!l.job.weather||l.job.weather.forDate!==l.job.date));if(!need)return;pendingCheck=setTimeout(()=>{checkAll().finally(()=>{pendingCheck=null})},50)}
function checkAll(){return wxRunning ||= checkAllInner().finally(()=>{wxRunning=null})}
async function checkAllInner(){if(document.body.classList.contains('portal-mode'))return;const jobs=state.leads.filter(l=>l.job?.date&&l.job.status!=='Completed');for(const l of jobs)await checkJob(l);
 const tmr=addDays(today(),1);for(const l of jobs){const w=l.job.weather;if(!w?.flags?.length||w.decision)continue;const f=w.flags[0];if(f.date<=tmr&&w.alertedFor!==f.date){w.alertedFor=f.date;save();toast(`Weather alert: ${l.address} ${f.date===today()?'today':'tomorrow'} — ${f.reasons.join(', ')}. Review the schedule.`)}}
 if((page==='schedule'||page==='detail')&&!$('#modal').open)render()}
setTimeout(checkAll,3000);setInterval(()=>{if(document.visibilityState==='visible')checkAll()},30*60e3);
function wxBadge(l){const w=l.job?.weather;if(!l.job?.date||l.job.status==='Completed')return '';if(!w||w.forDate!==l.job.date)return l.job.date>addDays(today(),9)?`<span class="wx wx-none">Forecast from ${esc(fmtDay(addDays(l.job.date,-9)))}</span>`:`<span class="wx wx-none">Checking forecast…</span>`;
 if(!w.flags.length)return `<span class="wx wx-ok">Weather OK</span>`;const f=w.flags[0];return `<span class="wx wx-bad" title="${esc(f.reasons.join(', '))}">${w.decision==='kept'?'Kept despite ':''}${f.kinds.includes('rain')?'Rain':f.kinds.includes('wind')?'Wind':'Heat'}${w.flags.length>1||f.kinds.length>1?' +':''} · ${esc(fmtDay(f.date))}</span>`}
function dayChip(d){const r=risks(d);return `<span class="wxd ${r.length?'bad':'ok'}" title="${esc(d.summary)}"><b>${esc(fmtDay(d.date).split(' ')[0])}</b><small>${esc(String(d.date).slice(8))}</small><i>${d.rainChance??'–'}%</i><i>${Math.round(d.gustMax??0)}</i></span>`}

// ---- Reschedule ----
function suggest(l){const out=l.job.weather?.outlook||[];const span=+l.job.days||1;for(let i=0;i<out.length;i++){const date=out[i].date;if(date<=today()||date===l.job.date)continue;const ok=[...Array(span).keys()].every(k=>{const d=out.find(x=>x.date===addDays(date,k));return d&&goodDay(d,addDays(date,k))});if(ok)return date}return addDays(l.job.date,1)}
function msgs(l,newDate){const c=crewOf(l.job.crewId),f=l.job.weather?.flags?.[0],biz=state.business?.name||'our team',ph=state.business?.phone||'';
 return {customer:`Hi ${first(l.name)}, it's ${biz}. The forecast for ${fmtLong(f?.date||l.job.date)} at ${l.address} shows ${f?f.reasons.join(' and '):'unsuitable weather'}, which isn't safe for roof work. We'd like to move your job to ${fmtLong(newDate)}${l.job.start?' from '+fmtTime(l.job.start):''}. Reply YES to confirm, or call us${ph?' on '+ph:''} to pick another day.`,
  crew:`${c?first(c.contact):'Team'} — ${l.address}, ${(l.suburb||'').split(',')[0]} moved from ${fmtDay(l.job.date)} to ${fmtDay(newDate)} because of the forecast (${f?f.reasons.join(', '):'weather'}). Job sheet: ${sheetLink(l)}`}}
function reschedule(l){const sug=suggest(l),out=l.job.weather?.outlook||[],m=msgs(l,sug);
 modal(`<span class="eyebrow">WEATHER CHECK</span><h2>Reschedule ${esc(l.address)}?</h2><p>${l.job.weather?.flags?.map(f=>`<b>${esc(fmtLong(f.date))}</b>: ${esc(f.reasons.join(', '))}`).join('<br>')||'No weather risk on the job days.'}</p>
 ${out.length?`<div class="wx-strip">${out.slice(0,10).map(dayChip).join('')}</div><p class="small-note">Chance of rain and wind gusts (km/h) at the job site. ${esc(l.job.weather?.source||'')}</p>`:''}
 <form id="rs-form"><div class="form-row"><label class="field">New date<input type="date" name="date" required min="${today()}" value="${sug}"></label><label class="field">Start<input type="time" name="start" value="${esc(l.job.start||'07:00')}"></label></div>
 <label class="field">Message to ${esc(first(l.name))}${l.phone?' (SMS)':''}<textarea name="customer" rows="5">${esc(m.customer)}</textarea></label><label class="field">Message to ${esc(crewOf(l.job.crewId)?.name||'crew')}<textarea name="crew" rows="3">${esc(m.crew)}</textarea></label>
 <div class="modal-actions"><button type="button" class="secondary" id="rs-keep">Keep the date</button><button class="primary">Reschedule and send</button></div></form>`);
 const f=$('#rs-form');f.date.onchange=()=>{const mm=msgs(l,f.date.value);f.customer.value=mm.customer;f.crew.value=mm.crew};
 $('#rs-keep').onclick=()=>{l.job.weather.decision='kept';addHistory(l.job,`Kept ${fmtDay(l.job.date)} despite the forecast`);save();$('#modal').close();render();toast('Date kept. The weather check will keep watching.')};
 f.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(f));const old=l.job.date;l.job.date=d.date;l.job.start=d.start;l.job.weather=null;
  addHistory(l.job,`Rescheduled from ${fmtDay(old)} to ${fmtDay(d.date)} (weather)`);(l.job.messages ||= []).push({at:Date.now(),to:'customer',text:d.customer},{at:Date.now(),to:'crew',text:d.crew});
  save();$('#modal').close();checkJob(l,{force:true}).then(()=>render());render();toast(`Moved to ${fmtDay(d.date)}. Customer and crew notified.`)}}
window.rlReschedule=id=>{const l=state.leads.find(x=>x.id===id);if(l?.job)reschedule(l)};

// ---- Lead page: Job & crew ----
function ensureTasks(l){if(l.job&&!Array.isArray(l.job.tasks)){l.job.tasks=buildTasks(l);save()}}
function jobCard(l){ensureTasks(l);ensureChecked();const j=l.job;const crews=state.crews;
 if(!j)return `<section class="card job-card"><div class="card-header"><h2>Job & crew</h2><span class="badge new">Not scheduled</span></div><form id="job-form" class="job-form"><div class="form-row"><label class="field">Crew<select name="crewId">${crews.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} · ${esc(c.contact)}</option>`).join('')}</select></label><label class="field">Date<input type="date" name="date" required min="${today()}" value="${addDays(today(),2)}"></label></div><div class="form-row"><label class="field">Start<input type="time" name="start" value="07:00"></label><label class="field">Days on site<input type="number" name="days" min="1" max="20" value="${l.area>250?2:1}"></label></div><button class="primary full">Schedule job</button></form><p class="small-note">Tasks are built from the quote and inspection findings. The crew gets a job sheet on their phone.</p></section>`;
 const c=crewOf(j.crewId),done=j.tasks.filter(t=>t.done).length;
 return `<section class="card job-card"><div class="card-header"><h2>Job & crew</h2><span class="badge ${j.status==='Completed'?'ready':j.status==='In progress'?'research':'quoted'}">${esc(j.status)}</span></div>
 <div class="job-when"><span class="crew-dot" style="background:${esc(c?.colour||'#64748b')}"></span><div><b>${esc(c?.name||'Unassigned')}</b><small>${esc(c?.contact||'')}${c?.type==='Subcontractor'?' · subcontractor':''}</small></div><div class="job-date"><b>${esc(fmtDay(j.date))}${(+j.days||1)>1?' – '+esc(fmtDay(addDays(j.date,(+j.days)-1))):''}</b><small>${esc(fmtTime(j.start))} start</small></div></div>
 ${wxBadge(l)?`<div class="job-wx">${wxBadge(l)}${j.weather?.flags?.length&&j.status!=='Completed'?`<button class="fu-link" data-job="reschedule">Reschedule?</button>`:''}</div>`:''}
 <div class="fu-progress"><span>${done} of ${j.tasks.length} tasks done</span><div class="fu-bar"><i style="width:${j.tasks.length?done/j.tasks.length*100:0}%"></i></div></div>
 <div class="inline-buttons"><button class="primary" data-job="send">${j.sentAt?'Resend job sheet':'Send job sheet'}</button><button class="secondary" data-job="open">Open crew view ↗</button><button class="fu-link" data-job="edit">Edit</button></div>
 <p class="small-note">${j.sentAt?`Sent to ${esc(c?.contact||'crew')} ${esc(new Date(j.sentAt).toLocaleString('en-AU',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}))}`:'Not sent to the crew yet'}${(j.history||[]).length?' · '+esc(j.history.at(-1).event):''}</p></section>`}
function scheduleJob(l,v){l.job={crewId:v.crewId,date:v.date,start:v.start||'07:00',days:Math.max(1,Math.min(20,+v.days||1)),status:'Scheduled',tasks:buildTasks(l),history:[],createdAt:Date.now()};addHistory(l.job,`Scheduled with ${crewOf(v.crewId)?.name||'crew'} for ${fmtDay(v.date)}`);save();checkJob(l,{force:true}).then(()=>{if(page==='detail')renderDetail()})}
function editJob(l){const j=l.job;modal(`<h2>Edit job</h2><form id="je"><div class="form-row"><label class="field">Crew<select name="crewId">${state.crews.map(c=>`<option value="${esc(c.id)}" ${c.id===j.crewId?'selected':''}>${esc(c.name)} · ${esc(c.contact)}</option>`).join('')}</select></label><label class="field">Status<select name="status">${['Scheduled','In progress','Completed'].map(s=>`<option ${s===j.status?'selected':''}>${s}</option>`).join('')}</select></label></div><div class="form-row"><label class="field">Date<input type="date" name="date" value="${j.date}" required></label><label class="field">Start<input type="time" name="start" value="${esc(j.start)}"></label></div><label class="field">Days on site<input type="number" name="days" min="1" max="20" value="${j.days}"></label><label class="field">Notes for the crew<textarea name="notes" rows="3" maxlength="600">${esc(j.notes||'')}</textarea></label><div class="modal-actions"><button type="button" class="secondary danger" id="je-del">Unschedule</button><button type="button" class="secondary" id="je-tasks">Rebuild tasks</button><button class="primary">Save</button></div></form>`);
 $('#je').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));const moved=v.date!==j.date;Object.assign(j,{crewId:v.crewId,status:v.status,date:v.date,start:v.start,days:+v.days||1,notes:v.notes.trim()});if(moved){j.weather=null;addHistory(j,'Moved to '+fmtDay(v.date))}if(v.status==='Completed'&&!j.completedAt)j.completedAt=Date.now();save();$('#modal').close();checkJob(l,{force:true}).then(()=>render());render()};
 $('#je-del').onclick=()=>{if(!confirm('Unschedule this job? Task progress is removed.'))return;delete l.job;save();$('#modal').close();render()};
 $('#je-tasks').onclick=()=>{if(!confirm('Rebuild the task list from the current quote and findings? Ticked tasks are kept where they match.'))return;const old=j.tasks;j.tasks=buildTasks(l).map(t=>({...t,...(old.find(o=>o.label===t.label&&o.done)?{done:true}:{})}));save();$('#modal').close();render()}}
function sendSheet(l){const c=crewOf(l.job.crewId),link=sheetLink(l);const text=`${c?first(c.contact):'Hi'} — job ${fmtDay(l.job.date)} ${fmtTime(l.job.start)}: ${l.address}, ${(l.suburb||'').split(',')[0]}. ${l.service}. Job sheet: ${link}`;
 modal(`<span class="eyebrow">JOB SHEET</span><h2>Send to ${esc(c?.name||'crew')}</h2><div class="phone"><div class="phone-top"><b>${esc(state.business?.name||'')}</b><span>To ${esc(c?.contact||'')} ${esc(c?.phone||'')}</span></div><div class="phone-bubble">${esc(text).replace(/(https?:\/\/\S+)/,'<u>$1</u>')}</div></div><p class="small-note">The job sheet opens on their phone and works without signal once opened.</p><div class="modal-actions"><button class="secondary" id="js-copy">Copy link</button><button class="primary" id="js-send">Send by SMS</button></div>`);
 $('#js-copy').onclick=async()=>{try{await navigator.clipboard.writeText(link);toast('Job sheet link copied.')}catch{}};
 $('#js-send').onclick=()=>{l.job.sentAt=Date.now();addHistory(l.job,`Job sheet sent to ${c?.contact||'crew'} by SMS`);save();$('#modal').close();render();toast('Job sheet sent to '+(c?.contact||'the crew')+'.')}}
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);if(!l)return;const anchor=$('.research-card');if(!anchor)return;const box=document.createElement('div');box.innerHTML=jobCard(l);anchor.before(box.firstElementChild);
 const f=$('#job-form');if(f)f.onsubmit=e=>{e.preventDefault();scheduleJob(l,Object.fromEntries(new FormData(f)));renderDetail();toast('Job scheduled.')};
 $$('[data-job]').forEach(b=>b.onclick=()=>{const a=b.dataset.job;if(a==='send')sendSheet(l);if(a==='open')window.open(sheetLink(l),'_blank','noopener'),save();if(a==='edit')editJob(l);if(a==='reschedule')reschedule(l)})};

// ---- Schedule page ----
let crewFilter='all';
function renderSchedule(){state.leads.forEach(ensureTasks);ensureChecked();const jobs=state.leads.filter(l=>l.job?.date).filter(l=>crewFilter==='all'||l.job.crewId===crewFilter);const start=today();const days=[...Array(14).keys()].map(i=>addDays(start,i));
 const alerts=jobs.filter(l=>l.job.weather?.flags?.length&&!l.job.weather.decision&&l.job.status!=='Completed');
 const ready=state.leads.filter(l=>!l.job&&(l.status==='Accepted'||state.quotes.some(q=>q.leadId===l.id&&q.acceptance)));
 const overdue=jobs.filter(l=>l.job.status!=='Completed'&&addDays(l.job.date,(+l.job.days||1)-1)<start);
 $('#content').innerHTML=`<div class="page-heading"><div><h1>Schedule</h1><p>${jobs.filter(l=>l.job.date>=start&&l.job.status!=='Completed').length} upcoming jobs · weather checked for the next 10 days</p></div><button class="secondary" id="sch-refresh">Check weather now</button></div>
 <div class="crew-filter">${[['all','All crews','#64748b'],...state.crews.map(c=>[c.id,c.name,c.colour])].map(([id,n,col])=>`<button class="${crewFilter===id?'active':''}" data-crew="${esc(id)}"><span class="crew-dot" style="background:${esc(col)}"></span>${esc(n)}</button>`).join('')}</div>
 ${alerts.length?`<section class="card wx-alerts"><h2>Weather alerts</h2>${alerts.map(l=>{const f=l.job.weather.flags[0];return `<div class="wx-alert"><div><b>${esc(l.address)}</b><small>${esc(fmtLong(f.date))} · ${esc(f.reasons.join(', '))}</small></div><button class="primary" data-rs="${l.id}">Reschedule?</button></div>`}).join('')}</section>`:''}
 ${ready.length?`<section class="card"><h2>Ready to schedule</h2>${ready.map(l=>`<div class="wx-alert"><div><b>${esc(l.address)}</b><small>${esc(l.name)} · ${esc(l.service)} · accepted</small></div><button class="secondary" data-open="${l.id}">Schedule</button></div>`).join('')}</section>`:''}
 ${overdue.length?`<section class="card"><h2>Not marked complete</h2>${overdue.map(l=>`<div class="wx-alert"><div><b>${esc(l.address)}</b><small>Finished ${esc(fmtDay(addDays(l.job.date,(+l.job.days||1)-1)))} · ${l.job.tasks.filter(t=>t.done).length}/${l.job.tasks.length} tasks</small></div><button class="secondary" data-open="${l.id}">Review</button></div>`).join('')}</section>`:''}
 <div class="sched">${days.map(d=>{const today_=jobs.filter(l=>jobDays(l.job).includes(d));const sun=new Date(d+'T12:00:00').getDay()===0;return `<section class="sched-day ${d===start?'today':''} ${sun?'sun':''}"><header><b>${esc(fmtDay(d))}</b>${d===start?'<span>Today</span>':d===addDays(start,1)?'<span>Tomorrow</span>':''}</header>${today_.length?today_.map(l=>{const c=crewOf(l.job.crewId),dayN=jobDays(l.job).indexOf(d)+1,wd=l.job.weather?.days?.find(x=>x.date===d),r=wd?risks(wd):[];return `<button class="sched-job" data-open="${l.id}" style="--crew:${esc(c?.colour||'#64748b')}"><span class="sj-crew">${esc(c?.name||'Unassigned')}${(+l.job.days||1)>1?` · day ${dayN}/${l.job.days}`:''}</span><b>${esc(l.address)}</b><small>${esc(fmtTime(l.job.start))} · ${esc(l.service)} · ${esc(l.name)}</small><span class="sj-meta">${wd?`<span class="wx ${r.length?'wx-bad':'wx-ok'}">${r.length?esc(r.map(x=>x.t).join(', ')):esc(wd.summary)+' · '+(wd.rainChance??0)+'%'}</span>`:''}<span class="badge ${l.job.status==='Completed'?'ready':l.job.status==='In progress'?'research':'new'}">${esc(l.job.status)}</span></span></button>`}).join(''):'<p class="sched-empty">No jobs</p>'}</section>`}).join('')}</div>
 <p class="small-note">Weather data by Open-Meteo.com (CC BY 4.0). Flags: rain ≥ ${S.wxRainChance}% or ${S.wxRainMm} mm, wind ≥ ${S.wxWind} km/h or gusts ≥ ${S.wxGust} km/h, heat ≥ ${S.wxHeat}°C. Change them in Settings → Team.</p>`;
 $$('[data-crew]').forEach(b=>b.onclick=()=>{crewFilter=b.dataset.crew;renderSchedule()});
 $$('[data-open]').forEach(b=>b.onclick=()=>openLead(+b.dataset.open));
 $$('[data-rs]').forEach(b=>b.onclick=()=>reschedule(state.leads.find(x=>x.id===+b.dataset.rs)));
 $('#sch-refresh').onclick=async()=>{const btn=$('#sch-refresh');btn.disabled=true;btn.textContent='Checking…';for(const l of jobs)await checkJob(l,{force:true});renderSchedule();toast('Weather updated for all scheduled jobs.')}}

// ---- Settings: Team + weather thresholds ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;
 const team=document.createElement('section');team.className='card';team.innerHTML=`<h2>Crews & subcontractors</h2><p>Assign jobs and send them job sheets.</p><ul class="crew-list">${state.crews.map(c=>{const exp=c.insuranceExpiry&&c.insuranceExpiry<addDays(today(),30);return `<li><span class="crew-dot" style="background:${esc(c.colour)}"></span><div><b>${esc(c.name)}</b><small>${esc(c.type)} · ${esc(c.contact)} · ${esc(c.phone)}${c.insuranceExpiry?` · insurance ${exp?'<b class="late">expires '+esc(fmtDay(c.insuranceExpiry))+'</b>':'to '+esc(fmtDay(c.insuranceExpiry))}`:''}</small></div><button class="fu-link" data-crew-edit="${esc(c.id)}">Edit</button></li>`}).join('')}</ul><button class="secondary" id="crew-add">Add crew or subcontractor</button>`;
 const wx=document.createElement('form');wx.className='card';wx.innerHTML=`<h2>Weather check</h2><p>Scheduled jobs are checked against the forecast. You’re alerted a day ahead and offered a new date.</p><div class="form-row"><label class="field">Rain chance (%)<input name="wxRainChance" type="number" min="10" max="100" value="${S.wxRainChance}"></label><label class="field">Rain amount (mm)<input name="wxRainMm" type="number" min="0" step="0.5" value="${S.wxRainMm}"></label></div><div class="form-row"><label class="field">Wind (km/h)<input name="wxWind" type="number" min="10" max="120" value="${S.wxWind}"></label><label class="field">Gusts (km/h)<input name="wxGust" type="number" min="10" max="150" value="${S.wxGust}"></label></div><div class="form-row"><label class="field">Heat (°C)<input name="wxHeat" type="number" min="25" max="50" value="${S.wxHeat}"></label><label class="field">Suggest Sundays<select name="wxSunday"><option value="0" ${!S.wxSunday?'selected':''}>No</option><option value="1" ${S.wxSunday?'selected':''}>Yes</option></select></label></div><button class="primary">Save weather check</button>`;
 grid.append(team,wx);
 wx.onsubmit=e=>{e.preventDefault();const d=Object.fromEntries(new FormData(wx));for(const k of Object.keys(d))S[k]=k==='wxSunday'?d[k]==='1':+d[k];state.leads.forEach(l=>{if(l.job)l.job.weather=null});save();checkAll();toast('Weather check saved.')};
 $('#crew-add').onclick=()=>editCrew(null);$$('[data-crew-edit]').forEach(b=>b.onclick=()=>editCrew(crewOf(b.dataset.crewEdit)))};
function editCrew(c){modal(`<h2>${c?'Edit':'Add'} crew or subcontractor</h2><form id="ce"><div class="form-row"><label class="field">Name<input name="name" required maxlength="60" value="${esc(c?.name||'')}" placeholder="e.g. Crew C"></label><label class="field">Type<select name="type"><option ${c?.type!=='Subcontractor'?'selected':''}>Crew</option><option ${c?.type==='Subcontractor'?'selected':''}>Subcontractor</option></select></label></div><div class="form-row"><label class="field">Contact person<input name="contact" required maxlength="60" value="${esc(c?.contact||'')}"></label><label class="field">Mobile<input name="phone" type="tel" maxlength="30" value="${esc(c?.phone||'')}"></label></div><div class="form-row"><label class="field">Licence<input name="licence" maxlength="60" value="${esc(c?.licence||'')}"></label><label class="field">Insurance expiry<input name="insuranceExpiry" type="date" value="${esc(c?.insuranceExpiry||'')}"></label></div><label class="field">Colour<input name="colour" type="color" value="${esc(c?.colour||'#7c3aed')}"></label><div class="modal-actions">${c?'<button type="button" class="secondary danger" id="ce-del">Remove</button>':''}<button type="button" class="secondary" data-close>Cancel</button><button class="primary">Save</button></div></form>`);
 $('#ce').onsubmit=e=>{e.preventDefault();const v=Object.fromEntries(new FormData(e.target));if(c)Object.assign(c,v);else state.crews.push({id:'crew-'+token().slice(0,6),email:'',...v});save();$('#modal').close();renderSettings()};
 if(c)$('#ce-del').onclick=()=>{if(state.leads.some(l=>l.job?.crewId===c.id&&l.job.status!=='Completed'))return toast('Reassign this crew’s jobs first.');if(!confirm('Remove '+c.name+'?'))return;state.crews=state.crews.filter(x=>x!==c);save();$('#modal').close();renderSettings()}}

// ---- Navigation ----
const navBtn=document.createElement('button');navBtn.dataset.nav='schedule';navBtn.innerHTML='<span>▦</span> Schedule';$('nav [data-nav="quotes"]')?.after(navBtn);navBtn.onclick=()=>nav('schedule');
const baseRender=render;render=function(){if(page==='schedule'){updateCounts();renderSchedule();return}baseRender()};
const baseNav=nav;nav=function(p){baseNav(p);if(p==='schedule')$('#breadcrumb').textContent='Schedule'};

// ---- Crew job sheet (/?job=<token>) ----
const jt=new URLSearchParams(location.search).get('job');
if(jt)crewView(jt);
function crewView(t){document.body.classList.add('portal-mode','crew-mode');const root=document.createElement('div');root.className='insp crew-sheet';document.body.append(root);document.title='Job sheet';
 const draw=()=>{const l=state.leads.find(x=>x.job?.sheetToken===t);if(l)ensureTasks(l);if(!l){root.innerHTML='<main class="portal-empty"><h1>This job sheet isn’t available</h1><p>Ask the office for an updated link.</p></main>';return}
  const j=l.job,c=crewOf(j.crewId),im=l.report?.imagery||l.researchImagery,notes=custNotes(l),gate=gateCode(notes)||gateCode(l.access||'')||gateCode(l.notes||''),q=quoteOf(l),tq=l.roofEstimate?.quantities;
  const lines=q?(q.pricingLines||(()=>{try{return Commercial.lines(q)}catch{return []}})()):[];const done=j.tasks.filter(x=>x.done).length;
  const dir=im?.latitude?`https://www.google.com/maps/dir/?api=1&destination=${im.latitude},${im.longitude}`:`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l.address+', '+l.suburb)}`;
  const pts=l.roofOutline?.points;let aerial='';if(im?.available){const v=window.RoofEstimate&&pts?.length>2?RoofEstimate.focus(pts,1.1,260):{x:250,y:250,s:500};aerial=`<svg class="cs-aerial" viewBox="${v.x} ${v.y} ${v.s} ${v.s}"><image href="${esc(im.imageUrl)}" width="1000" height="1000" preserveAspectRatio="none"/>${pts?.length>2?`<polygon points="${pts.map(p=>p.x+','+p.y).join(' ')}" fill="#3e8dff40" stroke="#78bdff" stroke-width="${5*v.s/1000}"/>`+(window.RoofEstimate?RoofEstimate.edgeLabels(pts,im.widthMeters||120,im.heightMeters||120,RoofEstimate.labelSize(v)):''):''}</svg>`}
  const wd=j.weather?.days||[];
  root.innerHTML=`<header class="insp-top"><div><b>${esc(l.address)}</b><small>${esc(c?.name||'Crew')} · ${esc(fmtDay(j.date))}${(+j.days||1)>1?' – '+esc(fmtDay(addDays(j.date,j.days-1))):''} · ${esc(fmtTime(j.start))}</small></div><span id="insp-net" class="insp-net ${navigator.onLine?'on':'off'}">${navigator.onLine?'Online':'Offline'}</span></header>
  <div class="insp-progress"><div><i style="width:${j.tasks.length?done/j.tasks.length*100:0}%"></i></div><span>${done}/${j.tasks.length} tasks · ${esc(j.status)}</span></div>
  <main class="insp-body cs-body">
   ${j.weather?.flags?.length?`<div class="cs-alert"><b>Weather warning</b><p>${j.weather.flags.map(f=>esc(fmtDay(f.date)+': '+f.reasons.join(', '))).join('<br>')}</p><small>Check conditions before going on the roof.</small></div>`:wd.length?`<div class="cs-ok">Forecast: ${wd.map(d=>esc(fmtDay(d.date)+' '+(d.summary||'')+', '+(d.rainChance??0)+'% rain')).join(' · ')}</div>`:''}
   <section class="cs-card"><h3>Site</h3><p class="cs-addr">${esc(l.address)}<br>${esc(l.suburb||'')}</p><div class="cs-actions"><a class="primary" href="${esc(dir)}" target="_blank" rel="noopener">Directions</a>${l.phone?`<a class="secondary" href="tel:${esc(String(l.phone).replace(/[^\d+]/g,''))}">Call ${esc(first(l.name))}</a><a class="secondary" href="sms:${esc(String(l.phone).replace(/[^\d+]/g,''))}">Text</a>`:''}</div>
    ${gate?`<div class="cs-gate"><span>Gate code</span><b>${esc(gate)}</b></div>`:''}
    <dl class="cs-facts"><dt>Customer</dt><dd>${esc(l.name)}${l.phone?' · '+esc(l.phone):''}</dd><dt>Access</dt><dd>${esc(l.access||'Not recorded')}</dd>${notes?`<dt>Notes</dt><dd>${esc(notes)}</dd>`:''}${j.notes?`<dt>From the office</dt><dd>${esc(j.notes)}</dd>`:''}</dl></section>
   ${aerial||l.area?`<section class="cs-card"><h3>Roof</h3>${aerial}<dl class="cs-facts">${l.area?`<dt>Surface</dt><dd>${esc(l.area)} m² · ${esc(l.pitch)}° pitch</dd>`:''}<dt>Material</dt><dd>${esc(l.material||'Unknown')}</dd>${tq?`<dt>Gutters</dt><dd>${esc(tq.eaves)} m · ${esc(tq.downpipes)} downpipes</dd><dt>Ridge / hips</dt><dd>${esc(tq.ridgeCapping)} m</dd>${tq.valleys?`<dt>Valleys</dt><dd>${esc(tq.valleys)} m</dd>`:''}${tq.sheetMetres?`<dt>Sheet</dt><dd>${esc(tq.sheetMetres)} lin. m</dd>`:''}${tq.tiles?`<dt>Tiles</dt><dd>≈ ${esc(tq.tiles)}</dd>`:''}<dt>Storeys</dt><dd>${esc(tq.storeys)}</dd>`:''}</dl></section>`:''}
   ${lines.length?`<section class="cs-card"><h3>Scope</h3><ul class="cs-scope">${lines.map(x=>`<li><span>${esc(String(x.description).replace(/^Take-off:\s*/,''))}</span><b>${esc(x.quantity)} ${esc(x.unit||'')}</b></li>`).join('')}</ul></section>`:''}
   ${(l.findings||[]).length?`<section class="cs-card"><h3>Findings</h3><ul class="insp-findings">${l.findings.map(f=>{const ph=(l.photos||[]).filter(p=>p.findingId===f.id);return `<li><div><b>${esc(f.code)}</b> ${esc([f.location,f.defect].filter(Boolean).join(' — '))}${f.recommendation?`<small>${esc(f.recommendation.split('\n')[0])}</small>`:''}${ph.length?`<div class="cs-ph">${ph.map(p=>`<img src="${esc(p.localThumb||'/api/photos/'+encodeURIComponent(p.id)+'?v=thumb')}" alt="">`).join('')}</div>`:''}</div><span class="badge ${f.severity==='Urgent'?'urgent':f.severity==='Moderate'?'waiting':'ready'}">${esc(f.severity||'Minor')}</span></li>`}).join('')}</ul></section>`:''}
   <section class="cs-card"><h3>Tasks</h3><ul class="cs-tasks">${j.tasks.map(x=>`<li class="${x.done?'done':''}"><label><input type="checkbox" data-task="${esc(x.id)}" ${x.done?'checked':''}><span>${esc(x.label)}</span></label>${x.done&&x.doneAt?`<small>${esc(new Date(x.doneAt).toLocaleTimeString('en-AU',{hour:'numeric',minute:'2-digit'}))}</small>`:''}<label class="cs-cam" aria-label="Photo for ${esc(x.label)}">${x.photoId?'✓ Photo':'Photo'}<input type="file" accept="image/*" capture="environment" data-tphoto="${esc(x.id)}" hidden></label></li>`).join('')}</ul></section>
  </main>
  <footer class="insp-foot">${j.status==='Scheduled'?'<button class="primary" id="cs-start">Start job</button>':j.status==='In progress'?`<button class="primary" id="cs-done">Complete job (${done}/${j.tasks.length})</button>`:'<div class="cs-ok">Job completed. Thanks!</div>'}</footer>`;
  $$('[data-task]').forEach(cb=>cb.onchange=()=>{const x=j.tasks.find(y=>y.id===cb.dataset.task);x.done=cb.checked;x.doneAt=cb.checked?Date.now():null;if(j.status==='Scheduled'&&cb.checked){j.status='In progress';j.startedAt=Date.now();addHistory(j,'Crew started the job')}save();draw()});
  $$('[data-tphoto]').forEach(i=>i.onchange=async()=>{const f=i.files[0];if(!f||!window.rlAddPhoto)return;const x=j.tasks.find(y=>y.id===i.dataset.tphoto);try{const p=await rlAddPhoto(l,f,{location:'Job',defect:'Progress',note:x.label});x.photoId=p.id;save();toast(p.pending?'Photo saved on this phone. It will sync when back online.':'Photo added.')}catch(e){toast(e.message)}draw()});
  const st=$('#cs-start');if(st)st.onclick=()=>{j.status='In progress';j.startedAt=Date.now();addHistory(j,'Crew started the job');save();draw()};
  const dn=$('#cs-done');if(dn)dn.onclick=()=>{const left=j.tasks.filter(x=>!x.done).length;if(left&&!confirm(`${left} task${left>1?'s are':' is'} not ticked. Complete the job anyway?`))return;j.status='Completed';j.completedAt=Date.now();addHistory(j,'Crew completed the job');save();draw();scrollTo(0,0)}};
 draw();addEventListener('online',draw);addEventListener('offline',draw);
}
})();
