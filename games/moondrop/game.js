/* Moondrop: tilt-steered lunar lander. Tilt the phone to angle the lander, hold anywhere to thrust, and set cargo down on a
   run of pads across four moons. Everything is generated in code; THREE and ARC (shared/kit.js) load first. */
(function(){
'use strict';
const T=THREE, TAU=Math.PI*2, PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
function seeded(seed){let s=(Math.abs(seed|0)%2147483646)+1;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
const {P,M,geo,makeMat}=ARC;
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================ SAVE */
const KEY='moondrop.save.v1';
function fresh(){return{v:1,unlocked:0,stars:[],best:[],set:{sfx:true,music:true,vibe:true,ctrl:'tilt',sens:'med'},stats:{landings:0,crashes:0}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&typeof v===typeof a[k])a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ================================================================ MOONS & MISSIONS */
const MOONS=[
 {name:'Selene',g:1.6,bg:0x0b0a26,star:0xbfd4ff,planet:[0x4f7bd9,0x2a3f8f,0x9fb8ff],top:[0x7a84b8,0x5a6294],side:0x2c3262,far:[0x262c58,0x171b3a],key:45,bpm:104,prog:[0,8,3,10]},
 {name:'Cinder',g:2.1,bg:0x1a0a12,star:0xffd6c0,planet:[0xd9734f,0x8f3a2a,0xffc59f],top:[0xa8634f,0x7e4436],side:0x3e1d1f,far:[0x3a1a1c,0x220f10],key:43,bpm:110,prog:[0,5,3,10]},
 {name:'Veil',g:1.25,bg:0x120a2a,star:0xe0c8ff,planet:[0x9a4fd9,0x4a2a8f,0xd8b8ff],top:[0x8a72b8,0x63488f],side:0x2c1d4c,far:[0x261a44,0x170e2c],key:47,bpm:114,prog:[0,8,5,7]},
 {name:'Foundry',g:2.3,bg:0x0d1416,star:0xc8ffe8,planet:[0x5ab89a,0x2a5a4a,0xc8ffe0],top:[0x6e9f95,0x4a706a],side:0x1c3431,far:[0x183230,0x0f1f1d],key:41,bpm:118,prog:[0,3,8,10]},
];
// w world width; pads = pad centres as fractions of w, landed in that order; spire = pads raised onto a mesa; pw pad width;
// rough terrain height; wind gust strength; fuel at start; par = seconds for the third star; cave = ceiling height above the
// tallest ground; hz = hazards [alien type, count]; cells = floating fuel cells.
const MISSIONS=[
 {m:0,name:'First Light',w:34,pads:[.66],pw:4.4,rough:2,fuel:100,par:22},
 {m:0,name:'Supply Run',w:44,pads:[.34,.82],pw:3.8,rough:3,fuel:100,par:40},
 {m:0,name:'Crater Hop',w:52,pads:[.72,.24,.9],pw:3.4,rough:4.5,fuel:110,par:65,cells:2},
 {m:1,name:'Ash Fields',w:46,pads:[.55,.86],pw:3.3,rough:4,fuel:110,par:45,hz:[['rock',4]]},
 {m:1,name:'Pinnacles',w:50,pads:[.3,.72],spire:[0,1],pw:3.2,rough:5,fuel:120,par:50,hz:[['rock',3]],cells:1},
 {m:1,name:'Ember Run',w:58,pads:[.42,.16,.88],pw:3.1,rough:5,fuel:125,par:75,hz:[['mite',4],['rock',2]],cells:2},
 {m:2,name:'Veil Winds',w:48,pads:[.7],pw:3.1,rough:4,wind:1.1,fuel:100,par:35,cells:1},
 {m:2,name:'Undercroft',w:52,pads:[.45,.85],pw:3,rough:3.5,cave:8.5,fuel:110,par:55,hz:[['mite',3]],cells:1},
 {m:2,name:'Gale Line',w:60,pads:[.3,.62,.92],pw:2.9,rough:5,wind:1.2,fuel:170,par:85,hz:[['drone',2],['rock',3]],cells:2},
 {m:3,name:'Foundry Gate',w:50,pads:[.6,.88],pw:2.9,rough:4,cave:9.5,fuel:125,par:55,hz:[['drone',2],['mite',3]],cells:2},
 {m:3,name:'Deep Haul',w:64,pads:[.2,.55,.36,.9],spire:[2],pw:2.8,rough:6,wind:.7,fuel:175,par:110,hz:[['drone',3],['rock',4]],cells:3},
 {m:3,name:'Last Drop',w:66,pads:[.76,.26,.6,.95],pw:2.7,rough:6,wind:1.2,cave:12,fuel:200,par:120,hz:[['drone',3],['mite',4],['rock',3]],cells:3},
];
// Lander tuning. Safe touchdown: falling slower than SAFE_VY, drifting slower than SAFE_VX, tilted less than SAFE_ANG.
const THRUST=4.6, BURN=8, ROT=3.2, MAX_TILT=1.25, SAFE_VY=2.2, SAFE_VX=1.3, SAFE_ANG=.3, REFUEL=35, CELL=25;
const SENS={low:1.2,med:1.7,high:2.3};
const HZ={rock:{r:.62,scale:1},mite:{r:.42,scale:1.1},drone:{r:.62,scale:1}};

/* ================================================================ RENDERER & CAMERA */
const stage=$('stage'),cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});
renderer.setPixelRatio(Math.min(DPR,2));
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(50,.5,.5,400);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.3);hemi.position.set(0,1,.3);
const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(-4,8,6);
scene.add(hemi,sun);
let W=1,H=1;
function resize(){W=window.innerWidth;H=window.innerHeight;renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
const cam={x:0,y:0,d:20};
const _v=new T.Vector3();
function toScreen(x,y,z){_v.set(x,y,z).project(camera);return{x:(_v.x+1)/2*W,y:(1-_v.y)/2*H,behind:_v.z>1};}

/* ================================================================ MODELS */
const MAT=makeMat(false), MAT_I=makeMat(true), MAT_2=makeMat(false,{side:T.DoubleSide});
function buildLander(){return geo([
  {g:P.oct(.42),c:0xe8eefc,s:[1.15,.9,1],p:[0,.12,0]},{g:P.oct(.17),c:0x3ef0ff,e:1,s:[1,.8,.6],p:[0,.2,.3]},
  {g:P.box(.7,.16,.5),c:0x5a6290,p:[0,-.2,0]},M({g:P.cyl(.12,.12,.36,6),c:0xc8d0ea,p:[.42,-.06,0]}),
  {g:P.cone(.17,.26,8),c:0x1b2140,p:[0,-.38,0]},{g:P.cone(.11,.08,8),c:0xff9b3d,e:1,p:[0,-.5,0],r:[0,0,PI]},
  M({g:P.box(.06,.5,.06),c:0x8a92c8,p:[.36,-.38,0],r:[0,0,.45]}),M({g:P.box(.22,.05,.22),c:0x8a92c8,p:[.52,-.6,0]}),
  M({g:P.box(.06,.06,.06),c:0x3ef0ff,e:1,p:[.52,-.56,.1]}),{g:P.box(.04,.3,.04),c:0x8a92c8,p:[.12,.55,0]},{g:P.oct(.04),c:0xff3d55,e:1,p:[.12,.72,0]},
  {g:P.box(.34,.22,.3),c:0xffc531,p:[0,-.12,-.32]}]);}
function buildPad(w){return geo([{g:P.box(w,.22,2.8),c:0x3a3f66,p:[0,-.11,0]},{g:P.box(w-.3,.06,2.4),c:0x8a92c8,p:[0,.02,0]},
  {g:P.box(.12,.07,2.5),c:0xffc531,p:[-w/2+.35,.04,0]},{g:P.box(.12,.07,2.5),c:0xffc531,p:[w/2-.35,.04,0]},
  M({g:P.box(.08,.9,.08),c:0x5a6290,p:[w/2-.1,.4,1.2]}),M({g:P.box(.08,.9,.08),c:0x5a6290,p:[w/2-.1,.4,-1.2]})]);}
const lander=new T.Group(),landerMesh=new T.Mesh(buildLander(),MAT);lander.add(landerMesh);scene.add(lander);
const HMESH={};for(const k in HZ){const g=ARC.ALIENS[k]();g.setAttribute('aFlash',new T.InstancedBufferAttribute(new Float32Array(16),1));
  const m=new T.InstancedMesh(g,MAT_I,16);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;scene.add(m);HMESH[k]=m;}
const cellMesh=new T.InstancedMesh(geo([{g:P.oct(.3),c:0xc9a0ff,e:1,s:[.8,.8,1.2]},{g:P.tor(.36,.04,3,12),c:0xb36bff,e:1}]),MAT,12);
cellMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);cellMesh.count=0;cellMesh.frustumCulled=false;scene.add(cellMesh);
const dbMesh=new T.InstancedMesh(geo([{g:P.tet(.5),c:0xffffff}]),new T.MeshLambertMaterial({vertexColors:true}),80);
dbMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);dbMesh.setColorAt(0,new T.Color());dbMesh.count=0;dbMesh.frustumCulled=false;scene.add(dbMesh);
const DB_COL=[0xe8eefc,0x5a6290,0x3ef0ff,0xffc531,0x8a92c8].map(h=>new T.Color(h));
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3();
const fx=new ARC.Batch(scene,1600,ARC.FX_FS,{blend:T.AdditiveBlending,order:5});

