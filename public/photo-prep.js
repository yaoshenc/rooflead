// Re-encodes a chosen photo to JPEG (max 1600 px, respecting EXIF rotation)
// plus a 360 px thumbnail before upload. Also strips location metadata.
(function(root){
async function decode(file){
 if('createImageBitmap' in root){try{return await createImageBitmap(file,{imageOrientation:'from-image'})}catch{}}
 return await new Promise((res,rej)=>{const img=new Image(),u=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(u);res(img)};img.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('This file could not be read as a photo.'))};img.src=u});
}
function encode(src,max,quality){const w0=src.width||src.naturalWidth,h0=src.height||src.naturalHeight,s=Math.min(1,max/Math.max(w0,h0)),w=Math.max(1,Math.round(w0*s)),h=Math.max(1,Math.round(h0*s));const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(src,0,0,w,h);return new Promise((res,rej)=>c.toBlob(b=>b?res({blob:b,width:w,height:h}):rej(new Error('The photo could not be prepared.')),'image/jpeg',quality))}
async function prepare(file){
 if(!file||!/^image\//.test(file.type||'image/'))throw new Error('Choose a photo file.');
 if(file.size>40e6)throw new Error('That photo is too large (over 40 MB).');
 const img=await decode(file);let full=await encode(img,1600,0.82);if(full.blob.size>1.7e6)full=await encode(img,1280,0.72);const thumb=await encode(img,360,0.72);img.close?.();
 const form=new FormData();form.append('image',full.blob,'photo.jpg');form.append('thumb',thumb.blob,'thumb.jpg');form.append('width',full.width);form.append('height',full.height);return form;
}
root.PhotoPrep={prepare};
})(globalThis);
