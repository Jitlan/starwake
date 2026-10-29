/* Wreckwatch: isometric base-defense roguelite in the Starwake universe. Everything (models, sound, UI) is generated in code. */
(function(){
'use strict';
const T=THREE, TAU=Math.PI*2, PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const fmt=n=>Math.round(n).toLocaleString('en-US');
const pick=a=>a[Math.floor(Math.random()*a.length)];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;};
const angDiff=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const turnTo=(a,b,m)=>a+clamp(angDiff(a,b),-m,m);
function seeded(seed){let s=(Math.abs(seed|0)%2147483646)+1;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================ SAVE */
const KEY='wreckwatch.save.v1';
const BASE_UNLOCK=['wall','blaster','scatter','intercept','mine','patch','overclock'];
function fresh(){return{v:1,diff:'normal',unlocked:BASE_UNLOCK.slice(),best:0,runs:0,wins:0,kills:0,run:null,
  set:{sfx:true,music:true,vibe:true,gfx:'auto'}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&typeof v===typeof a[k])a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
for(const t of BASE_UNLOCK)if(!S.unlocked.includes(t))S.unlocked.push(t);
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ================================================================ CATALOG */
// kind s = structure on one tile, a = action aimed at a tile. w = weapon: r range in tiles, cd seconds per shot, dmg per hit.
const CARDS={
  wall:{name:'Barricade',kind:'s',cost:1,hp:80,col:0x8a92c8,short:'Blocks',desc:'Cheap and tough. Aliens have to chew through it, and it soaks their fire.'},
  blaster:{name:'Blaster',kind:'s',cost:3,hp:36,col:0x3ef0ff,w:{k:'bolt',r:3.6,cd:.3,dmg:1.6},short:'Rapid fire',desc:'Fast cyan bolts at whichever alien is closest to the ship.'},
  scatter:{name:'Scatter',kind:'s',cost:3,hp:38,col:0xffd23d,w:{k:'fan',r:2.6,cd:.62,dmg:.95,n:5},short:'Close fan',desc:'A fan of pellets. Shreds swarms that get close.'},
  lance:{name:'Ion Lance',kind:'s',cost:5,hp:30,col:0xc9a0ff,w:{k:'beam',r:5.4,cd:1.5,dmg:10},short:'Long pierce',desc:'A slow, heavy beam that pierces every alien in a line.'},
  seeker:{name:'Seeker Silo',label:'Seeker',kind:'s',cost:4,hp:32,col:0xff9b3d,w:{k:'missile',r:6.5,cd:1.9,dmg:4.5,n:2,splash:1},short:'Homing splash',desc:'Homing missiles that burst on impact. Outranges every alien.'},
  tesla:{name:'Tesla Coil',kind:'s',cost:4,hp:44,col:0x4aa8ff,w:{k:'arc',r:2.7,cd:.8,dmg:2.6,n:4},short:'Chain zap',desc:'Lightning that jumps through up to four aliens.'},
  mine:{name:'Mine',kind:'s',cost:2,hp:1,col:0xff3d55,flat:1,short:'Burst trap',desc:'Aliens fly right over it and it detonates. Single use, never targeted.'},
  pylon:{name:'Guard Pylon',kind:'s',cost:4,hp:55,col:0x5dff9b,short:'Guard aura',desc:'Defenses on the eight tiles around it take 40% less damage from bites and bullets.'},
  intercept:{name:'Interceptor',label:'Intercept',kind:'s',cost:3,hp:32,col:0xa8d8ff,pd:{r:2.6,cd:.24},short:'Stops fire',desc:'Point defense. Shoots alien bullets out of the air before they land.'},
  dome:{name:'Shield Dome',label:'Dome',kind:'s',cost:4,hp:40,col:0x4aa8ff,aura:1.9,shield:60,short:'Bullet bubble',desc:'A bubble that soaks up alien bullets flying into it. It drops when drained and recharges after a few quiet seconds.'},
  bay:{name:'Repair Bay',kind:'s',cost:4,hp:45,col:0xffc531,aura:2.3,short:'Heals area',desc:'Mends nearby defenses for as long as it stands.'},
  gen:{name:'Capacitor',kind:'s',cost:3,hp:30,col:0xb36bff,short:'+Energy',desc:'Adds 1 energy every 7 seconds during a wave.'},
  patch:{name:'Patch Kit',kind:'a',cost:2,col:0xffc531,short:'Repair 3×3',desc:'Fully repairs every defense in a 3×3 area.'},
  overclock:{name:'Overclock',kind:'a',cost:3,col:0x5dff9b,short:'Upgrade +1',desc:'Raises one defense a level (max 3) and fully repairs it.'},
  nova:{name:'Nova Strike',kind:'a',cost:5,col:0xb36bff,area:2.2,short:'Blast area',desc:'Orbital strike. Heavy damage in a wide circle and erases alien fire.'},
};
const START_DECK=['wall','wall','wall','blaster','blaster','blaster','scatter','patch'];
// Cards that join the pool once a site is held for the first time (index = site).
const UNLOCKS=[['tesla','bay','dome'],['lance','pylon'],['seeker','gen'],['nova']];
const unlockSite=t=>{for(let i=0;i<UNLOCKS.length;i++)if(UNLOCKS[i].includes(t))return i;return -1;};

// atk keys: k pattern, r range, cd cooldown s, sp bullet speed, n count. melee = [damage, seconds between bites]. cost = wave budget points.
const ET={
  mite:{name:'Mite',hp:5,r:.3,speed:2.3,scale:.85,z:.55,cost:1,scrap:1,en:.05,melee:[3,.7]},
  dart:{name:'Dart',hp:8,r:.38,speed:1.9,scale:.8,z:.8,cost:2,scrap:2,en:.1,melee:[3,.8],atk:{k:'aimed',r:3.2,cd:1.7,dmg:4,sp:5}},
  drone:{name:'Drone',hp:24,r:.48,speed:1.15,scale:1,z:.95,spin:2.5,cost:4,scrap:3,en:.25,melee:[4,1],atk:{k:'ring',r:2.8,cd:3,dmg:3,sp:3,n:8}},
  turret:{name:'Spitter',hp:20,r:.5,speed:.95,scale:.9,z:.9,cost:4,scrap:3,en:.25,melee:[3,1],atk:{k:'burst',r:5,cd:3.2,dmg:4,sp:5.5,n:3}},
  gunship:{name:'Gunship',hp:80,r:.75,speed:.8,scale:1,z:1.05,cost:9,scrap:8,en:.6,melee:[10,1.2],atk:{k:'fan',r:3.4,cd:2.3,dmg:4,sp:4.2,n:5,spread:.8}},
  elite:{name:'Elite',hp:200,r:.9,speed:.7,scale:1,z:1.2,spin:.8,cost:22,scrap:20,en:1,melee:[14,1.2],atk:{k:'spiral',r:4,cd:.22,dmg:3,sp:3.2,n:3,rot:2.1}},
  rock:{name:'Meteor',hp:1,r:.6,speed:0,scale:1,z:0,cost:0,scrap:0,en:0},
};
// Bosses reuse Starwake's models and patterns. Pattern offsets are in model space, where -y is the front.
const BOSSES={
 warden:{name:'Warden',hp:300,r:1.2,phases:[
  {at:1,pat:[{k:'fan',n:5,spread:.9,cd:1.6,sp:3.6,o:[0,-1.3]},{k:'aimed',cd:1.1,sp:4.5,o:[-1.9,-.4]},{k:'aimed',cd:1.1,sp:4.5,o:[1.9,-.4],delay:.5}]},
  {at:.6,pat:[{k:'spiral',n:2,cd:.16,sp:3.2,rot:2.4,o:[0,-.6]},{k:'fan',n:7,spread:1.2,cd:2.4,sp:4,o:[0,-1.3]}],spawn:{e:'dart',cd:7,n:3}},
  {at:.3,pat:[{k:'ring',n:14,cd:1.6,sp:3.2},{k:'burst',n:4,cd:2,sp:5,o:[-1.9,-.4]},{k:'burst',n:4,cd:2,sp:5,o:[1.9,-.4],delay:1}]}]},
 hydra:{name:'Hydra Coil',hp:700,r:1.3,phases:[
  {at:1,pat:[{k:'ring',n:10,cd:1.3,sp:3.2,rot:.25},{k:'aimed3',cd:1.7,sp:4.5,o:[0,-1.2]}]},
  {at:.66,pat:[{k:'flower',n:8,cd:1.1,sp:3},{k:'fan',n:9,spread:1.6,cd:2.5,sp:3.8,aim:1,o:[0,-1.2]}]},
  {at:.33,pat:[{k:'spiral',n:4,cd:.15,sp:3.3,rot:1.7},{k:'burst',n:6,cd:2.2,sp:5,o:[0,-1.2]}],spawn:{e:'mite',cd:7,n:6}}]},
 bastion:{name:'Bastion',hp:1100,r:1.5,phases:[
  {at:1,pat:[{k:'wall',n:9,cd:2.4,sp:3,o:[0,-1.6]},{k:'aimed3',cd:1.4,sp:4.6,o:[-1.6,-.2]},{k:'aimed3',cd:1.4,sp:4.6,o:[1.6,-.2],delay:.7}]},
  {at:.66,pat:[{k:'spiral',n:3,cd:.14,sp:3,rot:2},{k:'ring',n:18,cd:2.6,sp:2.6}]},
  {at:.33,pat:[{k:'spiral',n:5,cd:.13,sp:3.4,rot:-2.4},{k:'fan',n:5,spread:.6,cd:1.3,sp:5,aim:1,o:[0,-1.6]}],spawn:{e:'drone',cd:9,n:2}}]},
 mantis:{name:'Mantis',hp:1550,r:1.3,phases:[
  {at:1,pat:[{k:'fan',n:5,spread:.5,cd:1.1,sp:5,aim:1,o:[-1.2,-1.5]},{k:'fan',n:5,spread:.5,cd:1.1,sp:5,aim:1,o:[1.2,-1.5],delay:.55},{k:'rain',n:6,cd:.7,sp:3.6,o:[0,-1]}]},
  {at:.66,pat:[{k:'ring',n:20,cd:2.1,sp:3.2},{k:'flower',n:10,cd:1.5,sp:2.8}]},
  {at:.33,pat:[{k:'spiral',n:6,cd:.12,sp:3.4,rot:2.8},{k:'burst',n:8,cd:2.2,sp:6,o:[0,-1.6]}],spawn:{e:'dart',cd:6,n:4}}]},
 eclipse:{name:'Eclipse Core',hp:2200,r:1.5,phases:[
  {at:1,pat:[{k:'ring',n:16,cd:1.4,sp:3,rot:.2},{k:'aimed',cd:.6,sp:5,orb:[2.3,1.2]},{k:'aimed',cd:.6,sp:5,orb:[2.3,1.2],ph:PI}]},
  {at:.75,pat:[{k:'spiral',n:4,cd:.12,sp:3.2,rot:2.2},{k:'fan',n:7,spread:.9,cd:1.7,sp:4.6,aim:1}]},
  {at:.5,pat:[{k:'flower',n:12,cd:1.2,sp:2.8},{k:'wall',n:11,cd:2.8,sp:3.2,o:[0,-1.6]}],spawn:{e:'drone',cd:9,n:2}},
  {at:.25,pat:[{k:'spiral',n:3,cd:.1,sp:3.6,rot:3.1},{k:'spiral',n:3,cd:.1,sp:3.6,rot:-2.3},{k:'ring',n:24,cd:2.4,sp:2.6},{k:'burst',n:5,cd:1.6,sp:6}]}]},
};
// Sites: one drifting rock each. budget = wave strength in enemy cost points, pool = enemy types that can appear.
const SITES=[
 {name:'Kepler Drift',waves:3,budget:13,boss:'warden',pool:['mite','dart','drone'],
  bg:0x0b0a26,star:0xbfd4ff,neb:[0x3a2b9a,0x1d5c8f],planet:[0x4f7bd9,0x2a3f8f,0x9fb8ff],land:[0x46558f,0x3c4a80],cliff:[0x262d60,0x161b40],rock:0x6a78b8,crys:0x3ef0ff,key:45,bpm:118,prog:[0,8,3,10]},
 {name:'Cinder Rock',waves:4,budget:18,boss:'hydra',meteors:9,pool:['mite','dart','drone','turret'],
  bg:0x1a0a12,star:0xffd6c0,neb:[0x8f2b2b,0x8f5a1d],planet:[0xd9734f,0x8f3a2a,0xffc59f],land:[0x704038,0x613731],cliff:[0x3e1d1f,0x241012],rock:0x8f5e4c,crys:0xff9b3d,key:43,bpm:124,prog:[0,5,3,10]},
 {name:'Veil Shoal',waves:5,budget:24,boss:'bastion',pool:['mite','dart','drone','turret','gunship'],
  bg:0x120a2a,star:0xe0c8ff,neb:[0x6b2b9a,0x2b8f8a],planet:[0x9a4fd9,0x4a2a8f,0xd8b8ff],land:[0x56407f,0x4b3871],cliff:[0x2c1d4c,0x180f30],rock:0x7d5dab,crys:0xd23dff,key:47,bpm:128,prog:[0,8,5,7]},
 {name:'Foundry Hulk',waves:6,budget:30,boss:'mantis',meteors:7,pool:['mite','dart','drone','turret','gunship','elite'],
  bg:0x0d1416,star:0xc8ffe8,neb:[0x1d6b5a,0x5a6b1d],planet:[0x5ab89a,0x2a5a4a,0xc8ffe0],land:[0x3e605b,0x365550],cliff:[0x1c3431,0x10201e],rock:0x5e8f85,crys:0x5dff9b,key:41,bpm:132,prog:[0,3,8,10]},
 {name:'Eclipse Shard',waves:7,budget:37,boss:'eclipse',pool:['mite','dart','drone','turret','gunship','elite'],
  bg:0x150616,star:0xffe0f0,neb:[0x9a2b6b,0x3a2b9a],planet:[0x2a2540,0x14121f,0xffc531],land:[0x40355a,0x382e4f],cliff:[0x1e1834,0x120e20],rock:0x5f4f7f,crys:0xffc531,key:44,bpm:136,prog:[0,1,8,7]},
];
const DIFF={
  easy:{name:'Easy',hp:.75,dmg:.7,dens:.8,scrap:.85},
  normal:{name:'Normal',hp:1,dmg:1,dens:1,scrap:1},
  hard:{name:'Hard',hp:1.2,dmg:1.25,dens:1.2,scrap:1.3},
};
const DF=()=>DIFF[G.diff]||DIFF.normal;
// Spawn direction k is world angle k*45deg. The camera looks along +x+y, so these are the screen compass points.
const DIRS=['NE','N','NW','W','SW','S','SE','E'];

/* ================================================================ RENDERER & CAMERA */
// World: the ground is the XY plane and +z is up. One tile = one unit. An orthographic camera looks down at it from 52 degrees.
const stage=$('stage'), cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});
const scene=new T.Scene();
const camera=new T.OrthographicCamera(-10,10,10,-10,1,700);scene.add(camera);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.25);hemi.position.set(0,0,1);
const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(-2,4,8);
scene.add(hemi,sun);
let pixelRatio=1,gfxCap=2;
const EL=.9,SEL=Math.sin(EL),CEL=Math.cos(EL),CAM_D=160;
// az = compass angle of the camera around its target; fwd = the ground direction that points up the screen.
const cam={az:-PI*.75,fwd:{x:0,y:0},zoom:1,base:30,ppu:30,g:0,px:0,py:0,shake:0};
const CR=new T.Vector3(),CU=new T.Vector3();
let W=1,H=1,rect={left:0,top:0,width:1,height:1};
function placeCam(){
  cam.fwd.x=-Math.cos(cam.az);cam.fwd.y=-Math.sin(cam.az);
  const sk=cam.shake*.16,tx=-cam.g*cam.fwd.x+cam.px+(Math.random()-.5)*sk,ty=-cam.g*cam.fwd.y+cam.py+(Math.random()-.5)*sk;
  camera.position.set(tx+Math.cos(cam.az)*CEL*CAM_D,ty+Math.sin(cam.az)*CEL*CAM_D,SEL*CAM_D);camera.up.set(0,0,1);camera.lookAt(tx,ty,0);camera.updateMatrixWorld();
  CR.setFromMatrixColumn(camera.matrixWorld,0);CU.setFromMatrixColumn(camera.matrixWorld,1);
}
// Fit the island into the space the HUD leaves free, then apply the player's zoom.
function fit(){
  let top=0,bot=H;
  if(!$('hud').hidden){top=$('hudTop').getBoundingClientRect().bottom;bot=$('hudBot').getBoundingClientRect().top;}
  else if(state==='title'){top=H*.24;bot=H*.66;}
  const fh=Math.max(140,bot-top);
  // The rock's underside hangs below it on screen and the wreck sticks up, hence the extra height and the small upward nudge.
  cam.base=Math.min(W/(isleR*2+.7),fh/(isleR*2*SEL+2.6));cam.ppu=cam.base*cam.zoom;
  const hw=W/2/cam.ppu,hh=H/2/cam.ppu;camera.left=-hw;camera.right=hw;camera.top=hh;camera.bottom=-hh;camera.updateProjectionMatrix();
  const spare=Math.max(0,fh-(isleR*2*SEL+2.6)*cam.base);
  cam.g=(H/2-(top+bot)/2-Math.min(spare*.5,70))/(SEL*cam.ppu)+.45;
  layoutSky(hw,hh);
}
function resize(){
  W=window.innerWidth;H=window.innerHeight;applyPixelRatio();renderer.setSize(W,H,false);
  rect=cv.getBoundingClientRect();fit();placeCam();
}
function applyPixelRatio(){const cap=S.set.gfx==='low'?1.25:gfxCap;pixelRatio=Math.min(DPR,cap,2);renderer.setPixelRatio(pixelRatio);if(starMat)starMat.uniforms.uPx.value=pixelRatio;}
const _v=new T.Vector3(),_w=new T.Vector3();
function ground(cx,cy,z){const nx=(cx-rect.left)/rect.width*2-1,ny=-((cy-rect.top)/rect.height)*2+1;
  _v.set(nx,ny,-1).unproject(camera);_w.set(nx,ny,1).unproject(camera).sub(_v);const t=((z||0)-_v.z)/_w.z;return{x:_v.x+_w.x*t,y:_v.y+_w.y*t};}
function toScreen(x,y,z){_v.set(x,y,z).project(camera);return{x:rect.left+(_v.x+1)/2*rect.width,y:rect.top+(1-_v.y)/2*rect.height};}
// Screen-space angle and length of a world vector, for billboards that must line up with something in 3D.
const sAng=(dx,dy,dz)=>Math.atan2(dx*CU.x+dy*CU.y+dz*CU.z,dx*CR.x+dy*CR.y+dz*CR.z);
const sLen=(dx,dy,dz)=>Math.hypot(dx*CR.x+dy*CR.y+dz*CR.z,dx*CU.x+dy*CU.y+dz*CU.z);

/* ================================================================ MODELS (builder and alien cast come from the arcade kit, see shared/kit.js) */
const {P,M,geo,makeMat}=ARC;
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color();
const MAT_I=makeMat(true), MAT_BG=makeMat(false);
// Starwake's aliens, unchanged. They were modelled facing +y with +z toward the viewer, which is exactly "seen from above" here.
const EGEO=ARC.ALIENS;