/* ================================================================ SKY */
const STARN=500,starGeo=new T.BufferGeometry();
{const pos=new Float32Array(STARN*3),sz=new Float32Array(STARN);for(let i=0;i<STARN;i++){pos[i*3+2]=-90;sz[i]=Math.random()<.08?rand(2.4,3.4):rand(1,2);}
  starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aSize',new T.BufferAttribute(sz,1));}
const starMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:Math.min(DPR,2)},uColor:{value:new T.Vector3(1,1,1)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:'uniform float uTime,uPx;attribute float aSize;varying float vB;\nvoid main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uPx;vB=(0.4+0.25*aSize)*(0.75+0.25*sin(uTime*1.5+position.x*3.1));}',
  fragmentShader:'uniform vec3 uColor;varying float vB;void main(){float d=length(gl_PointCoord-0.5);gl_FragColor=vec4(uColor*vB,smoothstep(0.5,0.05,d));}'});
const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;scene.add(stars);
const planet=new T.Group();scene.add(planet);let planetMesh=null;
const MAT_SKY=makeMat(false,{fog:false}),ringMesh=new T.Mesh(geo([{g:P.tor(1.65,.06,3,40),c:0xffffff}]),MAT_SKY);ringMesh.rotation.x=1.2;planet.add(ringMesh);

/* ================================================================ TERRAIN */
// Heightfield sampled every unit. Near ground is a solid strip you can land on; two darker ridgelines sit behind it for depth.
let world=null;const terrainMeshes=[],padMeshes=[];
function hAt(arr,x){const k=clamp(x,0,arr.length-1.001),i=Math.floor(k),f=k-i;return lerp(arr[i],arr[i+1],f);}
const ground=x=>hAt(world.h,x), ceil=x=>world.c?hAt(world.c,x):1e9;
// A low-poly strip from a heightfield: a front face down (or up, for a ceiling) to `edge`, plus a top surface going back in z.
function stripGeo(xs,hs,edge,zf,zb,top,side,seed,isCeil){
  const r=seeded(seed),Pp=[],N=[],C=[],E=[],ct=new T.Color(),cs=new T.Color(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3();
  const tri=(p,q,s,col)=>{a.set(...p);b.set(...q);c.set(...s);n.subVectors(c,b).cross(a.clone().sub(b)).normalize();
    for(const v of [a,b,c]){Pp.push(v.x,v.y,v.z);N.push(n.x,n.y,n.z);C.push(col.r,col.g,col.b);E.push(0);}};
  for(let k=0;k<xs.length-1;k++){const x0=xs[k],x1=xs[k+1],h0=hs[k],h1=hs[k+1];
    ct.set(top[0]).lerp(cs.set(top[1]),r());cs.set(side).lerp(ct,r()*.15);
    const lip=isCeil?.5:-.5,band=ct.clone().lerp(new T.Color(side),.55);
    tri([x0,h0,zf],[x1,h1,zf],[x1,h1,zb],ct);tri([x0,h0,zf],[x1,h1,zb],[x0,h0,zb],ct);
    tri([x0,h0+lip,zf],[x1,h1+lip,zf],[x1,h1,zf],band);tri([x0,h0+lip,zf],[x1,h1,zf],[x0,h0,zf],band);
    tri([x0,edge,zf],[x1,edge,zf],[x1,h1+lip,zf],cs);tri([x0,edge,zf],[x1,h1+lip,zf],[x0,h0+lip,zf],cs);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));
  g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('aEmis',new T.Float32BufferAttribute(E,1));g.computeBoundingSphere();return g;}
