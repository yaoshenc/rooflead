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