/* Defenses: a static base plus an optional head that turns to aim (barrels along +y). hz = head pivot height. */
const DK=0x1b1d33,HUL=0x3a3f66,HUL2=0x5a6290,PALE=0x8a92c8,WHT=0xe8eefc,ZA=[PI/2,0,0];
const pad=(r,h,c)=>({g:P.cyl(r*.84,r,h,8),c:c||HUL,r:ZA,p:[0,0,h/2]});
const SGEO={
  wall:{base:()=>geo([{g:P.box(.9,.9,.5),c:0x4a5280,p:[0,0,.25]},{g:P.box(.8,.8,.12),c:PALE,p:[0,0,.56]},{g:P.box(.32,.32,.06),c:HUL2,p:[0,0,.64]},
    M({g:P.box(.06,.6,.1),c:0x2a8fa8,e:1,p:[.455,0,.3]}),{g:P.box(.6,.06,.1),c:0x2a8fa8,e:1,p:[0,.455,.3]},{g:P.box(.6,.06,.1),c:0x2a8fa8,e:1,p:[0,-.455,.3]}])},
  blaster:{hz:.52,base:()=>geo([pad(.4,.36),{g:P.cyl(.3,.32,.08,8),c:HUL2,r:ZA,p:[0,0,.4]},M({g:P.box(.1,.1,.06),c:0x3ef0ff,e:1,p:[.3,0,.2]})]),
    head:()=>geo([{g:P.oct(.24),c:WHT,s:[1,1.15,.75]},{g:P.box(.34,.2,.14),c:HUL2,p:[0,-.12,-.04]},M({g:P.box(.07,.48,.07),c:DK,p:[.09,.3,0]}),
      M({g:P.box(.09,.09,.09),c:0x3ef0ff,e:1,p:[.09,.55,0]}),{g:P.oct(.08),c:0x3ef0ff,e:1,p:[0,.05,.16]}])},
  scatter:{hz:.5,base:()=>geo([pad(.42,.34),{g:P.cyl(.3,.32,.08,8),c:0x6b5a2a,r:ZA,p:[0,0,.38]}]),
    head:()=>geo([{g:P.box(.46,.3,.22),c:0x6b5a2a},{g:P.box(.3,.2,.12),c:0x9a8a4a,p:[0,-.05,.15]},{g:P.box(.07,.34,.07),c:DK,p:[0,.3,0]},
      M({g:P.box(.07,.3,.07),c:DK,p:[.14,.27,0],r:[0,0,-.32]}),{g:P.box(.09,.09,.09),c:0xffd23d,e:1,p:[0,.48,0]},M({g:P.box(.09,.09,.09),c:0xffd23d,e:1,p:[.2,.42,0]})])},
  lance:{hz:.66,base:()=>geo([pad(.38,.5),{g:P.tor(.3,.04,4,12),c:0xc9a0ff,e:1,p:[0,0,.4]},{g:P.cyl(.2,.26,.12,8),c:HUL2,r:ZA,p:[0,0,.56]}]),
    head:()=>geo([{g:P.oct(.2),c:PALE,s:[1,1.2,.8]},{g:P.box(.12,.95,.12),c:DK,p:[0,.38,0]},{g:P.tor(.11,.035,4,8),c:0xc9a0ff,e:1,p:[0,.25,0],r:ZA},
      {g:P.tor(.11,.035,4,8),c:0xc9a0ff,e:1,p:[0,.48,0],r:ZA},{g:P.oct(.08),c:0xf0e0ff,e:1,p:[0,.88,0]}])},
  seeker:{hz:.42,base:()=>geo([{g:P.box(.68,.68,.3),c:HUL,p:[0,0,.15]},M({g:P.box(.08,.4,.08),c:0xff9b3d,e:1,p:[.3,0,.22]})]),
    head:()=>geo([{g:P.box(.5,.44,.3),c:0x5a46b8},{g:P.box(.54,.1,.1),c:DK,p:[0,.22,.08]},
      M({g:P.cone(.07,.18,6),c:0xff9b3d,e:1,p:[.11,.08,.22],r:ZA}),M({g:P.cone(.07,.18,6),c:0xff9b3d,e:1,p:[.11,-.1,.22],r:ZA})])},
  tesla:{base:()=>geo([pad(.4,.24),{g:P.cyl(.08,.13,.62,6),c:PALE,r:ZA,p:[0,0,.54]},{g:P.tor(.24,.04,4,12),c:0x4aa8ff,e:1,p:[0,0,.44]},
    {g:P.tor(.18,.035,4,12),c:0x4aa8ff,e:1,p:[0,0,.62]},{g:P.tor(.12,.03,4,12),c:0x4aa8ff,e:1,p:[0,0,.78]},{g:P.ico(.13),c:0xdff0ff,e:1,p:[0,0,.94]}])},
  mine:{base:()=>geo([{g:P.cyl(.26,.32,.08,8),c:0x3a2a3a,r:ZA,p:[0,0,.04]},{g:P.box(.5,.08,.04),c:DK,p:[0,0,.09]},{g:P.box(.08,.5,.04),c:DK,p:[0,0,.09]},
    {g:P.oct(.09),c:0xff3d55,e:1,p:[0,0,.13]}])},
  pylon:{hz:.8,base:()=>geo([pad(.38,.22,0x2f4a40),{g:P.cyl(.1,.15,.32,6),c:PALE,r:ZA,p:[0,0,.38]},M({g:P.box(.06,.06,.2),c:0x5dff9b,e:1,p:[.26,0,.2]})]),
    head:()=>geo([{g:P.oct(.2),c:0x5dff9b,e:1,s:[1,1,1.7]},{g:P.tor(.32,.03,3,16),c:0x5dff9b,e:1}])},
  intercept:{hz:.56,base:()=>geo([pad(.36,.4),{g:P.cyl(.24,.28,.08,8),c:HUL2,r:ZA,p:[0,0,.44]},M({g:P.box(.08,.08,.08),c:0xa8d8ff,e:1,p:[.3,0,.22]})]),
    head:()=>geo([{g:P.box(.3,.22,.16),c:WHT},M({g:P.box(.04,.42,.04),c:DK,p:[.07,.26,0]}),M({g:P.box(.06,.06,.06),c:0xa8d8ff,e:1,p:[.07,.48,0]}),
      {g:P.box(.03,.12,.24),c:PALE,p:[0,-.08,.18]},{g:P.oct(.05),c:0xff3d55,e:1,p:[0,-.08,.32]}])},
  dome:{hz:.62,base:()=>geo([pad(.42,.2,0x2a3f6a),{g:P.cyl(.1,.15,.34,6),c:PALE,r:ZA,p:[0,0,.36]},M({g:P.box(.07,.07,.2),c:0x4aa8ff,e:1,p:[.3,0,.16]}),{g:P.box(.07,.07,.2),c:0x4aa8ff,e:1,p:[0,.3,.16]},{g:P.box(.07,.07,.2),c:0x4aa8ff,e:1,p:[0,-.3,.16]}]),
    head:()=>geo([{g:P.oct(.15),c:0xbfe0ff,e:1,s:[1,1,1.3]},{g:P.tor(.24,.03,3,16),c:0x4aa8ff,e:1}])},
  bay:{hz:.7,base:()=>geo([{g:P.box(.74,.74,.24),c:0x4a4a62,p:[0,0,.12]},{g:P.box(.44,.13,.05),c:0xffc531,e:1,p:[0,0,.26]},{g:P.box(.13,.44,.05),c:0xffc531,e:1,p:[0,0,.26]},
    M({g:P.box(.05,.05,.34),c:PALE,p:[.3,.3,.38]})]),
    head:()=>geo([{g:P.oct(.12),c:WHT,s:[1,1,.6]},{g:P.tor(.16,.025,3,12),c:0xffc531,e:1}])},
  gen:{base:()=>geo([{g:P.box(.72,.72,.16),c:HUL,p:[0,0,.08]},{g:P.box(.24,.24,.5),c:DK,p:[0,0,.33]},{g:P.box(.3,.3,.05),c:PALE,p:[0,0,.6]},
    M({g:P.cyl(.08,.08,.46,6),c:0xb36bff,e:1,r:ZA,p:[.2,.2,.39]}),M({g:P.cyl(.08,.08,.46,6),c:0xb36bff,e:1,r:ZA,p:[.2,-.2,.39]})])},
};
// The crashed frigate: nose along +y in model space, one wing snapped off and buried.
function buildWreck(){return geo([
  {g:P.oct(1),c:WHT,s:[.62,1.75,.42],p:[0,0,.5]},{g:P.box(.42,1.9,.26),c:0xc8d0ea,p:[0,-.15,.72]},
  {g:P.oct(.34),c:0x3ef0ff,e:1,s:[.6,1.15,.55],p:[0,.85,.78]},{g:P.cone(.22,.6,6),c:0x3ef0ff,p:[0,1.95,.5]},
  {g:P.box(1.5,.7,.09),c:0x2e3a8c,p:[-.95,-.5,.4],r:[0,.12,.38]},{g:P.box(.14,.55,.11),c:0x3ef0ff,e:1,p:[-1.62,-.74,.32],r:[0,.12,.1]},
  {g:P.box(.8,.62,.09),c:0x2e3a8c,p:[.62,-.45,.32],r:[0,-.5,-.3]},{g:P.box(.7,.5,.08),c:0x24306f,p:[1.55,-1.05,.06],r:[.2,.3,-.7]},
  M({g:P.cyl(.2,.26,.7,6),c:0x1b2140,p:[.34,-1.55,.46]}),M({g:P.cone(.14,.3,6),c:0xff9b3d,e:1,p:[.34,-1.98,.46],r:[0,0,PI]}),
  {g:P.box(.06,.6,.42),c:WHT,p:[0,-1.1,.95]},M({g:P.box(.18,.5,.05),c:PALE,p:[.22,.2,.86]}),{g:P.cyl(.02,.02,.5,4),c:PALE,p:[.15,.42,1.12],r:ZA},
]);}
// Plating that came off in the crash. It stays on the ground when the ship lifts off.
function buildWreckage(){return geo([{g:P.box(.3,.22,.04),c:0xc8d0ea,p:[-1.2,.95,.02],r:[0,0,.6]},{g:P.box(.18,.3,.04),c:0x2e3a8c,p:[1.15,.8,.02],r:[0,0,-.4]},{g:P.tet(.15),c:PALE,p:[.9,1.45,.05]}]);}
function buildShipGun(){return geo([{g:P.cyl(.2,.24,.14,8),c:HUL2,r:ZA},{g:P.oct(.16),c:WHT,s:[1,1.2,.7],p:[0,0,.1]},M({g:P.box(.05,.4,.05),c:DK,p:[.06,.24,.1]}),
  M({g:P.box(.07,.07,.07),c:0x3ef0ff,e:1,p:[.06,.44,.1]})]);}
function buildEngineer(){return geo([{g:P.box(.16,.12,.2),c:0xff8a3d,p:[0,0,.2]},{g:P.box(.13,.12,.12),c:WHT,p:[0,0,.37]},{g:P.box(.1,.04,.05),c:0x3ef0ff,e:1,p:[0,.06,.38]},
  M({g:P.box(.05,.05,.12),c:0x2a3050,p:[.045,0,.06]}),{g:P.box(.12,.06,.14),c:0x8a92c8,p:[0,-.08,.22]}]);}

// Bosses are Starwake's models from the kit (built facing -y).
const BMODELS=ARC.BOSSES;
const BOSS_SCALE=.62;

/* ================================================================ GLOW BATCHES (instanced quads from the kit, rebuilt every frame) */
// Shape ids under 10 are camera-facing billboards; adding 10 lays the same shape flat on the ground (see ARC.VS_ISO).
// UI shapes: 0 soft blob (shadows, smoke), 1 range ring, 2 tile outline, 3 bar (alpha = fill fraction).
const UI_FS='varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){vec2 u=vUv;float d=length(u);\n'+
 'if(vS<0.5){if(d>1.0)discard;float a=1.0-d;gl_FragColor=vec4(vC,a*a*vA);}\n'+
 'else if(vS<1.5){if(d>1.0)discard;float k=smoothstep(0.9,0.955,d)*(1.0-smoothstep(0.975,1.0,d));gl_FragColor=vec4(vC,(k*0.9+0.07)*vA);}\n'+
 'else if(vS<2.5){float e=max(abs(u.x),abs(u.y));float b=smoothstep(0.76,0.86,e);gl_FragColor=vec4(vC,(b*0.8+0.16)*vA);}\n'+
 'else{float inb=step(abs(u.x),0.9)*step(abs(u.y),0.45);float f=step(u.x/0.9*0.5+0.5,vA)*inb;gl_FragColor=vec4(mix(vec3(0.03,0.02,0.09),vC,f),0.92);}}';
const ISO=ARC.VS_ISO;
const uiG=new ARC.Batch(scene,900,UI_FS,{vs:ISO,blend:T.NormalBlending,order:3});            // shadows, tile highlights, range rings
const fx=new ARC.Batch(scene,4200,ARC.FX_FS,{vs:ISO,blend:T.AdditiveBlending,order:5,lift:1.6});
const ebR=new ARC.Batch(scene,1600,ARC.EB_FS,{vs:ISO,blend:T.NormalBlending,order:10,lift:1.3});
const uiT=new ARC.Batch(scene,320,UI_FS,{vs:ISO,blend:T.NormalBlending,order:12,lift:3,depth:false}); // health bars, always on top
// A billboard streak from one 3D point to another.
function bline(b,x1,y1,z1,x2,y2,z2,w,sh,a,c){const dx=x2-x1,dy=y2-y1,dz=z2-z1;b.push((x1+x2)/2,(y1+y2)/2,(z1+z2)/2,sAng(dx,dy,dz)-PI/2,w,sLen(dx,dy,dz)+w*.6,sh,a,c);}

/* ================================================================ SKY (fixed to the camera) */
const STARN=520;let starMat,starGeo;
{
  starGeo=new T.BufferGeometry();const pos=new Float32Array(STARN*3),sz=new Float32Array(STARN),ph=new Float32Array(STARN);
  for(let i=0;i<STARN;i++){pos[i*3]=Math.random();pos[i*3+1]=Math.random();pos[i*3+2]=-640;sz[i]=Math.random()<.08?rand(2.6,3.6):rand(1,2.1);ph[i]=rand(0,TAU);}
  starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aSize',new T.BufferAttribute(sz,1));starGeo.setAttribute('aPh',new T.BufferAttribute(ph,1));
  starGeo.userData.u=pos.slice();
  starMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:1},uColor:{value:new T.Vector3(1,1,1)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'uniform float uTime,uPx;attribute float aSize;attribute float aPh;varying float vB;\nvoid main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uPx;vB=(0.4+0.25*aSize)*(0.75+0.25*sin(uTime*1.7+aPh));}',
    fragmentShader:'uniform vec3 uColor;varying float vB;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.05,d);gl_FragColor=vec4(uColor*vB,a);}'});
  const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=0;camera.add(stars);
}
const NEB_FS='uniform vec3 uC;uniform float uA;varying vec2 vUv;void main(){float d=length(vUv*2.0-1.0);gl_FragColor=vec4(uC,exp(-d*d*3.0)*(1.0-smoothstep(0.8,1.0,d))*uA);}';
const nebs=[0,1].map(i=>{const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShaderMaterial({uniforms:{uC:{value:new T.Vector3(1,1,1)},uA:{value:.2}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:NEB_FS}));
  m.position.z=-630+i;m.frustumCulled=false;m.renderOrder=0;camera.add(m);return m;});
const planet=new T.Group();camera.add(planet);let planetMesh=null;
const ringMesh=new T.Mesh(geo([{g:P.tor(1.65,.06,3,40),c:0xffffff}]),makeMat(false));ringMesh.rotation.x=1.2;planet.add(ringMesh);
function layoutSky(hw,hh){
  const pos=starGeo.getAttribute('position'),u=starGeo.userData.u;
  for(let i=0;i<STARN;i++){pos.array[i*3]=(u[i*3]*2-1)*hw*1.05;pos.array[i*3+1]=(u[i*3+1]*2-1)*hh*1.05;}pos.needsUpdate=true;
  const s=Math.max(hw,hh)*2.2;nebs[0].scale.set(s,s,1);nebs[0].position.set(-hw*.5,hh*.45,nebs[0].position.z);
  nebs[1].scale.set(s*.9,s*.9,1);nebs[1].position.set(hw*.6,-hh*.5,nebs[1].position.z);
  planet.position.set(hw*.82,hh*.74,-560);planet.scale.setScalar(Math.min(hw,hh)*.3);
}
function applyTheme(L){
  scene.background=new T.Color(L.bg);const sc=rgb(L.star);starMat.uniforms.uColor.value.set(sc[0],sc[1],sc[2]);
  for(let i=0;i<2;i++){const c=rgb(L.neb[i]);nebs[i].material.uniforms.uC.value.set(c[0],c[1],c[2]);}
  if(planetMesh){planet.remove(planetMesh);planetMesh.geometry.dispose();}
  const g=geo([{g:P.ico(1,1),c:0xffffff}]);const col=g.getAttribute('color');const c1=new T.Color(L.planet[0]),c2=new T.Color(L.planet[1]),t=new T.Color();
  for(let i=0;i<col.count;i+=3){t.copy(c1).lerp(c2,Math.random()*.9);for(let k=0;k<3;k++)col.setXYZ(i+k,t.r,t.g,t.b);}
  planetMesh=new T.Mesh(g,MAT_BG);planet.add(planetMesh);
  ringMesh.geometry.dispose();ringMesh.geometry=geo([{g:P.tor(1.65,.06,3,40),c:L.planet[2]},{g:P.tor(1.9,.03,3,40),c:L.planet[2]}]);
}

/* ================================================================ ISLAND & NAVIGATION GRID */
// One grid covers the rock and the void around it. Aliens float, so the void is open sky to them; only defenses and the ship block.
const NAV=23,C=11,NN=NAV*NAV;
const VOID=0,LAND=1,ROCK=2,SHIP=3;
const kind=new Uint8Array(NN), occ=new Array(NN).fill(null), D=new Float32Array(NN), ENT=new Float32Array(NN);
const ti=(a,b)=>b*NAV+a, inNav=(a,b)=>a>=0&&b>=0&&a<NAV&&b<NAV, tileOf=v=>Math.round(v)+C;
const blocks=s=>!!s&&!s.dead&&!CARDS[s.type].flat;
const blockedAt=i=>kind[i]===SHIP||blocks(occ[i]);
let islandMesh=null,isleR=6.3;const crystals=[];
function buildIsland(L,seed){
  const r=seeded(seed);kind.fill(VOID);occ.fill(null);crystals.length=0;
  const s1=r()*TAU,s2=r()*TAU,R0=5.3;isleR=R0;
  for(let b=0;b<NAV;b++)for(let a=0;a<NAV;a++){const dx=a-C,dy=b-C,d=Math.hypot(dx,dy),th=Math.atan2(dy,dx);
    if(d<=R0+.55*Math.sin(3*th+s1)+.35*Math.sin(5*th+s2))kind[ti(a,b)]=LAND;}
  for(let b=C-2;b<=C+2;b++)for(let a=C-2;a<=C+2;a++)kind[ti(a,b)]=Math.abs(a-C)<=1&&Math.abs(b-C)<=1?SHIP:LAND;
  let n=4+Math.floor(r()*3),guard=0;
  while(n>0&&guard++<300){const a=Math.floor(r()*NAV),b=Math.floor(r()*NAV),i=ti(a,b);if(kind[i]===LAND&&Math.hypot(a-C,b-C)>2.9){kind[i]=ROCK;n--;}}
  if(islandMesh){scene.remove(islandMesh);islandMesh.geometry.dispose();}
  const parts=[],c0=new T.Color(L.land[0]),c1=new T.Color(L.land[1]),k0=new T.Color(L.cliff[0]),k1=new T.Color(L.cliff[1]),tc=new T.Color();
  for(let b=0;b<NAV;b++)for(let a=0;a<NAV;a++){const k=kind[ti(a,b)];if(k===VOID)continue;const x=a-C,y=b-C,d=Math.hypot(x,y);
    tc.copy((a+b)&1?c0:c1).lerp(k1,r()*.18+(k===SHIP?.25:0));parts.push({g:P.box(.94,.94,.26),c:tc.getHex(),p:[x,y,-.13]});
    const dep=.7+Math.max(0,R0+.6-d)*.85+r()*.6;
    parts.push({g:P.box(1,1,.55),c:k0.getHex(),p:[x,y,-.26-.275]});
    parts.push({g:P.box(.96,.96,dep),c:tc.copy(k0).lerp(k1,.6+r()*.4).getHex(),p:[x,y,-.81-dep/2]});
    let edge=false;for(const [da,db] of [[1,0],[-1,0],[0,1],[0,-1]])if(!inNav(a+da,b+db)||kind[ti(a+da,b+db)]===VOID)edge=true;
    if(edge)parts.push({g:P.cone(.5,1.4+r()*1.2,5),c:k1.getHex(),p:[x,y,-.81-dep-.6],r:[-PI/2,0,r()*TAU]});
    if(k===ROCK){parts.push({g:P.ico(.36),c:L.rock,p:[x+(r()-.5)*.2,y+(r()-.5)*.2,.2]},{g:P.ico(.2),c:tc.set(L.rock).lerp(k1,.4).getHex(),p:[x+.25,y-.18,.1]});
      if(r()<.45){crystals.push([x,y]);for(let j=0;j<3;j++)parts.push({g:P.oct(.12),c:L.crys,e:1,s:[.7,.7,2.2],p:[x-.2+j*.2,y+.22,.32],r:[r()*.6-.3,r()*.6-.3,0]});}}
  }
  islandMesh=new T.Mesh(geo(parts),MAT_BG);scene.add(islandMesh);
  isleR=0;for(let i=0;i<NN;i++)if(kind[i]!==VOID)isleR=Math.max(isleR,Math.hypot(i%NAV-C,((i/NAV)|0)-C)+.71);
  for(const v of voidRocks){const a=rand(0,TAU),d=rand(7.6,11.5);v.x=Math.cos(a)*d;v.y=Math.sin(a)*d;v.z=rand(-4,-1.2);v.s=rand(.3,.75);}
}
const VR_N=14;const voidMesh=new T.InstancedMesh(geo([{g:P.ico(.8),c:0x262236},{g:P.ico(.4),c:0x302a44,p:[.4,.3,.2]}]),makeMat(false),VR_N);voidMesh.frustumCulled=false;scene.add(voidMesh);
const voidRocks=[];for(let i=0;i<VR_N;i++)voidRocks.push({x:0,y:0,z:0,s:1,rx:rand(0,TAU),ry:rand(0,TAU),w:rand(.1,.4),ph:rand(0,TAU)});

// Dijkstra from the ship outward. ENT = extra cost to break into a tile, so aliens route around walls unless the detour is long.
let navDirty=true,navT=0;
const heap={k:new Float32Array(NN*8),v:new Int32Array(NN*8),n:0,
  push(k,v){let i=this.n++;while(i>0){const p=(i-1)>>1;if(this.k[p]<=k)break;this.k[i]=this.k[p];this.v[i]=this.v[p];i=p;}this.k[i]=k;this.v[i]=v;},
  pop(){const v=this.v[0],k=this.k[--this.n],w=this.v[this.n];let i=0;for(;;){let c=i*2+1;if(c>=this.n)break;if(c+1<this.n&&this.k[c+1]<this.k[c])c++;if(this.k[c]>=k)break;this.k[i]=this.k[c];this.v[i]=this.v[c];i=c;}this.k[i]=k;this.v[i]=w;return v;}};