function buildWorld(i){
  const L=MISSIONS[i],mo=MOONS[L.m],r=seeded(1000+i*77),n=L.w+1,h=new Float32Array(n);
  const ph=[r()*TAU,r()*TAU,r()*TAU];
  for(let k=0;k<n;k++)h[k]=L.rough*(.55*Math.sin(k*.17+ph[0])+.3*Math.sin(k*.41+ph[1])+.15*Math.sin(k*.93+ph[2]))+(r()-.5)*L.rough*.3;
  for(const k of [0,1,n-2,n-1])h[k]+=9;   // cliffs at both ends
  const pads=L.pads.map((f,j)=>{const x=clamp(f*L.w,L.pw/2+3,L.w-L.pw/2-3),k0=Math.floor(x-L.pw/2-.5),k1=Math.ceil(x+L.pw/2+.5);
    let y=0;for(let k=k0;k<=k1;k++)y+=h[k];y/=k1-k0+1;
    if(L.spire&&L.spire.includes(j)){let mx=-1e9;for(let k=k0-3;k<=k1+3;k++)mx=Math.max(mx,h[clamp(k,0,n-1)]);y=mx+L.rough*.8;}
    for(let k=k0;k<=k1;k++)h[k]=y;return{x,y,w:L.pw,i:j};});
  let lo=1e9,hi=-1e9;for(let k=2;k<n-2;k++){lo=Math.min(lo,h[k]);hi=Math.max(hi,h[k]);}
  for(let k=0;k<n;k++)h[k]-=lo;for(const p of pads)p.y-=lo;hi-=lo;
  let c=null;
  if(L.cave){c=new Float32Array(n);const q=[r()*TAU,r()*TAU];
    // at least 4.8 units of headroom over the nearby ground, not just the point directly below
    for(let k=0;k<n;k++){let g=-1e9;for(let j=Math.max(0,k-2);j<=Math.min(n-1,k+2);j++)g=Math.max(g,h[j]);c[k]=Math.max(g+4.8,hi+L.cave-1.6*(.5+.5*Math.sin(k*.23+q[0]))-1.1*(.5+.5*Math.sin(k*.57+q[1]))-r()*.6);}
    for(const p of pads){const k0=Math.floor(p.x-p.w/2-1),k1=Math.ceil(p.x+p.w/2+1);for(let k=k0;k<=k1;k++)c[k]=Math.max(c[k],p.y+6);}}
  // start high, but in a cave clear of the ceiling over the first stretch the lander drifts through
  world={L,mo,i,h,c,pads,hi,start:{x:3.2,y:c?Math.min(hi+7,Math.min(...c.slice(1,9))-2.6):hi+9}};
  // hazards and fuel cells, kept out of the start area and the airspace straight above each pad
  // Hazards keep their whole patrol area (rx, ry around the anchor) out of the start and the airspace above each pad.
  const clear=(x,y,rx,ry)=>{if(Math.hypot(Math.max(0,Math.abs(x-world.start.x)-rx),Math.max(0,Math.abs(y-world.start.y)-ry))<8)return false;
    for(const p of pads)if(Math.abs(x-p.x)<p.w/2+1.8+rx&&y-ry<p.y+9)return false;return true;};
  const r2=seeded(5000+i*31),rr=(a,b)=>a+r2()*(b-a);   // same layout every attempt, so a mission can be learned
  // in caves, only where the gap leaves room to fly around
  const spot=(lo,hiY,rx,ry)=>{for(let t=0;t<120;t++){const x=rr(5,L.w-5),gy=hAt(h,x),top=c?hAt(c,x)-1.4-ry:gy+hiY;if(c&&top-gy<6.5+ry)continue;
    const y=rr(gy+lo+ry,Math.max(gy+lo+ry+.5,top));if(clear(x,y,rx,ry))return{x,y};}return null;};
  world.hz=[];for(const [t,cnt] of (L.hz||[]))for(let j=0;j<cnt;j++){const sp=t==='drone'?rr(.4,.6):t==='mite'?rr(1,1.6):rr(.15,.3),rng=t==='drone'?rr(3,5.5):t==='mite'?rr(.8,1.3):rr(1.2,2.4);
    const rx=rng+HZ[t].r,ry=(t==='mite'?rng:t==='drone'?.4:.5)+HZ[t].r,s=spot(3,11,rx,ry);
    if(s)world.hz.push({t,x0:s.x,y0:s.y,x:s.x,y:s.y,ph:rr(0,TAU),rot:rr(0,TAU),sp,rng});}
  world.cells=[];for(let j=0;j<(L.cells||0);j++){const s=spot(2.5,9,0,0);if(s)world.cells.push({x:s.x,y:s.y,on:true,ph:rr(0,TAU)});}
  // meshes
  for(const m of terrainMeshes){scene.remove(m);m.geometry.dispose();}terrainMeshes.length=0;
  for(const m of padMeshes){scene.remove(m);m.geometry.dispose();}padMeshes.length=0;
  const xs=Array.from({length:n},(_,k)=>k);
  const add=g=>{const m=new T.Mesh(g,MAT_2);scene.add(m);terrainMeshes.push(m);};
  add(stripGeo(xs,h,-14,1.6,-1.6,mo.top,mo.side,i*3+1,false));
  if(c)add(stripGeo(xs,c,c.reduce((a,v)=>Math.max(a,v),0)+18,1.6,-1.6,mo.top,mo.side,i*3+2,true));
  for(let layer=0;layer<2;layer++){const rr=seeded(i*9+layer),fx_=[],fh=[],z=layer?-26:-9,amp=L.rough*(layer?2.6:1.6)+3,base=layer?hi*.6+4:hi*.3+1;
    for(let x=-40;x<=L.w+40;x+=layer?4:2.5){fx_.push(x);fh.push(base+amp*(.5+.5*Math.sin(x*(layer?.05:.09)+rr()*TAU))+rr()*amp*.35);}
    add(stripGeo(fx_,fh,-30,z+1.5,z-1.5,[mo.far[layer],mo.far[layer]],mo.far[1],i*5+layer,false));}
  for(const p of pads){const m=new T.Mesh(buildPad(p.w),MAT);m.position.set(p.x,p.y,0);scene.add(m);padMeshes.push(m);}
  // sky
  scene.background=new T.Color(mo.bg);scene.fog=new T.Fog(mo.bg,40,140);const sc=rgb(mo.star);starMat.uniforms.uColor.value.set(sc[0],sc[1],sc[2]);
  const sp=starGeo.getAttribute('position');for(let k=0;k<STARN;k++){sp.array[k*3]=rand(-60,L.w+60);sp.array[k*3+1]=rand(-10,hi+70);}sp.needsUpdate=true;
  if(planetMesh){planet.remove(planetMesh);planetMesh.geometry.dispose();}
  const g=geo([{g:P.ico(1,1),c:0xffffff}]),col=g.getAttribute('color'),c1=new T.Color(mo.planet[0]),c2=new T.Color(mo.planet[1]),tc=new T.Color();
  for(let k=0;k<col.count;k+=3){tc.copy(c1).lerp(c2,Math.random()*.9);for(let j=0;j<3;j++)col.setXYZ(k+j,tc.r,tc.g,tc.b);}
  planetMesh=new T.Mesh(g,MAT_SKY);planet.add(planetMesh);ringMesh.geometry.dispose();ringMesh.geometry=geo([{g:P.tor(1.65,.06,3,40),c:mo.planet[2]},{g:P.tor(1.9,.03,3,40),c:mo.planet[2]}]);
  planet.scale.setScalar(16);planet.position.set(L.w*.72,hi+42,-120);
}

