// Roof take-off from the aerial outline: edge measurements drawn on the
// satellite view, roof-style aware quantities (surface, gutters, ridges, hips,
// valleys, barges, downpipes, tiles/sheets, edge protection) and quote lines.
// All figures are preliminary aerial estimates that must be verified on site.
(function(root){
const STYLES={hip:'Hip',gable:'Gable',skillion:'Skillion',flat:'Flat / low pitch',complex:'Complex / mixed'};
const MATERIALS={metal:'Metal sheeting',concrete:'Concrete tile',terracotta:'Terracotta tile',other:'Other'};
const TILES_PER_M2={concrete:10.5,terracotta:15};
const SHEET_COVER_M=0.762;
const DEFAULT_PITCH={hip:22.5,gable:22.5,skillion:5,flat:2,complex:22.5};
const round=(n,d=1)=>Math.round(n*10**d)/10**d;

function toMetres(points,w=120,h=120){return points.map(p=>({x:p.x*w/1000,y:p.y*h/1000}))}
function edges(m){return m.map((a,i)=>{const b=m[(i+1)%m.length];return {a,b,length:Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(b.y-a.y,b.x-a.x)}})}
function signedArea(m){let s=0;for(let i=0;i<m.length;i++){const b=m[(i+1)%m.length];s+=m[i].x*b.y-b.x*m[i].y}return s/2}
// Minimum-area bounding rectangle, tested along each edge direction.
function boundingBox(m,es){let best=null;for(const e of es){if(e.length<0.01)continue;const c=Math.cos(e.angle),s=Math.sin(e.angle);let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;for(const p of m){const u=p.x*c+p.y*s,v=-p.x*s+p.y*c;x0=Math.min(x0,u);x1=Math.max(x1,u);y0=Math.min(y0,v);y1=Math.max(y1,v)}const a=(x1-x0)*(y1-y0);if(!best||a<best.area){const long=x1-x0>=y1-y0;best={area:a,length:Math.max(x1-x0,y1-y0),width:Math.min(x1-x0,y1-y0),axis:long?e.angle:e.angle+Math.PI/2}}}return best}
// Convex/reflex corner counts approximate hips and valleys on complex outlines.
function corners(m){const orient=Math.sign(signedArea(m));let convex=0,reflex=0;for(let i=0;i<m.length;i++){const a=m[(i+m.length-1)%m.length],b=m[i],c=m[(i+1)%m.length];const z=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);const turn=Math.abs(Math.atan2(Math.abs(z),(b.x-a.x)*(c.x-b.x)+(b.y-a.y)*(c.y-b.y)));if(turn<0.35)continue;if(Math.sign(z)===orient)convex++;else reflex++}return {convex,reflex}}
// Rectangle with the same area and perimeter as the outline (fallback: bounding box).
function equivalentRect(A,P,box){const s=P/2,d=s*s-4*A;if(d>=0){const L=(s+Math.sqrt(d))/2,W=s-L;if(W>0.5)return {L,W}}return {L:box.length,W:Math.max(0.5,A/box.length)}}

function takeoff(points,opts={}){
 const RG=root.RoofGeometry;if(!points||points.length<3||RG.validation(points))return null;
 const w=opts.widthMeters||120,h=opts.heightMeters||120,style=STYLES[opts.style]?opts.style:'hip',material=MATERIALS[opts.material]?opts.material:'metal';
 const pitch=Number.isFinite(+opts.pitch)&&opts.pitch!==''?Math.min(70,Math.max(0,+opts.pitch)):DEFAULT_PITCH[style];
 const waste=Number.isFinite(+opts.waste)?Math.min(40,Math.max(0,+opts.waste)):(material==='metal'?5:10);
 const storeys=Math.min(4,Math.max(1,Math.round(+opts.storeys||1)));
 const m=toMetres(points,w,h),es=edges(m),A=Math.abs(signedArea(m)),P=es.reduce((s,e)=>s+e.length,0),box=boundingBox(m,es),{convex,reflex}=corners(m),{L,W}=equivalentRect(A,P,box);
 const rad=pitch*Math.PI/180,k=1/Math.cos(rad),t=Math.tan(rad),half=W/2;
 const along=es.filter(e=>Math.abs(Math.cos(e.angle-box.axis))>=0.7).reduce((s,e)=>s+e.length,0),across=P-along;
 const hipLen=half*Math.sqrt(2+t*t);
 let eaves=P,ridge=0,hips=0,valleys=reflex*hipLen,barge=0,apron=0;
 if(style==='hip'||style==='complex'){ridge=Math.max(0,L-W);hips=Math.max(4,convex)*hipLen}
 else if(style==='gable'){eaves=along;barge=across*k;ridge=L}
 else if(style==='skillion'){eaves=L;apron=L;barge=2*W*k;valleys=0}
 else if(style==='flat'){eaves=L;apron=P-L;valleys=0}
 const surface=A*k,order=surface*(1+waste/100);
 const downpipes=Math.max(style==='flat'||style==='skillion'?1:2,Math.ceil(eaves/12));
 const q={style,material,pitch:round(pitch,1),waste,storeys,footprint:round(A),perimeter:round(P),length:round(box.length),width:round(box.width),surface:round(surface),orderArea:round(order),eaves:round(eaves),ridge:round(ridge),hips:round(hips),valleys:round(valleys),barge:round(barge),apron:round(apron),downpipes,edgeProtection:round(P),ridgeCapping:round(ridge+hips)};
 if(material==='metal')q.sheetMetres=Math.ceil(order/SHEET_COVER_M);
 if(TILES_PER_M2[material]){q.tiles=Math.ceil(order*TILES_PER_M2[material]);q.ridgeCaps=Math.ceil((ridge+hips)*2.8*1.05)}
 q.rise=round(half*t,2);q.confidence=style==='complex'||reflex>2?'low':reflex?'medium':'medium-high';
 return q;
}

// Labels sit just outside each edge so the roof itself stays visible.
function edgeLabels(points,w=120,h=120,fs=20){
 if(!points||points.length<2)return '';const closed=points.length>2,cx=points.reduce((a,p)=>a+p.x,0)/points.length,cy=points.reduce((a,p)=>a+p.y,0)/points.length;let out='';
 const n=closed?points.length:points.length-1;
 for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%points.length];const len=Math.hypot((b.x-a.x)*w/1000,(b.y-a.y)*h/1000),px=Math.hypot(b.x-a.x,b.y-a.y);if(len<1||px<fs*1.2)continue;
  let nx=(b.y-a.y)/px,ny=-(b.x-a.x)/px;const mx0=(a.x+b.x)/2,my0=(a.y+b.y)/2;if(closed&&(mx0+nx-cx)**2+(my0+ny-cy)**2<(mx0-nx-cx)**2+(my0-ny-cy)**2){nx=-nx;ny=-ny}
  const mx=mx0+nx*fs*1.15,my=my0+ny*fs*1.15,label=len.toFixed(1)+' m',tw=fs*(label.length*0.56+0.8);
  out+=`<g class="edge-label" pointer-events="none"><rect x="${mx-tw/2}" y="${my-fs*0.72}" width="${tw}" height="${fs*1.36}" rx="${fs*0.3}" fill="#0f1b2cd9"/><text x="${mx}" y="${my+fs*0.36}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="#fff">${label}</text></g>`}
 return out;
}
function scaleBar(w=120,view={x:0,y:0,s:1000}){const u=view.s/1000,px=10*1000/w,fs=20*u,right=view.x+view.s-24*u,bottom=view.y+view.s-22*u;return `<g class="scale-bar" pointer-events="none"><rect x="${right-px-16*u}" y="${bottom-50*u}" width="${px+32*u}" height="${52*u}" rx="${8*u}" fill="#ffffffe6"/><line x1="${right-px}" y1="${bottom-12*u}" x2="${right}" y2="${bottom-12*u}" stroke="#1f2b3d" stroke-width="${5*u}"/><line x1="${right-px}" y1="${bottom-22*u}" x2="${right-px}" y2="${bottom-2*u}" stroke="#1f2b3d" stroke-width="${4*u}"/><line x1="${right}" y1="${bottom-22*u}" x2="${right}" y2="${bottom-2*u}" stroke="#1f2b3d" stroke-width="${4*u}"/><text x="${right-px/2}" y="${bottom-26*u}" text-anchor="middle" font-size="${fs}" font-weight="600" fill="#1f2b3d">10 m</text></g>`}
function addressPin(view={s:1000}){const u=view.s/1000;return `<g pointer-events="none" class="address-pin"><circle cx="500" cy="500" r="${14*u}" fill="none" stroke="#ffcc4d" stroke-width="${4*u}"/><circle cx="500" cy="500" r="${4*u}" fill="#ffcc4d"/></g>`}
// Square view around the outline with breathing room, clamped to the image.
function focus(points,pad=0.9,min=220){if(!points||points.length<2)return {x:0,y:0,s:1000};const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);const sz=Math.min(1000,Math.max(min,Math.max(x1-x0,y1-y0)*(1+pad)));const cx=(x0+x1)/2,cy=(y0+y1)/2;return {x:Math.min(1000-sz,Math.max(0,cx-sz/2)),y:Math.min(1000-sz,Math.max(0,cy-sz/2)),s:sz}}
// The NSW export service can render the same 120 m square at twice the resolution.
function hiRes(url){try{const u=new URL(url);if(!/^(maps\.six|portal\.spatial)\.nsw\.gov\.au$/.test(u.hostname)||!u.searchParams.has('size'))return url;u.searchParams.set('size','1600,1600');return u.href}catch{return url}}
const labelSize=view=>Math.max(6,view.s/42);

