// Workspace safety tools: resilient saving, backup/restore of browser data,
// live AI research status and sign-out on independently hosted workspaces.
(()=>{
const KEY='rooflead-v1';
const previousSave=save;
let warned=false;
save=function(){try{previousSave();warned=false}catch(e){updateCounts();if(!warned){warned=true;toast(e&&e.name==='QuotaExceededError'?'Browser storage is full — changes are not saved. Download a backup in Settings and remove old leads.':'Changes could not be saved in this browser. Download a backup in Settings.')}}};

function backupFile(){
 const data={app:'RoofLead',format:KEY,exportedAt:new Date().toISOString(),state};
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download=`rooflead-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 toast('Backup downloaded. Keep it somewhere safe — it contains customer details.');
}
function validState(s){return s&&typeof s==='object'&&Array.isArray(s.leads)&&Array.isArray(s.quotes)&&s.settings&&typeof s.settings==='object'}
async function restoreFile(file){
 if(!file)return;
 if(file.size>20e6)return toast('That file is too large to be a RoofLead backup.');
 let parsed;try{parsed=JSON.parse(await file.text())}catch{return toast('That file is not a readable RoofLead backup.')}
 const next=parsed&&parsed.format===KEY?parsed.state:parsed;
 if(!validState(next))return toast('That file is not a RoofLead backup.');
 if(!confirm(`Replace the ${state.leads.length} leads and ${state.quotes.length} quotes in this browser with the backup (${next.leads.length} leads, ${next.quotes.length} quotes)? This cannot be undone — download a backup first if unsure.`))return;
 const previous=localStorage.getItem(KEY);
 try{localStorage.setItem(KEY,JSON.stringify(next))}catch{if(previous!==null)localStorage.setItem(KEY,previous);return toast('The backup is too large for this browser’s storage. Nothing was changed.')}
 location.reload();
}

const previousSettings=renderSettings;
renderSettings=function(){
 previousSettings();
 const grid=$('.settings-grid');if(!grid)return;
 const card=document.createElement('section');card.className='card';
 card.innerHTML=`<h2>Backup & restore</h2><p>Leads, quotes and settings are stored only in this browser. Download a backup regularly, and to move your workspace to another browser or device.</p><div class="backup-actions"><button class="primary" type="button" id="backup-download">Download backup</button><label class="secondary backup-restore">Restore from backup<input type="file" accept="application/json,.json" id="backup-restore" hidden></label></div><p class="backup-meta">${state.leads.length} leads · ${state.quotes.length} quotes in this browser</p><div id="session-tools"></div>`;
 grid.append(card);
 $('#backup-download').onclick=backupFile;
 $('#backup-restore').onchange=e=>{restoreFile(e.target.files[0]);e.target.value=''};
 fetch('/api/session',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{const box=$('#session-tools');if(s&&s.independent&&box)box.innerHTML='<div class="connection"><div><b>Signed in</b><p>This workspace is protected by a shared password.</p></div><a class="secondary" href="/logout">Sign out</a></div>'}).catch(()=>{});
 fetch('/api/research/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(s=>{
  const b=document.querySelector('[data-connect="AI property research"]');if(!s||!b)return;
  if(!s.configured){b.textContent='Not configured';const p=b.parentElement.querySelector('p');if(p)p.textContent='Add the OPENAI_API_KEY server secret to enable web research and roof outlines. NSW aerial imagery still works.'}
 }).catch(()=>{});
};
if(page==='settings')renderSettings();
})();