/* ================================================================ AUDIO */
const Snd=ARC.synth({sfx:()=>S.set.sfx,music:()=>S.set.music,onInit:()=>{if(Mus.want)Mus.play(Mus.want[0],Mus.want[1]);},
  thr:{tick:.05,warn:.9,pick:.1,thud:.2},
  sounds:{
    tick:(s,t)=>{s.osc('square',880,0,t,.03,.03);},
    pick:(s,t)=>{s.osc('triangle',660,990,t,.12,.1);s.osc('triangle',990,1320,t+.06,.1,.07);},
    land:(s,t)=>{s.osc('sine',160,60,t,.2,.3);s.nz(t,.15,.15,'lowpass',900,200);[523,784].forEach((f,i)=>s.osc('triangle',f,0,t+.08+i*.08,.14,.07));},
    deliver:(s,t)=>{[523,659,784,1047].forEach((f,i)=>s.osc('square',f,0,t+i*.07,.1,.05));},
    thud:(s,t)=>{s.osc('sine',120,50,t,.15,.2);},
    crash:(s,t)=>{s.nz(t,1.6,.7,'lowpass',2600,50);s.osc('sawtooth',260,30,t,1.3,.25);},
    warn:(s,t)=>{s.osc('triangle',880,880,t,.12,.08);s.osc('triangle',660,660,t+.15,.12,.08);},
    win:(s,t)=>{[523,659,784].forEach((f,i)=>s.osc('triangle',f,0,t+i*.1,.25,.09));s.osc('triangle',1047,0,t+.32,.6,.09);},
    click:(s,t)=>{s.osc('square',880,0,t,.03,.035);},
  }});
const Mus=ARC.music(Snd,{level:i=>MOONS[i],calmBpm:90,calmBass:.22});
const vibe=ms=>ARC.vibe(S.set.vibe,ms);
let engine=null,windSnd=null;
function voices(){if(!engine&&Snd.ctx){engine=Snd.loop('lowpass',300);windSnd=Snd.loop('bandpass',900);}}

/* ================================================================ PARTICLES */
const pt={n:0,cap:1200,keys:['x','y','z','vx','vy','l','m','s0','s1','r','g','b','sh','dr','gy']};for(const k of pt.keys)pt[k]=new Float32Array(pt.cap);
const db={n:0,cap:80,keys:['x','y','vx','vy','rx','ry','wx','wy','l','m','s','c']};for(const k of db.keys)db[k]=new Float32Array(db.cap);
function rm(o,i){const j=--o.n;if(i!==j)for(const k of o.keys)o[k][i]=o[k][j];}
function part(x,y,z,vx,vy,l,s0,s1,c,sh,dr,gy){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.l[i]=pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.dr[i]=dr||0;pt.gy[i]=gy||0;}
const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),green:rgb(0x5dff9b),hot:rgb(0xffe6b0),red:rgb(0xff4d4d),dim:rgb(0x5d5f99)};
function boom(x,y,sz,c){for(let i=0;i<10+sz*16;i++){const a=rand(0,TAU),s=rand(.5,1)*(2+sz*4);part(x,y,.3,Math.cos(a)*s,Math.sin(a)*s,rand(.3,.7)*(.7+sz*.3),rand(.3,.6)*(.6+sz*.5),.05,c,0,3,0);}
  part(x,y,.4,0,0,.2+sz*.06,1+sz*1.6,.2,COL.hot,0,0);part(x,y,.3,0,0,.35+sz*.1,.2,2+sz*2.6,c,1,0);
  for(let i=0;i<4+sz*4&&db.n<db.cap;i++){const k=db.n++,a=rand(0,PI),s=rand(2,6);db.x[k]=x;db.y[k]=y;db.vx[k]=Math.cos(a)*s;db.vy[k]=Math.sin(a)*s;db.rx[k]=rand(0,TAU);db.ry[k]=rand(0,TAU);
    db.wx[k]=rand(-9,9);db.wy[k]=rand(-9,9);db.l[k]=db.m[k]=rand(1.2,2);db.s[k]=rand(.1,.26);db.c[k]=Math.floor(rand(0,5));}}

/* ================================================================ RUN STATE */
let state='title';
const ship={x:0,y:0,vx:0,vy:0,a:0,ta:0,fuel:100,max:100,thr:false,on:null,settle:0,t:0,target:0,soft:9,dead:'',deadT:0,flash:0,used:false,warnT:0};
const FEET=[[-.52,-.62],[.52,-.62]],BODY=[[0,.62],[-.44,.08],[.44,.08],[-.3,-.36],[.3,-.36]];
function local(lx,ly){const c=Math.cos(ship.a),s=Math.sin(ship.a);return[ship.x+lx*c+ly*s,ship.y-lx*s+ly*c];}
let mi=0,doneT=0;
function startMission(i){
  mi=clamp(i,0,Math.min(S.unlocked,MISSIONS.length-1));buildWorld(mi);const L=MISSIONS[mi],st=world.start;
  Object.assign(ship,{x:st.x,y:st.y,vx:1.3,vy:0,a:0,ta:0,fuel:L.fuel,max:L.fuel,thr:false,on:null,settle:0,t:0,target:0,soft:9,dead:'',deadT:0,flash:0,used:false,warnT:0});
  pt.n=db.n=0;doneT=0;cam.x=st.x;cam.y=st.y-2;cam.d=24;
  ship.cal=S.set.ctrl==='tilt';   // "level" becomes however the phone is held at the first reading
  for(const id of ['banner','toast'])$(id).classList.remove('go');   // nothing from the last mission carries over
  state='play';hideScreens();$('hud').hidden=false;$('hint').hidden=false;$('hint').textContent=steerHint();
  $('hName').textContent='Mission '+(mi+1)+' · '+L.name;$('hMoon').textContent=world.mo.name+' · gravity '+world.mo.g.toFixed(1);
  $('hPads').innerHTML=world.pads.map((_,k)=>'<i'+(k?'':' class="cur"')+'></i>').join('');$('wind').hidden=!L.wind;
  Mus.play('level',L.m);requestWake();resetHold();lastHud={};
}
const steerHint=()=>(S.set.ctrl==='tilt'&&!ARC.motion.denied?'Tilt to steer':'Drag sideways to steer')+' · Hold anywhere to thrust';

/* ================================================================ INPUT */
// Thrust: any finger down outside the buttons. Steering: phone tilt, or (touch mode) how far the first finger has slid sideways.
const holds=new Map();let steerId=null,steerX0=0,steerX=0;const keys={};
const tiltOn=()=>S.set.ctrl==='tilt'&&ARC.motion.live;
function resetHold(){holds.clear();steerId=null;}
stage.addEventListener('pointerdown',e=>{if(state!=='play'||e.target.closest('button'))return;e.preventDefault();try{stage.setPointerCapture(e.pointerId);}catch(_){}
  holds.set(e.pointerId,1);if(steerId===null){steerId=e.pointerId;steerX0=steerX=e.clientX;}});
