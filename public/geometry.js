(function(root){
 const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
 const between=(a,b,c)=>Math.min(a.x,b.x)<=c.x&&c.x<=Math.max(a.x,b.x)&&Math.min(a.y,b.y)<=c.y&&c.y<=Math.max(a.y,b.y);
 function intersects(a,b,c,d){const v=[cross(a,b,c),cross(a,b,d),cross(c,d,a),cross(c,d,b)];return (v[0]*v[1]<0&&v[2]*v[3]<0)||(v[0]===0&&between(a,b,c))||(v[1]===0&&between(a,b,d))||(v[2]===0&&between(c,d,a))||(v[3]===0&&between(c,d,b))}
 function validation(p){if(!Array.isArray(p)||p.length<3)return 'Add at least three roof corners.';if(p.length>40)return 'Use no more than 40 corners.';if(p.some(a=>!Number.isFinite(a.x)||!Number.isFinite(a.y)||a.x<0||a.x>1000||a.y<0||a.y>1000))return 'Keep every corner inside the image.';for(let i=0;i<p.length;i++){for(let j=i+1;j<p.length;j++){if(p[i].x===p[j].x&&p[i].y===p[j].y)return 'Remove duplicate corners.';if(j===i+1||(i===0&&j===p.length-1))continue;if(intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return 'The roof outline crosses itself. Move the corners to follow the perimeter.'}}return null}
 function footprint(p,w=120,h=120){if(validation(p)||!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return null;let a=0;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length];a+=p[i].x*b.y-b.x*p[i].y}return Math.abs(a)*w*h/2000000}
 function surface(area,pitch){return Number.isFinite(area)&&Number.isFinite(pitch)&&pitch>=0&&pitch<=70?area/Math.cos(pitch*Math.PI/180):null}
 root.RoofGeometry={validation,footprint,surface};
})(globalThis);