function rows(q){const r=[['Roof footprint (plan)',q.footprint,'m²'],['Roof surface at '+q.pitch+'°',q.surface,'m²'],['Order area incl. '+q.waste+'% waste',q.orderArea,'m²'],['Gutter / eaves',q.eaves,'m'],q.ridge&&['Ridge',q.ridge,'m'],q.hips&&['Hips',q.hips,'m'],q.valleys&&['Valleys',q.valleys,'m'],q.barge&&['Barge / rake',q.barge,'m'],q.apron&&['Apron / perimeter flashing',q.apron,'m'],['Downpipes',q.downpipes,'each'],q.sheetMetres&&['Metal sheet (762 mm cover)',q.sheetMetres,'lin. m'],q.tiles&&['Tiles (approx.)',q.tiles,'each'],q.ridgeCaps&&['Ridge / hip caps',q.ridgeCaps,'each'],['Edge protection',q.edgeProtection,'m']];return r.filter(Boolean)}
function table(q){return `<table class="takeoff-table"><tbody>${rows(q).map(([k,v,u])=>`<tr><th>${k}</th><td>${Number(v).toLocaleString('en-AU')} <span>${u}</span></td></tr>`).join('')}</tbody></table>`}

root.RoofEstimate={takeoff,edgeLabels,scaleBar,addressPin,focus,hiRes,labelSize,table,rows,STYLES,MATERIALS,DEFAULT_PITCH};
})(globalThis);