const NB=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
function buildNav(){
  heap.n=0;D.fill(1e9);
  for(let i=0;i<NN;i++){const s=occ[i];ENT[i]=kind[i]===SHIP?0:blocks(s)?clamp(s.hp/9,3,14):0;if(kind[i]===SHIP){D[i]=0;heap.push(0,i);}}
  while(heap.n){const i=heap.pop(),a=i%NAV,b=(i/NAV)|0,di=D[i]+ENT[i];
    for(const [da,db,w] of NB){const na=a+da,nb=b+db;if(!inNav(na,nb))continue;
      if(da&&db&&(blockedAt(ti(a+da,b))||blockedAt(ti(a,b+db))))continue;
      const j=ti(na,nb),nd=di+w;if(nd<D[j]){D[j]=nd;heap.push(nd,j);}}}
  navDirty=false;navT=1.5;
}
const _nav={x:0,y:0,blk:null,ship:false};
// The next point an alien should fly toward, and the defense (or the ship) in its way if the best route goes through one.
function navNext(e){
  const a=tileOf(e.x),b=tileOf(e.y);_nav.blk=null;_nav.ship=false;
  if(!inNav(a,b)){_nav.x=0;_nav.y=0;return _nav;}
  const i=ti(a,b);let best=-1,bd=blockedAt(i)?1e12:D[i]+1e-3;
  for(const [da,db,w] of NB){const na=a+da,nb=b+db;if(!inNav(na,nb))continue;
    if(da&&db&&(blockedAt(ti(a+da,b))||blockedAt(ti(a,b+db))))continue;
    const j=ti(na,nb),v=D[j]+ENT[j]+w;if(v<bd){bd=v;best=j;}}
  if(best<0){_nav.x=a-C;_nav.y=b-C;return _nav;}
  _nav.x=best%NAV-C;_nav.y=((best/NAV)|0)-C;
  if(kind[best]===SHIP)_nav.ship=true;else if(blocks(occ[best]))_nav.blk=occ[best];
  return _nav;
}

/* ================================================================ AUDIO (synthesized with the arcade kit) */
const Snd=ARC.synth({sfx:()=>S.set.sfx,music:()=>S.set.music,onInit:()=>{if(Mus.want)Mus.play(Mus.want[0],Mus.want[1]);},
  thr:{shot:.07,hit:.045,boom:.04,pd:.05,absorb:.07,credit:.04,zap:.08,beam:.1,missile:.08,place:.05,clank:.12,hurt:.15,deny:.15,weld:.25},
  sounds:{
    shot:(s,t,a)=>{s.osc('square',1400,520,t,.045,.025);},
    pd:(s,t,a)=>{s.osc('square',2400,900,t,.035,.025);},
    absorb:(s,t,a)=>{s.osc('sine',900,300,t,.1,.06);s.nz(t,.06,.05,'highpass',3000);},
    shdown:(s,t,a)=>{s.osc('sawtooth',600,90,t,.35,.09);s.nz(t,.3,.15,'bandpass',1200,300,null,2);},
    shup:(s,t,a)=>{s.osc('sine',300,900,t,.25,.07);},
    pellet:(s,t,a)=>{s.osc('square',900,300,t,.05,.03);s.nz(t,.05,.05,'highpass',3000);},
    hit:(s,t,a)=>{s.osc('square',320,180,t,.03,.03);},
    boom:(s,t,a)=>{s.nz(t,.3+(a||0)*.15,.3,'lowpass',2200,180);s.osc('sine',130,40,t,.22,.2);},
    big:(s,t,a)=>{s.nz(t,1.4,.6,'lowpass',1800,60);s.osc('sine',90,25,t,1,.5);},
    credit:(s,t,a)=>{s.osc('triangle',1320,1760,t,.06,.05);},
    energy:(s,t,a)=>{s.osc('sine',660,1320,t,.12,.07);},
    place:(s,t,a)=>{s.osc('sine',180,60,t,.16,.3);s.nz(t,.12,.18,'lowpass',900,200);s.osc('triangle',880,0,t+.05,.06,.05);},
    card:(s,t,a)=>{s.osc('triangle',740,980,t,.05,.05);},
    deny:(s,t,a)=>{s.osc('square',200,150,t,.12,.06);s.osc('square',150,0,t+.1,.12,.05);},
    zap:(s,t,a)=>{s.nz(t,.16,.18,'bandpass',2600,900,null,3);s.osc('sawtooth',1200,300,t,.1,.05);},
    beam:(s,t,a)=>{s.osc('sawtooth',520,110,t,.32,.09);s.osc('square',1040,220,t,.25,.035);},
    missile:(s,t,a)=>{s.nz(t,.25,.12,'bandpass',800,3000,null,2);},
    clank:(s,t,a)=>{s.osc('square',300,120,t,.07,.06);s.nz(t,.05,.08,'highpass',2500);},
    weld:(s,t,a)=>{s.nz(t,.18,.035,'highpass',5000,8000);},
    repair:(s,t,a)=>{[660,880,1100].forEach((f,i)=>s.osc('triangle',f,0,t+i*.05,.1,.06));},
    up:(s,t,a)=>{[523,659,784,1047].forEach((f,i)=>s.osc('square',f,0,t+i*.06,.09,.05));},
    hurt:(s,t,a)=>{s.osc('sawtooth',220,60,t,.25,.14);s.nz(t,.2,.2,'lowpass',1200,200);},
    lost:(s,t,a)=>{s.osc('sawtooth',300,80,t,.3,.1);s.nz(t,.25,.2,'lowpass',1600,150);},
    warn:(s,t,a)=>{for(let i=0;i<3;i++){s.osc('triangle',440,660,t+i*.5,.24,.12);s.osc('triangle',660,440,t+i*.5+.25,.24,.12);}},
    wave:(s,t,a)=>{s.osc('sawtooth',110,220,t,.6,.12);s.osc('square',220,440,t,.6,.04);},
    clear:(s,t,a)=>{[523,659,784].forEach((f,i)=>s.osc('triangle',f,0,t+i*.09,.22,.08));s.osc('triangle',1047,0,t+.3,.5,.08);},
    click:(s,t,a)=>{s.osc('square',880,0,t,.03,.035);},
    phase:(s,t,a)=>{s.osc('sawtooth',160,640,t,.5,.14);},
    meteor:(s,t,a)=>{s.nz(t,1,.2,'bandpass',400,2400,null,1.5);},
    lift:(s,t,a)=>{s.nz(t,2.6,.35,'lowpass',400,3000);s.osc('sawtooth',60,240,t,2.4,.12);},
    die:(s,t,a)=>{s.nz(t,2,.7,'lowpass',2500,40);s.osc('sawtooth',300,30,t,1.5,.28);},
    buy:(s,t,a)=>{s.osc('triangle',880,0,t,.08,.08);s.osc('triangle',1320,0,t+.07,.12,.08);},
  }});
const Mus=ARC.music(Snd,{level:i=>SITES[i],calmBpm:92,calmBass:.22});
function vibe(ms){ARC.vibe(S.set.vibe,ms);}

/* ================================================================ POOLS & MESHES */
function soa(cap,keys){const o={cap,n:0,keys};for(const k of keys)o[k]=new Float32Array(cap);return o;}
function rmSoa(o,i){const j=--o.n;if(i!==j)for(const k of o.keys)o[k][i]=o[k][j];}
const pb=soa(800,['x','y','z','vx','vy','dmg','kind','life','home','tgt','tuid','splash']);   // defense projectiles
const eb=soa(1600,['x','y','vx','vy','c','big','cv','t','dmg']);                              // alien bullets
const pt=soa(3000,['x','y','z','vx','vy','vz','l','m','s0','s1','r','g','b','sh','dr','gz']);  // glow particles
const sm=soa(260,['x','y','z','vx','vy','vz','l','m','s0','s1','a']);                         // smoke puffs (normal blend)
const db=soa(260,['x','y','z','vx','vy','vz','rx','ry','rz','wx','wy','wz','l','m','s','c']);  // debris chunks
const EN=[];for(let i=0;i<170;i++)EN.push({alive:false,uid:0});
const PK=[];for(let i=0;i<140;i++)PK.push({alive:false});
const beams=[],arcs=[],meteors=[];
let uidSeq=0;

const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),
  green:rgb(0x5dff9b),blue:rgb(0x4aa8ff),yellow:rgb(0xffd23d),red:rgb(0xff4d4d),lance:rgb(0xc9a0ff),rail:rgb(0xa8d8ff),hot:rgb(0xffe6b0),shadow:[.01,.0,.04],smoke:[.16,.15,.22],dark:[.05,.04,.12]};
const EBC=[rgb(0xff9a2e),rgb(0xff3d7f),rgb(0xb36bff),rgb(0xffd23d),rgb(0xff4040),rgb(0xff5ad7)];
const PAT_C={aimed:0,aimed3:0,fan:1,ring:2,spiral:5,burst:3,wall:4,flower:5,rain:1};
const PB_VIS=[[COL.cyan,.2,.7],[COL.yellow,.22,.34],[COL.lance,.3,1.5],[COL.cyan,.24,.6],[COL.orange,.26,.46]];  // kind -> [color, w, h]

function instMesh(g,cap){const fl=new T.InstancedBufferAttribute(new Float32Array(cap),1).setUsage(T.DynamicDrawUsage);g.setAttribute('aFlash',fl);
  const m=new T.InstancedMesh(g,MAT_I,cap);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;scene.add(m);return{m,cap,fl,n:0};}
const EMESH={};for(const k in EGEO)EMESH[k]=instMesh(EGEO[k](),k==='gunship'||k==='elite'?30:k==='rock'?16:110);
const SMESH={};for(const k in SGEO){const d=SGEO[k];SMESH[k]={base:instMesh(d.base(),80),head:d.head?instMesh(d.head(),80):null};}
const engMesh=instMesh(buildEngineer(),4);
function colorInst(g,cap){const m=new T.InstancedMesh(g,makeMat(true),cap);g.setAttribute('aFlash',new T.InstancedBufferAttribute(new Float32Array(cap),1));
  m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;m.setColorAt(0,new T.Color(1,1,1));m.instanceColor.setUsage(T.DynamicDrawUsage);scene.add(m);return m;}
const pkMesh=colorInst(geo([{g:P.oct(.5),c:0xffffff,e:1,s:[.8,.8,1.1]}]),140);
const dbMesh=colorInst(geo([{g:P.tet(.5),c:0xffffff}]),260);
const DB_COL=[0xff3d7f,0xff8a2e,0x5a46b8,0x8a92c8,0x6b5a50,0xd23dff,0x3ef0ff,0xffc531,0x4a5280,0xe8eefc].map(h=>new T.Color(h));
const PK_COL=[new T.Color(0xffc531),new T.Color(0xc9a0ff)];

// The wreck: outer group = heading, inner = crash tilt. Its own material so it can flash on hits.
const shipMat=makeMat(false);
const shipG=new T.Group(),shipIn=new T.Group();shipG.add(shipIn);shipIn.add(new T.Mesh(buildWreck(),shipMat));scene.add(shipG);
const shipGun=new T.Mesh(buildShipGun(),shipMat);scene.add(shipGun);
const wreckage=new T.Mesh(buildWreckage(),MAT_BG);scene.add(wreckage);
const SHIP_BASE={rz:-PI/2+.32,rx:-.09,ry:.1};wreckage.rotation.z=SHIP_BASE.rz;
const ghostMat=makeMat(false,{transparent:true,opacity:.6,depthWrite:false});
const ghostB=new T.Mesh(new T.BufferGeometry(),ghostMat),ghostH=new T.Mesh(new T.BufferGeometry(),ghostMat);ghostB.renderOrder=ghostH.renderOrder=4;
ghostB.visible=ghostH.visible=false;scene.add(ghostB,ghostH);
const GHOST_GEO={};function ghostGeo(t){if(!GHOST_GEO[t]){const d=SGEO[t];GHOST_GEO[t]={b:d.base(),h:d.head?d.head():null};}return GHOST_GEO[t];}

/* ================================================================ RUN STATE */
let state='title';
// G = the current run. Most of it is saved at every build phase (see snap()).
const G={site:0,L:SITES[0],diff:'normal',wave:0,deck:[],draw:[],hand:[null,null,null,null],bonus:null,discard:[],
  energy:0,eFrac:0,scrap:0,hull:200,repair:0,up:null,structs:[],plan:null,spawnQ:[],wt:0,spawned:0,total:0,killed:0,
  speed:1,metT:0,gunT:0,gunRot:0,shipFlash:0,stats:null,shop:null,seed:1,anim:0,over:false};
function freshUp(){return{dmg:{},mk:{},hp:1,eMax:0,waveE:0,regen:1,hull:0,armor:0,cap:0,removes:0};}
const hullMax=()=>240+G.up.hull*60;
const eMax=()=>10+G.up.eMax;

/* ================================================================ EFFECTS */
const LOWQ=()=>S.set.gfx==='low';
function part(x,y,z,vx,vy,vz,l,s0,s1,c,sh,dr,gz){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.vz[i]=vz;pt.l[i]=pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.dr[i]=dr||0;pt.gz[i]=gz||0;}
function sparks(x,y,z,n,c,spd,size,life){if(LOWQ())n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(.3,1)*spd;part(x,y,z,Math.cos(a)*s,Math.sin(a)*s,rand(-.2,1)*spd*.7,rand(.6,1)*life,size,.02,c,0,3,5);}}
function smoke(x,y,z,s,a){if(sm.n>=sm.cap||LOWQ()&&Math.random()<.5)return;const i=sm.n++;sm.x[i]=x+rand(-.1,.1);sm.y[i]=y+rand(-.1,.1);sm.z[i]=z;
  sm.vx[i]=rand(-.12,.12)+.15;sm.vy[i]=rand(-.12,.12)+.15;sm.vz[i]=rand(.5,.9);sm.l[i]=sm.m[i]=rand(1.3,2.2);sm.s0[i]=s*.35;sm.s1[i]=s;sm.a[i]=a;}
function debris(x,y,z,n,c){for(let i=0;i<n&&db.n<db.cap;i++){const k=db.n++,a=rand(0,TAU),s=rand(1.5,4.5);db.x[k]=x;db.y[k]=y;db.z[k]=z;
  db.vx[k]=Math.cos(a)*s;db.vy[k]=Math.sin(a)*s;db.vz[k]=rand(2,5);db.rx[k]=rand(0,TAU);db.ry[k]=rand(0,TAU);db.rz[k]=0;
  db.wx[k]=rand(-8,8);db.wy[k]=rand(-8,8);db.wz[k]=rand(-8,8);db.l[k]=db.m[k]=rand(.7,1.3);db.s[k]=rand(.1,.24);db.c[k]=c;}}
function shake(a){cam.shake=Math.min(1.2,cam.shake+a*(REDUCED?.3:1));}
function boom(x,y,z,sz,c,dc){
  const q=LOWQ()?.5:1,n=Math.round((6+sz*12)*q);
  for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(.4,1)*(2+sz*3);part(x,y,z,Math.cos(a)*s,Math.sin(a)*s,rand(-.4,1.2)*s*.5,rand(.25,.6)*(.7+sz*.3),rand(.3,.6)*(.6+sz*.5),.05,c,0,3.2,0);}
  part(x,y,z,0,0,0,.16+sz*.06,1+sz*1.4,.2,COL.hot,0,0);
  part(x,y,.04,0,0,0,.3+sz*.1,.2,1.4+sz*2,c,11,0);
  debris(x,y,z,Math.round((2+sz*3)*q),dc||0);shake(.04+sz*.08);Snd.play(sz>1.8?'big':'boom',sz);
}
// Delayed explosions for bosses and the ship going down.
const booms=[];
function chain(x,y,z,n,spread,dur,c){for(let i=0;i<n;i++)booms.push({t:i*dur/n+rand(0,.05),x:x+rand(-spread,spread),y:y+rand(-spread,spread),z:z+rand(0,.5),s:rand(.8,1.6),c:c||(Math.random()<.5?COL.orange:COL.pink)});}
function pickup(x,y,z,type,n){for(let k=0;k<n;k++)for(const p of PK)if(!p.alive){p.alive=true;p.x=x;p.y=y;p.z=z;p.type=type;const a=rand(0,TAU),s=rand(1,2.5);
  p.vx=Math.cos(a)*s;p.vy=Math.sin(a)*s;p.vz=rand(2,4);p.t=0;p.ph=rand(0,3);break;}}
function dust(x,y){for(let i=0;i<10;i++){const a=i/10*TAU;part(x+Math.cos(a)*.4,y+Math.sin(a)*.4,.08,Math.cos(a)*1.6,Math.sin(a)*1.6,.3,.45,.3,.05,COL.cyan,0,4,0);}
  part(x,y,.03,0,0,0,.35,.3,1.4,COL.cyan,11,0);}
function addEnergy(n){G.energy=Math.min(eMax(),G.energy+n);}

/* ================================================================ DEFENSES */
const maxHp=s=>CARDS[s.type].hp*(1+.5*(s.lvl-1))*G.up.hp;
const domeMax=s=>CARDS.dome.shield*(1+.6*(s.lvl-1))*G.up.hp, domeR=s=>CARDS.dome.aura+.2*(s.lvl-1);
const pdStats=s=>({r:CARDS.intercept.pd.r+.3*(s.lvl-1),cd:CARDS.intercept.pd.cd/(1+.35*(s.lvl-1))});
function addStruct(type,a,b,lvl,hp){
  const s={type,a,b,x:a-C,y:b-C,lvl:lvl||1,cd:rand(0,.4),rot:rand(0,TAU),flash:0,dead:false,t:rand(0,9),tgt:null,tgT:0,built:hp!=null?1:0,id:++uidSeq,guard:false,heal:0,recoil:0,alt:false};
  s.max=maxHp(s);s.hp=hp!=null?clamp(hp,1,s.max):s.max;if(type==='dome'){s.sh=domeMax(s);s.up=true;s.shT=0;s.hitF=0;}G.structs.push(s);occ[ti(a,b)]=s;navDirty=true;refreshGuards();return s;}
function refreshGuards(){for(const s of G.structs)s.guard=false;
  for(const p of G.structs){if(p.dead||p.type!=='pylon')continue;for(const s of G.structs)if(s!==p&&Math.abs(s.a-p.a)<=1&&Math.abs(s.b-p.b)<=1)s.guard=true;}}
function hurtS(s,d){if(s.dead||G.over)return;if(s.guard)d*=.6;s.hp-=d;if(s.flash<.2)s.flash=.8;if(s.hp<=0)destroyS(s,true);}
function destroyS(s,loud){if(s.dead)return;s.dead=true;s.hp=0;const i=ti(s.a,s.b);if(occ[i]===s)occ[i]=null;navDirty=true;
  const k=G.structs.indexOf(s);if(k>=0)G.structs.splice(k,1);if(s.type==='pylon')refreshGuards();
  if(loud){boom(s.x,s.y,.4,1.1,rgb(CARDS[s.type].col),8);Snd.play('lost');vibe(25);G.stats.lost++;}}
function wStats(s){const w=CARDS[s.type].w,mk=G.up.mk[s.type]||0,L=s.lvl-1;
  return{k:w.k,n:w.n,splash:w.splash,r:w.r+.3*L+.3*mk,cd:w.cd*(1-.1*L),dmg:w.dmg*(1+.45*L)*(1+.3*mk)*(1+(G.up.dmg[s.type]||0))};}
function threat(e){const a=tileOf(e.x),b=tileOf(e.y);return inNav(a,b)?D[ti(a,b)]:99;}
// The alien a defense should shoot: the one with the shortest route to the ship (or simply the nearest).
function findEnemy(x,y,r,nearest){let best=null,bv=1e9;
  for(const e of EN){if(!e.alive)continue;const dx=e.x-x,dy=e.y-y,d2=dx*dx+dy*dy,rr=r+e.r*.6;if(d2>rr*rr)continue;
    const v=nearest?d2:threat(e)+d2*.01;if(v<bv){bv=v;best=e;}}return best;}
const inRange=(e,x,y,r)=>e&&e.alive&&(e.x-x)**2+(e.y-y)**2<=(r+e.r*.6)**2;
function leadAng(x,y,e,sp){const dx=e.x-x,dy=e.y-y,t=Math.hypot(dx,dy)/sp;return Math.atan2(dy+e.vy*t,dx+e.vx*t);}
function segDist(px,py,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy,t=clamp(((px-x1)*dx+(py-y1)*dy)/l2,0,1);return Math.hypot(px-x1-dx*t,py-y1-dy*t);}
function pShot(x,y,z,ang,spd,dmg,kind,life,home,e,splash){if(pb.n>=pb.cap)return;const i=pb.n++;pb.x[i]=x;pb.y[i]=y;pb.z[i]=z;pb.vx[i]=Math.cos(ang)*spd;pb.vy[i]=Math.sin(ang)*spd;
  pb.dmg[i]=dmg;pb.kind[i]=kind;pb.life[i]=life;pb.home[i]=home||0;pb.tgt[i]=e?e.idx:-1;pb.tuid[i]=e?e.uid:0;pb.splash[i]=splash||0;}