stage.addEventListener('pointermove',e=>{if(e.pointerId===steerId)steerX=e.clientX;});
function endPtr(e){holds.delete(e.pointerId);if(e.pointerId===steerId){steerId=null;const n=holds.keys().next();if(!n.done){steerId=n.value;steerX0=steerX;}}}
stage.addEventListener('pointerup',endPtr);stage.addEventListener('pointercancel',endPtr);
window.addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space')e.preventDefault();if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pause();else if(state==='paused')resume();}});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
let autoInput=null;   // test hook: a function returning {ta, thr} replaces the player
function readInput(){
  if(autoInput)return autoInput(ship,world);
  const kl=keys.ArrowLeft||keys.KeyA,kr=keys.ArrowRight||keys.KeyD;
  let ta=0;
  if(kl||kr)ta=(kr?1:0)-(kl?1:0);
  else if(tiltOn()){if(ship.cal){ARC.motion.calibrate();ship.cal=false;}let t=ARC.motion.read();t=Math.sign(t)*Math.max(0,Math.abs(t)-.035);ta=clamp(t*(SENS[S.set.sens]||1.7)/MAX_TILT,-1,1);}
  else if(steerId!==null)ta=clamp((steerX-steerX0)/(Math.min(W,H)*.3),-1,1);
  return{ta:ta*MAX_TILT,thr:holds.size>0||!!(keys.ArrowUp||keys.KeyW||keys.Space)};
}

/* ================================================================ SIMULATION */
function crash(why){if(ship.dead)return;ship.dead=why;ship.deadT=0;ship.thr=false;boom(ship.x,ship.y,2,COL.orange);boom(ship.x,ship.y+.2,1,COL.cyan);
  Snd.play('crash');vibe([60,40,120]);S.stats.crashes++;save();lander.visible=false;}
function step(dt){
  const L=world.L,g=world.mo.g;
  if(state==='play'&&!ship.dead){
    ship.t+=dt;const inp=readInput();
    if(ship.on&&!inp.thr)inp.ta=0;
    ship.ta=inp.ta;ship.a+=clamp(ship.ta-ship.a,-ROT*dt,ROT*dt);
    ship.thr=inp.thr&&ship.fuel>0;if(inp.thr&&!ship.used){ship.used=true;$('hint').hidden=true;}
    // gusts fade close to the ground, so final approaches stay flyable
    const shelter=clamp((ship.y-ground(ship.x))/5,.25,1),wind=L.wind?L.wind*.7*shelter*(.6*Math.sin(ship.t*.35+mi)+.4*Math.sin(ship.t*1.1+mi*2)):0;world.wind=wind;
    let ax=wind,ay=-g;
    if(ship.thr){ax+=Math.sin(ship.a)*THRUST;ay+=Math.cos(ship.a)*THRUST;ship.fuel=Math.max(0,ship.fuel-BURN*dt);}
    if(ship.on){
      if(ship.thr&&ay>0){ship.on=null;ship.settle=0;}
      else{ship.vx=ship.vy=0;ship.a+=(0-ship.a)*Math.min(1,dt*6);ship.settle+=dt;
        if(ship.on.i===ship.target&&ship.settle>.8)deliver();}
    }
    if(!ship.on){
      ship.vx+=ax*dt;ship.vy+=ay*dt;ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;
      if(ship.x<1){ship.x=1;ship.vx=Math.abs(ship.vx)*.3;}if(ship.x>L.w-1){ship.x=L.w-1;ship.vx=-Math.abs(ship.vx)*.3;}
      const top=world.c?1e9:world.hi+18;if(ship.y>top){ship.y=top;ship.vy=Math.min(ship.vy,0);}
      collide();
    }
    if(ship.fuel>0&&ship.fuel<ship.max*.18){ship.warnT-=dt;if(ship.warnT<=0){ship.warnT=1.4;Snd.play('warn');}}
    // exhaust and dust
    if(ship.thr){const s=Math.sin(ship.a),c=Math.cos(ship.a),[ex,ey]=local(0,-.55);
      for(let k=0;k<2;k++){const sp=rand(3,5);part(ex,ey,0,-s*sp+ship.vx+rand(-.5,.5),-c*sp+ship.vy+rand(-.5,.5),rand(.25,.4),rand(.35,.5),.05,Math.random()<.5?COL.orange:COL.hot,0,2,0);}
      const gy=ground(ex),d=ey-gy;if(d<3.5&&Math.random()<.8){const k=1-d/3.5;for(let j=0;j<2;j++){const dir=Math.random()<.5?-1:1;part(ex+rand(-.3,.3),gy+.15,.5,dir*rand(2,4)*k,rand(.2,1),rand(.5,.9),.2,rand(.5,.8),rgb(world.mo.top[0]),0,2,0);}}}
  }else if(ship.dead){ship.deadT+=dt;if(ship.deadT>2.2&&state==='play')result(false);}
  if(state==='play'&&doneT>0){doneT+=dt;if(doneT>1.6)result(true);}
  // hazards drift on their own paths
  for(const h of world.hz){h.ph+=dt*h.sp;h.rot+=dt*(h.t==='rock'?.6:h.t==='mite'?3:1.5);
    if(h.t==='drone'){h.x=h.x0+Math.sin(h.ph)*h.rng;h.y=h.y0+Math.sin(h.ph*2.3)*.4;}
    else if(h.t==='mite'){h.x=h.x0+Math.cos(h.ph)*h.rng;h.y=h.y0+Math.sin(h.ph)*h.rng;}
    else{h.x=h.x0+Math.sin(h.ph)*h.rng;h.y=h.y0+Math.cos(h.ph*.7)*.5;}}
  for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){rm(pt,i);continue;}const dr=Math.max(0,1-pt.dr[i]*dt);pt.vx[i]*=dr;pt.vy[i]=pt.vy[i]*dr-pt.gy[i]*dt;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;}
  for(let i=db.n-1;i>=0;i--){db.l[i]-=dt;if(db.l[i]<=0){rm(db,i);continue;}db.vy[i]-=world.mo.g*2*dt;db.x[i]+=db.vx[i]*dt;db.y[i]+=db.vy[i]*dt;
    const gy=ground(db.x[i]);if(db.y[i]<gy){db.y[i]=gy;db.vy[i]=Math.abs(db.vy[i])*.35;db.vx[i]*=.6;}db.rx[i]+=db.wx[i]*dt;db.ry[i]+=db.wy[i]*dt;}
  ship.flash=Math.max(0,ship.flash-dt*4);
}
function collide(){
  // hazards, fuel cells, then the rock itself
  for(const h of world.hz)if(Math.hypot(h.x-ship.x,h.y-ship.y)<HZ[h.t].r+.5){crash('Hit '+(h.t==='rock'?'a meteor':h.t==='mite'?'a mite swarm':'a drone'));return;}
  for(const c of world.cells)if(c.on&&Math.hypot(c.x-ship.x,c.y-ship.y)<.9){c.on=false;ship.fuel=Math.min(ship.max,ship.fuel+CELL);Snd.play('pick');part(c.x,c.y,.3,0,0,.4,.3,2.4,COL.violet,1,0);toast('Fuel +'+CELL,COL.violet);}
  for(const [lx,ly] of BODY){const [x,y]=local(lx,ly);if(y<ground(x)||y>ceil(x)){crash('Hull hit the rock');return;}}
  let touch=false;const fx_=[];for(const [lx,ly] of FEET){const [x,y]=local(lx,ly);fx_.push(x);if(y<=ground(x))touch=true;if(y>ceil(x)){crash('Hit the ceiling');return;}}
  if(!touch||ship.vy>0)return;   // rising off a pad is not a landing
  const pad=world.pads.find(p=>fx_.every(x=>Math.abs(x-p.x)<=p.w/2+.05)&&Math.abs(ground(ship.x)-p.y)<.05);
  const vy=-ship.vy,vx=Math.abs(ship.vx),ang=Math.abs(ship.a);
  if(!pad){crash('Missed the pad');return;}
  if(vy>SAFE_VY){crash('Came down too fast');return;}
  if(vx>SAFE_VX){crash('Drifting sideways');return;}
  if(ang>SAFE_ANG){crash('Landed too steep');return;}
  ship.on=pad;ship.settle=0;ship.y=pad.y+.62+(1-Math.cos(ship.a))*.3;ship.soft=Math.min(ship.soft,vy);ship.vx=ship.vy=0;
  Snd.play('land');vibe(20);S.stats.landings++;for(let k=0;k<12;k++){const d=k<6?-1:1;part(ship.x+d*.5,pad.y+.1,.5,d*rand(1,3),rand(.2,.8),rand(.4,.7),.2,.6,rgb(world.mo.top[0]),0,3,0);}
}
function deliver(){const L=world.L;ship.target++;ship.fuel=Math.min(ship.max,ship.fuel+REFUEL);Snd.play('deliver');vibe(30);
  const p=ship.on;for(let k=0;k<16;k++)part(p.x+rand(-p.w/2,p.w/2),p.y+.2,.6,0,rand(1,3),rand(.5,1),.25,.05,COL.green,0,1,0);
  $('hPads').innerHTML=world.pads.map((_,k)=>'<i class="'+(k<ship.target?'done':k===ship.target?'cur':'')+'"></i>').join('');
  if(ship.target>=L.pads.length){doneT=.001;banner('Cargo delivered','Mission complete');Snd.play('win');}
  else toast('Cargo '+ship.target+' of '+L.pads.length+' delivered · fuel +'+REFUEL,COL.green);}

