// Customer-facing photo upload page (served at /upload/<token>).
(()=>{
const form=document.getElementById('customer-upload'),status=document.getElementById('cu-status'),list=document.getElementById('cu-list'),card=document.querySelector('.upload-card');
const token=location.pathname.split('/').pop();let remaining=+card.dataset.remaining||0;
form.addEventListener('submit',async e=>{e.preventDefault();const files=[...document.getElementById('cu-files').files];const note=document.getElementById('cu-note').value.trim();
 if(!files.length)return;if(files.length>remaining){status.textContent=`You can send ${remaining} more photo(s) with this link.`;return}
 const btn=form.querySelector('button');btn.disabled=true;let ok=0;
 for(const [i,f] of files.entries()){const li=document.createElement('li');li.textContent=`${f.name||'Photo'} — preparing…`;list.append(li);
  try{const data=await PhotoPrep.prepare(f);if(note)data.append('note',note);li.textContent=`${f.name||'Photo'} — uploading…`;
   const r=await fetch('/api/customer-upload/'+encodeURIComponent(token),{method:'POST',body:data});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Upload failed');li.textContent=`✓ ${f.name||'Photo '+(i+1)} received`;li.className='ok';ok++;remaining--}
  catch(err){li.textContent=`✕ ${f.name||'Photo'}: ${err.message}`;li.className='err'}}
 status.textContent=ok?`Thank you — ${ok} photo(s) sent to your roofer.${remaining?' You can add more if needed.':''}`:'No photos were sent. Please try again.';
 form.reset();btn.disabled=remaining<=0});
})();

// Information request answers (quick-tap chips fill the answer box).
(()=>{
const form=document.getElementById('customer-answers');if(!form)return;
const token=location.pathname.split('/').pop(),status=document.getElementById('cu-answer-status');
form.querySelectorAll('[data-for]').forEach(b=>b.addEventListener('click',()=>{const t=document.getElementById(b.dataset.for);t.value=b.textContent;form.querySelectorAll(`[data-for="${b.dataset.for}"]`).forEach(x=>x.classList.toggle('active',x===b));t.focus()}));
form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('button[type=submit]');const answers={};form.querySelectorAll('textarea').forEach(t=>{if(t.value.trim())answers[t.name]=t.value.trim()});
 if(!Object.keys(answers).length){status.textContent='Please answer at least one question.';return}
 btn.disabled=true;status.textContent='Sending…';
 try{const r=await fetch('/api/customer-request/'+encodeURIComponent(token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({answers})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not send your answers');
  status.textContent=d.answered<d.total?`Thanks — ${d.answered} of ${d.total} answers sent. You can add the rest any time.`:'Thanks — your answers have been sent. Add photos below if you can.';btn.textContent='Update my answers'}
 catch(err){status.textContent=err.message}finally{btn.disabled=false}});
})();