function fire(s,w,e){
  const hz=SGEO[s.type].hz||.5,c=Math.cos(s.rot),sn=Math.sin(s.rot),mx=s.x+c*.45,my=s.y+sn*.45;s.recoil=1;
  switch(w.k){
    case 'bolt':{s.alt=!s.alt;const o=s.alt?.09:-.09;pShot(mx-sn*o,my+c*o,hz,leadAng(mx,my,e,15),15,w.dmg,0,w.r/15+.25);Snd.play('shot');break;}
    case 'fan':{for(let i=0;i<w.n;i++){const k=i/(w.n-1)-.5;pShot(mx,my,hz,s.rot+k*.62+rand(-.05,.05),12,w.dmg,1,w.r/12+.08);}Snd.play('pellet');break;}
    case 'beam':{const L=w.r+.5,x2=mx+c*L,y2=my+sn*L;
      for(const t of EN){if(t.alive&&segDist(t.x,t.y,mx,my,x2,y2)<t.r+.18){hurtEnemy(t,w.dmg);sparks(t.x,t.y,t.z,3,COL.lance,4,.2,.25);}}
      beams.push({x1:mx,y1:my,z1:hz,x2,y2,z2:.85,t:.26,m:.26,c:COL.lance,w:.55});Snd.play('beam');shake(.025);break;}
    case 'missile':{for(let i=0;i<w.n;i++)pShot(s.x,s.y,hz+.2,s.rot+(i%2?.7:-.7),4,w.dmg,4,3.6,1,e,w.splash);Snd.play('missile');break;}
    case 'arc':{const hit=[e];let cur=e;
      for(let k=1;k<w.n;k++){let nb=null,nd=2.3*2.3;for(const t of EN){if(!t.alive||hit.includes(t))continue;const d2=(t.x-cur.x)**2+(t.y-cur.y)**2;if(d2<nd){nd=d2;nb=t;}}if(!nb)break;hit.push(nb);cur=nb;}
      const pts=[[s.x,s.y,.94]];for(const t of hit)pts.push([t.x,t.y,t.z]);
      hit.forEach((t,k)=>hurtEnemy(t,w.dmg*(1-.12*k)));arcs.push({pts,t:.16,m:.16});Snd.play('zap');break;}
  }
}
function detonate(s){const R=1.7,dmg=16*(1+.5*(s.lvl-1))*(1+(G.up.dmg.mine||0));
  for(const e of EN){if(!e.alive)continue;const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<R+e.r)hurtEnemy(e,dmg*(1-.4*clamp(d/R,0,1)));}
  boom(s.x,s.y,.3,1.7,COL.red,0);destroyS(s,false);}
function updStruct(s,dt,live){
  s.t+=dt;s.flash=Math.max(0,s.flash-dt*6);s.built=Math.min(1,s.built+dt*3.5);s.recoil=Math.max(0,s.recoil-dt*6);s.heal=Math.max(0,s.heal-dt);
  const c=CARDS[s.type];
  if(s.hp<s.max*.35&&Math.random()<dt*3)smoke(s.x,s.y,.6,.5,.5);
  if(s.type==='dome')s.hitF=Math.max(0,s.hitF-dt*4);
  if(!live){if(c.w||c.pd)s.rot+=dt*.25;if(s.type==='dome'){s.sh=domeMax(s);s.up=true;}return;}
  if(c.w){const w=wStats(s);s.cd-=dt;s.tgT-=dt;
    if(s.tgT<=0||!inRange(s.tgt,s.x,s.y,w.r)){s.tgT=.2;s.tgt=findEnemy(s.x,s.y,w.r,w.k==='arc');}
    const e=s.tgt;
    if(e){const ang=Math.atan2(e.y-s.y,e.x-s.x);s.rot=turnTo(s.rot,ang,dt*9);if(s.cd<=0&&Math.abs(angDiff(s.rot,ang))<.3){s.cd=w.cd;fire(s,w,e);}}
    else s.rot+=dt*.25;
  }else if(c.pd){const w=pdStats(s);s.cd-=dt;
    // Point defense: zap the nearest alien bullet in range.
    if(s.cd<=0){let bi=-1,bd=w.r*w.r;for(let i=0;i<eb.n;i++){const d2=(eb.x[i]-s.x)**2+(eb.y[i]-s.y)**2;if(d2<bd){bd=d2;bi=i;}}
      if(bi>=0){const x=eb.x[bi],y=eb.y[bi];s.cd=w.cd;s.rot=Math.atan2(y-s.y,x-s.x);s.recoil=1;const hz=SGEO.intercept.hz;
        beams.push({x1:s.x+Math.cos(s.rot)*.45,y1:s.y+Math.sin(s.rot)*.45,z1:hz,x2:x,y2:y,z2:.7,t:.09,m:.09,c:COL.rail,w:.16});
        part(x,y,.7,0,0,0,.18,.5,.05,COL.white,0,0);sparks(x,y,.7,3,COL.rail,2.5,.14,.2);rmSoa(eb,bi);G.stats.intercepted=(G.stats.intercepted||0)+1;Snd.play('pd');}}
    if(s.cd<-1)s.rot+=dt*.4;
  }else if(s.type==='dome'){const m=domeMax(s);s.shT+=dt;
    // Recharges after 2.5 quiet seconds; once drained it stays down until 40% charged.
    if(s.shT>2.5&&s.sh<m){s.sh=Math.min(m,s.sh+m*.22*dt);if(!s.up&&s.sh>=m*.4){s.up=true;Snd.play('shup');part(s.x,s.y,.6,0,0,0,.4,.3,domeR(s)*2,COL.blue,1,0);}}
  }else if(s.type==='mine'){for(const e of EN)if(e.alive&&(e.x-s.x)**2+(e.y-s.y)**2<(.4+e.r)**2){detonate(s);break;}}
  else if(s.type==='bay'){s.cd-=dt;if(s.cd<=0){s.cd=.6;const R=c.aura+.2*(s.lvl-1);
    for(const o of G.structs)if(o!==s&&o.hp<o.max&&(o.x-s.x)**2+(o.y-s.y)**2<=R*R){o.hp=Math.min(o.max,o.hp+o.max*.035*(1+.5*(s.lvl-1)));o.heal=.6;}}}
  else if(s.type==='gen'){s.cd-=dt;if(s.cd<=0){s.cd=7/(1+.35*(s.lvl-1));if(G.energy<eMax()){addEnergy(1);Snd.play('energy');}part(s.x,s.y,.5,0,0,0,.5,.3,1.6,COL.violet,1,0);}}
}
const GUN={x:-.25,y:.18,z:1.08};
function updShipGun(dt,live){
  G.gunT-=dt;if(!live||G.over){G.gunRot+=dt*.3;return;}
  const e=findEnemy(GUN.x,GUN.y,4.4,true);
  if(e){const ang=Math.atan2(e.y-GUN.y,e.x-GUN.x);G.gunRot=turnTo(G.gunRot,ang,dt*8);
    if(G.gunT<=0&&Math.abs(angDiff(G.gunRot,ang))<.3){G.gunT=.42;const c=Math.cos(G.gunRot),s=Math.sin(G.gunRot);pShot(GUN.x+c*.4,GUN.y+s*.4,GUN.z+.1,leadAng(GUN.x,GUN.y,e,14),14,1.5,3,.5);}}
}
function hurtShip(d,x,y){if(G.over||state!=='wave')return;G.hull-=d;G.shipFlash=1;G.stats.hullLost+=d;shake(.1);vibe(12);
  if(Math.random()<.3)smoke(x,y,.8,.7,.5);if(G.hull<=0){G.hull=0;shipDown();}}

/* ================================================================ ALIENS */
EN.forEach((e,i)=>{e.idx=i;});
const BOSS_D={name:'Boss',melee:[12,1.3],atk:{r:5.2},scrap:60,en:1};
function spawnEnemy(type,x,y,isBoss){
  let e=null;for(const c of EN)if(!c.alive){e=c;break;}if(!e)return null;
  const L=G.site,mul=DF().hp*(1+.22*L)*(1+.07*G.wave);
  Object.assign(e,{alive:true,type,uid:++uidSeq,x,y,vx:0,vy:0,t:rand(0,5),flash:0,face:Math.atan2(-y,-x),spinA:0,mT:rand(.2,.6),tg:null,tgShip:false,tgT:0,tx:0,ty:0,lunge:0,holdT:0,
    dmgMul:DF().dmg*(1+.1*L),model:null,boss:null,ems:null,em:null,atk:null});
  if(isBoss){const bd=BOSSES[type];e.boss=bd;e.d=BOSS_D;e.hp=e.max=bd.hp*DF().hp;e.r=bd.r;e.z=1.7;e.spd=.5;e.spin=0;e.ph=0;setBossPhase(e,0);
    e.mat=makeMat(false);e.model=BMODELS[type](e.mat);e.model.group.scale.setScalar(BOSS_SCALE);scene.add(e.model.group);
    $('bossName').textContent=bd.name;$('bossBar').hidden=false;lastHud.boss=-1;}
  else{const d=ET[type];e.d=d;e.hp=e.max=d.hp*mul;e.r=d.r;e.z=d.z;e.spd=d.speed*rand(.92,1.08);e.spin=d.spin?(Math.random()<.5?-1:1)*d.spin:0;
    e.atk=d.atk||null;e.em=e.atk?{t:rand(.4,1)*e.atk.cd,a:rand(0,TAU),bn:0,bt:0}:null;}
  return e;
}
function setBossPhase(e,i){e.ph=i;const p=e.boss.phases[i];e.ems=p.pat.map(sp=>({sp,t:(sp.delay||0)+1,a:0,bn:0,bt:0}));e.spawnT=p.spawn?p.spawn.cd*.6:0;
  if(i>0){e.flash=1;shake(.5);Snd.play('phase');toast('Phase '+(i+1),COL.pink);}}
// Bullet patterns from Starwake. aim = toward the target, fwd = the way the shooter faces.
function eShot(x,y,a,s,c,big,dmg,cv){if(eb.n>=eb.cap)return;const i=eb.n++;eb.x[i]=x;eb.y[i]=y;eb.vx[i]=Math.cos(a)*s;eb.vy[i]=Math.sin(a)*s;eb.c[i]=c;eb.big[i]=big||0;eb.dmg[i]=dmg;eb.cv[i]=cv||0;eb.t[i]=0;}
function emit(sp,x,y,em,aim,fwd,dmg){
  const spd=sp.sp||4,c=sp.c!=null?sp.c:PAT_C[sp.k],dens=n=>Math.max(1,Math.round(n*DF().dens));
  switch(sp.k){
    case 'aimed':eShot(x,y,aim,spd,c,0,dmg);break;
    case 'aimed3':for(let i=-1;i<=1;i++)eShot(x,y,aim+i*.2,spd,c,0,dmg);break;
    case 'fan':{const n=dens(sp.n||5),spr=sp.spread||.8,base=sp.aim?aim:fwd;for(let i=0;i<n;i++)eShot(x,y,base-spr/2+spr*(n===1?.5:i/(n-1)),spd,c,0,dmg);}break;
    case 'ring':{const n=dens(sp.n||8);em.a+=(sp.rot||.3);for(let i=0;i<n;i++)eShot(x,y,em.a+i*TAU/n,spd,c,1,dmg);}break;
    case 'spiral':{const n=sp.n||2;em.a+=(sp.rot||2)*sp.cd;for(let i=0;i<n;i++)eShot(x,y,em.a+i*TAU/n,spd,c,0,dmg);}break;
    case 'burst':em.bn=sp.n||3;em.bt=0;em.bs=spd;em.bc=c;em.bd=dmg;break;
    case 'wall':{const n=dens(sp.n||9),gapAt=Math.floor(rand(1,n-1)),px=-Math.sin(fwd),py=Math.cos(fwd);
      for(let i=0;i<n;i++){if(i===gapAt)continue;const o=(i-(n-1)/2)*.5;eShot(x+px*o,y+py*o,fwd,spd*.8,c,1,dmg);}}break;
    case 'flower':{const n=dens(sp.n||8);em.a+=.35;for(let i=0;i<n;i++){const a=em.a+i*TAU/n;eShot(x,y,a,spd,c,0,dmg,.55);eShot(x,y,a+PI/n,spd,c,0,dmg,-.55);}}break;
    case 'rain':{const n=dens(sp.n||5);for(let i=0;i<n;i++)eShot(x+rand(-.6,.6),y+rand(-.6,.6),fwd+rand(-.45,.45),spd*rand(.7,1.15),c,0,dmg);}break;
  }
}
function tickBurst(em,x,y,aim,dt){if(em.bn>0){em.bt-=dt;if(em.bt<=0){em.bt+=.1;em.bn--;eShot(x,y,aim,em.bs,em.bc,2,em.bd);}}}
// Ranged aliens stop and shoot the nearest defense (or the ship) once one is in range.
function acquire(e,r){const was=e.tg;let best=null,bd=(r+.4)*(r+.4),ship=false,bx=0,by=0;
  for(const s of G.structs){if(CARDS[s.type].flat)continue;const d2=(s.x-e.x)**2+(s.y-e.y)**2;if(d2<bd){bd=d2;best=s;}}
  const sx=clamp(e.x,-1.2,1.2),sy=clamp(e.y,-1.2,1.2),d2=(sx-e.x)**2+(sy-e.y)**2;if(d2<bd){best=null;ship=true;bx=sx;by=sy;}
  if(best!==was)e.holdT=0;e.tg=best;e.tgShip=ship;if(best){e.tx=best.x;e.ty=best.y;}else if(ship){e.tx=bx;e.ty=by;}}
function updEnemy(e,dt){
  e.t+=dt;e.flash=Math.max(0,e.flash-dt*8);e.lunge=Math.max(0,e.lunge-dt*4);
  const d=e.d,atk=e.boss?BOSS_D.atk:e.atk;let stop=false,slow=1;
  if(atk){e.tgT-=dt;if(e.tgT<=0){e.tgT=.3;acquire(e,atk.r);}
    if(e.tg&&e.tg.dead){e.tg=null;e.tgT=0;}
    // Shooters keep drifting in while they fire and hold once well inside their range. If a target outlasts them
    // (say, a wall kept alive by Repair Bays) they press on, so no wave can stall.
    if(e.tg||e.tgShip){const aim=Math.atan2(e.ty-e.y,e.tx-e.x),hold=e.boss?3.2:atk.r*.6,near=Math.hypot(e.tx-e.x,e.ty-e.y)<=hold;
      if(near)e.holdT+=dt;slow=near&&e.holdT<6&&G.wt<120?0:e.boss?.3:.35;e.face=turnTo(e.face,aim,dt*4);
      if(e.boss)bossFire(e,dt);else{tickBurst(e.em,e.x,e.y,aim,dt);e.em.t-=dt;if(e.em.t<=0){e.em.t+=e.atk.cd*rand(.9,1.1);emit(e.atk,e.x,e.y,e.em,aim,e.face,e.atk.dmg*e.dmgMul);}}}}
  const nx=navNext(e);
  if(nx.blk||nx.ship){const dist=Math.hypot(nx.x-e.x,nx.y-e.y);
    if(dist<.5+e.r+.12){stop=true;e.mT-=dt;if(!(e.tg||e.tgShip))e.face=turnTo(e.face,Math.atan2(nx.y-e.y,nx.x-e.x),dt*5);
      if(e.mT<=0){e.mT=d.melee[1];e.lunge=1;const dm=d.melee[0]*e.dmgMul,hx=lerp(e.x,nx.x,.55),hy=lerp(e.y,nx.y,.55);
        if(nx.ship)hurtShip(dm,hx,hy);else hurtS(nx.blk,dm);sparks(hx,hy,.5,4,COL.orange,3,.2,.25);Snd.play('clank');}}}
  const sp=stop?0:e.spd*slow,dx=nx.x-e.x,dy=nx.y-e.y,dl=Math.hypot(dx,dy)||1,k=Math.min(1,dt*(e.boss?1.5:3));
  e.vx+=(dx/dl*sp-e.vx)*k;e.vy+=(dy/dl*sp-e.vy)*k;
  const ox=e.x,oy=e.y;e.x+=e.vx*dt;e.y+=e.vy*dt;
  const a=tileOf(e.x),b=tileOf(e.y);
  if((a!==tileOf(ox)||b!==tileOf(oy))&&inNav(a,b)&&blockedAt(ti(a,b))){e.x=ox;e.y=oy;e.vx*=.2;e.vy*=.2;}
  if(!stop&&slow===1&&e.vx*e.vx+e.vy*e.vy>.02)e.face=turnTo(e.face,Math.atan2(e.vy,e.vx),dt*6);
  if(e.spin)e.spinA+=e.spin*dt;
  if(e.boss)updBoss(e,dt);
}
function bossFire(e,dt){const rz=e.face+PI/2,ca=Math.cos(rz),sa=Math.sin(rz);
  for(const em of e.ems){const sp=em.sp;let ox=0,oy=0;
    if(sp.orb){const a=e.t*sp.orb[1]+(sp.ph||0);ox=Math.cos(a)*sp.orb[0];oy=Math.sin(a)*sp.orb[0];}else if(sp.o){ox=sp.o[0];oy=sp.o[1];}
    ox*=BOSS_SCALE;oy*=BOSS_SCALE;const wx=e.x+ox*ca-oy*sa,wy=e.y+ox*sa+oy*ca,aim=Math.atan2(e.ty-wy,e.tx-wx);
    tickBurst(em,wx,wy,aim,dt);em.t-=dt;if(em.t<=0){em.t+=sp.cd;emit(sp,wx,wy,em,aim,e.face,1.1*(1+.15*G.site)*DF().dmg);}}}
function updBoss(e,dt){const ph=e.boss.phases;if(e.ph+1<ph.length&&e.hp/e.max<=ph[e.ph+1].at)setBossPhase(e,e.ph+1);
  const p=ph[e.ph];if(p.spawn){e.spawnT-=dt;if(e.spawnT<=0){e.spawnT=p.spawn.cd;
    for(let i=0;i<p.spawn.n;i++){const a=rand(0,TAU);if(spawnEnemy(p.spawn.e,e.x+Math.cos(a)*1.3,e.y+Math.sin(a)*1.3))G.total++;}}}
  e.model.anim(e.t,e,dt);}
function hurtEnemy(e,dmg){if(!e.alive)return;e.hp-=dmg;if(e.flash<.15)e.flash=e.max>=40?.6:1;Snd.play('hit');if(e.hp<=0)killEnemy(e);}
function killEnemy(e){if(!e.alive)return;e.alive=false;G.killed++;G.stats.kills++;S.kills++;
  const big=e.boss?3:e.max>=60?1.6:e.max>=15?1:.55;
  const c=e.boss?COL.pink:{mite:COL.orange,drone:COL.orange,gunship:COL.violet,elite:COL.pink,turret:COL.yellow}[e.type]||COL.pink;
  const dc=e.boss?7:{dart:0,mite:1,drone:1,gunship:2,turret:3,elite:5}[e.type];
  boom(e.x,e.y,e.z,big,c,dc);
  const sc=Math.max(1,Math.round(e.d.scrap*DF().scrap));G.scrap+=sc;G.stats.scrap+=sc;pickup(e.x,e.y,e.z,0,Math.min(sc,5));
  if(Math.random()<e.d.en){addEnergy(e.boss?4:e.d.en>=1?2:1);pickup(e.x,e.y,e.z,1,1);}
  if(e.boss){chain(e.x,e.y,e.z,10,1.4,1.4,null);scene.remove(e.model.group);e.model.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});e.mat.dispose();
    e.model=null;e.boss=null;$('bossBar').hidden=true;clearBullets(true);shake(1);vibe(80);}
}
function clearBullets(fxOn){if(fxOn)for(let i=0;i<eb.n;i+=2)part(eb.x[i],eb.y[i],.7,0,0,0,.3,.45,.05,COL.gold,0,0);eb.n=0;}
function anyAlive(){for(const e of EN)if(e.alive)return true;return false;}
// Repulsion so a swarm spreads out instead of stacking on one point.
function separate(dt){const n=EN.length;for(let i=0;i<n;i++){const a=EN[i];if(!a.alive)continue;
  for(let j=i+1;j<n;j++){const b=EN[j];if(!b.alive)continue;const dx=b.x-a.x,dy=b.y-a.y,rr=(a.r+b.r)*.85,d2=dx*dx+dy*dy;
    if(d2<rr*rr&&d2>1e-6){const d=Math.sqrt(d2),f=(rr-d)/d*6*dt,wa=a.boss?.1:1,wb=b.boss?.1:1;a.vx-=dx*f*wa;a.vy-=dy*f*wa;b.vx+=dx*f*wb;b.vy+=dy*f*wb;}}}}