/* ================================================================ DRAW */
const _tmp=[0,0,0];
function draw(dt,now){
  const tt=now*.001;
  if(world){
    // camera: follow the lander, pull back when high up so the ground stays in view
    const alt=ship.y-ground(ship.x),want=lerp(14,27,clamp((alt-1.5)/14,0,1)),L=world.L;
    cam.d+=(want-cam.d)*Math.min(1,dt*1.5);
    const hw=Math.tan(camera.fov*PI/360)*cam.d*camera.aspect,tx=clamp(ship.x,Math.min(L.w/2,hw-2),Math.max(L.w/2,L.w-hw+2));
    cam.x+=(tx-cam.x)*Math.min(1,dt*3);cam.y+=(ship.y-1.2-cam.y)*Math.min(1,dt*3);
    if(state==='title'){cam.x=L.w*.5+Math.sin(tt*.12)*6;cam.y=world.hi+3;cam.d=26;}
    const sk=ship.dead&&ship.deadT<.5?(.5-ship.deadT)*.6:0;
    camera.position.set(cam.x+(Math.random()-.5)*sk,cam.y+cam.d*.2+(Math.random()-.5)*sk,cam.d);camera.lookAt(cam.x,cam.y,0);
    // lander
    if(!ship.dead){lander.visible=true;lander.position.set(ship.x,ship.y,0);lander.rotation.set(0,Math.sin(tt*.8)*.15,-ship.a);
      if(ship.thr){const [ex,ey]=local(0,-.62),fl=.8+Math.random()*.4,ang=-ship.a;fx.push(ex-Math.sin(ship.a)*.35,ey-Math.cos(ship.a)*.35,.1,ang,.4*fl,1.1*fl,2,.95,COL.orange);fx.push(ex,ey,.15,0,.6*fl,.6*fl,0,.9,COL.hot);}
      for(const [lx,ly] of FEET){const [x,y]=local(lx,ly);fx.push(x,y+.05,.25,0,.22,.22,0,.6+.4*Math.sin(tt*6),ship.on?COL.green:COL.cyan);}
      const gy=ground(ship.x),alt2=ship.y-.62-gy;if(alt2<6)fx.push(ship.x,gy+.05,1.7,0,1.4*(1-alt2/8),.25,0,.35*(1-alt2/6),COL.cyan);}
    // pads
    world.pads.forEach((p,k)=>{const done=k<ship.target,cur=k===ship.target&&state!=='title',c=done?COL.green:cur?COL.cyan:COL.dim,b=cur?.6+.4*Math.sin(tt*5):1;
      for(const s of [-1,1])fx.push(p.x+s*(p.w/2-.1),p.y+.92,1.3,0,.45,.45,0,.9*b,c);
      if(cur&&!ship.on){for(let j=0;j<3;j++)fx.push(p.x,p.y+2.6+j*.55-((tt*1.5)%1)*.55,1.4,PI,.9,.9,3,(1-j*.3)*.9,COL.cyan);}});
    // hazards and cells
    for(const k in HMESH)HMESH[k].count=0;
    for(const h of world.hz){const m=HMESH[h.t];const i=m.count++;_m4.compose(_p.set(h.x,h.y,0),_q.setFromEuler(_e.set(h.t==='rock'?h.rot:.4,h.t==='rock'?h.rot*.7:0,h.t==='rock'?0:h.rot)),_s.setScalar(HZ[h.t].scale));m.setMatrixAt(i,_m4);
      if(h.t!=='rock')fx.push(h.x,h.y,.2,0,1.6,1.6,0,.25,h.t==='drone'?COL.orange:COL.pink);}
    for(const k in HMESH)HMESH[k].instanceMatrix.needsUpdate=true;
    let nc=0;for(const c of world.cells){if(!c.on)continue;const i=nc++;_m4.compose(_p.set(c.x,c.y+Math.sin(tt*2+c.ph)*.15,0),_q.setFromEuler(_e.set(0,tt*2+c.ph,0)),_s.setScalar(1));cellMesh.setMatrixAt(i,_m4);
      fx.push(c.x,c.y,.3,0,1.6,1.6,0,.45,COL.violet);}
    cellMesh.count=nc;cellMesh.instanceMatrix.needsUpdate=true;
  }
  for(let i=0;i<pt.n;i++){const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_tmp[0]=pt.r[i];_tmp[1]=pt.g[i];_tmp[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_tmp);}
  for(let i=0;i<db.n;i++){const k=db.l[i]/db.m[i];_m4.compose(_p.set(db.x[i],db.y[i],.3),_q.setFromEuler(_e.set(db.rx[i],db.ry[i],0)),_s.setScalar(db.s[i]*Math.min(1,k*2)));dbMesh.setMatrixAt(i,_m4);dbMesh.setColorAt(i,DB_COL[db.c[i]|0]);}
  dbMesh.count=db.n;dbMesh.instanceMatrix.needsUpdate=true;dbMesh.instanceColor.needsUpdate=true;
  fx.flush();renderer.render(scene,camera);
}