if(typeof document!=='undefined'&&typeof state!=='undefined'){(function(){
const RE=RoofEstimate,RG=RoofGeometry;
const S=state.settings;
const RATE_DEFAULTS={gutterRate:48,downpipeRate:165,cappingRate:38,valleyRate:55,bargeRate:42,flashingRate:45,edgeRate:22};
for(const [k,v] of Object.entries(RATE_DEFAULTS))if(!Number.isFinite(S[k]))S[k]=v;
const materialKey=m=>/metal|colorbond|sheet/i.test(m||'')?'metal':/terracotta/i.test(m||'')?'terracotta':/concrete|tile/i.test(m||'')?'concrete':'metal';
const imageryOf=l=>l.report?.imagery||l.researchImagery;
function optionsFor(l){const e=l.roofEstimate||{},ai=l.aiOutline||{};const style=e.style||(RE.STYLES[ai.roof_form]?ai.roof_form:'hip');return {style,material:e.material||(ai.material_guess&&RE.MATERIALS[ai.material_guess]?ai.material_guess:materialKey(l.material)),pitch:e.pitch??(l.pitch||RE.DEFAULT_PITCH[style]),waste:e.waste??'',storeys:e.storeys||l.storeys||1}}

// ---- Roof editor: measurements on the image + estimate options ----
const baseOpen=openRoofEditor;
openRoofEditor=function(l){
 baseOpen(l);if(!roofEditor||!$('#roof-canvas'))return;
 const o=optionsFor(l);roofEditor.estimate={...o};
 if(roofEditor.pitch===''||roofEditor.pitch==null){roofEditor.pitch=o.pitch;$('#roof-pitch').value=o.pitch}
 const svg=$('#roof-canvas'),img=svg.querySelector('image');if(img)img.setAttribute('href',RE.hiRes(img.getAttribute('href')));
 svg.insertAdjacentHTML('beforeend','<g id="roof-overlay"></g><g id="roof-edge-labels"></g>');
 roofEditor.view=roofEditor.points.length>2?RE.focus(roofEditor.points):{x:0,y:0,s:1000};
 $('.roof-tools').insertAdjacentHTML('afterbegin','<span class="zoom-tools" role="group" aria-label="Zoom"><button type="button" class="secondary" id="zoom-fit" title="Zoom to roof">⤢ Fit roof</button><button type="button" class="secondary" id="zoom-in" aria-label="Zoom in">＋</button><button type="button" class="secondary" id="zoom-out" aria-label="Zoom out">－</button></span>');
 const zoom=f=>{const v=roofEditor.view,c={x:v.x+v.s/2,y:v.y+v.s/2},s2=Math.min(1000,Math.max(120,v.s*f));roofEditor.view={x:Math.min(1000-s2,Math.max(0,c.x-s2/2)),y:Math.min(1000-s2,Math.max(0,c.y-s2/2)),s:s2};paintRoof()};
 $('#zoom-in').onclick=()=>zoom(0.7);$('#zoom-out').onclick=()=>zoom(1/0.7);$('#zoom-fit').onclick=()=>{roofEditor.view=roofEditor.points.length>2?RE.focus(roofEditor.points):{x:0,y:0,s:1000};paintRoof()};
 const pitchField=$('#roof-pitch').closest('label');
 pitchField.insertAdjacentHTML('afterend',`<div class="pitch-presets" aria-label="Common pitches">${[5,15,20,22.5,25,30,35].map(p=>`<button type="button" class="chip" data-pitch="${p}">${p}°</button>`).join('')}</div>`);
 $('.measurement-totals').insertAdjacentHTML('afterend',`<div class="estimate-options"><h3>3. Roof details for the take-off</h3><div class="form-row"><label class="field">Roof style<select id="est-style">${Object.entries(RE.STYLES).map(([k,v])=>`<option value="${k}" ${k===o.style?'selected':''}>${v}</option>`).join('')}</select></label><label class="field">New roof material<select id="est-material">${Object.entries(RE.MATERIALS).map(([k,v])=>`<option value="${k}" ${k===o.material?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="form-row"><label class="field">Waste allowance (%)<input id="est-waste" type="number" min="0" max="40" step="1" placeholder="Auto" value="${esc(o.waste)}"></label><label class="field">Storeys<select id="est-storeys">${[1,2,3].map(n=>`<option ${+o.storeys===n?'selected':''}>${n}</option>`).join('')}</select></label></div><div id="est-ai-hint" class="est-ai-hint"></div><div id="est-takeoff"></div></div>`);
 $$('[data-pitch]').forEach(b=>b.onclick=()=>{const i=$('#roof-pitch');i.value=b.dataset.pitch;i.dispatchEvent(new Event('input'))});
 for(const id of ['est-style','est-material','est-waste','est-storeys'])$('#'+id).addEventListener(id==='est-waste'?'input':'change',()=>{const e=roofEditor.estimate;e.style=$('#est-style').value;e.material=$('#est-material').value;e.waste=$('#est-waste').value;e.storeys=+$('#est-storeys').value;if(id==='est-style'&&!$('#roof-pitch').value){$('#roof-pitch').value=RE.DEFAULT_PITCH[e.style];$('#roof-pitch').dispatchEvent(new Event('input'))}roofEditor.reviewed=false;$('#roof-reviewed').checked=false;paintRoof()});
 $('.measurement-note').textContent='Surface = footprint ÷ cos(pitch). Ridge, hip and valley lengths are approximated from the outline’s overall dimensions and roof style. Aerial imagery can be offset or dated: verify every measurement on site before a final quote.';
 paintRoof();
};
const basePaint=paintRoof;
paintRoof=function(){basePaint();const e=roofEditor;if(!e||!$('#roof-edge-labels'))return;const w=e.image.widthMeters||120,h=e.image.heightMeters||120,v=e.view||{x:0,y:0,s:1000},u=v.s/1000;
 const svg=$('#roof-canvas');svg.setAttribute('viewBox',`${v.x} ${v.y} ${v.s} ${v.s}`);
 // Keep handles and strokes a constant on-screen size while zoomed.
 svg.querySelectorAll('#roof-shapes circle[data-corner]').forEach(c=>c.setAttribute('r',(+c.getAttribute('r')||9)*Math.max(u,0.35)));svg.querySelectorAll('#roof-shapes [stroke-width]').forEach(c=>{if(!c.hasAttribute('vector-effect'))c.setAttribute('vector-effect','non-scaling-stroke')});
 $('#roof-overlay').innerHTML=RE.addressPin(v)+RE.scaleBar(w,v);$('#roof-edge-labels').innerHTML=RE.edgeLabels(e.points,w,h,RE.labelSize(v));
 const cap=$('.roof-canvas-caption');if(cap)cap.textContent=`Showing ≈ ${Math.round(v.s*w/1000)} m across · north up · drag corners to adjust`;aiHint();takeoffPreview()};
function aiHint(){const box=$('#est-ai-hint'),ai=roofEditor?.lead.aiOutline;if(!box)return;const bits=[];if(ai?.roof_form&&ai.roof_form!=='unknown')bits.push('roof style looks like '+(RE.STYLES[ai.roof_form]||ai.roof_form).toLowerCase());if(ai?.material_guess&&ai.material_guess!=='unknown')bits.push('existing material looks like '+(RE.MATERIALS[ai.material_guess]||ai.material_guess).toLowerCase());if(ai?.features?.length)bits.push('visible: '+ai.features.join(', '));box.textContent=bits.length?'AI suggestion from the image — '+bits.join(' · ')+'. Confirm on site.':''}
function currentTakeoff(){const e=roofEditor;if(!e?.estimate)return null;return RE.takeoff(e.points,{...e.estimate,pitch:e.pitch===''?NaN:+e.pitch,waste:e.estimate.waste===''?undefined:+e.estimate.waste,widthMeters:e.image.widthMeters||120,heightMeters:e.image.heightMeters||120})}
function takeoffPreview(){const box=$('#est-takeoff');if(!box)return;const q=currentTakeoff();box.innerHTML=q?RE.table(q):'<p class="measurement-note">Outline the roof to see the full take-off.</p>'}
const baseAccept=acceptOutline;
acceptOutline=function(l,d){baseAccept(l,d);if(roofEditor?.lead.id===l.id&&d.outline?.identifiable&&$('#roof-canvas')){roofEditor.view=RE.focus(roofEditor.points);paintRoof()}};
const baseSave=saveRoofArea;
saveRoofArea=function(){const e=roofEditor;if(!e)return;const l=e.lead,q=currentTakeoff(),est={...e.estimate};baseSave();if(l.roofMeasurement&&q){l.roofEstimate={...est,pitch:q.pitch,quantities:q,savedAt:new Date().toISOString()};l.storeys=q.storeys;save();if(page==='detail'&&currentId===l.id)renderDetail()}};

// ---- Lead detail: measured satellite view + take-off card ----
const basePanel=aerialPanel;
aerialPanel=function(l){let html=basePanel(l);const im=imageryOf(l),pts=l.roofOutline?.points;if(!im?.available)return html;const w=im.widthMeters||120,h=im.heightMeters||120,valid=pts?.length>=3&&!RG.validation(pts),v=valid?RE.focus(pts,1.1,260):{x:0,y:0,s:1000};
 html=html.replace(/(<div class="inline-roof-image"><svg) viewBox="0 0 1000 1000"/,`$1 viewBox="${v.x} ${v.y} ${v.s} ${v.s}"`).replace(/(<image href=")([^"]+)(")/,(m,a,u,b)=>a+esc(RE.hiRes(u.replace(/&amp;/g,'&')))+b);
 if(valid){const u=v.s/1000;html=html.replace(/(<polygon points="[^"]*" fill="#3e8dff55" stroke="#78bdff" stroke-width=")5"/,'$1'+(5*u)+'"').replace(/<circle cx="([\d.]+)" cy="([\d.]+)" r="6" fill="white" stroke="#337ee4" stroke-width="2"\/>/g,(m,x,y)=>`<circle cx="${x}" cy="${y}" r="${6*Math.max(u,.4)}" fill="white" stroke="#337ee4" stroke-width="${2*Math.max(u,.4)}"/>`);
  const extra=RE.addressPin(v)+RE.edgeLabels(pts,w,h,RE.labelSize(v)*1.1)+RE.scaleBar(w,v);const i=html.indexOf('</svg>');if(i>0)html=html.slice(0,i)+extra+html.slice(i);
  html=html.replace('NSW aerial imagery · north up',`NSW aerial imagery · zoomed to roof (≈ ${Math.round(v.s*w/1000)} m across) · north up`)}
 return html};
function takeoffCard(l){const q=l.roofEstimate?.quantities;if(!q||!l.roofMeasurement)return '';const quote=state.quotes.find(x=>x.leadId===l.id);
 return `<section class="card takeoff-card"><div class="card-header"><h2>Roof take-off</h2><span class="pill">Aerial estimate · ${esc(q.confidence)} confidence</span></div><p class="takeoff-summary">${esc(RE.STYLES[q.style])} roof · ${q.pitch}° pitch · ${esc(RE.MATERIALS[q.material])} · ${q.storeys} storey${q.storeys>1?'s':''} · approx. ${q.length} × ${q.width} m overall</p>${RE.table(q)}<div class="inline-buttons"><button class="primary" id="takeoff-to-quote">${quote?'Update quote line items':'Create quote with take-off'}</button><button class="secondary" id="takeoff-edit">Adjust outline & details</button></div><p class="measurement-note">Estimated from ${esc(imageryOf(l)?.provider||'aerial imagery')} (roughly 10–15 cm per pixel). Ridge, hip and valley lengths are approximations. Confirm all measurements, pitch and access on site.</p></section>`}
const baseDetail=renderDetail;
renderDetail=function(){baseDetail();const l=state.leads.find(x=>x.id===currentId);if(!l)return;const html=takeoffCard(l);if(!html)return;const anchor=$('.research-card');const box=document.createElement('div');box.innerHTML=html;if(anchor)anchor.after(box.firstElementChild);else $('.detail-grid > div')?.prepend(box.firstElementChild);$('#takeoff-to-quote').onclick=()=>takeoffToQuote(l);$('#takeoff-edit').onclick=()=>openRoofEditor(l)};

// ---- Quote integration ----
function takeoffLines(q){const s=state.settings,m=1+(+s.margin||0)/100,r=n=>Math.round(n*m*100)/100,L=[];
 const add=(d,qty,unit,rate)=>{if(qty>0)L.push({description:'Take-off: '+d,quantity:+qty,unit,rate:r(rate),takeoff:true})};
 add('Gutter supply & install',q.eaves,'m',s.gutterRate);add('Downpipes',q.downpipes,'each',s.downpipeRate);add('Ridge & hip capping',q.ridgeCapping,'m',s.cappingRate);add('Valley irons',q.valleys,'m',s.valleyRate);add('Barge / rake flashing',q.barge,'m',s.bargeRate);add('Apron / perimeter flashing',q.apron,'m',s.flashingRate);add('Edge protection (safety rail)',q.edgeProtection,'m',s.edgeRate*(q.storeys>1?1.5:1));return L}
function takeoffToQuote(l){const t=l.roofEstimate?.quantities;if(!t)return;let q=state.quotes.find(x=>x.leadId===l.id);
 if(!q){q={id:Math.max(1000,...state.quotes.map(x=>x.id))+1,leadId:l.id,status:'Draft',area:l.area,...state.settings};state.quotes.unshift(q)}
 const base=(q.pricingLines?structuredClone(q.pricingLines):Commercial.lines(q)).filter(i=>!i.takeoff&&!/^Take-off: /.test(i.description));
 base.forEach(i=>{if(i.areaLinked)i.quantity=l.area});q.area=l.area;q.pricingLines=[...base,...takeoffLines(t)];q.status='Draft';if(q.quoteDocument){q.revision=(q.revision||1)+1;q.quoteDocument=null}
 save();openQuote(q.id);toast('Take-off quantities added as draft line items. Review rates before sending.')}

// ---- Settings: take-off rates ----
const baseSettings=renderSettings;
renderSettings=function(){baseSettings();const grid=$('.settings-grid');if(!grid)return;const card=document.createElement('form');card.className='card';card.id='takeoff-rates';
 card.innerHTML=`<h2>Take-off rates</h2><p>Used when aerial take-off quantities are added to a quote (AUD, before markup).</p><div class="form-row">${[['gutterRate','Gutter / m'],['downpipeRate','Downpipe / each'],['cappingRate','Ridge & hip capping / m'],['valleyRate','Valley iron / m'],['bargeRate','Barge flashing / m'],['flashingRate','Apron flashing / m'],['edgeRate','Edge protection / m']].map(([k,label])=>`<label class="field">${label}<input name="${k}" type="number" min="0" step="0.01" required value="${state.settings[k]}"></label>`).join('')}</div><button class="primary">Save take-off rates</button>`;
 const rates=$('#rates-form');if(rates)rates.after(card);else grid.append(card);
 card.onsubmit=e=>{e.preventDefault();Object.assign(state.settings,Object.fromEntries([...new FormData(card)].map(([k,v])=>[k,+v])));save();toast('Take-off rates saved.')}};

// ---- AI outline straight from the satellite image (no research run needed) ----
async function startOutline(l,payload){const res=await fetch('/api/outline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(l.researchJob?{researchId:l.researchJob,...payload}:{address:l.address,suburb:l.suburb,candidateRid:imageryOf(l)?.addressRecordId,...payload})});const d=await res.json();if(!res.ok)throw new Error(d.error||'Unable to start the outline.');return d}
suggestOutline=async function(l){const e=roofEditor;if(!e?.target)return;e.busy=true;e.reason='';paintRoof();try{const d=await startOutline(l,{target:e.target});l.outlineJob=d.id;l.outlineTarget=structuredClone(e.target);l.outlineState=d.status;save();if(d.status==='completed')acceptOutline(l,d);else pollOutline(l,d.id)}catch(err){e.busy=false;e.reason=err.message;paintRoof()}};
const autoStarts=new Set();
ensureAutomaticOutline=async function(l){const im=imageryOf(l);if(!l.researchJob&&!state.settings.autoResearch)return;const key=l.researchJob||('img:'+(im?.addressRecordId||''));if(!im?.available||l.roofOutline?.points?.length||autoStarts.has(key))return;if(l.outlineState==='researching'&&l.outlineJob){pollOutline(l,l.outlineJob);return}if(l.outlineAutoResearchId===key&&['completed','failed'].includes(l.outlineState))return;
 autoStarts.add(key);l.outlineAutoResearchId=key;l.outlineState='researching';l.outlineError='';save();refreshInlineOutline(l);
 try{const d=await startOutline(l,{automatic:true});l.outlineJob=d.id;l.outlineState=d.status;save();if(d.status==='researching')pollOutline(l,d.id);else acceptOutline(l,d)}catch(err){l.outlineState='failed';l.outlineError=err.message;save();refreshInlineOutline(l)}finally{autoStarts.delete(key)}};
if(page==='detail')renderDetail();
})()}