/* ================================================================ CARDS */
function drawCard(){if(!G.draw.length){if(!G.discard.length)return null;G.draw=shuffle(G.discard);G.discard=[];}return G.draw.pop();}
function fillHand(){for(let i=0;i<4;i++)if(!G.hand[i])G.hand[i]=drawCard();}
const slotCard=i=>i===4?G.bonus:G.hand[i];
const slotCost=i=>{const t=slotCard(i);return !t?99:i===4?0:CARDS[t].cost;};
function validAt(t,a,b){
  if(!t||!inNav(a,b))return false;const i=ti(a,b),c=CARDS[t];
  if(c.kind==='s')return kind[i]===LAND&&!occ[i];
  if(t==='patch'){for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){if(!inNav(a+x,b+y))continue;const s=occ[ti(a+x,b+y)];if(s&&s.hp<s.max-.5)return true;}return false;}
  if(t==='overclock'){const s=occ[i];return !!s&&s.lvl<3;}
  if(t==='nova')return Math.hypot(a-C,b-C)<10.5;
  return false;
}
function whyNot(t,a,b){const c=CARDS[t];if(!inNav(a,b))return 'Off the map';const i=ti(a,b);
  if(c.kind==='s')return kind[i]===VOID?'Needs solid ground':kind[i]===ROCK?'Boulder in the way':kind[i]===SHIP?'That is the ship':'Tile taken';
  if(t==='patch')return 'Nothing damaged there';if(t==='overclock')return occ[i]?'Already max level':'Aim at a defense';return 'Can’t use that here';}
function applyCard(t,a,b){const x=a-C,y=b-C;
  if(CARDS[t].kind==='s'){addStruct(t,a,b);dust(x,y);Snd.play('place');vibe(8);G.stats.built++;return;}
  if(t==='patch'){for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++){if(!inNav(a+u,b+v))continue;const s=occ[ti(a+u,b+v)];if(s){s.hp=s.max;s.heal=1;sparks(s.x,s.y,.6,8,COL.gold,2.5,.2,.4);}}
    part(x,y,.04,0,0,0,.6,.4,2.8,COL.gold,11,0);Snd.play('repair');return;}
  if(t==='overclock'){const s=occ[ti(a,b)];s.lvl++;const m=maxHp(s);s.max=m;s.hp=m;s.flash=1;if(s.type==='dome'){s.sh=domeMax(s);s.up=true;}
    for(let i=0;i<14;i++)part(s.x+rand(-.3,.3),s.y+rand(-.3,.3),.2,0,0,rand(1.5,3),rand(.5,.9),.25,.05,COL.green,0,1,0);part(s.x,s.y,.05,0,0,0,.5,.2,1.6,COL.green,11,0);Snd.play('up');return;}
  if(t==='nova'){const R=CARDS.nova.area,dmg=34*(1+(G.up.dmg.nova||0));
    for(const e of EN){if(!e.alive)continue;const d=Math.hypot(e.x-x,e.y-y);if(d<R+e.r)hurtEnemy(e,dmg*(1-.4*clamp(d/R,0,1)));}
    for(let i=eb.n-1;i>=0;i--)if((eb.x[i]-x)**2+(eb.y[i]-y)**2<R*R*1.4){part(eb.x[i],eb.y[i],.7,0,0,0,.3,.45,.05,COL.violet,0,0);rmSoa(eb,i);}
    for(let i=0;i<3;i++)part(x,y,.06,0,0,0,.5+i*.15,.3,R*2.2+i*.6,i?COL.violet:COL.white,11,0);
    part(x,y,4,0,0,0,.35,6,.3,COL.white,0,0);boom(x,y,.6,2.4,COL.violet,5);flash();vibe(50);return;}
}
let sel=-1;
function play(slot,a,b){const t=slotCard(slot);if(!t)return false;const co=slotCost(slot);
  if(G.energy+1e-6<co){deny('Not enough energy');return false;}
  if(!validAt(t,a,b)){deny(whyNot(t,a,b));return false;}
  G.energy-=co;applyCard(t,a,b);
  if(slot===4)G.bonus=null;else{G.discard.push(t);G.hand[slot]=drawCard();}
  sel=-1;renderHand();if(state==='build')saveRun();return true;}
function swapCard(slot){if(slot===4||!G.hand[slot])return;if(G.energy<1){deny('Swapping costs 1 energy');return;}
  G.energy-=1;G.discard.push(G.hand[slot]);G.hand[slot]=drawCard();Snd.play('card');sel=-1;renderHand();if(state==='build')saveRun();}

/* ================================================================ WAVES */
function makePlan(site,w){
  const L=SITES[site],last=w===L.waves-1,dirs=shuffle([0,1,2,3,4,5,6,7]),groups=[];let budget=L.budget*(1+.36*w)*DF().dens,di=0;
  if(last){groups.push({e:L.boss,boss:1,n:1,dir:dirs[di++],t:9,gap:0});budget*=.6;}
  const nG=clamp(2+Math.floor((w+site)/2),2,5);
  for(let g=0;g<nG;g++){
    const share=budget/nG*rand(.8,1.2),opts=L.pool.filter(k=>ET[k].cost<=share*.75||k==='mite');
    // Later waves lean toward the tougher end of the site's pool.
    let tot=0;const wts=opts.map((k,i)=>{const v=(1+i*.9*w/Math.max(1,L.waves-1))*(i>w+2?.2:1);tot+=v;return v;});let r=Math.random()*tot,k=0;for(;k<opts.length-1;k++){r-=wts[k];if(r<=0)break;}
    const e=opts[k],n=clamp(Math.round(share/ET[e].cost),1,36);
    const dir=g<2||Math.random()<.45?dirs[di++%8]:groups[groups.length-1].dir;
    groups.push({e,n,dir,t:g*rand(5,8)+(last?2:0)+1,gap:e==='mite'?.28:rand(.5,.9)});
  }
  return{groups};
}
function launchWave(){
  if(state!=='build')return;sel=-1;closeInfo();G.spawnQ=[];let boss=false;
  for(const g of G.plan.groups)for(let k=0;k<g.n;k++){const a=g.dir*PI/4+rand(-.22,.22),R=10.3+rand(0,.8);G.spawnQ.push({t:g.t+k*g.gap,e:g.e,boss:!!g.boss,x:Math.cos(a)*R,y:Math.sin(a)*R});if(g.boss)boss=true;}
  G.spawnQ.sort((p,q)=>p.t-q.t);G.total=G.spawnQ.length;G.killed=0;G.wt=0;G.metT=G.L.meteors?rand(4,7):0;G.waveBoss=boss;
  if(G.up.waveE)addEnergy(G.up.waveE);
  state='wave';G.stats.sorties=(G.stats.sorties||0)+1;
  banner('Wave '+(G.wave+1)+' of '+G.L.waves,boss?'The big one':G.total+' contacts',boss);Snd.play('wave');Mus.play('level',G.site);requestWake();refreshPhaseUI();
}
function updateSpawner(){
  while(G.spawnQ.length&&G.spawnQ[0].t<=G.wt){const q=G.spawnQ[0];const e=spawnEnemy(q.e,q.x,q.y,q.boss);if(!e){q.t+=.5;break;}G.spawnQ.shift();
    if(q.boss){banner('Warning',BOSSES[q.e].name+' inbound',true);Snd.play('warn');Mus.play('boss',G.site);}}
}
function updMeteors(dt){
  if(G.L.meteors&&state==='wave'&&G.spawnQ.length+G.total-G.killed>0){G.metT-=dt;if(G.metT<=0){G.metT=G.L.meteors*rand(.7,1.3);
    const cand=[];for(let i=0;i<NN;i++)if(kind[i]===LAND&&(occ[i]||Math.random()<.25))cand.push(i);
    if(cand.length){const i=pick(cand);meteors.push({x:i%NAV-C+rand(-.2,.2),y:((i/NAV)|0)-C+rand(-.2,.2),t:1.8,rx:rand(0,TAU),ry:rand(0,TAU)});Snd.play('meteor');}}}
  for(let i=meteors.length-1;i>=0;i--){const m=meteors[i];m.t-=dt;m.rx+=dt*3;m.ry+=dt*2;
    if(m.t<=0){meteors.splice(i,1);boom(m.x,m.y,.3,1.5,[.9,.55,.3],4);
      for(const s of G.structs.slice())if((s.x-m.x)**2+(s.y-m.y)**2<1.05)hurtS(s,24*DF().dmg);
      for(const e of EN)if(e.alive&&(e.x-m.x)**2+(e.y-m.y)**2<1.3)hurtEnemy(e,20);
      if(Math.abs(m.x)<1.5&&Math.abs(m.y)<1.5)hurtShip(14*DF().dmg,m.x,m.y);}}
}

/* ================================================================ RUN FLOW */
function clearWorld(){
  pb.n=eb.n=pt.n=db.n=sm.n=0;beams.length=arcs.length=meteors.length=booms.length=0;
  for(const e of EN){if(e.model){scene.remove(e.model.group);e.model.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});e.mat.dispose();e.model=null;}e.alive=false;}
  for(const p of PK)p.alive=false;$('bossBar').hidden=true;
}
function newRun(diff){
  Object.assign(G,{diff,deck:START_DECK.slice(),bonus:null,scrap:0,up:freshUp(),shop:null,over:false,counted:false,
    stats:{kills:0,built:0,lost:0,waves:0,scrap:0,hullLost:0,sites:0}});
  S.diff=diff;S.run=null;save();startSite(0);
}
function startSite(i,r){
  G.site=i;G.L=SITES[i];G.over=false;clearWorld();applyTheme(G.L);
  G.seed=r?r.seed:(Math.random()*1e9)|0;buildIsland(G.L,G.seed);G.structs=[];
  if(r){Object.assign(G,{wave:r.wave,repair:r.repair,hull:r.hull,energy:r.energy,draw:r.draw.slice(),hand:r.hand.slice(),discard:r.discard.slice(),plan:r.plan});
    for(const q of r.structs)if(inNav(q[1],q[2])&&kind[ti(q[1],q[2])]===LAND&&!occ[ti(q[1],q[2])])addStruct(q[0],q[1],q[2],q[3],q[4]);}
  else{G.wave=0;G.repair=0;G.hull=hullMax();G.energy=Math.min(eMax(),6+G.up.cap);G.draw=shuffle(G.deck.slice());G.discard=[];G.hand=[null,null,null,null];fillHand();G.plan=makePlan(i,0);}
  G.shipLift=0;buildNav();resetEngineers();
  state='build';sel=-1;hideScreens();$('hud').hidden=false;cam.zoom=1;cam.px=cam.py=0;cam.az=-PI*.75;resize();renderHand();refreshPhaseUI();lastHud={};
  if(r&&r.phase==='pick'){showPick();return;}
  banner('Site '+(i+1)+' of '+SITES.length,G.L.name,false);Mus.play('calm',i);saveRun();releaseWake();
}
function waveClear(){
  clearBullets(true);pb.n=0;
  const w=G.wave,last=w===G.L.waves-1;
  const bonus=Math.round((8+4*w)*(1+.3*G.site)*DF().scrap);G.scrap+=bonus;G.stats.scrap+=bonus;G.stats.waves++;
  addEnergy(3);G.repair=(w+1)/G.L.waves;S.best=Math.max(S.best,G.stats.waves);
  if(last){siteDone();return;}
  state='cleared';G.anim=0;banner('Wave '+(w+1)+' held','+'+bonus+' scrap · +3 energy',false);Snd.play('clear');Mus.play('calm',G.site);releaseWake();
  saveRun('pick');refreshPhaseUI();
}
let offers=[];
function showPick(){
  state='pick';offers=makeOffers();
  $('pkEye').textContent='Wave '+(G.wave+1)+' of '+G.L.waves+' held';
  $('pkList').innerHTML=offers.map((o,i)=>'<button class="boon" data-i="'+i+'" style="--c:'+hex(o.col)+'"><svg viewBox="0 0 40 40" aria-hidden="true">'+(ICO[o.icon]||'')+'</svg><span><b>'+o.name+'</b><small>'+o.desc+'</small></span></button>').join('');
  $('pkSkip').textContent='Skip · +'+skipScrap()+' scrap';
  hideScreens();$('pick').hidden=false;
}
const skipScrap=()=>Math.round(12*(1+.3*G.site));
function takeOffer(i){
  if(state!=='pick')return;if(i>=0){offers[i].apply();Snd.play('buy');}else{G.scrap+=skipScrap();Snd.play('credit');}
  $('pick').hidden=true;G.wave++;G.plan=makePlan(G.site,G.wave);state='build';renderHand();refreshPhaseUI();
  banner('Build phase','Wave '+(G.wave+1)+' of '+G.L.waves+' incoming',false);saveRun();
}
function makeOffers(){
  const un=S.unlocked,live=G.structs,dmgd=live.filter(s=>s.hp<s.max*.75).length,opts=[];
  const deckW=[...new Set(G.deck)].filter(t=>CARDS[t].w),fieldW=[...new Set(live.filter(s=>CARDS[s.type].w&&s.lvl<3).map(s=>s.type))];
  for(const t of shuffle(un.slice()).slice(0,2))opts.push({w:3,o:{icon:t,col:CARDS[t].col,name:'Requisition: '+CARDS[t].name,desc:'Add a '+CARDS[t].name+' to your deck. '+CARDS[t].desc,apply(){G.deck.push(t);G.discard.push(t);}}});
  if(!G.bonus){const t=pick(un.filter(k=>CARDS[k].kind==='s'&&k!=='wall'&&k!=='mine'));if(t)opts.push({w:2,o:{icon:t,col:0xffc531,name:'Supply Drop',desc:'A free '+CARDS[t].name+' waits in your bonus slot. Place it whenever you like.',apply(){G.bonus=t;}}});}
  if(dmgd)opts.push({w:1+dmgd*.8,o:{icon:'patch',col:0xffc531,name:'Field Repairs',desc:'Every defense back to full strength. '+dmgd+' are damaged.',apply(){for(const s of G.structs){s.hp=s.max;s.heal=1;}Snd.play('repair');}}});
  opts.push({w:1.5,o:{icon:'plating',col:0x8a92c8,name:'Reinforced Plating',desc:'Defenses get +20% max HP for the rest of the run, and gain that much now.',apply(){G.up.hp+=.2;for(const s of G.structs){const m=maxHp(s);s.hp+=m-s.max;s.max=m;}}}});
  if(deckW.length){const t=pick(deckW);opts.push({w:2,o:{icon:t,col:CARDS[t].col,name:CARDS[t].name+' Tuning',desc:'+25% damage for every '+CARDS[t].name+' for the rest of the run.',apply(){G.up.dmg[t]=(G.up.dmg[t]||0)+.25;}}});}
  if(fieldW.length){const t=pick(fieldW),n=live.filter(s=>s.type===t&&s.lvl<3).length;
    opts.push({w:2,o:{icon:'overclock',col:0x5dff9b,name:'Field Upgrade',desc:'Every '+CARDS[t].name+' on the rock gains a level ('+n+' in place).',apply(){for(const s of G.structs)if(s.type===t&&s.lvl<3){s.lvl++;const m=maxHp(s);s.hp+=m-s.max;s.max=m;s.flash=1;}}}});}
  opts.push({w:1.2,o:{icon:'battery',col:0xb36bff,name:'Charge Cells',desc:'+1 max energy and +2 energy at the start of every wave.',apply(){G.up.eMax++;G.up.waveE+=2;}}});
  if(G.hull<hullMax()*.85)opts.push({w:1.4+(1-G.hull/hullMax())*3,o:{icon:'hull',col:0xff8a3d,name:'Hull Patch',desc:'The engineers patch the ship: +40% hull.',apply(){G.hull=Math.min(hullMax(),G.hull+hullMax()*.4);}}});
  const v=Math.round(35*(1+.3*G.site));opts.push({w:.8,o:{icon:'scrap',col:0xffc531,name:'Salvage Haul',desc:'+'+v+' scrap to spend at the next refit.',apply(){G.scrap+=v;}}});
  const out=[];while(out.length<3&&opts.length){let tot=0;for(const c of opts)tot+=c.w;let r=Math.random()*tot,k=0;for(;k<opts.length-1;k++){r-=opts[k].w;if(r<=0)break;}out.push(opts[k].o);opts.splice(k,1);}
  return out;
}
let newUnlocks=[];
function siteDone(){
  state='liftoff';G.anim=0;closeInfo();sel=-1;renderHand();
  const bonus=Math.round(40*(G.site+1)*DF().scrap);G.scrap+=bonus;G.stats.scrap+=bonus;G.stats.sites++;G.siteBonus=bonus;
  newUnlocks=(UNLOCKS[G.site]||[]).filter(t=>!S.unlocked.includes(t));S.unlocked.push(...newUnlocks);
  // Record the result now, so closing the app during the liftoff can't lose it.
  if(G.site>=SITES.length-1){S.run=null;S.runs++;S.wins++;G.counted=true;save();}else saveRun('refit');
  banner('Repairs complete','Site '+(G.site+1)+' held',false);Snd.play('clear');Snd.play('lift');Mus.play('calm',G.site);releaseWake();refreshPhaseUI();
}
function afterLiftoff(){if(G.site>=SITES.length-1)runOver(true);else goRefit();}
function shipDown(){
  if(G.over)return;G.over=true;state='over';G.anim=0;sel=-1;closeInfo();S.run=null;S.runs++;G.counted=true;S.best=Math.max(S.best,G.stats.waves);save();chain(0,0,.8,16,1.3,2.2,null);Snd.play('die');Mus.stop();vibe([60,40,120]);shake(1);refreshPhaseUI();
}
function runOver(win){
  if(!G.counted){S.runs++;if(win)S.wins++;}G.counted=false;S.run=null;S.best=Math.max(S.best,G.stats.waves);save();
  state='result';$('hud').hidden=true;releaseWake();Mus.play('calm',G.site);
  const r=$('result');r.className='screen dim '+(win?'win':'lose');
  $('rEye').textContent=win?'Run complete · '+DF().name:'Site '+(G.site+1)+' · '+G.L.name;
  $('rTitle').textContent=win?'The fleet is whole':'Ship lost';
  $('rSub').textContent=win?'All five rocks held. The frigate limps home with everyone aboard.':'The wreck went up with the crew still welding. Every run starts fresh, but your unlocked cards stay.';
  const rows=[['Sites held',G.stats.sites+' / '+SITES.length],['Waves held',fmt(G.stats.waves)],['Aliens destroyed',fmt(G.stats.kills)],['Defenses built',fmt(G.stats.built)],['Defenses lost',fmt(G.stats.lost)],['Scrap salvaged',fmt(G.stats.scrap)]];
  $('rRows').innerHTML=rows.map((x,k)=>'<dt'+(k===rows.length-1?' class="tot"':'')+'>'+x[0]+'</dt><dd'+(k===rows.length-1?' class="tot"':'')+'>'+x[1]+'</dd>').join('');
  $('rUnl').hidden=!newUnlocks.length;$('rUnl').innerHTML=newUnlocks.length?'New cards in the pool: <b>'+newUnlocks.map(t=>CARDS[t].name).join(', ')+'</b>':'';
  hideScreens();r.hidden=false;
}