/* ================================================================ HUD */
let lastHud={};
function setIf(k,v,fn){if(lastHud[k]!==v){lastHud[k]=v;fn(v);}}
// Landing limits only matter near the ground; higher up the gauges stay neutral.
let near=false;const ok=(el,good)=>{el.classList.toggle('bad',near&&!good);el.classList.toggle('na',!near);};
function hud(){
  const f=ship.fuel/ship.max;setIf('fuel',Math.round(f*200),v=>{$('hFuel').style.transform='scaleX('+v/200+')';$('hFuelN').textContent=Math.ceil(ship.fuel);$('fuelW').classList.toggle('low',f<.18);});
  const vy=-ship.vy,vx=Math.abs(ship.vx),ang=Math.abs(ship.a)*180/PI,alt=Math.max(0,ship.y-.62-ground(ship.x));
  if(near!==(alt<6)){near=alt<6;lastHud.vy=lastHud.vx=lastHud.ang=null;}
  setIf('vy',Math.round(vy*10),()=>{$('gVy').textContent=(vy>=0?'↓':'↑')+Math.abs(vy).toFixed(1);ok($('gVyW'),vy<=SAFE_VY);});
  setIf('vx',Math.round(vx*10),()=>{$('gVx').textContent=vx.toFixed(1);ok($('gVxW'),vx<=SAFE_VX);});
  setIf('ang',Math.round(ang),v=>{$('gAng').textContent=v+'°';ok($('gAngW'),ang<=SAFE_ANG*180/PI);});
  setIf('alt',Math.round(alt*2),()=>$('gAlt').textContent=alt.toFixed(1));
  setIf('t',Math.floor(ship.t),v=>$('hTime').textContent=Math.floor(v/60)+':'+String(v%60).padStart(2,'0'));
  if(world.L.wind)setIf('wind',Math.round((world.wind||0)*10),v=>{$('windA').style.transform='scaleX('+(v<0?-1:1)+')';$('windN').textContent=Math.abs(v/10).toFixed(1);});
  // arrow at the screen edge pointing to the next pad when it is off screen
  const p=world.pads[ship.target],ar=$('arrow');
  if(p&&!ship.dead){const s=toScreen(p.x,p.y+.5,0),m=44,off=s.behind||s.x<m||s.x>W-m||s.y<m+90||s.y>H-m-110;
    ar.hidden=!off;if(off){const cx=W/2,cy=H/2,dx=s.x-cx,dy=s.y-cy,k=Math.min((W/2-m)/Math.abs(dx||1e-6),(H/2-m-100)/Math.abs(dy||1e-6));
      ar.style.transform='translate('+(cx+dx*k-22)+'px,'+(cy+dy*k-22)+'px)';$('arrowI').style.transform='rotate('+Math.atan2(dy,dx)+'rad)';
      $('arrowN').textContent=Math.round(Math.hypot(p.x-ship.x,p.y-ship.y))+'m';}}
  else ar.hidden=true;
}
function toast(txt,c){const t=$('toast');t.textContent=txt;t.style.color='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';t.classList.remove('go');void t.offsetWidth;t.classList.add('go');}
function banner(eye,txt){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}

/* ================================================================ SCREENS */
const SCREENS=['title','levels','pause','result','settings'];
function hideScreens(){for(const s of SCREENS)$(s).hidden=true;}
function goTitle(){state='title';hideScreens();$('hud').hidden=true;$('title').hidden=false;buildWorld(Math.min(S.unlocked,MISSIONS.length-1));ship.dead='';ship.target=0;
  Object.assign(ship,{x:world.L.w*.5,y:world.hi+4,vx:0,vy:0,a:0,thr:false});
  const total=S.stars.reduce((a,v)=>a+(v||0),0);$('tStars').textContent=total+' / '+MISSIONS.length*3;Mus.play('calm',world.L.m);releaseWake();}
function goLevels(){state='levels';hideScreens();$('hud').hidden=true;$('levels').hidden=false;
  $('lvGrid').innerHTML=MISSIONS.map((L,i)=>{const lock=i>S.unlocked,st=S.stars[i]||0;
    return '<button class="lv'+(lock?' lock':'')+'" data-i="'+i+'"'+(lock?' disabled':'')+' style="--c:'+'#'+MOONS[L.m].top[0].toString(16).padStart(6,'0')+'">'+
      '<span class="lvn">'+(i+1)+'</span><b>'+L.name+'</b><small>'+MOONS[L.m].name+' · '+L.pads.length+' pad'+(L.pads.length>1?'s':'')+'</small>'+
      '<span class="st">'+[0,1,2].map(k=>'<i'+(k<st?' class="on"':'')+'></i>').join('')+'</span></button>';}).join('');}
function result(win){
  state='result';$('hud').hidden=true;releaseWake();if(engine)engine.set(0);if(windSnd)windSnd.set(0);
  const L=world.L;let stars=0;
  if(win){stars=1+(ship.fuel>=ship.max*.35?1:0)+(ship.t<=L.par?1:0);S.stars[mi]=Math.max(S.stars[mi]||0,stars);
    if(!S.best[mi]||ship.t<S.best[mi])S.best[mi]=Math.round(ship.t*10)/10;if(mi===S.unlocked&&mi<MISSIONS.length-1)S.unlocked=mi+1;save();}
  const r=$('result');r.className='screen dim '+(win?'win':'lose');
  $('rEye').textContent='Mission '+(mi+1)+' · '+L.name;$('rTitle').textContent=win?(mi===MISSIONS.length-1?'Every drop made':'Touchdown'):'Crashed';
  $('rSub').textContent=win?(stars===3?'Three stars. Textbook flying.':stars===2?'Finish under '+L.par+' s for the third star.':'Land with more fuel left and faster for more stars.'):ship.dead+'. Land slower than '+SAFE_VY+' m/s, nearly level, with both legs on the pad.';
  $('rStars').innerHTML=win?[0,1,2].map(k=>'<i'+(k<stars?' class="on"':'')+'></i>').join(''):'';$('rStars').hidden=!win;
  const rows=[['Time',ship.t.toFixed(1)+' s'+(win?' (par '+L.par+')':'')],['Fuel left',Math.round(ship.fuel/ship.max*100)+'%'],['Cargo delivered',ship.target+' / '+L.pads.length]];
  if(ship.soft<9)rows.push(['Softest touchdown',ship.soft.toFixed(2)+' m/s']);
  $('rRows').innerHTML=rows.map(x=>'<dt>'+x[0]+'</dt><dd>'+x[1]+'</dd>').join('');
  const next=win&&mi<MISSIONS.length-1;$('rMain').textContent=next?'Next mission':win?'Missions':'Retry';$('rMain').dataset.act=next?'next':win?'levels':'retry';
  $('rAlt').textContent=win?'Fly it again':'Missions';$('rAlt').dataset.act=win?'retry':'levels';
  hideScreens();r.hidden=false;Mus.play('calm',L.m);
}
function pause(){if(state!=='play')return;state='paused';resetHold();for(const k in keys)keys[k]=false;hideScreens();$('pause').hidden=false;
  $('pTitle').textContent='Mission '+(mi+1);$('pCal').hidden=S.set.ctrl!=='tilt';if(engine)engine.set(0);if(windSnd)windSnd.set(0);Snd.suspend();releaseWake();}
function resume(){if(state!=='paused')return;hideScreens();state='play';Snd.resume();last=performance.now();requestWake();}
let settingsFrom='title',confirmReset=false;
function openSettings(from){settingsFrom=from;$(from).hidden=true;$('settings').hidden=false;confirmReset=false;renderSettings();}
function renderSettings(){
  for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);
  for(const sg of document.querySelectorAll('#settings .seg'))for(const b of sg.children)b.classList.toggle('on',S.set[sg.dataset.seg]===b.dataset.v);
  $('ctrlHint').textContent=S.set.ctrl==='tilt'?(ARC.motion.denied?'Motion access was declined. Allow it in Safari’s website settings, or use Touch.':'Tilt the phone left and right to steer. It levels to however you hold it when a mission starts.'):'Hold to thrust and slide the finger sideways to steer.';
  $('sensRow').hidden=S.set.ctrl!=='tilt';$('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';}
// iOS only shows the motion permission prompt from inside a tap, so every button that leads to flying asks first.
function wantMotion(){if(S.set.ctrl==='tilt')return ARC.motion.start().then(ok=>{if(!ok&&ARC.motion.denied)toast('Motion access declined: drag to steer',COL.orange);return ok;});return Promise.resolve(false);}

/* ----- buttons ----- */
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>{Snd.init();voices();},{once:true});
$('tPlay').onclick=()=>{wantMotion();goLevels();};
$('tSet').onclick=()=>openSettings('title');
if(window.ARCADE){$('tArc').hidden=false;$('tArc').onclick=()=>{save();location.href=window.ARCADE.home;};}
$('lvGrid').onclick=e=>{const b=e.target.closest('.lv');if(!b||b.disabled)return;wantMotion();Snd.play('click');startMission(+b.dataset.i);};
$('lvBack').onclick=()=>goTitle();
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
$('pRes').onclick=resume;
$('pCal').onclick=()=>{ARC.motion.calibrate();toast('Level set to how you hold the phone',COL.cyan);resume();};
$('pRestart').onclick=()=>{Snd.resume();wantMotion();startMission(mi);};
$('pSet').onclick=()=>openSettings('pause');
$('pQuit').onclick=()=>{Snd.resume();goLevels();};
$('rMain').onclick=e=>act(e.target.dataset.act);$('rAlt').onclick=e=>act(e.target.dataset.act);
function act(a){wantMotion();if(a==='next')startMission(mi+1);else if(a==='retry')startMission(mi);else goLevels();}
$('setClose').onclick=()=>{$('settings').hidden=true;$(settingsFrom).hidden=false;if(settingsFrom==='pause')$('pCal').hidden=S.set.ctrl!=='tilt';};
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){S.set[t.dataset.set]=!S.set[t.dataset.set];Snd.apply();if(t.dataset.set==='vibe'&&S.set.vibe)vibe(30);save();renderSettings();return;}
  const b=e.target.closest('.seg button');if(b){const k=b.parentElement.dataset.seg;S.set[k]=b.dataset.v;if(k==='ctrl'&&b.dataset.v==='tilt')ARC.motion.start().then(()=>{ARC.motion.calibrate();renderSettings();});save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}const keep=S.set;S=fresh();S.set=keep;save();confirmReset=false;$('settings').hidden=true;goTitle();}
});
document.addEventListener('touchmove',e=>{if(!e.target.closest||!e.target.closest('.scroll'))e.preventDefault();},{passive:false});
for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
function autoPause(){if(state==='play')pause();else Snd.suspend();save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else if(state!=='paused')Snd.resume();last=performance.now();});
window.addEventListener('pagehide',autoPause);window.addEventListener('blur',autoPause);
window.addEventListener('resize',resize);
let wakeLock=null;
function requestWake(){try{if(navigator.wakeLock&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null;});}).catch(()=>{});}catch(e){}}
function releaseWake(){try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}

/* ================================================================ LOOP */
let last=performance.now();
function frame(now){
  requestAnimationFrame(frame);let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(document.hidden||state==='paused')return;
  if(world){const steps=dt>1/50?2:1;for(let i=0;i<steps;i++)step(dt/steps);}
  if(state==='play'){hud();voices();
    if(engine)engine.set(ship.thr?.5:0,ship.thr?300+Math.random()*80:200);
    if(windSnd)windSnd.set(world.L.wind?Math.min(.25,Math.abs(world.wind||0)*.15):0,700+Math.abs(world.wind||0)*400);
    if(S.set.ctrl==='tilt'&&!ARC.motion.live&&ship.t>1.5&&!fellBack){fellBack=true;$('hint').hidden=false;$('hint').textContent='No tilt sensor here · Drag sideways to steer';}}
  starMat.uniforms.uTime.value+=dt;Mus.tick();draw(dt,now);
}
let fellBack=false;

/* ================================================================ BOOT */
resize();goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
window.__moondrop={get S(){return S;},ship,get world(){return world;},MISSIONS,startMission,step,result,goLevels,goTitle,ground,get state(){return state;},keys,holds,motion:ARC.motion,set auto(f){autoInput=f;},ceil};
})();