/* ================================================================ REFIT (between sites) */
const REFIT={
  hull:{name:'Hull Plating',desc:'+60 ship hull for the rest of the run.',cost:[60,110,170],lv:()=>G.up.hull,buy(){G.up.hull++;}},
  cap:{name:'Capacitor Bank',desc:'+1 max energy, and you start each site with 1 more.',cost:[70,140],lv:()=>G.up.cap,buy(){G.up.cap++;G.up.eMax++;}},
  armor:{name:'Armor Weave',desc:'Every defense gets +15% max HP.',cost:[80,150],lv:()=>G.up.armor,buy(){G.up.armor++;G.up.hp+=.15;}},
  reactor:{name:'Reactor Tuning',desc:'Energy recharges 15% faster during waves.',cost:[80,150],lv:()=>Math.round((G.up.regen-1)/.15),buy(){G.up.regen+=.15;}},
};
const MK_COST=[70,140],cardPrice=t=>15+CARDS[t].cost*10,removePrice=()=>30+15*G.up.removes;
function goRefit(){
  state='refit';clearWorld();$('hud').hidden=true;G.structs=[];occ.fill(null);
  if(!G.shop||G.shop.site!==G.site){const pool=shuffle(S.unlocked.slice());G.shop={site:G.site,offers:pool.slice(0,3).map(t=>({t,sold:false}))};}
  hideScreens();$('refit').hidden=false;renderRefit();saveRun('refit');releaseWake();
}
function renderRefit(){
  const n=G.site+1,L=SITES[n];$('fScrap').textContent=fmt(G.scrap);
  $('fNext').innerHTML='<div class="eyebrow">Next jump · Site '+(n+1)+' of '+SITES.length+'</div><div class="sec-name">'+L.name+'</div><div class="sec-meta">'+L.waves+' waves · Final wave: '+BOSSES[L.boss].name+(L.meteors?' · Meteor showers':'')+'</div>';
  const btn=(act,key,label,cost,dis)=>'<button class="buy" data-act="'+act+'" data-key="'+key+'"'+(dis||cost>G.scrap?' disabled':'')+'>'+label+'</button>';
  const pips=(l,m)=>'<span class="pips" aria-label="Level '+l+' of '+m+'">'+Array.from({length:m},(_,k)=>'<i'+(k<l?' class="on"':'')+'></i>').join('')+'</span>';
  let h='<div class="sec-h">Requisition</div>';
  G.shop.offers.forEach((o,i)=>{const c=CARDS[o.t];h+='<div class="item"><div class="it-top"><div class="it-name">'+cardChip(o.t)+c.name+'</div><span class="cost">'+c.cost+'<i></i></span></div><div class="it-desc">'+c.desc+'</div><div class="it-act">'+
    (o.sold?'<button class="lbl" disabled>Added to deck</button>':btn('card',i,'Add to deck · '+cardPrice(o.t),cardPrice(o.t)))+'</div></div>';});
  const wt=[...new Set(G.deck)].filter(t=>CARDS[t].w);
  if(wt.length){h+='<div class="sec-h">Weapon marks</div>';
    for(const t of wt){const l=G.up.mk[t]||0,nx=l<2?MK_COST[l]:null;
      h+='<div class="item"><div class="it-top"><div class="it-name">'+CARDS[t].name+' Mk '+['I','II','III'][l]+'</div>'+pips(l,2)+'</div><div class="it-desc">Each mark: +30% damage and +0.3 range for every '+CARDS[t].name+'.</div><div class="it-act">'+
        (nx!=null?btn('mk',t,'Mk '+['II','III'][l]+' · '+nx,nx):'<button class="lbl" disabled>Maxed</button>')+'</div></div>';}}
  h+='<div class="sec-h">Ship &amp; crew</div>';
  for(const k in REFIT){const d=REFIT[k],l=d.lv(),m=d.cost.length,nx=l<m?d.cost[l]:null;
    h+='<div class="item"><div class="it-top"><div class="it-name">'+d.name+'</div>'+pips(l,m)+'</div><div class="it-desc">'+d.desc+'</div><div class="it-act">'+(nx!=null?btn('up',k,'Upgrade · '+nx,nx):'<button class="lbl" disabled>Maxed</button>')+'</div></div>';}
  const counts={};for(const t of G.deck)counts[t]=(counts[t]||0)+1;
  h+='<div class="sec-h">Your deck · '+G.deck.length+' cards</div><div class="item"><div class="it-desc">Thinner decks draw your best cards more often. Removing costs '+removePrice()+' scrap'+(G.deck.length<=6?'. Six cards is the minimum.':'.')+'</div><div class="deck">'+
    Object.keys(counts).map(t=>'<div class="dk">'+cardChip(t)+'<span>'+CARDS[t].name+' ×'+counts[t]+'</span>'+btn('rm',t,'Remove',removePrice(),G.deck.length<=6)+'</div>').join('')+'</div></div>';
  $('fList').innerHTML=h;$('fJump').textContent='Jump to site '+(n+1);
}
function refitAct(act,key){
  if(act==='up'){const d=REFIT[key],l=d.lv();if(l<d.cost.length&&G.scrap>=d.cost[l]){G.scrap-=d.cost[l];d.buy();Snd.play('buy');}}
  else if(act==='mk'){const l=G.up.mk[key]||0;if(l<2&&G.scrap>=MK_COST[l]){G.scrap-=MK_COST[l];G.up.mk[key]=l+1;Snd.play('buy');}}
  else if(act==='card'){const o=G.shop.offers[+key];if(o&&!o.sold&&G.scrap>=cardPrice(o.t)){G.scrap-=cardPrice(o.t);o.sold=true;G.deck.push(o.t);Snd.play('buy');}}
  else if(act==='rm'){const i=G.deck.indexOf(key);if(i>=0&&G.deck.length>6&&G.scrap>=removePrice()){G.scrap-=removePrice();G.deck.splice(i,1);G.up.removes++;Snd.play('click');}}
  saveRun('refit');renderRefit();
}

/* ================================================================ SAVE / RESUME A RUN */
function snap(phase){return{phase,site:G.site,wave:G.wave,diff:G.diff,seed:G.seed,deck:G.deck.slice(),draw:G.draw.slice(),hand:G.hand.slice(),bonus:G.bonus,discard:G.discard.slice(),
  energy:G.energy,scrap:G.scrap,hull:G.hull,repair:G.repair,up:JSON.parse(JSON.stringify(G.up)),plan:G.plan,shop:G.shop,stats:Object.assign({},G.stats),
  structs:G.structs.map(s=>[s.type,s.a,s.b,s.lvl,Math.round(s.hp*10)/10])};}
function saveRun(phase){if(G.over)return;S.run=snap(phase||(state==='refit'?'refit':'build'));save();}
function continueRun(){const r=S.run;if(!r)return;
  Object.assign(G,{diff:r.diff,deck:r.deck.slice(),scrap:r.scrap,up:Object.assign(freshUp(),r.up),shop:r.shop,bonus:r.bonus,over:false,counted:false,
    stats:Object.assign({kills:0,built:0,lost:0,waves:0,scrap:0,hullLost:0,sites:0},r.stats)});
  newUnlocks=[];
  if(r.phase==='refit'){G.site=r.site;G.L=SITES[r.site];G.seed=r.seed;applyTheme(G.L);buildIsland(G.L,G.seed);goRefit();}
  else startSite(r.site,r);
}

/* ================================================================ ENGINEERS (they do the actual repairing) */
const ENG=[];for(let i=0;i<3;i++)ENG.push({x:0,y:0,tx:0,ty:0,face:0,mode:0,t:0,on:true});
function engSpot(e){const side=Math.floor(Math.random()*4),u=rand(-1.1,1.1),o=1.72;
  e.tx=side===0?o:side===1?-o:u;e.ty=side===2?o:side===3?-o:u;if(side<2)e.ty=u;}
function resetEngineers(){for(const e of ENG){engSpot(e);e.x=e.tx;e.y=e.ty;e.mode=1;e.t=rand(0,2);e.on=true;}}
function updEngineers(dt){
  const busy=state==='wave'?1.6:1;
  for(const e of ENG){if(!e.on)continue;e.t-=dt*busy;
    if(state==='liftoff'){const dx=-e.x,dy=-e.y,d=Math.hypot(dx,dy);if(d<.5){e.on=false;continue;}e.x+=dx/d*1.6*dt;e.y+=dy/d*1.6*dt;e.face=Math.atan2(dy,dx);continue;}
    if(e.mode===0){const dx=e.tx-e.x,dy=e.ty-e.y,d=Math.hypot(dx,dy);if(d<.05){e.mode=1;e.t=rand(2,4.5);}else{e.x+=dx/d*Math.min(d,.75*dt);e.y+=dy/d*Math.min(d,.75*dt);e.face=Math.atan2(dy,dx);}}
    else{const ang=Math.atan2(-e.y,-e.x);e.face=turnTo(e.face,ang,dt*6);
      if(Math.random()<dt*(state==='wave'?14:5)){const c=Math.cos(e.face),s=Math.sin(e.face);part(e.x+c*.16,e.y+s*.16,.32,rand(-1,1),rand(-1,1),rand(0,1.6),.25,.12,.02,Math.random()<.5?COL.hot:COL.cyan,0,2,6);if(state==='wave')Snd.play('weld');}
      if(e.t<=0){engSpot(e);e.mode=0;}}}
}

/* ================================================================ STEP */
function step(dt){
  const live=state==='wave';
  if(live){G.wt+=dt;updateSpawner();G.energy=Math.min(eMax(),G.energy+dt/3.2*G.up.regen);}
  navT-=dt;if(navDirty||navT<=0)buildNav();
  for(const e of EN)if(e.alive)updEnemy(e,dt);separate(dt);
  for(const s of G.structs.slice())if(!s.dead)updStruct(s,dt,live);
  updShipGun(dt,live);
  // defense projectiles
  for(let i=pb.n-1;i>=0;i--){
    pb.life[i]-=dt;
    if(pb.home[i]){let t=pb.tgt[i]>=0?EN[pb.tgt[i]]:null;if(!t||!t.alive||t.uid!==pb.tuid[i]){t=findEnemy(pb.x[i],pb.y[i],5,true);pb.tgt[i]=t?t.idx:-1;pb.tuid[i]=t?t.uid:0;}
      const sp=Math.min(11,Math.hypot(pb.vx[i],pb.vy[i])+dt*14);let a=Math.atan2(pb.vy[i],pb.vx[i]);
      if(t){a+=clamp(angDiff(a,Math.atan2(t.y-pb.y[i],t.x-pb.x[i])),-6*dt,6*dt);pb.z[i]+=((t?t.z:.8)-pb.z[i])*Math.min(1,dt*2);}
      pb.vx[i]=Math.cos(a)*sp;pb.vy[i]=Math.sin(a)*sp;if(Math.random()<.6)part(pb.x[i],pb.y[i],pb.z[i],0,0,0,.35,.2,.05,COL.orange,0,0);}
    pb.x[i]+=pb.vx[i]*dt;pb.y[i]+=pb.vy[i]*dt;
    let dead=pb.life[i]<=0||Math.abs(pb.x[i])>13||Math.abs(pb.y[i])>13;
    if(!dead){const x=pb.x[i],y=pb.y[i];
      for(const e of EN){if(!e.alive)continue;const dx=e.x-x,dy=e.y-y,r=e.r+.14;if(dx*dx+dy*dy<r*r){
        const k=pb.kind[i],c=PB_VIS[k][0];
        if(pb.splash[i]){const R=pb.splash[i];for(const o of EN)if(o.alive&&(o.x-x)**2+(o.y-y)**2<(R+o.r)**2)hurtEnemy(o,pb.dmg[i]);boom(x,y,e.z,.6,COL.orange,1);}
        else{hurtEnemy(e,pb.dmg[i]);sparks(x,y,pb.z[i],2,c,3.5,.18,.18);}dead=true;break;}}}
    if(dead)rmSoa(pb,i);
  }
  // alien bullets: a shield dome they fly into soaks them up; otherwise they hit whatever blocking tile they cross first
  const domes=G.structs.filter(s=>s.type==='dome'&&s.up);
  for(let i=eb.n-1;i>=0;i--){
    eb.t[i]+=dt;
    if(eb.cv[i]&&eb.t[i]<2.4){const a=eb.cv[i]*dt,c=Math.cos(a),s=Math.sin(a),vx=eb.vx[i];eb.vx[i]=vx*c-eb.vy[i]*s;eb.vy[i]=vx*s+eb.vy[i]*c;}
    eb.x[i]+=eb.vx[i]*dt;eb.y[i]+=eb.vy[i]*dt;const x=eb.x[i],y=eb.y[i];
    if(eb.t[i]>6||Math.abs(x)>13||Math.abs(y)>13){rmSoa(eb,i);continue;}
    let soaked=false;
    for(const d of domes){if(!d.up)continue;const R2=domeR(d)**2,px=x-eb.vx[i]*dt-d.x,py=y-eb.vy[i]*dt-d.y;
      if((x-d.x)**2+(y-d.y)**2<R2&&px*px+py*py>=R2){d.sh-=eb.dmg[i];d.shT=0;d.hitF=1;sparks(x,y,.7,4,COL.blue,2.5,.18,.22);Snd.play('absorb');
        if(d.sh<=0){d.sh=0;d.up=false;part(d.x,d.y,.6,0,0,0,.5,domeR(d)*2,.3,COL.blue,1,0);sparks(d.x,d.y,.8,14,COL.blue,4,.25,.4);Snd.play('shdown');}
        soaked=true;break;}}
    if(soaked){rmSoa(eb,i);continue;}
    const a=tileOf(x),b=tileOf(y);if(!inNav(a,b))continue;const j=ti(a,b);
    if(kind[j]===SHIP){hurtShip(eb.dmg[i],x,y);sparks(x,y,.7,4,EBC[eb.c[i]],3,.2,.22);rmSoa(eb,i);continue;}
    const s=occ[j];if(blocks(s)){hurtS(s,eb.dmg[i]);sparks(x,y,.7,4,EBC[eb.c[i]],3,.2,.22);rmSoa(eb,i);}
  }
  updMeteors(dt);
  for(let i=beams.length-1;i>=0;i--){beams[i].t-=dt;if(beams[i].t<=0)beams.splice(i,1);}
  for(let i=arcs.length-1;i>=0;i--){arcs[i].t-=dt;if(arcs[i].t<=0)arcs.splice(i,1);}
  for(let i=booms.length-1;i>=0;i--){const b=booms[i];b.t-=dt;if(b.t<=0){boom(b.x,b.y,b.z,b.s,b.c,Math.floor(rand(0,10)));booms.splice(i,1);}}
  // salvage and energy drifting home to the ship
  for(const p of PK){if(!p.alive)continue;p.t+=dt;
    if(p.t<.35){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=8*dt;if(p.z<.3){p.z=.3;p.vz=Math.abs(p.vz)*.4;}}
    else{const dx=-p.x,dy=-p.y,dz=1-p.z,d=Math.hypot(dx,dy,dz),sp=4+p.t*10;if(d<.35){p.alive=false;Snd.play(p.type?'energy':'credit');continue;}
      p.x+=dx/d*sp*dt;p.y+=dy/d*sp*dt;p.z+=dz/d*sp*dt;}}
  updEngineers(dt);updFx(dt);
  if(live&&!G.spawnQ.length&&!anyAlive()&&!meteors.length)waveClear();
  if(state==='cleared'){G.anim+=dt;if(G.anim>1.6)showPick();}
  else if(state==='liftoff'){G.anim+=dt;G.shipLift=G.anim<1.1?0:Math.pow((G.anim-1.1)/2.3,2)*16;
    if(G.anim>1&&G.anim<3.4&&Math.random()<dt*20)smoke(rand(-1,1),rand(-1,1),.2,1,.5);if(G.anim>3.6){flash();afterLiftoff();}}
  else if(state==='over'){G.anim+=dt;if(G.anim>1.2&&!G.wreckGone){G.wreckGone=true;boom(0,0,.8,4,COL.hot,9);boom(.3,.2,1,3,COL.orange,6);}
    if(G.anim>3.4){G.wreckGone=false;runOver(false);}}
}
function updFx(dt){
  for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){rmSoa(pt,i);continue;}
    const dr=Math.max(0,1-pt.dr[i]*dt);pt.vx[i]*=dr;pt.vy[i]*=dr;pt.vz[i]=pt.vz[i]*dr-pt.gz[i]*dt;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;pt.z[i]=Math.max(.02,pt.z[i]+pt.vz[i]*dt);}
  for(let i=sm.n-1;i>=0;i--){sm.l[i]-=dt;if(sm.l[i]<=0){rmSoa(sm,i);continue;}sm.x[i]+=sm.vx[i]*dt;sm.y[i]+=sm.vy[i]*dt;sm.z[i]+=sm.vz[i]*dt;}
  for(let i=db.n-1;i>=0;i--){db.l[i]-=dt;if(db.l[i]<=0){rmSoa(db,i);continue;}
    db.x[i]+=db.vx[i]*dt;db.y[i]+=db.vy[i]*dt;db.z[i]+=db.vz[i]*dt;db.vz[i]-=11*dt;
    const a=tileOf(db.x[i]),b=tileOf(db.y[i]);if(db.z[i]<.05&&inNav(a,b)&&kind[ti(a,b)]!==VOID){db.z[i]=.05;db.vz[i]=Math.abs(db.vz[i])*.35;db.vx[i]*=.6;db.vy[i]*=.6;db.wx[i]*=.5;db.wy[i]*=.5;}
    db.rx[i]+=db.wx[i]*dt;db.ry[i]+=db.wy[i]*dt;db.rz[i]+=db.wz[i]*dt;}
  cam.shake*=Math.exp(-dt*7);G.shipFlash=Math.max(0,G.shipFlash-dt*5);
}

/* ================================================================ DRAW */
const _tmp=[0,0,0],_v2=new T.Vector3();
const easeBack=t=>{const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2);};
const hpCol=f=>f>.6?COL.green:f>.3?COL.yellow:COL.red;
const onLand=(x,y)=>{const a=tileOf(x),b=tileOf(y);return inNav(a,b)&&kind[ti(a,b)]!==VOID;};
// Offset a billboard sideways on screen by k world units (camera right).
const sideX=(x,k)=>x+CR.x*k, sideY=(y,k)=>y+CR.y*k;
function draw(dt,now){
  placeCam();const tt=now*.001;
  // void rocks
  for(let i=0;i<VR_N;i++){const r=voidRocks[i];r.rx+=dt*r.w;r.ry+=dt*r.w*.7;_m4.compose(_p.set(r.x,r.y,r.z+Math.sin(tt*.6+r.ph)*.25),_q.setFromEuler(_e.set(r.rx,r.ry,0)),_s.setScalar(r.s));voidMesh.setMatrixAt(i,_m4);}
  voidMesh.instanceMatrix.needsUpdate=true;
  for(const [x,y] of crystals)fx.push(x,y+.2,.45,0,1.1,1.1,0,.22+Math.sin(tt*2+x)*.06,rgb(G.L.crys));
  // defenses
  for(const k in SMESH){SMESH[k].base.n=0;if(SMESH[k].head)SMESH[k].head.n=0;}
  for(const s of G.structs){const MM=SMESH[s.type],b=MM.base;if(b.n>=b.cap)continue;
    const pop=s.built<1?Math.max(.01,easeBack(s.built)):1,drop=(1-Math.min(1,s.built*1.4))*1.5;
    _m4.compose(_p.set(s.x,s.y,drop),_q.identity(),_s.setScalar(pop));const i=b.n++;b.m.setMatrixAt(i,_m4);b.fl.array[i]=s.flash;
    if(MM.head){const h=MM.head,hz=SGEO[s.type].hz;let rz=s.rot-PI/2,z=hz+drop,ox=0,oy=0;
      if(s.type==='pylon'){z+=Math.sin(s.t*2)*.06;rz=s.t*1.2;}
      else if(s.type==='bay'){rz=s.t*3;ox=Math.cos(s.t*1.5)*.3;oy=Math.sin(s.t*1.5)*.3;z+=Math.sin(s.t*3)*.05;}
      else{const rc=s.recoil*.07;ox=-Math.cos(s.rot)*rc;oy=-Math.sin(s.rot)*rc;}
      _m4.compose(_p.set(s.x+ox,s.y+oy,z),_q.setFromEuler(_e.set(0,0,rz)),_s.setScalar(pop));const j=h.n++;h.m.setMatrixAt(j,_m4);h.fl.array[j]=s.flash;}
    uiG.push(s.x+.06,s.y-.1,.012,0,1.1,1.1,10,.3,COL.shadow);
    if(s.guard)uiG.push(s.x,s.y,.02,0,1.02,1.02,12,.35+Math.sin(tt*3)*.1,COL.green);
    if(s.type==='pylon')fx.push(s.x,s.y,.05,0,3.1,3.1,11,.18+Math.sin(tt*2.4)*.06,COL.green);
    if(s.type==='mine')fx.push(s.x,s.y,.16,0,.5,.5,0,.5+.5*Math.sin(tt*6+s.id),COL.red);
    if(s.type==='dome'&&s.up&&s.built>=1){const R=domeR(s),k=s.sh/domeMax(s),f=s.hitF;
      fx.push(s.x,s.y,.55,0,R*2,R*2,1,.22+.25*k+.5*f,COL.blue);fx.push(s.x,s.y,.55,0,R*2.1,R*2.1,0,.05+.06*k+.2*f,COL.blue);
      uiG.push(s.x,s.y,.02,0,R*2,R*2,11,.35+.3*f,COL.blue);}
    if(s.heal>0&&Math.random()<dt*10)part(s.x+rand(-.3,.3),s.y+rand(-.3,.3),.3,0,0,rand(.8,1.6),.5,.16,.04,COL.gold,0,1,0);
    const top=(SGEO[s.type].hz||.55)+.55;
    if(s.hp<s.max-.5&&s.built>=1){const f=s.hp/s.max;uiT.push(s.x,s.y,top,0,.62,.09,3,f,hpCol(f));}
    if(s.type==='dome'&&s.sh<domeMax(s)-.5)uiT.push(s.x,s.y,top+.13,0,.62,.09,3,s.sh/domeMax(s),s.up?COL.blue:COL.dark);
    for(let l=1;l<s.lvl;l++)fx.push(sideX(s.x,(l-1.5)*.16+.08),sideY(s.y,(l-1.5)*.16+.08),top+.14,0,.18,.18,0,1,COL.gold);
  }
  for(const k in SMESH){for(const M_ of [SMESH[k].base,SMESH[k].head]){if(!M_)continue;M_.m.count=M_.n;M_.m.instanceMatrix.needsUpdate=true;M_.fl.needsUpdate=true;}}
  // the wreck
  const repair=state==='wave'?(G.wave+clamp(G.killed/Math.max(1,G.total),0,1)*.95)/G.L.waves:G.repair;
  shipG.visible=!(state==='over'&&G.wreckGone)&&!(state==='result'||state==='refit');wreckage.visible=state!=='result'&&state!=='refit';
  if(shipG.visible){
    const lift=G.shipLift||0,lv=state==='liftoff'?clamp(G.anim-.6,0,1):0,sink=state==='over'?Math.min(.4,G.anim*.3):0;
    shipG.position.set(0,0,lift-sink);shipG.rotation.z=SHIP_BASE.rz;shipIn.rotation.set(lerp(SHIP_BASE.rx,0,lv)+(state==='liftoff'&&G.anim<1.1?Math.sin(tt*40)*.01:0),lerp(SHIP_BASE.ry,0,lv),0);
    shipMat.userData.flash.value=G.shipFlash*.7;shipG.updateMatrixWorld(true);
    shipGun.position.set(GUN.x,GUN.y,GUN.z+lift-sink);shipGun.rotation.set(0,0,G.gunRot-PI/2);shipGun.visible=true;
    const eg=state==='liftoff'?1.2+lv:.25+repair*.6;
    for(const sx of [-.34,.34]){_v2.set(sx,-2.05,.46).applyMatrix4(shipIn.matrixWorld);const fl=.8+Math.random()*.4;
      fx.push(_v2.x,_v2.y,_v2.z,0,.5*eg*fl,.5*eg*fl,0,.9,COL.orange);fx.push(_v2.x,_v2.y,_v2.z,0,.25*eg,.25*eg,0,.9,COL.hot);
      if(state==='liftoff'&&G.anim>1)bline(fx,_v2.x,_v2.y,_v2.z,_v2.x,_v2.y,_v2.z-2.5*lv,.5,2,.8,COL.orange);}
    if(state!=='liftoff'&&Math.random()<dt*(1-repair)*7){_v2.set(rand(-.3,.5),rand(-1,.6),.8).applyMatrix4(shipIn.matrixWorld);smoke(_v2.x,_v2.y,_v2.z,.9,.55);}
    if(state!=='liftoff'&&Math.random()<dt*(1-repair)*3){_v2.set(.55,-.4,.4).applyMatrix4(shipIn.matrixWorld);sparks(_v2.x,_v2.y,_v2.z,2,COL.hot,2,.12,.3);}
    if(lift<4)uiG.push(.2,-.3,.012,0,4.6*(1-lift/6),3.4*(1-lift/6),10,.45,COL.shadow);
  }else shipGun.visible=false;
  // engineers
  engMesh.n=0;for(const e of ENG){if(!e.on||state==='result'||state==='refit'||(state==='over'&&G.wreckGone))continue;const i=engMesh.n++;const hop=e.mode===0?Math.abs(Math.sin(tt*12+e.x))*.04:0;
    _m4.compose(_p.set(e.x,e.y,hop),_q.setFromEuler(_e.set(0,0,e.face-PI/2)),_s.setScalar(1));engMesh.m.setMatrixAt(i,_m4);engMesh.fl.array[i]=0;
    uiG.push(e.x,e.y,.012,0,.32,.32,10,.4,COL.shadow);}
  engMesh.m.count=engMesh.n;engMesh.m.instanceMatrix.needsUpdate=true;
  // aliens
  for(const k in EMESH)EMESH[k].n=0;
  for(const e of EN){if(!e.alive)continue;const bob=Math.sin(e.t*2.6+e.uid)*.08,lg=e.lunge*.2,x=e.x+Math.cos(e.face)*lg,y=e.y+Math.sin(e.face)*lg,z=e.z+bob;
    if(onLand(e.x,e.y))uiG.push(e.x+z*.1,e.y-z*.2,.015,0,e.r*2.4,e.r*2.4,10,.4,COL.shadow);
    if(e.model){const g=e.model.group;g.position.set(x,y,z);g.rotation.set(0,0,e.face+PI/2);e.mat.userData.flash.value=e.flash;
      fx.push(x,y,z,0,e.r*3.2,e.r*3.2,0,.25,COL.pink);continue;}
    const MM=EMESH[e.type];if(MM.n>=MM.cap)continue;const i=MM.n++;
    _m4.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(0,0,e.spin?e.spinA:e.face-PI/2)),_s.setScalar(e.d.scale));MM.m.setMatrixAt(i,_m4);MM.fl.array[i]=e.flash;
    if(e.type==='elite'||e.type==='drone')fx.push(x,y,z,0,e.r*3,e.r*3,0,.25,e.type==='elite'?COL.pink:COL.orange);
    if(e.max>=15&&e.hp<e.max)uiT.push(x,y,z+e.r+.35,0,Math.min(1.2,.4+e.r*.7),.08,3,e.hp/e.max,COL.pink);}
  // meteors falling, with a warning circle where they land
  for(const m of meteors){const MM=EMESH.rock;if(MM.n>=MM.cap)break;const z=m.t*7,i=MM.n++;
    _m4.compose(_p.set(m.x+m.t*1.2,m.y-m.t*.6,z),_q.setFromEuler(_e.set(m.rx,m.ry,0)),_s.setScalar(.8));MM.m.setMatrixAt(i,_m4);MM.fl.array[i]=0;
    bline(fx,m.x+m.t*1.2,m.y-m.t*.6,z,m.x+m.t*1.2+1.5,m.y-m.t*.6-.75,z+8.75,.6,2,.6,COL.orange);
    const k=1-m.t/1.8;fx.push(m.x,m.y,.04,0,2.1,2.1,11,.4+k*.6*(.6+.4*Math.sin(tt*20)),COL.red);uiG.push(m.x,m.y,.02,0,2*k,2*k,10,.35,COL.red);}
  for(const k in EMESH){const MM=EMESH[k];MM.m.count=MM.n;MM.m.instanceMatrix.needsUpdate=true;MM.fl.needsUpdate=true;}
  // projectiles
  for(let i=0;i<pb.n;i++){const v=PB_VIS[pb.kind[i]];if(pb.kind[i]===4){fx.push(pb.x[i],pb.y[i],pb.z[i],0,.45,.45,0,.9,COL.orange);fx.push(pb.x[i],pb.y[i],pb.z[i],0,.18,.18,0,1,COL.hot);continue;}
    fx.push(pb.x[i],pb.y[i],pb.z[i],sAng(pb.vx[i],pb.vy[i],0)-PI/2,v[1],v[2],2,1,v[0]);}
  for(const b of beams){const k=b.t/b.m;bline(fx,b.x1,b.y1,b.z1,b.x2,b.y2,b.z2,b.w*2.2*k,2,.8*k,b.c);bline(fx,b.x1,b.y1,b.z1,b.x2,b.y2,b.z2,b.w*.7*k,2,k,COL.hot);
    fx.push(b.x1,b.y1,b.z1,0,.9*k,.9*k,0,1,COL.white);}
  for(const a of arcs){const k=a.t/a.m;for(let j=0;j<a.pts.length-1;j++){const p=a.pts[j],q=a.pts[j+1];let px=p[0],py=p[1],pz=p[2];
    for(let s=1;s<=4;s++){const u=s/4,j2=s<4?.22:0,nx=lerp(p[0],q[0],u)+rand(-j2,j2),ny=lerp(p[1],q[1],u)+rand(-j2,j2),nz=lerp(p[2],q[2],u)+rand(-j2,j2)*.5;
      bline(fx,px,py,pz,nx,ny,nz,.22*k+.06,2,1,COL.blue);bline(fx,px,py,pz,nx,ny,nz,.07,2,k,COL.white);px=nx;py=ny;pz=nz;}
    fx.push(q[0],q[1],q[2],0,.7*k,.7*k,0,.9,COL.blue);}}
  for(let i=0;i<eb.n;i++){const bg=eb.big[i],c=EBC[eb.c[i]];
    if(bg===2){fx.push(eb.x[i],eb.y[i],.7,0,.55,.55,0,.5,c);ebR.push(eb.x[i],eb.y[i],.7,sAng(eb.vx[i],eb.vy[i],0)-PI/2,.32,.72,0,1,c);}
    else ebR.push(eb.x[i],eb.y[i],.7,0,bg?.8:.55,bg?.8:.55,0,1,c);
    if(onLand(eb.x[i],eb.y[i]))uiG.push(eb.x[i]+.07,eb.y[i]-.14,.015,0,.3,.3,10,.25,COL.shadow);}
  // particles, smoke, debris, pickups
  for(let i=0;i<pt.n;i++){const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_tmp[0]=pt.r[i];_tmp[1]=pt.g[i];_tmp[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_tmp);}
  for(let i=0;i<sm.n;i++){const k=sm.l[i]/sm.m[i];uiG.push(sm.x[i],sm.y[i],sm.z[i],0,lerp(sm.s1[i],sm.s0[i],k),lerp(sm.s1[i],sm.s0[i],k),0,sm.a[i]*Math.min(1,k*2)*Math.min(1,(1-k)*6),COL.smoke);}
  for(let i=0;i<db.n;i++){const k=db.l[i]/db.m[i];_m4.compose(_p.set(db.x[i],db.y[i],db.z[i]),_q.setFromEuler(_e.set(db.rx[i],db.ry[i],db.rz[i])),_s.setScalar(db.s[i]*Math.min(1,k*2)));
    dbMesh.setMatrixAt(i,_m4);dbMesh.setColorAt(i,DB_COL[db.c[i]|0]);}
  dbMesh.count=db.n;dbMesh.instanceMatrix.needsUpdate=true;dbMesh.instanceColor.needsUpdate=true;
  let np=0;for(const p of PK){if(!p.alive||np>=140)continue;const i=np++;_m4.compose(_p.set(p.x,p.y,p.z),_q.setFromEuler(_e.set(tt*2+p.ph,tt*3,0)),_s.setScalar(p.type?.32:.26));
    pkMesh.setMatrixAt(i,_m4);pkMesh.setColorAt(i,PK_COL[p.type]);fx.push(p.x,p.y,p.z,0,.7,.7,0,.5,p.type?COL.violet:COL.gold);}
  pkMesh.count=np;pkMesh.instanceMatrix.needsUpdate=true;if(pkMesh.instanceColor)pkMesh.instanceColor.needsUpdate=true;
  drawOverlays(tt);
  uiG.flush();fx.flush();ebR.flush();uiT.flush();
  renderer.render(scene,camera);
}
// Placement ghost, inspected range, and incoming-wave chevrons.
const _gc=new T.Color();
function drawOverlays(tt){
  ghostB.visible=ghostH.visible=false;
  if(ghost.on&&sel>=0&&(state==='build'||state==='wave')){const t=slotCard(sel),c=t&&CARDS[t];
    if(c){const ok=validAt(t,ghost.a,ghost.b)&&G.energy+1e-6>=slotCost(sel),x=ghost.a-C,y=ghost.b-C,col=ok?COL.cyan:COL.red;
      if(c.kind==='s'){const g=ghostGeo(t);ghostB.geometry=g.b;ghostB.position.set(x,y,0);ghostB.visible=true;
        if(g.h){ghostH.geometry=g.h;ghostH.position.set(x,y,SGEO[t].hz);ghostH.rotation.z=tt*.8;ghostH.visible=true;}
        ghostMat.color.copy(_gc.setRGB(ok?.75:1,ok?1:.35,ok?1:.4));
        uiG.push(x,y,.02,0,1,1,12,.9,col);
        if(c.w){const r=c.w.r+.3*(G.up.mk[t]||0);uiG.push(x,y,.025,0,r*2,r*2,11,.8,col);}
        if(c.aura)uiG.push(x,y,.025,0,c.aura*2,c.aura*2,11,.7,col);
        if(c.pd)uiG.push(x,y,.025,0,c.pd.r*2,c.pd.r*2,11,.8,col);
        if(t==='pylon')for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++)if(u||v)uiG.push(x+u,y+v,.02,0,.96,.96,12,.35,COL.green);}
      else if(t==='patch'){for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++)uiG.push(x+u,y+v,.02,0,.96,.96,12,.8,ok?COL.gold:COL.red);}
      else if(t==='overclock')uiG.push(x,y,.02,0,1,1,12,.95,ok?COL.green:COL.red);
      else if(t==='nova'){const R=c.area;uiG.push(x,y,.03,0,R*2,R*2,11,.9,COL.violet);fx.push(x,y,.04,0,R*2,R*2,11,.5+.3*Math.sin(tt*8),COL.violet);}
    }}
  if(info.s&&!info.s.dead){const s=info.s,c=CARDS[s.type];uiG.push(s.x,s.y,.02,0,1,1,12,.9,COL.cyan);
    if(c.w){const r=wStats(s).r;uiG.push(s.x,s.y,.025,0,r*2,r*2,11,.85,COL.cyan);}if(c.pd){const r=pdStats(s).r;uiG.push(s.x,s.y,.025,0,r*2,r*2,11,.85,COL.cyan);}
    if(c.aura&&s.type!=='dome')uiG.push(s.x,s.y,.025,0,c.aura*2,c.aura*2,11,.7,COL.gold);}
  if(state==='build'&&G.plan){const seen={};for(const g of G.plan.groups){if(seen[g.dir])continue;seen[g.dir]=1;const a=g.dir*PI/4,R=isleR+1.1,p=.6+.4*Math.sin(tt*4);
    for(let k=0;k<3;k++){const r=R+.55*k;fx.push(Math.cos(a)*r,Math.sin(a)*r,.05,a+PI/2,1.1,1.1,13,(g.boss?1:.85)*p*(1-k*.25),g.boss?COL.pink:COL.red);}}}
}

/* ================================================================ HUD */
const hex=c=>'#'+c.toString(16).padStart(6,'0');
const ICO={
  wall:'<g fill="currentColor"><rect x="4" y="7" width="15" height="7" rx="1"/><rect x="21" y="7" width="15" height="7" rx="1"/><rect x="4" y="16" width="8" height="7" rx="1"/><rect x="14" y="16" width="12" height="7" rx="1"/><rect x="28" y="16" width="8" height="7" rx="1"/><rect x="4" y="25" width="15" height="7" rx="1"/><rect x="21" y="25" width="15" height="7" rx="1"/></g>',
  blaster:'<g fill="currentColor"><circle cx="20" cy="27" r="9"/><rect x="14" y="4" width="4" height="19" rx="1"/><rect x="22" y="4" width="4" height="19" rx="1"/></g>',
  scatter:'<g stroke="currentColor" stroke-width="4" stroke-linecap="round" fill="none"><path d="M20 31V7M20 31L8 11M20 31L32 11"/></g><circle cx="20" cy="31" r="5" fill="currentColor"/>',
  lance:'<g fill="currentColor"><rect x="17" y="3" width="6" height="26" rx="3"/><rect x="11" y="28" width="18" height="8" rx="2"/></g><rect x="19" y="3" width="2" height="26" fill="#fff"/>',
  seeker:'<g fill="currentColor"><path d="M20 3l6 10H14z"/><rect x="15" y="13" width="10" height="16" rx="1"/><path d="M15 22l-6 9h6zM25 22l6 9h-6z"/></g>',
  tesla:'<path d="M23 3L9 22h9l-3 15 16-21h-9z" fill="currentColor"/>',
  mine:'<circle cx="20" cy="20" r="9" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 4v5M20 31v5M4 20h5M31 20h5M9 9l3 3M28 28l3 3M31 9l-3 3M9 31l3-3"/></g>',
  pylon:'<path d="M20 3l13 5v10c0 9-6 15-13 19C13 33 7 27 7 18V8z" fill="currentColor"/>',
  intercept:'<circle cx="20" cy="20" r="11" fill="none" stroke="currentColor" stroke-width="3"/><path d="M20 3v10M20 27v10M3 20h10M27 20h10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="20" r="3.5" fill="currentColor"/>',
  dome:'<path d="M5 30a15 15 0 0 1 30 0" fill="none" stroke="currentColor" stroke-width="4"/><path d="M12 30a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".6"/><rect x="3" y="30" width="34" height="5" rx="2" fill="currentColor"/>',
  bay:'<g fill="currentColor"><rect x="16" y="6" width="8" height="28" rx="2"/><rect x="6" y="16" width="28" height="8" rx="2"/></g>',
  gen:'<rect x="9" y="9" width="22" height="27" rx="3" fill="currentColor"/><rect x="15" y="4" width="10" height="5" rx="1" fill="currentColor"/><path d="M22 13l-7 10h5l-2 9 7-12h-5z" fill="#07061a"/>',
  patch:'<path d="M28 4a8 8 0 0 0-8 10L5 29l5 5 15-15a8 8 0 0 0 10-8l-5 3-4-1-1-4z" fill="currentColor"/>',
  overclock:'<g fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"><path d="M8 21l12-11 12 11"/><path d="M8 32l12-11 12 11"/></g>',
  nova:'<circle cx="20" cy="20" r="7" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 3v6M20 31v6M3 20h6M31 20h6M8 8l4 4M28 28l4 4M32 8l-4 4M8 32l4-4"/></g>',
  plating:'<path d="M6 8h28v12c0 8-6 13-14 16C12 33 6 28 6 20z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M13 14h14M13 21h14" stroke="currentColor" stroke-width="3"/>',
  battery:'<rect x="5" y="11" width="27" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="4"/><rect x="33" y="16" width="3" height="8" fill="currentColor"/><rect x="10" y="16" width="5" height="8" fill="currentColor"/><rect x="17" y="16" width="5" height="8" fill="currentColor"/>',
  hull:'<path d="M20 3l5 17 11 8v4l-11-3-2 7h-6l-2-7-11 3v-4l11-8z" fill="currentColor"/>',
  scrap:'<path d="M20 4l14 16-14 16L6 20z" fill="currentColor"/><path d="M20 11l7 9-7 9-7-9z" fill="#07061a"/>',
};
const cardChip=t=>'<svg class="chip" viewBox="0 0 40 40" style="color:'+hex(CARDS[t].col)+'" aria-hidden="true">'+ICO[t]+'</svg>';
function statLine(t){const c=CARDS[t];if(c.kind==='a')return '';const mk=G.up?G.up.mk[t]||0:0,hp=Math.round(c.hp*(G.up?G.up.hp:1));
  if(c.pd)return '<span class="st">HP '+hp+' · Range '+c.pd.r.toFixed(1)+'</span>';
  if(c.shield)return '<span class="st">HP '+hp+' · Shield '+Math.round(c.shield*(G.up?G.up.hp:1))+' · Radius '+c.aura.toFixed(1)+'</span>';
  if(!c.w)return '<span class="st">HP '+hp+'</span>';
  const d=c.w.dmg*(1+.3*mk)*(1+((G.up&&G.up.dmg[t])||0))*(c.w.n&&c.w.k!=='missile'?1:c.w.n||1),r=c.w.r+.3*mk;
  return '<span class="st">HP '+hp+' · DMG '+(Math.round(d*10)/10)+(c.w.k==='fan'?'×'+c.w.n:'')+' · Range '+r.toFixed(1)+'</span>';}
let lastHud={};
function setIf(k,v,fn){if(lastHud[k]!==v){lastHud[k]=v;fn(v);}}
function hud(){
  setIf('site',G.site,v=>$('hSite').textContent='Site '+(v+1)+' · '+SITES[v].name);
  setIf('wave',G.wave+'|'+state,()=>{const b=state==='build';$('hWave').textContent=b?'Build':'Wave '+(G.wave+1);$('hWaveOf').textContent=b?'wave '+(G.wave+1)+' of '+G.L.waves+' next':'of '+G.L.waves;});
  setIf('hull',Math.round(G.hull/hullMax()*100),v=>{$('hHull').style.transform='scaleX('+v/100+')';$('hHullW').classList.toggle('low',v<30);});
  setIf('hullN',Math.ceil(G.hull),v=>$('hHullN').textContent=v);
  const rep=state==='wave'?(G.wave+clamp(G.killed/Math.max(1,G.total),0,1)*.95)/G.L.waves:G.repair;
  setIf('rep',Math.round(rep*100),v=>{$('hRep').style.transform='scaleX('+v/100+')';$('hRepN').textContent=v+'%';});
  setIf('scrap',G.scrap,v=>$('hScrap').textContent=fmt(v));
  const em=eMax();setIf('en',Math.round(G.energy*30)+'|'+em,()=>{$('enFill').style.transform='scaleX('+(G.energy/em).toFixed(3)+')';$('enBar').style.setProperty('--n',em);});
  setIf('enI',Math.floor(G.energy+1e-6),v=>{$('enNum').textContent=v;updateHandState();});
  setIf('draw',G.draw.length,v=>$('dDraw').textContent=v);
  let b=null;for(const e of EN)if(e.alive&&e.boss){b=e;break;}
  if(b)setIf('boss',Math.round(b.hp/b.max*200),v=>{$('bossHp').style.transform='scaleX('+v/200+')';$('bossPh').textContent='Phase '+(b.ph+1)+' / '+b.boss.phases.length;});
  if(info.s)setIf('info',info.s.dead?-1:Math.round(info.s.hp)+'|'+info.s.lvl+'|'+Math.ceil(info.s.sh||0),()=>renderInfo());
  if(state==='build')placeLabels();
}
function renderHand(){
  const els=$('hand').children;
  for(let i=0;i<5;i++){const b=els[i],t=slotCard(i);
    if(i===4)b.hidden=!t;
    if(!t){b.className='card empty'+(i===4?' bonus':'');b.innerHTML='';b.disabled=true;b.removeAttribute('aria-label');continue;}
    const c=CARDS[t];b.disabled=false;b.className='card'+(i===4?' bonus':'');b.style.setProperty('--c',hex(c.col));
    b.innerHTML='<span class="cost">'+(i===4?'FREE':c.cost)+'</span><svg class="ci" viewBox="0 0 40 40" aria-hidden="true">'+ICO[t]+'</svg><b>'+(c.label||c.name)+'</b><small>'+c.short+'</small>';
    b.setAttribute('aria-label',c.name+', '+(i===4?'free':c.cost+' energy'));}
  $('dDraw').textContent=G.draw.length;updateHandState();renderTip();
}
function updateHandState(){const els=$('hand').children;for(let i=0;i<5;i++){const b=els[i];b.classList.toggle('sel',sel===i);b.classList.toggle('poor',!!slotCard(i)&&G.energy+1e-6<slotCost(i));}}
function groupsByDir(){const by={};if(!G.plan)return by;for(const g of G.plan.groups){const k=g.dir;(by[k]=by[k]||[]).push(g);}return by;}
const gName=g=>g.boss?BOSSES[g.e].name:g.n+' '+ET[g.e].name+(g.n>1?'s':'');
function renderTip(){
  const tip=$('tip');
  if(info.s){tip.hidden=true;return;}
  if(sel>=0&&slotCard(sel)&&(state==='build'||state==='wave')){const t=slotCard(sel),c=CARDS[t];
    tip.innerHTML='<div class="tt"><b style="color:'+hex(c.col)+'">'+c.name+'</b>'+statLine(t)+'</div><div class="td">'+c.desc+'</div><div class="ta"><span>'+
      (c.kind==='s'?'Tap a tile, or drag the card onto the rock':t==='patch'?'Tap the middle of the damaged area':t==='overclock'?'Tap a defense':'Tap where to strike')+'</span>'+
      (sel<4?'<button id="bSwap" type="button">Swap · 1 energy</button>':'')+'</div>';tip.hidden=false;
    const sw=$('bSwap');if(sw)sw.onclick=e=>{e.stopPropagation();swapCard(sel);};}
  else if(state==='build'){const by=groupsByDir(),parts=[];for(const k in by)parts.push(by[k].map(gName).join(' + ')+' from the '+DIRS[k]);
    tip.innerHTML='<div class="tt"><b>Incoming</b><span class="st">wave '+(G.wave+1)+' of '+G.L.waves+'</span></div><div class="td">'+parts.join('. ')+'.</div>'+
      (G.site===0&&G.wave===0&&!S.runs?'<div class="ta"><span>Tap a card, then tap a tile to build. Launch when you are ready.</span></div>':'');tip.hidden=false;}
  else tip.hidden=true;
}
function refreshPhaseUI(){
  const b=state==='build';$('bWave').hidden=!b;if(b)$('bWave').textContent='Launch wave '+(G.wave+1);
  $('bSpeed').hidden=state!=='wave';$('bSpeed').textContent=G.speed+'×';
  renderTip();buildLabels();lastHud.wave=null;
}
// Floating labels at the rim of the rock that say what is coming from each direction.
function buildLabels(){const box=$('labels');box.innerHTML='';if(state!=='build')return;const by=groupsByDir();
  for(const k in by){const d=document.createElement('div');d.className='lbl'+(by[k].some(g=>g.boss)?' boss':'');d.dataset.dir=k;d.innerHTML=by[k].map(g=>'<span>'+gName(g)+'</span>').join('');box.appendChild(d);}
  placeLabels();}
function placeLabels(){const box=$('labels');if(!box.children.length)return;const tp=$('tip'),t=(tp.hidden?$('hudTop'):tp).getBoundingClientRect().bottom,bt=$('hudBot').getBoundingClientRect().top;
  for(const d of box.children){const a=+d.dataset.dir*PI/4,R=isleR+2.7,p=toScreen(Math.cos(a)*R,Math.sin(a)*R,.3);
    const w=d.offsetWidth,h=d.offsetHeight,x=clamp(p.x-w/2,8,W-w-8),y=clamp(p.y-h/2,t+6,bt-h-6);d.style.transform='translate('+Math.round(x)+'px,'+Math.round(y)+'px)';}}
const info={s:null};
function openInfo(s){info.s=s;lastHud.info=null;$('tip').hidden=true;renderInfo();}
function closeInfo(){const was=!!info.s;info.s=null;$('info').hidden=true;if(was)renderTip();}
function renderInfo(){const s=info.s;if(!s||s.dead){closeInfo();return;}const c=CARDS[s.type];let st='HP '+Math.ceil(s.hp)+' / '+Math.round(s.max);
  if(c.w){const w=wStats(s);st+=' · DMG '+(Math.round(w.dmg*10)/10)+' · Range '+w.r.toFixed(1);}
  if(c.pd)st+=' · Range '+pdStats(s).r.toFixed(1);
  if(s.type==='dome')st+=' · Shield '+Math.ceil(s.sh)+' / '+Math.round(domeMax(s))+(s.up?'':' (down)');
  $('info').innerHTML='<div class="it-top"><div class="it-name">'+cardChip(s.type)+c.name+'</div><span class="pips">'+[1,2,3].map(k=>'<i'+(k<=s.lvl?' class="on"':'')+'></i>').join('')+'</span></div>'+
    '<div class="it-stat">'+st+(s.guard?' · <em>Guarded</em>':'')+((G.up.mk[s.type]||0)?' · Mk '+['I','II','III'][G.up.mk[s.type]]:'')+'</div><div class="it-desc">'+c.desc+'</div>';
  $('info').hidden=false;}
function toast(txt,c){const t=$('toast');t.textContent=txt;t.style.color='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';t.classList.remove('go');void t.offsetWidth;t.classList.add('go');}
function banner(eye,txt,warn){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.toggle('warn',!!warn);b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}
function deny(msg){Snd.play('deny');const d=$('deny');d.textContent=msg;d.classList.remove('go');void d.offsetWidth;d.classList.add('go');}
function flash(){const f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');}

/* ================================================================ SCREENS */
const SCREENS=['title','help','pick','refit','pause','result','settings'];
function hideScreens(){for(const s of SCREENS)$(s).hidden=true;}
let newDiff='normal',confirmNew=false,confirmReset=false,confirmQuit=false,pausedFrom=null;
function goTitle(){
  state='title';clearWorld();hideScreens();$('hud').hidden=true;$('labels').innerHTML='';closeInfo();sel=-1;
  const L=SITES[S.run?S.run.site:0];G.L=L;G.site=S.run?S.run.site:0;G.up=G.up||freshUp();G.over=false;G.repair=.35;G.shipLift=0;G.structs=[];
  applyTheme(L);buildIsland(L,(Math.random()*1e9)|0);
  for(const [t,a,b] of [['blaster',C+3,C+1],['wall',C+3,C],['wall',C+3,C-1],['scatter',C-1,C-3],['tesla',C+1,C+3],['wall',C-3,C+1]])if(kind[ti(a,b)]===LAND)addStruct(t,a,b);
  buildNav();resetEngineers();cam.zoom=1;cam.px=cam.py=0;
  $('tMain').hidden=false;$('tNewPanel').hidden=true;$('title').hidden=false;
  const c=$('tCont');c.hidden=!S.run;if(S.run)c.innerHTML='Continue run<small>Site '+(S.run.site+1)+' · '+(S.run.phase==='refit'?'refit':'wave '+(S.run.wave+1+(S.run.phase==='pick'?1:0)))+' · '+DIFF[S.run.diff].name+'</small>';
  $('tNew').className=S.run?'':'primary';
  $('tBest').textContent=S.best;$('tRuns').textContent=S.runs;$('tWins').textContent=S.wins;
  resize();Mus.play('calm',G.site);releaseWake();
}
function markDiff(){for(const b of $('tDiffs').children)b.classList.toggle('on',b.dataset.d===newDiff);$('tGo').textContent=confirmNew?'Replace run and start':'Start run';}
function renderHelp(){
  $('hCards').innerHTML=Object.keys(CARDS).map(t=>{const c=CARDS[t],u=S.unlocked.includes(t),site=unlockSite(t);
    return '<div class="item'+(u?'':' locked')+'"><div class="it-top"><div class="it-name">'+cardChip(t)+c.name+'</div><span class="cost">'+c.cost+'<i></i></span></div><div class="it-desc">'+
      (u?c.desc:'Locked. Hold site '+(site+1)+' in any run to add it to the card pool.')+'</div>'+(u&&c.kind==='s'?'<div class="it-stat">'+statLine(t)+'</div>':'')+'</div>';}).join('');
}
function pause(){if(state!=='build'&&state!=='wave')return;pausedFrom=state;state='paused';ptrs.clear();gest=null;ghost.on=false;confirmQuit=false;
  $('pTitle').textContent='Site '+(G.site+1)+' · '+(pausedFrom==='wave'?'Wave '+(G.wave+1):'Build');$('pQuit').textContent='Quit to title';$('pAban').textContent='Abandon run';
  $('pNote').textContent=pausedFrom==='wave'?'Quitting now restarts this wave next time. Your rock is saved as it was before the wave.':'Your run is saved. Continue it from the title screen.';
  hideScreens();$('pause').hidden=false;Snd.suspend();releaseWake();}
function resume(){if(state!=='paused')return;hideScreens();state=pausedFrom||'build';Snd.init();Snd.resume();last=performance.now();if(state==='wave')requestWake();}
function openSettings(from){settingsFrom=from;$(from).hidden=true;$('settings').hidden=false;confirmReset=false;renderSettings();}
let settingsFrom='title';
function closeSettings(){$('settings').hidden=true;$(settingsFrom).hidden=false;if(settingsFrom==='refit')renderRefit();}
function renderSettings(){
  for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);
  for(const sg of document.querySelectorAll('#settings .seg'))for(const b of sg.children)b.classList.toggle('on',S.set[sg.dataset.seg]===b.dataset.v);
  $('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';
}

/* ================================================================ INPUT */
// One finger: tap a card then a tile, or drag a card onto the rock. With no card selected, drag pans and a tap inspects.
// Two fingers pinch to zoom. While dragging a card the ghost sits a little above the finger so you can see it.
const ptrs=new Map(),ghost={on:false,a:0,b:0};let gest=null;
const touchOff=()=>Math.round(64*clamp(rect.height/760,.8,1.2));
const playing=()=>state==='build'||state==='wave';
function setGhost(cx,cy,off){const g=ground(cx,cy-off,0);ghost.a=tileOf(g.x);ghost.b=tileOf(g.y);ghost.on=true;}
function overHand(cy){return cy>$('hudBot').getBoundingClientRect().top+4;}
function zoomAt(cx,cy,z){const b=ground(cx,cy,0);cam.zoom=clamp(z,1,2.6);fit();placeCam();const a=ground(cx,cy,0);cam.px+=b.x-a.x;cam.py+=b.y-a.y;clampPan();placeCam();}
function clampPan(){const lim=1.5+(cam.zoom-1)*4.5,d=Math.hypot(cam.px,cam.py);if(d>lim){cam.px*=lim/d;cam.py*=lim/d;}}
function pickStruct(cx,cy){let best=null,bd=34*34;for(const s of G.structs){const p=toScreen(s.x,s.y,.35),d=(p.x-cx)**2+(p.y-cy)**2;if(d<bd){bd=d;best=s;}}
  if(best)return best;const g=ground(cx,cy,0),a=tileOf(g.x),b=tileOf(g.y);return inNav(a,b)?occ[ti(a,b)]:null;}
cv.addEventListener('pointerdown',e=>{
  if(!playing()&&state!=='pick'&&state!=='cleared')return;e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY});
  if(ptrs.size===2){const [p,q]=[...ptrs.values()];gest={mode:'pinch',d:Math.hypot(p.x-q.x,p.y-q.y),z:cam.zoom,mx:(p.x+q.x)/2,my:(p.y+q.y)/2};ghost.on=false;return;}
  if(ptrs.size>2||!playing())return;
  if(sel>=0){gest={mode:'place',id:e.pointerId,touch:e.pointerType!=='mouse',moved:false};setGhost(e.clientX,e.clientY,0);}
  else gest={mode:'tap',id:e.pointerId};
});
cv.addEventListener('pointermove',e=>{
  const q=ptrs.get(e.pointerId);
  if(!q){if(e.pointerType==='mouse'&&sel>=0&&playing())setGhost(e.clientX,e.clientY,0);return;}
  const px=q.x,py=q.y;q.x=e.clientX;q.y=e.clientY;if(!gest)return;
  if(gest.mode==='pinch'&&ptrs.size>=2){const [p,r]=[...ptrs.values()];const d=Math.hypot(p.x-r.x,p.y-r.y),mx=(p.x+r.x)/2,my=(p.y+r.y)/2;
    zoomAt(mx,my,gest.z*d/Math.max(20,gest.d));const a=ground(gest.mx,gest.my,0),b=ground(mx,my,0);cam.px-=b.x-a.x;cam.py-=b.y-a.y;clampPan();gest.mx=mx;gest.my=my;return;}
  if(gest.id!==e.pointerId)return;
  if(gest.mode==='tap'&&Math.hypot(q.x-q.sx,q.y-q.sy)>9)gest.mode='pan';
  if(gest.mode==='pan'){const a=ground(px,py,0),b=ground(q.x,q.y,0);cam.px-=b.x-a.x;cam.py-=b.y-a.y;clampPan();}
  else if(gest.mode==='place'){if(Math.hypot(q.x-q.sx,q.y-q.sy)>12)gest.moved=true;setGhost(q.x,q.y,gest.moved&&gest.touch?touchOff():0);}
});
function endPtr(e){const q=ptrs.get(e.pointerId);ptrs.delete(e.pointerId);if(!gest)return;
  if(gest.mode==='pinch'){if(ptrs.size===0)gest=null;return;}
  if(gest.id!==e.pointerId)return;const g=gest;gest=null;
  if(e.type==='pointercancel'){ghost.on=e.pointerType==='mouse'&&sel>=0;return;}
  if(g.mode==='place'&&ghost.on&&playing()){if(!overHand(q.y))play(sel,ghost.a,ghost.b);ghost.on=e.pointerType==='mouse'&&sel>=0;}
  else if(g.mode==='tap'&&playing()){const s=pickStruct(q.x,q.y);if(s&&s!==info.s){openInfo(s);Snd.play('click');}else closeInfo();}
}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'&&!ptrs.size)ghost.on=false;});
cv.addEventListener('wheel',e=>{if(!playing())return;e.preventDefault();zoomAt(e.clientX,e.clientY,cam.zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
// Cards: tap to select, or press and drag up onto the rock.
let cardDrag=null;
$('hand').addEventListener('pointerdown',e=>{const b=e.target.closest('.card');if(!b||b.disabled||!playing())return;e.preventDefault();
  const i=+b.dataset.slot;try{b.setPointerCapture(e.pointerId);}catch(_){}closeInfo();
  cardDrag={id:e.pointerId,slot:i,el:b,was:sel===i,sy:e.clientY,touch:e.pointerType!=='mouse',out:false};
  if(sel!==i){sel=i;Snd.play('card');updateHandState();renderTip();}});
$('hand').addEventListener('pointermove',e=>{const d=cardDrag;if(!d||d.id!==e.pointerId)return;
  if(!overHand(e.clientY)){d.out=true;setGhost(e.clientX,e.clientY,d.touch?touchOff():0);}else if(d.out)ghost.on=false;});
function endCard(e){const d=cardDrag;if(!d||d.id!==e.pointerId)return;cardDrag=null;
  if(e.type==='pointercancel'){ghost.on=false;return;}
  if(d.out){if(!overHand(e.clientY)&&ghost.on)play(d.slot,ghost.a,ghost.b);ghost.on=false;}
  else if(d.was){sel=-1;updateHandState();renderTip();}}
$('hand').addEventListener('pointerup',endCard);$('hand').addEventListener('pointercancel',endCard);
$('hand').addEventListener('click',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP'){if(sel>=0&&e.code==='Escape'){sel=-1;ghost.on=false;updateHandState();renderTip();}else if(playing())pause();else if(state==='paused')resume();return;}
  if(!playing())return;
  const n='12345'.indexOf(e.key);if(n>=0&&slotCard(n)){sel=sel===n?-1:n;Snd.play('card');updateHandState();renderTip();return;}
  if((e.code==='Space'||e.code==='Enter')&&state==='build'){e.preventDefault();launchWave();}
  if(e.code==='KeyF'&&state==='wave'){G.speed=G.speed===1?2:1;refreshPhaseUI();}
});
document.addEventListener('touchmove',e=>{if(!e.target.closest||!e.target.closest('.scroll'))e.preventDefault();},{passive:false});
document.addEventListener('touchstart',e=>{if(e.touches.length>1&&!e.target.closest('button'))e.preventDefault();},{passive:false});
for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>{Snd.init();},{once:true});
// Browsers skip the click for a secondary touch while another finger is down, so menu buttons activate on that pointerup themselves.
let downBtn=null;
document.addEventListener('pointerdown',e=>{downBtn=!e.isPrimary&&e.target.closest?e.target.closest('.screen button'):null;},true);
document.addEventListener('pointerup',e=>{const b=!e.isPrimary&&e.target.closest?e.target.closest('.screen button'):null;if(b&&b===downBtn&&!b.disabled){e.preventDefault();b.click();}downBtn=null;},true);

function autoPause(){if(playing())pause();else Snd.suspend();save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else if(state!=='paused'){Snd.resume();}last=performance.now();});
window.addEventListener('pagehide',autoPause);window.addEventListener('blur',autoPause);
window.addEventListener('resize',()=>{resize();});
if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);
let wakeLock=null;
function requestWake(){try{if(navigator.wakeLock&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null;});}).catch(()=>{});}catch(e){}}
function releaseWake(){try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}

/* ----- buttons ----- */
$('bWave').onclick=()=>launchWave();
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
$('bSpeed').onclick=()=>{G.speed=G.speed===1?2:1;refreshPhaseUI();Snd.play('click');};
$('info').onclick=()=>closeInfo();
$('tCont').onclick=()=>continueRun();
$('tNew').onclick=()=>{$('tMain').hidden=true;$('tNewPanel').hidden=false;newDiff=S.diff;confirmNew=false;$('tWarn').hidden=true;markDiff();};
$('tBack').onclick=()=>{$('tMain').hidden=false;$('tNewPanel').hidden=true;};
$('tDiffs').onclick=e=>{const b=e.target.closest('button');if(!b)return;newDiff=b.dataset.d;markDiff();};
$('tGo').onclick=()=>{if(S.run&&!confirmNew){confirmNew=true;$('tWarn').hidden=false;markDiff();return;}newRun(newDiff);};
$('tHelp').onclick=()=>{$('title').hidden=true;renderHelp();$('help').hidden=false;$('hList').scrollTop=0;};
$('hClose').onclick=()=>{$('help').hidden=true;$('title').hidden=false;};
$('tSet').onclick=()=>openSettings('title');
if(window.ARCADE){$('tArc').hidden=false;$('tArc').onclick=()=>{save();location.href=window.ARCADE.home;};}
$('pkList').onclick=e=>{const b=e.target.closest('.boon');if(b)takeOffer(+b.dataset.i);};
$('pkSkip').onclick=()=>takeOffer(-1);
$('fList').onclick=e=>{const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;refitAct(b.dataset.act,b.dataset.key);};
$('fJump').onclick=()=>{startSite(G.site+1);};
$('fSet').onclick=()=>openSettings('refit');
$('pRes').onclick=resume;
$('pSet').onclick=()=>openSettings('pause');
$('pQuit').onclick=()=>{Snd.resume();if(pausedFrom==='build')saveRun();save();goTitle();};
$('pAban').onclick=()=>{if(!confirmQuit){confirmQuit=true;$('pAban').textContent='Tap again to end the run';return;}Snd.resume();G.over=true;runOver(false);};
$('rMain').onclick=()=>{goTitle();$('tNew').click();};
$('rAlt').onclick=()=>goTitle();
$('setClose').onclick=closeSettings;
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){S.set[t.dataset.set]=!S.set[t.dataset.set];Snd.apply();if(t.dataset.set==='vibe'&&S.set.vibe)vibe(30);if(t.dataset.set==='music'&&!S.set.music)Mus.stop();else if(t.dataset.set==='music')Mus.play(Mus.want?Mus.want[0]:'calm',G.site);save();renderSettings();return;}
  const b=e.target.closest('.seg button');if(b){const k=b.parentElement.dataset.seg;S.set[k]=b.dataset.v;if(k==='gfx'){gfxCap=2;applyPixelRatio();resize();}save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}
    const keep=S.set;S=fresh();S.set=keep;save();confirmReset=false;$('settings').hidden=true;goTitle();}
});

/* ================================================================ LOOP */
let last=performance.now(),perfAcc=0,perfN=0,slowFor=0;
const SIM={build:1,wave:1,cleared:1,liftoff:1,over:1,pick:1};
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(document.hidden||state==='paused')return;
  if(SIM[state]){const sdt=dt*(state==='wave'?G.speed:1),steps=Math.max(1,Math.ceil(sdt/(1/40)));for(let i=0;i<steps;i++)step(sdt/steps);if(SIM[state])hud();
    if(S.set.gfx==='auto'){perfAcc+=dt;perfN++;if(perfN>=30){const avg=perfAcc/perfN;perfAcc=0;perfN=0;
      if(avg>1/48){slowFor++;if(slowFor>=3&&pixelRatio>1){gfxCap=Math.max(1,pixelRatio-.25);applyPixelRatio();resize();slowFor=0;}}else slowFor=0;}}}
  else{updFx(dt);if(state==='title'){cam.az+=dt*.05;updEngineers(dt);for(const s of G.structs)updStruct(s,dt,false);}}
  starMat.uniforms.uTime.value+=dt;Mus.tick();
  draw(dt,now);
}

/* ================================================================ BOOT */
resize();goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
window.__wreck={get S(){return S;},G,EN,CARDS,SITES,occ,kind,D,ti,C,NAV,newRun,startSite,launchWave,play,step,waveClear,takeOffer,goRefit,refitAct,continueRun,makePlan,
  get state(){return state;},set state(v){state=v;},get sel(){return sel;},set sel(v){sel=v;},addStruct,validAt,draw,hud,showPick,cam,resize,goTitle,spawnEnemy,ghost,renderHand,openInfo,closeInfo,runOver,groundAt:ground};
})();
