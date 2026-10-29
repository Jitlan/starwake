/* Starwake: offline vertical shooter. Everything (models, sound, UI) is generated in code. */
(function(){
'use strict';
const T=THREE, TAU=Math.PI*2, PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const fmt=n=>Math.round(n).toLocaleString('en-US');
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================ SAVE */
const KEY='starwake.save.v1';
function fresh(){return{v:1,started:false,credits:0,unlocked:0,next:0,diff:'normal',best:0,cleared:0,
  lvlBest:[0,0,0,0,0],ship:{armor:1,shield:1,engine:1,gen:1},
  front:{eq:'pulse',own:{pulse:1}},side:{eq:'',own:{}},special:{eq:'bomb',own:{bomb:1}},
  set:{sfx:true,music:true,vibe:true,ctrl:'offset',gfx:'auto'},stats:{kills:0,deaths:0,sorties:0}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(k==='own'&&v&&typeof v==='object')a[k]=v;
  else if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&typeof v===typeof a[k])a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ================================================================ CATALOG */
const FRONT={
  pulse:{name:'Pulse Cannon',desc:'Twin-linked bolts. Every level adds a stream or fires faster.',buy:0,up:[0,250,600,1100,1800,2800],max:6},
  spread:{name:'Scatter Vulcan',desc:'A wide fan of light rounds. Shreds swarms, weaker up close on bosses.',buy:1200,up:[0,350,750,1300,2000,3000],max:6},
  lance:{name:'Ion Lance',desc:'Slow, heavy beams that punch through several targets in a row.',buy:2200,up:[0,450,900,1500,2300,3400],max:6},
};
const SIDE={
  twin:{name:'Twin Pods',desc:'Two wing pods that fire straight ahead alongside the main gun.',buy:600,up:[0,500,1100],max:3,col:0x5dff9b},
  seeker:{name:'Seeker Pods',desc:'Pods that launch homing darts at the nearest target.',buy:1500,up:[0,700,1400],max:3,col:0xffa12e},
  rail:{name:'Rail Pods',desc:'Angled piercing slugs that sweep both flanks.',buy:1100,up:[0,600,1200],max:3,col:0xa8d8ff},
};
const SPECIAL={
  bomb:{name:'Nova Bomb',short:'NOVA',desc:'Erases enemy fire on screen and blasts everything in view.',buy:0,up:[0,700,1500],max:3,cost:[100,90,80]},
  missiles:{name:'Swarm Missiles',short:'SWARM',desc:'A volley of homing missiles. Light on energy.',buy:1300,up:[0,700,1400],max:3,cost:[40,36,32]},
  laser:{name:'Helios Laser',short:'HELIOS',desc:'A sustained beam that burns a column and eats bullets in it.',buy:2000,up:[0,900,1800],max:3,cost:[70,65,60]},
};
const HULL={
  armor:{name:'Armor Plating',desc:'More hull points. Armor only comes back between sectors or from orange repair drops.',up:[0,400,900,1600,2600],max:5},
  shield:{name:'Shield Emitter',desc:'A bigger shield that recharges sooner after a hit.',up:[0,450,1000,1700,2700],max:5},
  engine:{name:'Engine',desc:'Higher top speed, so the ship keeps up with your thumb.',up:[0,300,700,1200,1900],max:5},
  gen:{name:'Generator',desc:'Faster energy and shield recharge.',up:[0,400,900,1500,2400],max:5},
};
const DIFF={
  easy:{name:'Easy',sp:0.75,rate:0.65,dens:0.7,dmg:0.75,cred:0.85,hp:0.85,score:0.8},
  normal:{name:'Normal',sp:1,rate:1,dens:1,dmg:1,cred:1,hp:1,score:1},
  hard:{name:'Hard',sp:1.25,rate:1.35,dens:1.35,dmg:1.25,cred:1.3,hp:1.15,score:1.3},
};
const DF=()=>DIFF[S.diff]||DIFF.normal;
function shipStats(){const s=S.ship;return{maxA:12+5*(s.armor-1),maxS:8+4*(s.shield-1),spd:11+2.6*(s.engine-1),
  en:5+2.5*(s.gen-1),sr:1.2+0.6*(s.gen-1),sd:1.9-0.15*(s.shield-1)};}
// [streams, spread, interval, damage] per power level 1..8 (levels 7-8 only reachable with in-sector boosts)
const PULSE=[[1,0,.11,1],[2,0,.1,1],[3,.1,.1,1],[4,.14,.09,1.1],[5,.18,.085,1.2],[5,.2,.075,1.35],[6,.24,.07,1.45],[7,.28,.065,1.55]];
const SPREAD=[[3,.35,.15,.9],[4,.45,.14,.9],[5,.55,.14,.95],[6,.65,.13,1],[7,.75,.12,1.05],[8,.85,.11,1.1],[9,.95,.105,1.15],[11,1.05,.1,1.2]];
const LANCE=[[1,0,.24,3],[1,0,.22,3.6],[2,0,.22,3.6],[2,0,.2,4.4],[3,0,.2,4.6],[3,0,.18,5.4],[4,0,.18,5.8],[4,0,.16,6.6]];
const SIDE_T={twin:[[.16,1],[.13,1.2],[.11,1.5]],seeker:[[.5,2.2],[.4,2.8],[.32,3.4]],rail:[[.3,1.6],[.25,2],[.2,2.4]]};
const BOMB_D=[25,40,60], BOMB_B=[35,55,80], MIS_N=[8,12,16], LAS_T=[1.6,2.2,2.8], LAS_D=[45,65,90], LAS_W=[.7,.85,1];
function dps(key,L){const t=(key==='pulse'?PULSE:key==='spread'?SPREAD:LANCE)[L-1];return Math.round(t[0]*t[3]/t[2]);}

/* ================================================================ ENEMIES, LEVELS, BOSSES (data) */
// fire spec keys: k=pattern, n=count, cd=cooldown s, sp=speed, spread=arc rad, rot=spiral rad/s, aim=aim fan at player, o=[x,y] offset, delay, c=color index
const ET={
  dart:{hp:3,r:.42,score:50,speed:5,scale:.8,fire:[{k:'aimed',cd:3.2,sp:4.6}],drop:{cr:[.3,10],pw:.015,sh:.025}},
  mite:{hp:1.5,r:.32,score:30,speed:4.6,scale:.85,fire:null,drop:{cr:[.12,10]}},
  drone:{hp:9,r:.5,score:150,speed:2.6,scale:1,spin:2.5,fire:[{k:'ring',n:7,cd:3,sp:3}],drop:{cr:[.45,15],pw:.04,sh:.06,en:.04}},
  gunship:{hp:34,r:.8,score:450,speed:2.4,scale:1,face:1,fire:[{k:'fan',n:5,spread:.85,cd:2.1,sp:4,aim:1},{k:'aimed',cd:1.3,sp:5.2}],drop:{cr:[1,40],pw:.3,sh:.3,ar:.12}},
  turret:{hp:16,r:.55,score:220,speed:1.8,scale:1,aimer:1,fire:[{k:'burst',n:3,cd:2.6,sp:5.4}],drop:{cr:[.6,20],pw:.05,sh:.08}},
  rock:{hp:12,r:.62,score:60,speed:2.4,scale:1,tumble:1,fire:null,drop:{cr:[.2,10],en:.03}},
  elite:{hp:80,r:.95,score:1000,speed:2,scale:1,spin:.8,hold:7,fire:[{k:'spiral',n:3,cd:.2,sp:3.2,rot:2.1}],drop:{cr:[1,80],pw:.5,sh:.4,ar:.2}},
};
// Waves: [time s, {f:formation, e:enemy, n:count, x:-1..1, p:path, gap:s}]. Boss arrives after the last wave clears.
const LEVELS=[
 {name:'Kepler Outskirts',bg:0x0b0a26,star:0xbfd4ff,neb:[0x3a2b9a,0x1d5c8f],planet:[0x4f7bd9,0x2a3f8f,0x9fb8ff],rate:.8,key:45,bpm:126,prog:[0,8,3,10],boss:'warden',
  waves:[[1.5,{f:'vee',e:'dart',n:5}],[5,{f:'column',e:'dart',n:6,x:-.6,p:'sine',gap:.35}],[8,{f:'column',e:'dart',n:6,x:.6,p:'sine',gap:.35}],
   [12,{f:'line',e:'drone',n:3,p:'hover'}],[16,{f:'side',e:'dart',n:7,x:-1,gap:.25}],[19,{f:'side',e:'dart',n:7,x:1,gap:.25}],
   [23,{f:'random',e:'rock',n:6,gap:.6,p:'scroll'}],[27,{f:'single',e:'gunship',p:'hover'}],[31,{f:'swarm',e:'mite',n:12,x:-.4}],
   [34,{f:'vee',e:'dart',n:7,x:.3,p:'dive'}],[38,{f:'line',e:'drone',n:4,p:'hover'}],[42,{f:'swarm',e:'mite',n:14,x:.4}],
   [45,{f:'pair',e:'gunship',p:'hover'}],[50,{f:'column',e:'dart',n:8,p:'dive',gap:.3}],[55,{f:'random',e:'rock',n:8,gap:.4,p:'scroll'}],
   [58,{f:'side',e:'dart',n:8,x:-1,gap:.2}],[58,{f:'side',e:'dart',n:8,x:1,gap:.2}],[63,{f:'line',e:'turret',n:3,p:'scroll'}]]},
 {name:'Cinder Belt',bg:0x1a0a12,star:0xffd6c0,neb:[0x8f2b2b,0x8f5a1d],planet:[0xd9734f,0x8f3a2a,0xffc59f],rate:1,key:43,bpm:132,prog:[0,5,3,10],rocks:.5,boss:'hydra',
  waves:[[1,{f:'line',e:'dart',n:5}],[4,{f:'random',e:'rock',n:6,gap:.5,p:'scroll'}],[6,{f:'side',e:'dart',n:6,x:-1,gap:.25}],
   [9,{f:'line',e:'turret',n:2,p:'scroll'}],[12,{f:'column',e:'dart',n:8,x:.5,p:'sine',gap:.3}],[15,{f:'single',e:'gunship',x:-.4,p:'hover'}],
   [17,{f:'swarm',e:'mite',n:14,x:.5}],[21,{f:'line',e:'turret',n:3,p:'scroll'}],[24,{f:'vee',e:'dart',n:7,p:'dive'}],
   [28,{f:'line',e:'drone',n:3,p:'hover'}],[31,{f:'random',e:'rock',n:10,gap:.35,p:'scroll'}],[35,{f:'pair',e:'gunship',p:'hover'}],
   [40,{f:'side',e:'dart',n:8,x:1,gap:.2}],[42,{f:'swarm',e:'mite',n:16,x:-.5}],[46,{f:'line',e:'turret',n:4,p:'scroll'}],
   [50,{f:'column',e:'dart',n:10,x:-.4,p:'dive',gap:.25}],[54,{f:'line',e:'drone',n:4,p:'hover'}],[58,{f:'single',e:'elite',p:'hover'}],
   [64,{f:'random',e:'rock',n:10,gap:.3,p:'scroll'}],[66,{f:'vee',e:'dart',n:9}]]},
 {name:'Veil Nebula',bg:0x120a2a,star:0xe0c8ff,neb:[0x6b2b9a,0x2b8f8a],planet:[0x9a4fd9,0x4a2a8f,0xd8b8ff],rate:1.15,key:47,bpm:136,prog:[0,8,5,7],boss:'bastion',
  waves:[[1,{f:'vee',e:'dart',n:7,p:'dive'}],[4,{f:'line',e:'drone',n:4,p:'hover'}],[8,{f:'swarm',e:'mite',n:16,x:-.5}],[9,{f:'swarm',e:'mite',n:16,x:.5}],
   [13,{f:'single',e:'elite',p:'hover'}],[18,{f:'side',e:'dart',n:8,x:-1,gap:.2}],[19,{f:'side',e:'dart',n:8,x:1,gap:.2}],
   [23,{f:'line',e:'drone',n:5,p:'hover'}],[27,{f:'pair',e:'gunship',p:'hover'}],[32,{f:'column',e:'dart',n:10,p:'sine',gap:.22}],
   [36,{f:'pair',e:'elite',p:'hover'}],[42,{f:'swarm',e:'mite',n:20}],[46,{f:'line',e:'turret',n:3,p:'scroll'}],[48,{f:'vee',e:'dart',n:9,p:'dive'}],
   [52,{f:'line',e:'drone',n:5,p:'hover'}],[57,{f:'single',e:'gunship',x:-.5,p:'hover'}],[58,{f:'single',e:'gunship',x:.5,p:'hover'}],
   [63,{f:'single',e:'elite',p:'hover'}],[68,{f:'side',e:'dart',n:10,x:-1,gap:.18}],[68,{f:'side',e:'dart',n:10,x:1,gap:.18}]]},
 {name:'Foundry Wreck',bg:0x0d1416,star:0xc8ffe8,neb:[0x1d6b5a,0x5a6b1d],planet:[0x5ab89a,0x2a5a4a,0xc8ffe0],rate:1.3,key:41,bpm:140,prog:[0,3,8,10],rocks:.25,boss:'mantis',
  waves:[[1,{f:'line',e:'turret',n:3,p:'scroll'}],[3,{f:'vee',e:'dart',n:7}],[6,{f:'pair',e:'gunship',p:'hover'}],[10,{f:'swarm',e:'mite',n:18,x:-.4}],
   [13,{f:'line',e:'turret',n:4,p:'scroll'}],[16,{f:'line',e:'drone',n:4,p:'hover'}],[20,{f:'single',e:'elite',x:-.4,p:'hover'}],[21,{f:'single',e:'elite',x:.4,p:'hover'}],
   [27,{f:'side',e:'dart',n:10,x:1,gap:.18}],[30,{f:'random',e:'rock',n:8,gap:.3,p:'scroll'}],[33,{f:'line',e:'gunship',n:3,p:'hover'}],
   [39,{f:'swarm',e:'mite',n:20,x:.4}],[42,{f:'line',e:'turret',n:5,p:'scroll'}],[45,{f:'column',e:'dart',n:12,p:'dive',gap:.2}],
   [49,{f:'line',e:'drone',n:5,p:'hover'}],[54,{f:'pair',e:'elite',p:'hover'}],[60,{f:'vee',e:'dart',n:11,p:'dive'}],
   [63,{f:'line',e:'gunship',n:3,p:'hover'}],[69,{f:'swarm',e:'mite',n:24}]]},
 {name:'Eclipse Gate',bg:0x150616,star:0xffe0f0,neb:[0x9a2b6b,0x3a2b9a],planet:[0x2a2540,0x14121f,0xffc531],rate:1.45,key:44,bpm:146,prog:[0,1,8,7],boss:'eclipse',
  waves:[[1,{f:'vee',e:'dart',n:9,p:'dive'}],[4,{f:'line',e:'drone',n:5,p:'hover'}],[8,{f:'single',e:'elite',p:'hover'}],
   [11,{f:'swarm',e:'mite',n:20,x:-.5}],[12,{f:'swarm',e:'mite',n:20,x:.5}],[15,{f:'line',e:'gunship',n:3,p:'hover'}],
   [20,{f:'side',e:'dart',n:10,x:-1,gap:.16}],[20,{f:'side',e:'dart',n:10,x:1,gap:.16}],[24,{f:'line',e:'turret',n:5,p:'scroll'}],
   [27,{f:'pair',e:'elite',p:'hover'}],[33,{f:'random',e:'rock',n:12,gap:.25,p:'scroll'}],[35,{f:'line',e:'drone',n:6,p:'hover'}],
   [40,{f:'column',e:'dart',n:14,x:-.5,p:'sine',gap:.18}],[40,{f:'column',e:'dart',n:14,x:.5,p:'sine',gap:.18}],
   [45,{f:'line',e:'gunship',n:3,p:'hover'}],[50,{f:'line',e:'elite',n:3,p:'hover'}],[57,{f:'swarm',e:'mite',n:26}],
   [60,{f:'vee',e:'dart',n:11,p:'dive'}],[64,{f:'line',e:'drone',n:6,p:'hover'}],[69,{f:'pair',e:'gunship',p:'hover'}],[70,{f:'single',e:'elite',p:'hover'}]]},
];
LEVELS.forEach(L=>{L.length=L.waves[L.waves.length-1][0];});
// phase.at = boss health fraction at which the phase begins. move: sway | circle | chase | hold | dash
const BOSSES={
 warden:{name:'Warden',hp:380,hit:[[0,0,1.5],[-1.9,.2,.75],[1.9,.2,.75]],phases:[
  {at:1,move:'sway',ms:1,pat:[{k:'fan',n:5,spread:.9,cd:1.5,sp:4,o:[0,-1.3]},{k:'aimed',cd:1,sp:5,o:[-1.9,-.4]},{k:'aimed',cd:1,sp:5,o:[1.9,-.4],delay:.5}]},
  {at:.6,move:'sway',ms:1.6,pat:[{k:'spiral',n:2,cd:.14,sp:3.4,rot:2.4,o:[0,-.6]},{k:'fan',n:7,spread:1.2,cd:2.2,sp:4.4,o:[0,-1.3]}],spawn:{e:'dart',cd:6,n:4}},
  {at:.3,move:'chase',ms:1.5,pat:[{k:'ring',n:14,cd:1.4,sp:3.6,o:[0,0]},{k:'burst',n:4,cd:1.8,sp:6,o:[-1.9,-.4]},{k:'burst',n:4,cd:1.8,sp:6,o:[1.9,-.4],delay:.9}]}]},
 hydra:{name:'Hydra Coil',hp:800,hit:[[0,0,1.35]],phases:[
  {at:1,move:'circle',ms:1,pat:[{k:'ring',n:10,cd:1.2,sp:3.4,rot:.25},{k:'aimed3',cd:1.6,sp:5,o:[0,-1.2]}]},
  {at:.66,move:'sway',ms:1.4,pat:[{k:'flower',n:8,cd:1,sp:3.2},{k:'fan',n:9,spread:1.6,cd:2.4,sp:4,aim:1,o:[0,-1.2]}]},
  {at:.33,move:'circle',ms:1.6,pat:[{k:'spiral',n:4,cd:.13,sp:3.6,rot:1.7},{k:'burst',n:6,cd:2,sp:6,o:[0,-1.2]}],spawn:{e:'mite',cd:7,n:8}}]},
 bastion:{name:'Bastion',hp:1300,hit:[[0,0,1.85]],phases:[
  {at:1,move:'sway',ms:.8,pat:[{k:'wall',n:9,cd:2.2,sp:3.2,o:[0,-1.6]},{k:'aimed3',cd:1.3,sp:5.2,o:[-1.6,-.2]},{k:'aimed3',cd:1.3,sp:5.2,o:[1.6,-.2],delay:.65}]},
  {at:.66,move:'hold',ms:1,pat:[{k:'spiral',n:3,cd:.12,sp:3.2,rot:2},{k:'ring',n:18,cd:2.5,sp:2.6}]},
  {at:.33,move:'chase',ms:1.2,pat:[{k:'spiral',n:5,cd:.11,sp:3.8,rot:-2.4},{k:'fan',n:5,spread:.6,cd:1.2,sp:6,aim:1,o:[0,-1.6]}],spawn:{e:'drone',cd:8,n:2}}]},
 mantis:{name:'Mantis',hp:1900,hit:[[0,0,1.1],[0,-1.4,.75],[0,1.4,.6]],phases:[
  {at:1,move:'sway',ms:1.6,pat:[{k:'fan',n:5,spread:.5,cd:1,sp:6,aim:1,o:[-1.2,-1.5]},{k:'fan',n:5,spread:.5,cd:1,sp:6,aim:1,o:[1.2,-1.5],delay:.5},{k:'rain',n:6,cd:.6,sp:4,o:[0,-1]}]},
  {at:.66,move:'dash',ms:1,pat:[{k:'ring',n:20,cd:2,sp:3.4},{k:'flower',n:10,cd:1.4,sp:3}]},
  {at:.33,move:'sway',ms:2.2,pat:[{k:'spiral',n:6,cd:.1,sp:3.6,rot:2.8},{k:'burst',n:8,cd:2,sp:7,o:[0,-1.6]}],spawn:{e:'dart',cd:6,n:4}}]},
 eclipse:{name:'Eclipse Core',hp:2800,hit:[[0,0,1.65]],phases:[
  {at:1,move:'sway',ms:.8,pat:[{k:'ring',n:16,cd:1.3,sp:3.2,rot:.2},{k:'aimed',cd:.5,sp:5.5,orb:[2.3,1.2]},{k:'aimed',cd:.5,sp:5.5,orb:[2.3,1.2],ph:PI}]},
  {at:.75,move:'circle',ms:1,pat:[{k:'spiral',n:4,cd:.1,sp:3.4,rot:2.2},{k:'fan',n:7,spread:.9,cd:1.6,sp:5,aim:1}]},
  {at:.5,move:'hold',ms:1,pat:[{k:'flower',n:12,cd:1.1,sp:3},{k:'wall',n:11,cd:2.6,sp:3.4,o:[0,-1.6]}],spawn:{e:'drone',cd:9,n:2}},
  {at:.25,move:'chase',ms:1,pat:[{k:'spiral',n:3,cd:.08,sp:4,rot:3.1},{k:'spiral',n:3,cd:.08,sp:4,rot:-2.3},{k:'ring',n:24,cd:2.2,sp:2.8},{k:'burst',n:5,cd:1.5,sp:7}]}]},
};

/* ================================================================ RENDERER & CAMERA */
const stage=$('stage'), cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(50,.5,.5,320);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.3); hemi.position.set(0,0,1);
const sun=new T.DirectionalLight(0xffffff,2.3); sun.position.set(-3,4,8);
scene.add(hemi,sun);
let pixelRatio=1, gfxCap=2;
const TILT=.34, LOOK=new T.Vector3(0,1.3,0), camBase=new T.Vector3();
const B={top:10,bottom:-10,hwT:6,hwB:4.5,yMin:-8,yMax:8};
const hw=y=>B.hwB+(B.hwT-B.hwB)*(y-B.bottom)/(B.top-B.bottom);
const _v=new T.Vector3(), _d=new T.Vector3(), _hit={x:0,y:0};
function ndcPlane(nx,ny,z){_v.set(nx,ny,.5).unproject(camera);_d.copy(_v).sub(camera.position).normalize();
  const t=((z||0)-camera.position.z)/_d.z;_hit.x=camera.position.x+_d.x*t;_hit.y=camera.position.y+_d.y*t;return _hit;}
let rect={left:0,top:0,width:1,height:1};
function screenPlane(cx,cy){return ndcPlane((cx-rect.left)/rect.width*2-1,-((cy-rect.top)/rect.height)*2+1,0);}
function placeCam(D){camera.position.set(0,LOOK.y-Math.sin(TILT)*D,Math.cos(TILT)*D);camera.up.set(0,1,0);camera.lookAt(LOOK);camera.updateMatrixWorld();}
function resize(){
  const W=window.innerWidth,H=window.innerHeight;const w=Math.min(W,Math.round(H*.62));
  stage.style.width=w+'px';
  applyPixelRatio();
  renderer.setSize(w,H,false);
  camera.aspect=w/H;camera.updateProjectionMatrix();
  placeCam(10);const k=ndcPlane(1,0,0).x;placeCam(10*5/k);camBase.copy(camera.position);
  B.top=ndcPlane(0,1,0).y;B.bottom=ndcPlane(0,-1,0).y;B.hwT=ndcPlane(1,1,0).x;B.hwB=ndcPlane(1,-1,0).x;
  rect=cv.getBoundingClientRect();
  layoutStars();computeLimits();
}
function applyPixelRatio(){const cap=S.set.gfx==='low'?1.25:gfxCap;pixelRatio=Math.min(DPR,cap,2);renderer.setPixelRatio(pixelRatio);
  if(starMat)starMat.uniforms.uPx.value=pixelRatio;}
function computeLimits(){
  const hb=document.querySelector('.hud-bot');let px=rect.top+rect.height-130;
  if(hb&&!$('hud').hidden){const r=hb.getBoundingClientRect();px=r.top-12;}
  B.yMin=screenPlane(rect.left+rect.width/2,px).y;B.yMax=B.top-1.6;
}

/* ================================================================ LOW-POLY MODEL BUILDER */
const P={box:(w,h,d)=>new T.BoxGeometry(w,h,d),cone:(r,h,s)=>new T.ConeGeometry(r,h,s||6),cyl:(a,b,h,s)=>new T.CylinderGeometry(a,b,h,s||8),
  oct:r=>new T.OctahedronGeometry(r),ico:(r,d)=>new T.IcosahedronGeometry(r,d||0),tet:r=>new T.TetrahedronGeometry(r),
  tor:(r,t,a,b)=>new T.TorusGeometry(r,t,a||4,b||14)};
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color();
const M=pt=>[pt,Object.assign({},pt,{p:[-pt.p[0],pt.p[1],pt.p[2]],r:pt.r?[pt.r[0],-pt.r[1],-pt.r[2]]:undefined})];
// Merge primitives into one flat-shaded geometry with per-vertex color and an emissive flag.
function geo(parts){
  const Pp=[],N=[],C=[],E=[];const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),cb=new T.Vector3();
  for(const pt of parts.flat()){
    const g=pt.g.index?pt.g.toNonIndexed():pt.g, pos=g.getAttribute('position');
    const p=pt.p||[0,0,0],r=pt.r||[0,0,0],s=pt.s||[1,1,1];
    _m4.compose(_p.set(p[0],p[1],p[2]),_q.setFromEuler(_e.set(r[0],r[1],r[2])),_s.set(s[0],s[1],s[2]));
    _c.setHex(pt.c);const em=pt.e?1:0;
    for(let i=0;i<pos.count;i+=3){
      a.fromBufferAttribute(pos,i).applyMatrix4(_m4);b.fromBufferAttribute(pos,i+1).applyMatrix4(_m4);c.fromBufferAttribute(pos,i+2).applyMatrix4(_m4);
      cb.subVectors(c,b);ab.subVectors(a,b);cb.cross(ab).normalize();
      for(const v of [a,b,c]){Pp.push(v.x,v.y,v.z);N.push(cb.x,cb.y,cb.z);C.push(_c.r,_c.g,_c.b);E.push(em);}
    }
  }
  const out=new T.BufferGeometry();
  out.setAttribute('position',new T.Float32BufferAttribute(Pp,3));out.setAttribute('normal',new T.Float32BufferAttribute(N,3));
  out.setAttribute('color',new T.Float32BufferAttribute(C,3));out.setAttribute('aEmis',new T.Float32BufferAttribute(E,1));
  out.computeBoundingSphere();return out;
}
// Lambert + vertex colors, emissive parts drawn unlit, white hit-flash (per instance or per material).
function makeMat(inst){
  const m=new T.MeshLambertMaterial({vertexColors:true});const uFlash={value:0};m.userData.flash=uFlash;
  m.onBeforeCompile=sh=>{
    sh.uniforms.uFlash=uFlash;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aEmis;varying float vEmis;'+(inst?'attribute float aFlash;varying float vFlash;':''))
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvEmis=aEmis;'+(inst?'vFlash=aFlash;':''));
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEmis;'+(inst?'varying float vFlash;':'uniform float uFlash;'))
      .replace('#include <dithering_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(vColor*1.25,1.0)).rgb,vEmis);\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,.96,.9),'+(inst?'vFlash':'uFlash')+');\n#include <dithering_fragment>');
  };
  m.customProgramCacheKey=()=>inst?'sw-inst':'sw-solo';
  return m;
}
const MAT_I=makeMat(true), MAT_BG=makeMat(false);

const EGEO={
  dart:()=>geo([{g:P.cone(.32,1,5),c:0xff3d7f},{g:P.box(1.05,.26,.07),c:0x3a0f3a,p:[0,-.3,0]},
    M({g:P.box(.07,.36,.26),c:0xff3d7f,p:[.46,-.36,.05]}),{g:P.oct(.13),c:0xffd23d,e:1,p:[0,.02,.22]}]),
  mite:()=>geo([{g:P.tet(.34),c:0xffa12e,r:[.6,.6,0]},{g:P.oct(.14),c:0xff3d55,e:1,p:[0,0,.2]}]),
  drone:()=>geo([{g:P.oct(.5),c:0xff8a2e,s:[1,1,.7]},{g:P.tor(.6,.07,3,12),c:0x2a2850},{g:P.oct(.17),c:0xff3d7f,e:1,p:[0,0,.32]},
    M({g:P.box(.18,.18,.18),c:0xffd23d,e:1,p:[.6,0,0]})]),
  gunship:()=>geo([{g:P.box(1.4,1,.42),c:0x3b2a7a},{g:P.box(.6,.55,.36),c:0x5a46b8,p:[0,.62,.02]},M({g:P.cyl(.09,.09,.8,6),c:0x1a1530,p:[.55,.6,0]}),
    M({g:P.box(.36,.95,.5),c:0x5a46b8,p:[.86,-.1,0]}),{g:P.box(1.05,.09,.44),c:0xff3d55,e:1,p:[0,-.28,0]},
    M({g:P.cone(.13,.32,5),c:0xff9b3d,e:1,p:[.86,-.7,0],r:[0,0,PI]})]),
  turret:()=>geo([{g:P.cyl(.55,.66,.3,8),c:0x3a3f66,r:[PI/2,0,0]},{g:P.oct(.36),c:0x8a92c8,p:[0,0,.22],s:[1,1,.7]},
    {g:P.box(.15,.8,.15),c:0x1b1d33,p:[0,.45,.28]},{g:P.box(.2,.14,.2),c:0xff9b3d,e:1,p:[0,.85,.28]}]),
  rock:()=>geo([{g:P.ico(.62),c:0x6b5a50},{g:P.ico(.3),c:0x857065,p:[.32,.22,.18]},{g:P.ico(.22),c:0x4f4038,p:[-.3,-.2,-.1]}]),
  elite:()=>{const a=[{g:P.oct(.72),c:0xd23dff,s:[1,1,.6]},{g:P.ico(.3),c:0xffd23d,e:1,p:[0,0,.3]},{g:P.tor(.98,.06,3,16),c:0xff3d7f,e:1}];
    for(let i=0;i<4;i++){const an=i*PI/2+PI/4;a.push({g:P.cone(.22,.9,4),c:0x3a1a5a,p:[Math.cos(an)*.85,Math.sin(an)*.85,0],r:[0,0,an-PI/2]});}return geo(a);},
};
function buildShip(){return geo([
  {g:P.oct(.5),c:0xe8eefc,s:[.42,1.35,.34],p:[0,.05,0]},{g:P.cone(.16,.55,6),c:0x3ef0ff,p:[0,.82,0]},
  {g:P.oct(.2),c:0x3ef0ff,e:1,s:[.55,1.2,.6],p:[0,.28,.15]},M({g:P.box(.95,.4,.07),c:0x2e3a8c,p:[.5,-.18,0],r:[0,0,-.38]}),
  M({g:P.box(.12,.42,.14),c:0x3ef0ff,e:1,p:[.95,-.38,.02],r:[0,0,-.1]}),M({g:P.cyl(.11,.14,.42,6),c:0x1b2140,p:[.22,-.62,0]}),
  M({g:P.cone(.1,.28,6),c:0xff9b3d,e:1,p:[.22,-.95,0],r:[0,0,PI]}),{g:P.box(.05,.42,.32),c:0xe8eefc,p:[0,-.45,.2]}]);}
function buildPod(col){return geo([{g:P.cyl(.09,.12,.5,6),c:0x2a3050},{g:P.cone(.09,.22,6),c:col,p:[0,.36,0]},{g:P.box(.06,.2,.08),c:col,e:1,p:[0,-.05,.1]}]);}

/* Bosses: each builder returns a group plus an animate callback. All parts share one material so the whole boss flashes. */
function bmesh(parts,mat){return new T.Mesh(geo(parts),mat);}
const BMODELS={
 warden(mat){const g=new T.Group();
  g.add(bmesh([{g:P.box(3.4,1.5,.7),c:0x3a3f66},{g:P.box(2.2,1,.5),c:0x5a6290,p:[0,.9,.1]},{g:P.cone(.7,1.4,4),c:0x8a92c8,p:[0,-1.3,0],r:[0,0,PI]},
    M({g:P.box(1.3,.9,.4),c:0x262a48,p:[2,.5,0]}),M({g:P.box(.25,1.2,.25),c:0xff8a3d,e:1,p:[1.1,-.2,.38]}),M({g:P.cyl(.22,.3,.5,6),c:0x1b1d33,p:[.8,1.55,0]}),
    M({g:P.cone(.18,.4,6),c:0xff9b3d,e:1,p:[.8,2,0]})],mat));
  const core=bmesh([{g:P.oct(.5),c:0xff9b3d,e:1,s:[1,1,.6]}],mat);core.position.set(0,-.1,.45);
  const tur=[-1.9,1.9].map(x=>{const t=bmesh([{g:P.cyl(.45,.55,.3,8),c:0x5a6290,r:[PI/2,0,0]},{g:P.box(.18,.9,.18),c:0x1b1d33,p:[0,.5,.25]},{g:P.box(.24,.16,.24),c:0xff3d55,e:1,p:[0,.95,.25]}],mat);t.position.set(x,-.3,.35);g.add(t);return t;});
  g.add(core);
  return{group:g,anim(t,b){core.scale.setScalar(1+Math.sin(t*6)*.12);for(const u of tur){u.rotation.z=Math.atan2(ply.y-(b.y+u.position.y),ply.x-(b.x+u.position.x))-PI/2;}}};},
 hydra(mat){const g=new T.Group();
  g.add(bmesh([{g:P.ico(1.1),c:0xc0304a,s:[1,1,.7]},{g:P.tor(1.3,.12,3,18),c:0x3a1020},{g:P.oct(.35),c:0xffd23d,e:1,p:[0,-.3,.7]}],mat));
  const ring=new T.Group();const hp=[];for(let i=0;i<6;i++)hp.push({g:P.cone(.3,1,5),c:0xe05a6a,p:[Math.cos(i*TAU/6)*1.75,Math.sin(i*TAU/6)*1.75,0],r:[0,0,i*TAU/6-PI/2]},{g:P.oct(.14),c:0xffd23d,e:1,p:[Math.cos(i*TAU/6)*2.2,Math.sin(i*TAU/6)*2.2,.1]});
  ring.add(bmesh(hp,mat));g.add(ring);
  return{group:g,anim(t,b,dt){ring.rotation.z+=dt*(.6+b.ph*.5);}};},
 bastion(mat){const g=new T.Group();
  g.add(bmesh([{g:P.cyl(1.7,1.9,.8,8),c:0x56607a,r:[PI/2,0,0]},{g:P.cyl(1.1,1.2,.4,8),c:0x2a2f45,r:[PI/2,0,0],p:[0,0,.5]},M({g:P.box(.7,1.4,.5),c:0x3a4058,p:[2,.1,0]}),
    M({g:P.box(.18,.8,.18),c:0x1b1d33,p:[1.6,-.7,.3]}),M({g:P.box(.24,.16,.24),c:0xb36bff,e:1,p:[1.6,-1.1,.3]})],mat));
  const crown=new T.Group();const cp=[];for(let i=0;i<8;i++){const a=i*TAU/8;cp.push({g:P.box(.45,.45,.6),c:i%2?0xb36bff:0x8a92c8,e:i%2,p:[Math.cos(a)*1.55,Math.sin(a)*1.55,.5],r:[0,0,a]});}
  crown.add(bmesh(cp,mat));g.add(crown);
  const dome=bmesh([{g:P.oct(.6),c:0xb36bff,e:1,s:[1,1,.7]}],mat);dome.position.z=.85;g.add(dome);
  return{group:g,anim(t,b,dt){crown.rotation.z-=dt*(.4+b.ph*.6);dome.rotation.z+=dt*2;}};},
 mantis(mat){const g=new T.Group();
  g.add(bmesh([{g:P.oct(1),c:0xa8c43a,s:[.7,1.6,.5]},{g:P.oct(.6),c:0xc8e04a,p:[0,-1.4,.1]},M({g:P.oct(.18),c:0xff3d55,e:1,p:[.25,-1.6,.35]}),
    M({g:P.box(2.2,.7,.06),c:0x2b3a10,p:[1.4,.4,.2],r:[0,0,.5]}),M({g:P.box(1.6,.4,.05),c:0x4a6418,p:[1.2,1.1,.15],r:[0,0,-.3]}),
    {g:P.cone(.6,1.6,6),c:0x7a9428,p:[0,1.6,0]}],mat));
  const md=[-1,1].map(s=>{const m=bmesh([{g:P.cone(.18,1.1,4),c:0xd8f060,p:[0,-.55,0],r:[0,0,PI]}],mat);m.position.set(s*.35,-1.8,.1);g.add(m);return m;});
  return{group:g,anim(t,b){const o=.25+Math.sin(t*5)*.2;md[0].rotation.z=-o;md[1].rotation.z=o;}};},
 eclipse(mat){const g=new T.Group();
  g.add(bmesh([{g:P.ico(1.5,1),c:0x23203f}],mat));
  const core=bmesh([{g:P.oct(.8),c:0xfff0c0,e:1}],mat);core.position.z=.9;
  const r1=bmesh([{g:P.tor(2.2,.12,4,24),c:0xffc531,e:1}],mat), r2=bmesh([{g:P.tor(2.7,.08,4,24),c:0xff3d7f,e:1}],mat);
  const sat=new T.Group();const sp=[];for(let i=0;i<4;i++){const a=i*TAU/4;sp.push({g:P.oct(.3),c:0x8a92c8,p:[Math.cos(a)*3.2,Math.sin(a)*3.2,0]},{g:P.oct(.12),c:0xff3d7f,e:1,p:[Math.cos(a)*3.2,Math.sin(a)*3.2,.25]});}
  sat.add(bmesh(sp,mat));g.add(core,r1,r2,sat);
  return{group:g,anim(t,b,dt){r1.rotation.x=Math.sin(t*.7)*.6;r1.rotation.y=Math.cos(t*.5)*.4;r2.rotation.x=Math.cos(t*.6)*.7;r2.rotation.y=-Math.sin(t*.8)*.5;
    sat.rotation.z+=dt*(.5+b.ph*.3);core.scale.setScalar(1+Math.sin(t*7)*.1);core.rotation.z+=dt;}};},
};

/* ================================================================ GLOW BATCHES (instanced quads, rebuilt every frame) */
const GVS='attribute vec4 iA;attribute vec4 iB;attribute vec3 iC;varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){vUv=position.xy*2.0;float c=cos(iA.w),s=sin(iA.w);vec2 p=position.xy*iB.xy;p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);\n'+
 'gl_Position=projectionMatrix*viewMatrix*vec4(iA.xy+p,iA.z,1.0);vC=iC;vA=iB.w;vS=iB.z;}';
const FX_FS='varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){float d=length(vUv);float a;float core;\n'+
 'if(vS<0.5){if(d>1.0)discard;a=exp(-d*d*4.5)*(1.0-d);core=smoothstep(0.32,0.0,d);}\n'+
 'else if(vS<1.5){if(d>1.0)discard;float k=(d-0.78)*7.0;a=exp(-k*k)*(1.0-d*0.6);core=0.0;}\n'+
 'else{float x=abs(vUv.x);float y=abs(vUv.y);a=exp(-x*x*5.0)*(1.0-smoothstep(0.75,1.0,y));core=smoothstep(0.25,0.0,x)*(1.0-smoothstep(0.6,1.0,y));}\n'+
 'gl_FragColor=vec4(mix(vC,vec3(1.0),core*0.85),max(a,core)*vA);}';
const EB_FS='varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){float d=length(vUv);if(d>1.0)discard;float body=1.0-smoothstep(0.52,0.6,d);float edge=1.0-smoothstep(0.68,0.76,d);\n'+
 'vec3 col=mix(vC,vec3(1.0),1.0-smoothstep(0.12,0.36,d));col=mix(vec3(0.06,0.02,0.1),col,body);\n'+
 'float glow=exp(-d*d*5.0)*0.55*(1.0-d);float a=max(edge,glow);gl_FragColor=vec4(mix(vC,col,edge),a*vA);}';
class Batch{
  constructor(cap,fs,blend,order){
    const g=new T.InstancedBufferGeometry(),pl=new T.PlaneGeometry(1,1);g.index=pl.index;g.setAttribute('position',pl.getAttribute('position'));
    this.A=new Float32Array(cap*4);this.Bb=new Float32Array(cap*4);this.C=new Float32Array(cap*3);
    this.aA=new T.InstancedBufferAttribute(this.A,4).setUsage(T.DynamicDrawUsage);this.aB=new T.InstancedBufferAttribute(this.Bb,4).setUsage(T.DynamicDrawUsage);
    this.aC=new T.InstancedBufferAttribute(this.C,3).setUsage(T.DynamicDrawUsage);
    g.setAttribute('iA',this.aA);g.setAttribute('iB',this.aB);g.setAttribute('iC',this.aC);g.instanceCount=0;
    this.mesh=new T.Mesh(g,new T.ShaderMaterial({vertexShader:GVS,fragmentShader:fs,transparent:true,depthWrite:false,blending:blend}));
    this.mesh.frustumCulled=false;this.mesh.renderOrder=order;this.g=g;this.cap=cap;this.n=0;scene.add(this.mesh);
  }
  push(x,y,z,rot,sx,sy,sh,a,c){if(this.n>=this.cap)return;const i=this.n++,k=i*4,j=i*3,A=this.A,Bb=this.Bb,C=this.C;
    A[k]=x;A[k+1]=y;A[k+2]=z;A[k+3]=rot;Bb[k]=sx;Bb[k+1]=sy;Bb[k+2]=sh;Bb[k+3]=a;C[j]=c[0];C[j+1]=c[1];C[j+2]=c[2];}
  flush(){const n=this.n;this.g.instanceCount=n;
    for(const [at,sz] of [[this.aA,4],[this.aB,4],[this.aC,3]]){at.updateRange.offset=0;at.updateRange.count=Math.max(1,n*sz);at.needsUpdate=true;}this.n=0;}
}
const fx=new Batch(3600,FX_FS,T.AdditiveBlending,5);
const ebR=new Batch(1600,EB_FS,T.NormalBlending,10);

/* ================================================================ BACKGROUND */
const STARN=900;let starMat,starGeo,stars;
{
  starGeo=new T.BufferGeometry();
  const pos=new Float32Array(STARN*3),rng=new Float32Array(STARN*2),sz=new Float32Array(STARN);
  for(let i=0;i<STARN;i++){pos[i*3+2]=-Math.pow(Math.random(),.7)*70-4;sz[i]=Math.random()<.08?rand(1.6,2.4):rand(.5,1.3);}
  starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aRange',new T.BufferAttribute(rng,2));starGeo.setAttribute('aSize',new T.BufferAttribute(sz,1));
  starMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uSpeed:{value:7},uPx:{value:1},uColor:{value:new T.Vector3(1,1,1)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
    vertexShader:'uniform float uTime,uSpeed,uPx;attribute vec2 aRange;attribute float aSize;varying float vB;\nvoid main(){vec3 p=position;p.y=aRange.x+mod(p.y-aRange.x-uTime*uSpeed,aRange.y);\nvec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(aSize*uPx*46.0/(-mv.z),1.0,7.0*uPx);vB=0.45+0.4*aSize;}',
    fragmentShader:'uniform vec3 uColor;varying float vB;void main(){float d=length(gl_PointCoord-0.5);float a=smoothstep(0.5,0.05,d);gl_FragColor=vec4(uColor*vB,a);}'});
  stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=1;scene.add(stars);
}
function layoutStars(){
  const pos=starGeo.getAttribute('position'),rng=starGeo.getAttribute('aRange');
  for(let i=0;i<STARN;i++){const z=pos.array[i*3+2];const top=ndcPlane(0,1,z).y,bot=ndcPlane(0,-1,z).y,h=ndcPlane(1,1,z).x;
    pos.array[i*3]=rand(-h,h)*1.05;rng.array[i*2]=bot-1;rng.array[i*2+1]=top-bot+2;pos.array[i*3+1]=rand(bot-1,top+1);}
  pos.needsUpdate=true;rng.needsUpdate=true;
}
const planet=new T.Group();scene.add(planet);let planetMesh=null;
const ringMesh=new T.Mesh(geo([{g:P.tor(1.65,.06,3,40),c:0xffffff}]),makeMat(false));ringMesh.rotation.x=1.15;planet.add(ringMesh);
const BGR_N=10;const bgRocks=new T.InstancedMesh(geo([{g:P.ico(.8),c:0x262236},{g:P.ico(.4),c:0x302a44,p:[.4,.3,.2]}]),makeMat(false),BGR_N);
bgRocks.frustumCulled=false;scene.add(bgRocks);
const bgr=[];for(let i=0;i<BGR_N;i++)bgr.push({x:0,y:0,z:0,s:1,rx:rand(0,TAU),ry:rand(0,TAU),w:rand(.2,.8),v:rand(.5,1.2)});
function resetBgRocks(){for(const r of bgr){r.z=-rand(16,36);const top=ndcPlane(0,1,r.z).y,bot=ndcPlane(0,-1,r.z).y,h=ndcPlane(1,1,r.z).x;r.x=rand(-h,h);r.y=rand(bot,top);r.s=rand(.5,1.1);}}
let theme=LEVELS[0];const nebC=[[0,0,0],[0,0,0]];
function applyTheme(L){
  theme=L;scene.background=new T.Color(L.bg);scene.fog=new T.Fog(L.bg,28,115);
  const sc=rgb(L.star);starMat.uniforms.uColor.value.set(sc[0],sc[1],sc[2]);nebC[0]=rgb(L.neb[0]);nebC[1]=rgb(L.neb[1]);
  if(planetMesh){planet.remove(planetMesh);planetMesh.geometry.dispose();}
  const g=geo([{g:P.ico(1,1),c:0xffffff}]);const col=g.getAttribute('color');const c1=new T.Color(L.planet[0]),c2=new T.Color(L.planet[1]),t=new T.Color();
  for(let i=0;i<col.count;i+=3){t.copy(c1).lerp(c2,Math.random()*.9);for(let k=0;k<3;k++)col.setXYZ(i+k,t.r,t.g,t.b);}
  planetMesh=new T.Mesh(g,MAT_BG);planet.add(planetMesh);
  ringMesh.geometry.dispose();ringMesh.geometry=geo([{g:P.tor(1.65,.06,3,40),c:L.planet[2]},{g:P.tor(1.9,.03,3,40),c:L.planet[2]}]);
  planet.scale.setScalar(6);planet.position.set((Math.random()<.5?-1:1)*rand(8,14),B.top+10,-78);
  resetBgRocks();
}
const nebP=[{x:-14,y:10,s:62,a:.16,c:0},{x:16,y:40,s:70,a:.13,c:1}];
function updateBg(dt){
  starMat.uniforms.uTime.value+=dt;
  planet.position.y-=dt*.55;planet.rotation.z+=dt*.02;if(planet.position.y<B.bottom-60){planet.position.y=B.top+70;planet.position.x=(Math.random()<.5?-1:1)*rand(8,14);}
  for(const r of bgr){r.y-=dt*r.v*5;r.rx+=dt*r.w;r.ry+=dt*r.w*.7;const bot=ndcPlane(0,-1,r.z).y;
    if(r.y<bot-3){const top=ndcPlane(0,1,r.z).y,h=ndcPlane(1,1,r.z).x;r.y=top+3;r.x=rand(-h,h);}}
  for(let i=0;i<BGR_N;i++){const r=bgr[i];_m4.compose(_p.set(r.x,r.y,r.z),_q.setFromEuler(_e.set(r.rx,r.ry,0)),_s.setScalar(r.s));bgRocks.setMatrixAt(i,_m4);}
  bgRocks.instanceMatrix.needsUpdate=true;
  for(const n of nebP){n.y-=dt*1.2;if(n.y<-70)n.y=70;fx.push(n.x,n.y,-70,0,n.s,n.s,0,n.a,nebC[n.c]);}
}

/* ================================================================ AUDIO (synthesized) */
const mtof=m=>440*Math.pow(2,(m-69)/12);
const THR={shot:.075,hit:.045,boom:.04,credit:.035,pick:.05,shield:.1,hurt:.12,missile:.08};
const Snd={ctx:null,last:{},
  init(){if(this.ctx){this.resume();return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{this.ctx=new AC();}catch(e){return;}const c=this.ctx;
    this.comp=c.createDynamicsCompressor();this.comp.threshold.value=-14;this.comp.ratio.value=4;this.comp.connect(c.destination);
    this.sfx=c.createGain();this.mus=c.createGain();this.sfx.connect(this.comp);this.mus.connect(this.comp);
    const buf=c.createBuffer(1,c.sampleRate,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=buf;
    this.apply();if(Mus.want){Mus.play(Mus.want[0],Mus.want[1]);}},
  apply(){if(!this.ctx)return;this.sfx.gain.value=S.set.sfx?.5:0;this.mus.gain.value=S.set.music?.2:0;},
  resume(){if(this.ctx&&this.ctx.state!=='running')this.ctx.resume().catch(()=>{});},
  suspend(){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend().catch(()=>{});},
  osc(type,f0,f1,t,dur,vol,dest){const c=this.ctx,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)o.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
    o.connect(g);g.connect(dest||this.sfx);o.start(t);o.stop(t+dur+.03);},
  nz(t,dur,vol,ft,f0,f1,dest,q){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nb;f.type=ft;
    f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);if(q)f.Q.value=q;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(f);f.connect(g);g.connect(dest||this.sfx);s.start(t,Math.random()*.5);s.stop(t+dur+.03);},
  play(n,a){const c=this.ctx;if(!c||!S.set.sfx||c.state!=='running')return;const now=c.currentTime,th=THR[n]||0;
    if(this.last[n]&&now-this.last[n]<th)return;this.last[n]=now;const t=now+.005;
    switch(n){
      case 'shot':this.osc('square',1400,520,t,.045,.03);break;
      case 'hit':this.osc('square',320,180,t,.03,.035);break;
      case 'boom':this.nz(t,.3+(a||0)*.15,.32,'lowpass',2200,180);this.osc('sine',130,40,t,.22,.22);break;
      case 'big':this.nz(t,1.4,.6,'lowpass',1800,60);this.osc('sine',90,25,t,1,.5);break;
      case 'credit':this.osc('triangle',1320,1760,t,.07,.07);break;
      case 'power':[523,659,784,1047].forEach((f,i)=>this.osc('square',f,0,t+i*.06,.09,.06));break;
      case 'pick':this.osc('triangle',660,990,t,.12,.1);break;
      case 'shield':this.osc('sine',900,300,t,.12,.1);this.nz(t,.08,.07,'highpass',3000);break;
      case 'hurt':this.osc('sawtooth',220,60,t,.25,.16);this.nz(t,.2,.22,'lowpass',1200,200);break;
      case 'bomb':this.nz(t,1.6,.7,'lowpass',3000,50);this.osc('sine',200,30,t,1.2,.5);break;
      case 'missile':this.nz(t,.25,.14,'bandpass',800,3000,null,2);break;
      case 'laser':this.osc('sawtooth',110,90,t,a||1.5,.1);this.osc('square',220,200,t,a||1.5,.04);break;
      case 'warn':for(let i=0;i<4;i++){this.osc('triangle',440,660,t+i*.5,.24,.13);this.osc('triangle',660,440,t+i*.5+.25,.24,.13);}break;
      case 'click':this.osc('square',880,0,t,.03,.035);break;
      case 'phase':this.osc('sawtooth',160,640,t,.5,.14);break;
      case 'die':this.nz(t,2,.7,'lowpass',2500,40);this.osc('sawtooth',300,30,t,1.5,.28);break;
      case 'buy':this.osc('triangle',880,0,t,.08,.08);this.osc('triangle',1320,0,t+.07,.12,.08);break;
    }}
};
const Mus={on:false,mode:'',step:0,next:0,bpm:128,key:45,prog:[0,8,3,10],want:null,
  play(mode,lvl){const L=LEVELS[lvl||0];this.want=[mode,lvl];if(!Snd.ctx)return;this.mode=mode;this.key=L.key;
    this.bpm=mode==='boss'?L.bpm+18:mode==='calm'?96:L.bpm;this.prog=mode==='boss'?[0,1,0,-2]:L.prog;this.on=true;this.step=0;this.next=Snd.ctx.currentTime+.1;},
  stop(){this.on=false;},
  tick(){const c=Snd.ctx;if(!this.on||!c||c.state!=='running'||!S.set.music)return;const st=60/this.bpm/4;
    if(this.next<c.currentTime-.25)this.next=c.currentTime+.05;
    while(this.next<c.currentTime+.18){this.note(this.step,this.next,st);this.next+=st;this.step++;}},
  note(i,t,st){const s=i%16,bar=(i>>4)%4,root=this.key+this.prog[bar],D=Snd.mus,calm=this.mode==='calm',boss=this.mode==='boss';
    const ch=(bar===0||boss)?[0,3,7,10]:[0,4,7,11];
    if(s%2===0)Snd.osc('triangle',mtof(root+(s%8===6?12:0)),0,t,st*1.8,.3,D);
    if(!calm||s%2===0){const n=root+24+ch[(calm?s>>1:s)%4]+((s>>2)%2?12:0);Snd.osc('square',mtof(n),0,t,st*.9,calm?.03:.04,D);}
    if(!calm){if(s%4===0)Snd.osc('sine',150,45,t,.16,.5,D);if(boss&&s%4===2)Snd.osc('sine',150,45,t,.12,.3,D);
      if(s===4||s===12)Snd.nz(t,.12,.2,'bandpass',1800,0,D,1);if(s%2===1)Snd.nz(t,.035,.07,'highpass',7000,0,D);}
    else if(s===0)Snd.osc('sine',110,40,t,.3,.22,D);}
};
function vibe(ms){if(!S.set.vibe||!navigator.vibrate)return;try{navigator.vibrate(ms);}catch(e){}}

/* ================================================================ POOLS */
function soa(cap,keys){const o={cap,n:0};for(const k of keys)o[k]=new Float32Array(cap);return o;}
const pb=soa(700,['x','y','vx','vy','dmg','life','kind','pierce','last','home','sx','sy','tgt','tt']);   // player bullets
const eb=soa(1600,['x','y','vx','vy','c','big','cv','t']);                                                 // enemy bullets
const pt=soa(2600,['x','y','z','vx','vy','l','m','s0','s1','r','g','b','sh','dr']);                       // glow particles
const db=soa(220,['x','y','z','vx','vy','vz','rx','ry','rz','wx','wy','wz','l','m','s','c']);             // debris chunks
const EN=[];for(let i=0;i<140;i++)EN.push({alive:false,uid:0});
const PK=[];for(let i=0;i<160;i++)PK.push({alive:false});
let uidSeq=0;

const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),
  green:rgb(0x5dff9b),blue:rgb(0x4aa8ff),yellow:rgb(0xffd23d),red:rgb(0xff4d4d),rail:rgb(0xa8d8ff),lance:rgb(0xc9a0ff),hot:rgb(0xffe6b0)};
const EBC=[rgb(0xff9a2e),rgb(0xff3d7f),rgb(0xb36bff),rgb(0xffd23d),rgb(0xff4040),rgb(0xff5ad7)];
const PAT_C={aimed:0,aimed3:0,fan:1,ring:2,spiral:5,burst:3,wall:4,flower:5,rain:1};
const PB_VIS=[ // kind -> [color, sx, sy]
  [COL.cyan,.28,.95],[COL.yellow,.32,.42],[COL.lance,.3,1.5],[COL.green,.18,.55],[COL.orange,.3,.5],[COL.pink,.32,.62],[COL.rail,.16,.9]];

/* ================================================================ RUNTIME STATE */
const ply={x:0,y:0,tx:0,ty:0,vx:0,bank:0,shield:8,armor:12,energy:50,maxS:8,maxA:12,spd:11,inv:0,rd:0,alive:true,fireT:0,sideT:0,sideAlt:0,
  boost:0,beam:0,beamW:.7,beamD:45,flash:0,shF:0,muz:0,st:null,god:false};
const run={lvl:0,L:LEVELS[0],t:0,wi:0,queue:[],bossCalled:false,warnT:0,score:0,kills:0,credits:0,hullHit:false,clearT:0,deadT:0,
  magnet:false,timeScale:1,slowT:0,rockT:0,shake:0,fade:0};
const boss={on:false};
let state='title';

/* ----- player mesh ----- */
const shipMat=makeMat(false);
const ship=new T.Group();ship.add(new T.Mesh(buildShip(),shipMat));ship.scale.setScalar(.62);scene.add(ship);
const pods=[new T.Mesh(buildPod(0x5dff9b),shipMat),new T.Mesh(buildPod(0x5dff9b),shipMat)];
pods[0].position.set(-.78,-.05,0);pods[1].position.set(.78,-.05,0);ship.add(pods[0],pods[1]);
function setPods(){const k=S.side.eq;for(const p of pods){p.visible=!!k;if(k){p.geometry.dispose();p.geometry=buildPod(SIDE[k].col);}}}

/* ----- instanced enemies, pickups, debris ----- */
const EMESH={};
for(const k in ET){const cap=(k==='gunship'||k==='elite')?24:96;const g=EGEO[k]();
  const fl=new T.InstancedBufferAttribute(new Float32Array(cap),1).setUsage(T.DynamicDrawUsage);g.setAttribute('aFlash',fl);
  const m=new T.InstancedMesh(g,MAT_I,cap);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;scene.add(m);EMESH[k]={m,cap,fl,n:0};}
function instGroup(g,cap){const fl=new T.InstancedBufferAttribute(new Float32Array(cap),1);g.setAttribute('aFlash',fl);
  const m=new T.InstancedMesh(g,makeMat(true),cap);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;
  m.setColorAt(0,new T.Color(1,1,1));m.instanceColor.setUsage(T.DynamicDrawUsage);scene.add(m);return m;}
const pkOct=instGroup(geo([{g:P.oct(.5),c:0xffffff,e:1,s:[.8,.8,1.1]}]),120);
const pkBox=instGroup(geo([{g:P.box(.7,.7,.7),c:0xffffff},{g:P.box(.36,.36,.9),c:0xffffff,e:1}]),60);
const dbMesh=new T.InstancedMesh(geo([{g:P.tet(.5),c:0xffffff}]),new T.MeshLambertMaterial({vertexColors:true}),220);
dbMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);dbMesh.setColorAt(0,new T.Color());dbMesh.instanceColor.setUsage(T.DynamicDrawUsage);
dbMesh.count=0;dbMesh.frustumCulled=false;scene.add(dbMesh);
// pickup types: credit, big credit, shield, power, armor, energy
const PKT=[{oct:1,c:0xffc531,s:.36,h:COL.gold},{oct:1,c:0xffe680,s:.56,h:COL.gold},{oct:0,c:0x4aa8ff,s:.5,h:COL.blue},
  {oct:0,c:0x5dff9b,s:.55,h:COL.green},{oct:0,c:0xff8a3d,s:.5,h:COL.orange},{oct:0,c:0xc9a0ff,s:.46,h:COL.violet}];
PKT.forEach(p=>p.col=new T.Color(p.c));

/* ================================================================ SPAWN HELPERS */
const LOWQ=()=>S.set.gfx==='low';
function part(x,y,z,vx,vy,l,s0,s1,c,sh,dr){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.l[i]=l;pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.dr[i]=dr||0;}
function sparks(x,y,n,c,spd,size,life){if(LOWQ())n=Math.ceil(n/2);for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(.3,1)*spd;part(x,y,.3,Math.cos(a)*s,Math.sin(a)*s,rand(.6,1)*life,size,.02,c,0,4);}}
function debris(x,y,n,c){for(let i=0;i<n&&db.n<db.cap;i++){const k=db.n++,a=rand(0,TAU),s=rand(2,6);db.x[k]=x;db.y[k]=y;db.z[k]=.2;
  db.vx[k]=Math.cos(a)*s;db.vy[k]=Math.sin(a)*s;db.vz[k]=rand(1,4);db.rx[k]=rand(0,TAU);db.ry[k]=rand(0,TAU);db.rz[k]=0;
  db.wx[k]=rand(-8,8);db.wy[k]=rand(-8,8);db.wz[k]=rand(-8,8);db.l[k]=db.m[k]=rand(.5,1.1);db.s[k]=rand(.12,.3);db.c[k]=c;}}
const DB_COL=[0xff3d7f,0xff8a2e,0x5a46b8,0x8a92c8,0x6b5a50,0xd23dff,0x3ef0ff,0xffc531].map(h=>new T.Color(h));
function shake(a){run.shake=Math.min(1.2,run.shake+a*(REDUCED?.3:1));}
function boom(x,y,sz,c,dc){
  const q=LOWQ()?.5:1,n=Math.round((6+sz*12)*q);
  for(let i=0;i<n;i++){const a=rand(0,TAU),s=rand(.4,1)*(2.5+sz*4);part(x,y,.25,Math.cos(a)*s,Math.sin(a)*s,rand(.25,.6)*(.7+sz*.3),rand(.3,.6)*(.6+sz*.5),.05,c,0,3.2);}
  part(x,y,.35,0,0,.16+sz*.06,1+sz*1.5,.2,COL.hot,0,0);
  part(x,y,.3,0,0,.28+sz*.1,.2,2+sz*2.4,c,1,0);
  debris(x,y,Math.round((2+sz*3)*q),dc||0);shake(.05+sz*.1);Snd.play(sz>1.8?'big':'boom',sz);
}
function pShot(x,y,ang,spd,dmg,kind,pierce,home,life){if(pb.n>=pb.cap)return;const i=pb.n++;pb.x[i]=x;pb.y[i]=y;pb.vx[i]=Math.cos(ang)*spd;pb.vy[i]=Math.sin(ang)*spd;
  pb.dmg[i]=dmg;pb.kind[i]=kind;pb.pierce[i]=pierce||0;pb.last[i]=-1;pb.home[i]=home||0;pb.life[i]=life||2.2;pb.tgt[i]=-1;pb.tt[i]=0;}
function eShot(x,y,a,s,c,big,cv){if(eb.n>=eb.cap)return;const i=eb.n++;eb.x[i]=x;eb.y[i]=y;eb.vx[i]=Math.cos(a)*s;eb.vy[i]=Math.sin(a)*s;eb.c[i]=c;eb.big[i]=big||0;eb.cv[i]=cv||0;eb.t[i]=0;}
function pickup(x,y,type,val){for(const p of PK)if(!p.alive){p.alive=true;p.x=x;p.y=y;p.type=type;p.val=val||0;p.vx=rand(-1.6,1.6);p.vy=rand(1,3);p.t=rand(0,3);return;}}

function spawnEnemy(type,x,y,path,o){
  let e=null;for(const c of EN)if(!c.alive){e=c;break;}if(!e)return null;const d=ET[type];o=o||{};
  e.alive=true;e.ambient=false;e.type=type;e.d=d;e.x=e.px=e.x0=x;e.y=e.py=y;e.t=0;e.path=path||'down';e.st=0;e.uid=++uidSeq;
  e.hp=d.hp*DF().hp*(1+run.lvl*.12);e.flash=0;e.entered=false;e.spd=d.speed*(o.spd||1);
  e.rx=0;e.ry=0;e.rz=-PI;e.spin=d.spin?(Math.random()<.5?-1:1)*d.spin:0;e.s=d.scale*(o.scale||1);e.r=d.r*(o.scale||1);
  e.group=o.group||null;e.ty=o.ty!=null?o.ty:B.top-(B.top-B.bottom)*.25;e.hold=o.hold||d.hold||5.5;e.amp=o.amp||1.3;e.f=o.f||2.2;e.ph=o.ph||0;
  e.ang=o.ang||0;e.turn=o.turn||0;e.turnT=o.turnT||2.5;e.vx=o.vx||0;e.vy=0;
  if(d.tumble){e.wx=rand(-1.5,1.5);e.wy=rand(-1.5,1.5);e.rx=rand(0,TAU);e.ry=rand(0,TAU);}
  e.ems=d.fire?d.fire.map(sp=>({sp,t:rand(.6,sp.cd),a:rand(0,TAU),bn:0,bt:0})):null;
  return e;
}
function schedule(w){
  const n=w.n||1,p=w.p||'down',gap=w.gap||.3,x=w.x||0,top=B.top+1.2,hb=B.hwB*.9,span=B.top-B.bottom;
  const grp=n>=5?{left:n,killed:0}:null;
  const add=(dt,X,Y,path,o)=>{o.group=grp;run.queue.push({t:run.t+dt,e:w.e,x:X,y:Y,p:path,o});};
  switch(w.f){
    case 'single':add(0,x*hb,top,p,{ty:B.top-span*.24});break;
    case 'pair':for(const s of [-1,1])add(0,s*.5*hb,top,p,{ty:B.top-span*.24});break;
    case 'line':{const sp=Math.min(.8,.24*(n-1));for(let i=0;i<n;i++){const u=n===1?x:x*.3+lerp(-sp,sp,i/(n-1));add(0,u*hb,top+(i%2)*.4,p,{ty:B.top-span*(.2+(i%2)*.07)});}}break;
    case 'vee':for(let i=0;i<n;i++){const k=i-(n-1)/2;add(Math.abs(k)*.06,(x+k*.2)*hb,top+Math.abs(k)*.7,p,{ty:B.top-span*(.3+Math.abs(k)*.02)});}break;
    case 'column':for(let i=0;i<n;i++)add(i*gap,x*hb,top,p,{amp:1.4,ty:B.top-span*.3});break;
    case 'swarm':for(let i=0;i<n;i++)add(i*.11,x*hb,top,'snake',{amp:2.2,f:1.7});break;
    case 'side':{const dir=x<0?-1:1;for(let i=0;i<n;i++)add(i*gap,dir*(hw(B.top-1.6)+.9),B.top-1.6,'arc',{ang:dir<0?-.35:PI+.35,turn:dir<0?-.85:.85,turnT:2.6});}break;
    case 'random':for(let i=0;i<n;i++)add(i*gap,rand(-.9,.9)*hb,top,p,{vx:rand(-.4,.4),scale:w.e==='rock'?rand(.75,1.4):1});break;
  }
}

/* ================================================================ BULLET PATTERNS */
function emit(sp,x,y,em,isBoss){
  const d=DF(),spd=(sp.sp||4)*d.sp*(isBoss?1:1+run.lvl*.04),c=sp.c!=null?sp.c:PAT_C[sp.k];
  const aim=Math.atan2(ply.y-y,ply.x-x),dens=n=>Math.max(1,Math.round(n*d.dens));
  switch(sp.k){
    case 'aimed':eShot(x,y,aim,spd,c,0);break;
    case 'aimed3':for(let i=-1;i<=1;i++)eShot(x,y,aim+i*.2,spd,c,0);break;
    case 'fan':{const n=dens(sp.n||5),spr=sp.spread||.8,base=sp.aim?aim:-PI/2;for(let i=0;i<n;i++)eShot(x,y,base-spr/2+spr*(n===1?.5:i/(n-1)),spd,c,0);}break;
    case 'ring':{const n=dens(sp.n||8);em.a+=(sp.rot||.3);for(let i=0;i<n;i++)eShot(x,y,em.a+i*TAU/n,spd,c,1);}break;
    case 'spiral':{const n=sp.n||2;em.a+=(sp.rot||2)*sp.cd;for(let i=0;i<n;i++)eShot(x,y,em.a+i*TAU/n,spd,c,0);}break;
    case 'burst':em.bn=sp.n||3;em.bt=0;em.bs=spd;em.bc=c;break;
    case 'wall':{const n=dens(sp.n||9),gapAt=Math.floor(rand(1,n-1));for(let i=0;i<n;i++){if(Math.abs(i-gapAt)<=0)continue;const xx=x+(i-(n-1)/2)*.55;eShot(xx,y,-PI/2,spd*.8,c,1);}}break;
    case 'flower':{const n=dens(sp.n||8);em.a+=.35;for(let i=0;i<n;i++){const a=em.a+i*TAU/n;eShot(x,y,a,spd,c,0,.55);eShot(x,y,a+PI/n,spd,c,0,-.55);}}break;
    case 'rain':{const n=dens(sp.n||5);for(let i=0;i<n;i++)eShot(x+rand(-1,1),y,-PI/2+rand(-.45,.45),spd*rand(.7,1.15),c,0);}break;
  }
}
function tickEm(em,x,y,dt,rate,isBoss){
  if(em.bn>0){em.bt-=dt;if(em.bt<=0){em.bt+=.075;em.bn--;eShot(x,y,Math.atan2(ply.y-y,ply.x-x),em.bs,em.bc,2);}}
  em.t-=dt*rate;if(em.t<=0){em.t+=em.sp.cd;emit(em.sp,x,y,em,isBoss);}
}

/* ================================================================ PLAYER */
function resetPlayer(){
  const st=ply.st=shipStats();ply.maxA=st.maxA;ply.maxS=st.maxS;ply.armor=st.maxA;ply.shield=st.maxS;ply.spd=st.spd;ply.energy=60;
  ply.x=ply.tx=0;ply.y=ply.ty=B.bottom+(B.yMin-B.bottom)+1.2;ply.vx=0;ply.bank=0;ply.inv=1.2;ply.rd=0;ply.alive=true;ply.fireT=0;ply.sideT=0;
  ply.boost=0;ply.beam=0;ply.flash=0;ply.shF=0;ship.visible=true;
  const sl=S.special.own[S.special.eq]||1;ply.beamW=LAS_W[sl-1];ply.beamD=LAS_D[sl-1];
}
const frontLv=()=>S.front.own[S.front.eq]||1;
function fireFront(){
  const w=S.front.eq,L=Math.min(8,frontLv()+ply.boost),x=ply.x,y=ply.y+.55;
  if(w==='spread'){const [n,spr,rate,dmg]=SPREAD[L-1];for(let i=0;i<n;i++){const k=n===1?0:i/(n-1)-.5;pShot(x+k*.3,y,PI/2-k*spr,17,dmg,1,0,0,1.4);}return rate;}
  if(w==='lance'){const [n,,rate,dmg]=LANCE[L-1];const pr=1+Math.floor(L/3);for(let i=0;i<n;i++){const k=n===1?0:i/(n-1)-.5;pShot(x+k*.5*Math.min(n,3),y,PI/2-k*.06,19,dmg,2,pr,0,1.6);}return rate;}
  const [n,spr,rate,dmg]=PULSE[L-1];
  for(let i=0;i<n;i++){const k=n===1?0:i/(n-1)-.5;pShot(x+k*.16*Math.min(n,4),y,PI/2-k*spr,22,dmg,0,0,0,1.2);}
  return rate;
}
function fireSide(){
  const k=S.side.eq;if(!k)return 1;const lv=S.side.own[k]||1,[rate,dmg]=SIDE_T[k][lv-1],y=ply.y;
  if(k==='twin'){for(const s of [-1,1])pShot(ply.x+s*.48,y+.2,PI/2,20,dmg,3);}
  else if(k==='seeker'){ply.sideAlt^=1;const s=ply.sideAlt?1:-1;pShot(ply.x+s*.48,y+.1,PI/2+s*.6,9,dmg,4,0,1,2.6);}
  else{for(const s of [-1,1])pShot(ply.x+s*.48,y+.15,PI/2-s*.32,20,dmg,6,1);}
  return rate;
}
function useSpecial(){
  if(state!=='play'||!ply.alive)return;const k=S.special.eq,lv=S.special.own[k]||1,cost=SPECIAL[k].cost[lv-1];
  if(ply.energy<cost||ply.beam>0)return;ply.energy-=cost;
  if(k==='bomb'){
    let c=0;for(let i=0;i<eb.n;i++){if((c++)%3===0)part(eb.x[i],eb.y[i],.3,0,0,.35,.5,.1,COL.violet,0,0);}eb.n=0;
    for(const e of EN)if(e.alive&&e.entered)hurtEnemy(e,BOMB_D[lv-1],true);
    if(boss.on&&!boss.enter&&boss.dying<=0)hurtBoss(BOMB_B[lv-1]);
    for(let i=0;i<3;i++)part(ply.x,ply.y,.4,0,0,.6+i*.15,.5,26+i*6,i?COL.violet:COL.white,1,0);
    const f=$('flash');f.classList.remove('go');void f.offsetWidth;f.classList.add('go');shake(.9);Snd.play('bomb');vibe(60);
  }else if(k==='missiles'){
    const n=MIS_N[lv-1];for(let i=0;i<n;i++){const s=i%2?1:-1,a=PI/2+s*(.4+(i>>1)*.18);pShot(ply.x+s*.3,ply.y,a,7,4,5,0,2,3.2);}Snd.play('missile');
  }else{ply.beam=LAS_T[lv-1];Snd.play('laser',ply.beam);}
}
function hurt(dmg){
  if(ply.inv>0||!ply.alive||ply.god)return;dmg*=DF().dmg;ply.inv=.3;ply.rd=ply.st.sd;
  if(ply.shield>0){const a=Math.min(ply.shield,dmg);ply.shield-=a;dmg-=a;ply.shF=1;Snd.play('shield');}
  if(dmg>0){ply.armor-=dmg;ply.flash=1;run.hullHit=true;shake(.35);Snd.play('hurt');vibe(35);}
  if(ply.armor<=0)killPlayer();
}
function killPlayer(){ply.armor=0;ply.alive=false;ship.visible=false;ply.beam=0;boom(ply.x,ply.y,3,COL.cyan,6);boom(ply.x+.3,ply.y+.2,1.5,COL.orange,1);
  Snd.play('die');vibe([60,40,120]);run.deadT=2.4;S.stats.deaths++;}

/* ================================================================ ENEMIES */
function hurtEnemy(e,dmg,noSpark){
  e.hp-=dmg;if(e.flash<.15)e.flash=e.d.hp>=30?.6:1;if(!noSpark)Snd.play('hit');
  if(e.hp<=0)killEnemy(e,true);
}
function killEnemy(e,byPlayer){
  e.alive=false;if(!byPlayer)return;const d=e.d,big=d.hp>=30?1.6:d.hp>=9?1:.55;
  const c=e.type==='drone'||e.type==='mite'?COL.orange:e.type==='gunship'?COL.violet:e.type==='rock'?[.75,.62,.52]:e.type==='elite'?COL.pink:e.type==='turret'?COL.yellow:COL.pink;
  const dc={dart:0,mite:1,drone:1,gunship:2,turret:3,rock:4,elite:5}[e.type];
  boom(e.x,e.y,big,c,dc);
  run.score+=d.score*DF().score;run.kills++;S.stats.kills++;
  const dr=d.drop||{},cr=DF().cred;
  if(dr.cr&&Math.random()<dr.cr[0]){const v=dr.cr[1];if(v>=40){pickup(e.x,e.y,1,Math.round(v*cr));if(v>=80)pickup(e.x+.3,e.y,1,Math.round(v*.5*cr));}else pickup(e.x,e.y,0,Math.round(v*cr));}
  if(dr.pw&&Math.random()<dr.pw)pickup(e.x,e.y,3);
  else if(dr.sh&&Math.random()<dr.sh)pickup(e.x,e.y,2);
  else if(dr.ar&&Math.random()<dr.ar)pickup(e.x,e.y,4);
  else if(dr.en&&Math.random()<dr.en)pickup(e.x,e.y,5);
  if(e.group){e.group.killed++;if(e.group.killed===e.group.left){pickup(e.x,e.y,Math.random()<.6?3:2);toast('Formation down',COL.green);}}
}
function updEnemy(e,dt){
  e.t+=dt;e.px=e.x;e.py=e.y;
  switch(e.path){
    case 'down':e.y-=e.spd*dt;break;
    case 'sine':e.y-=e.spd*dt;e.x=e.x0+Math.sin(e.t*e.f+e.ph)*e.amp;break;
    case 'snake':e.y-=e.spd*.8*dt;e.x=e.x0+Math.sin(e.t*e.f)*e.amp;break;
    case 'dive':if(e.st===0){e.y-=e.spd*dt;if(e.y<=e.ty){e.st=1;const a=Math.atan2(ply.y-e.y,ply.x-e.x);e.vx=Math.cos(a)*e.spd*1.5;e.vy=Math.min(-2,Math.sin(a)*e.spd*1.5);}}
      else{e.x+=e.vx*dt;e.y+=e.vy*dt;}break;
    case 'hover':if(e.st===0){e.y+=(e.ty-e.y)*Math.min(1,dt*1.8);e.x=e.x0+Math.sin(e.t*.8)*.4;if(e.y-e.ty<.4){e.hold-=dt;if(e.hold<=0){e.st=1;e.vy=0;}}}
      else{e.vy+=3*dt;e.y+=e.vy*dt;}break;
    case 'arc':if(e.t<e.turnT)e.ang+=e.turn*dt;e.x+=Math.cos(e.ang)*e.spd*dt;e.y+=Math.sin(e.ang)*e.spd*dt;break;
    case 'scroll':e.y-=e.spd*dt;e.x+=e.vx*dt;break;
  }
  const d=e.d;
  if(d.spin)e.rz+=e.spin*dt;
  else if(d.tumble){e.rx+=e.wx*dt;e.ry+=e.wy*dt;}
  else if(d.aimer)e.rz=Math.atan2(ply.y-e.y,ply.x-e.x)-PI/2;
  else if(d.face)e.rz=PI;
  else{const dx=e.x-e.px,dy=e.y-e.py;if(dx*dx+dy*dy>1e-6){e.rz=Math.atan2(dy,dx)-PI/2;e.ry=clamp(-dx/dt*.12,-.8,.8);}}
  e.flash=Math.max(0,e.flash-dt*8);
  if(!e.entered&&e.y<B.top-.3&&Math.abs(e.x)<hw(e.y))e.entered=true;
  if(e.ems&&e.entered&&ply.alive&&e.y>ply.y+1.3&&!(e.path==='hover'&&e.st===1)){
    const rate=DF().rate*run.L.rate;for(const em of e.ems)tickEm(em,e.x,e.y-.3,dt,rate,false);}
  if(e.y<B.bottom-2||(e.entered&&e.y>B.top+3)||(e.t>3&&Math.abs(e.x)>hw(e.y)+3)){e.alive=false;}
  // body collision
  if(ply.alive){const dx=e.x-ply.x,dy=e.y-ply.y,r=e.r+.3;if(dx*dx+dy*dy<r*r){hurt(e.type==='mite'?3:5);hurtEnemy(e,8,true);}}
}

/* ================================================================ BOSS */
function spawnBoss(){
  const key=run.L.boss,d=BOSSES[key],mat=makeMat(false),m=BMODELS[key](mat);scene.add(m.group);
  const hp=d.hp*DF().hp;
  Object.assign(boss,{on:true,key,d,m,mat,hp,max:hp,x:0,y:B.top+5,by:B.top-3.4,t:0,ph:-1,enter:true,dying:0,flash:0,ems:[],spawnT:0,dash:0,dashT:3,dashSt:0,boomT:0,hitCD:0});
  setPhase(0);$('bossName').textContent=d.name;$('bossBar').hidden=false;Mus.play('boss',run.lvl);
}
function setPhase(i){boss.ph=i;const p=boss.d.phases[i];boss.p=p;boss.ems=p.pat.map(sp=>({sp,t:(sp.delay||0)+.9,a:0,bn:0,bt:0}));
  boss.spawnT=p.spawn?p.spawn.cd*.6:0;boss.dashSt=0;boss.dashT=2.5;$('bossPh').textContent='Phase '+(i+1)+' / '+boss.d.phases.length;
  if(i>0){clearEnemyBullets(true);boss.flash=1;shake(.5);Snd.play('phase');toast('Phase '+(i+1),COL.pink);}}
function clearEnemyBullets(fxOn){if(fxOn)for(let i=0;i<eb.n;i+=2)part(eb.x[i],eb.y[i],.3,0,0,.3,.45,.05,COL.gold,0,0);eb.n=0;}
function hurtBoss(dmg){if(!boss.on||boss.enter||boss.dying>0)return;boss.hp-=dmg;if(boss.hitCD<=0){boss.flash=Math.max(boss.flash,.5);boss.hitCD=.13;}
  const ph=boss.d.phases;if(boss.ph+1<ph.length&&boss.hp/boss.max<=ph[boss.ph+1].at)setPhase(boss.ph+1);
  if(boss.hp<=0){boss.hp=0;boss.dying=2.4;clearEnemyBullets(true);run.timeScale=.35;run.slowT=.9;for(const e of EN)if(e.alive&&e.entered)killEnemy(e,true);}}
function updBoss(dt){
  if(!boss.on)return;const b=boss;b.t+=dt;b.flash=Math.max(0,b.flash-dt*7);b.hitCD-=dt;
  if(b.enter){b.y+=(b.by-b.y)*Math.min(1,dt*1.1);if(b.y-b.by<.1)b.enter=false;}
  else if(b.dying>0){
    b.dying-=dt;b.boomT-=dt;if(b.boomT<=0){b.boomT=.11;boom(b.x+rand(-2,2),b.y+rand(-1.5,1.5),rand(.8,1.6),Math.random()<.5?COL.orange:COL.pink,Math.floor(rand(0,8)));}
    b.x+=rand(-1,1)*.05;
    if(b.dying<=0){boom(b.x,b.y,4,COL.hot,7);boom(b.x,b.y,3,COL.pink,0);shake(1.2);vibe(120);
      for(let i=0;i<14;i++)pickup(b.x+rand(-1.5,1.5),b.y+rand(-1,1),i<8?1:0,Math.round((i<8?50:15)*DF().cred));
      pickup(b.x,b.y,3);run.score+=5000*(run.lvl+1)*DF().score;
      scene.remove(b.m.group);b.m.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});b.mat.dispose();b.on=false;$('bossBar').hidden=true;
      run.clearT=3.2;run.magnet=true;toast('Sector clear',COL.cyan);Mus.play('calm',run.lvl);return;}
  }else{
    const p=b.p,ms=p.ms||1,H=hw(b.by)*.45;
    switch(p.move){
      case 'sway':b.x+=(Math.sin(b.t*.6*ms)*H-b.x)*Math.min(1,dt*2);b.y+=(b.by+Math.sin(b.t*ms*1.1)*.35-b.y)*Math.min(1,dt*3);break;
      case 'circle':b.x+=(Math.cos(b.t*.55*ms)*H-b.x)*Math.min(1,dt*3);b.y+=(b.by-.8+Math.sin(b.t*1.1*ms)*.9-b.y)*Math.min(1,dt*3);break;
      case 'chase':b.x+=clamp(ply.x-b.x,-1,1)*ms*dt*1.6;b.y+=(b.by+Math.sin(b.t)*.3-b.y)*Math.min(1,dt*2);break;
      case 'hold':b.x+=(0-b.x)*Math.min(1,dt*1.5);b.y+=(b.by-.4-b.y)*Math.min(1,dt*1.5);break;
      case 'dash':
        if(b.dashSt===0){b.x+=(Math.sin(b.t*.8)*H-b.x)*Math.min(1,dt*2);b.y+=(b.by-b.y)*Math.min(1,dt*3);b.dashT-=dt;if(b.dashT<=0){b.dashSt=1;b.dashT=.7;b.dx=ply.x;}}
        else if(b.dashSt===1){b.flash=.5+.5*Math.sin(b.t*40);b.dashT-=dt;if(b.dashT<=0)b.dashSt=2;}
        else if(b.dashSt===2){b.x+=(b.dx-b.x)*Math.min(1,dt*6);b.y-=14*dt;if(b.y<Math.max(B.yMin+1,ply.y+.5)){b.dashSt=3;shake(.4);}}
        else{b.y+=6*dt;if(b.y>=b.by){b.dashSt=0;b.dashT=3;}}
        break;
    }
    if(p.move!=='dash'||b.dashSt===0||b.dashSt===3){
      for(const em of b.ems){const sp=em.sp;let ox=0,oy=0;
        if(sp.orb){const a=b.t*sp.orb[1]+(sp.ph||0);ox=Math.cos(a)*sp.orb[0];oy=Math.sin(a)*sp.orb[0];}else if(sp.o){ox=sp.o[0];oy=sp.o[1];}
        tickEm(em,b.x+ox,b.y+oy,dt,DF().rate,true);}
    }
    if(p.spawn){b.spawnT-=dt;if(b.spawnT<=0){b.spawnT=p.spawn.cd;const s=p.spawn;
      if(s.e==='mite')schedule({f:'swarm',e:'mite',n:s.n,x:rand(-.5,.5)});
      else if(s.e==='drone')schedule({f:'pair',e:'drone',p:'hover'});
      else{schedule({f:'side',e:s.e,n:s.n,x:Math.random()<.5?-1:1,gap:.22});}}}
    if(ply.alive){for(const h of b.d.hit){const dx=b.x+h[0]-ply.x,dy=b.y+h[1]-ply.y,r=h[2]+.25;if(dx*dx+dy*dy<r*r){hurt(8);break;}}}
  }
  b.m.anim(b.t,b,dt);b.m.group.position.set(b.x,b.y,0);b.m.group.rotation.y=Math.sin(b.t*.9)*.08;b.mat.userData.flash.value=b.flash;
}

/* ================================================================ LEVEL FLOW */
function clearWorld(){
  pb.n=eb.n=pt.n=db.n=0;for(const e of EN)e.alive=false;for(const p of PK)p.alive=false;
  if(boss.on){scene.remove(boss.m.group);boss.m.group.traverse(o=>{if(o.geometry)o.geometry.dispose();});boss.mat.dispose();boss.on=false;}
  $('bossBar').hidden=true;
}
function startLevel(i){
  i=clamp(i,0,Math.min(S.unlocked,LEVELS.length-1));S.next=i;S.started=true;S.stats.sorties++;save();
  const L=LEVELS[i];
  Object.assign(run,{lvl:i,L,t:0,wi:0,queue:[],bossCalled:false,warnT:0,score:0,kills:0,credits:0,hullHit:false,clearT:0,deadT:0,magnet:false,timeScale:1,slowT:0,rockT:2,shake:0});
  clearWorld();applyTheme(L);hideScreens();$('hud').hidden=false;computeLimits();resetPlayer();setPods();setSpecialIcon();
  state='play';ptrs.clear();moveId=null;lastHud={};banner('Sector '+(i+1),L.name,false);Mus.play('level',i);requestWake();
}
function updateSpawner(dt){
  const L=run.L;
  while(run.wi<L.waves.length&&L.waves[run.wi][0]<=run.t){schedule(L.waves[run.wi][1]);run.wi++;}
  for(let i=run.queue.length-1;i>=0;i--){const q=run.queue[i];if(q.t<=run.t){spawnEnemy(q.e,q.x,q.y,q.p,q.o);run.queue.splice(i,1);}}
  if(L.rocks&&!run.bossCalled){run.rockT-=dt;if(run.rockT<=0){run.rockT=1/L.rocks*rand(.6,1.4);const r=spawnEnemy('rock',rand(-.9,.9)*B.hwB,B.top+1.2,'scroll',{vx:rand(-.4,.4),scale:rand(.7,1.3)});if(r)r.ambient=true;}}
  if(!run.bossCalled&&run.wi>=L.waves.length&&run.queue.length===0){
    let alive=0;for(const e of EN)if(e.alive&&!e.ambient)alive++;
    if(alive===0||run.t>L.length+12){run.bossCalled=true;run.warnT=3.2;banner('Warning','Massive signal inbound',true);Snd.play('warn');Mus.stop();}
  }
  if(run.warnT>0){run.warnT-=dt;if(run.warnT<=0)spawnBoss();}
}

/* ================================================================ STEP */
function step(dt){
  if(run.slowT>0){run.slowT-=dt/Math.max(.01,run.timeScale);if(run.slowT<=0)run.timeScale=1;}
  run.t+=dt;
  // --- player
  const st=ply.st;
  if(ply.alive){
    let kx=0,ky=0;if(keys.ArrowLeft||keys.KeyA)kx--;if(keys.ArrowRight||keys.KeyD)kx++;if(keys.ArrowUp||keys.KeyW)ky++;if(keys.ArrowDown||keys.KeyS)ky--;
    if(kx||ky){ply.tx=ply.x+kx*ply.spd*.12;ply.ty=ply.y+ky*ply.spd*.12;}
    ply.ty=clamp(ply.ty,B.yMin,B.yMax);ply.tx=clamp(ply.tx,-hw(ply.ty)+.55,hw(ply.ty)-.55);
    const dx=ply.tx-ply.x,dy=ply.ty-ply.y,dist=Math.hypot(dx,dy),mv=Math.min(dist,ply.spd*dt);
    const ox=ply.x;if(dist>1e-4){ply.x+=dx/dist*mv;ply.y+=dy/dist*mv;}
    ply.vx=(ply.x-ox)/dt;ply.bank+=(clamp(ply.vx/ply.spd,-1,1)*.65-ply.bank)*Math.min(1,dt*10);
    ply.inv=Math.max(0,ply.inv-dt);ply.flash=Math.max(0,ply.flash-dt*5);ply.shF=Math.max(0,ply.shF-dt*3);ply.muz=Math.max(0,ply.muz-dt);
    if(ply.rd>0)ply.rd-=dt;else ply.shield=Math.min(ply.maxS,ply.shield+st.sr*dt);
    ply.energy=Math.min(100,ply.energy+st.en*dt);
    if(run.clearT<=0){
      ply.fireT-=dt;if(ply.fireT<=0){ply.fireT+=fireFront();ply.muz=.05;Snd.play('shot');}
      ply.sideT-=dt;if(ply.sideT<=0){ply.sideT+=fireSide();}
    }
    if(ply.beam>0){ply.beam-=dt;laser(dt);}
  }else{
    run.deadT-=dt;if(run.deadT<=0){showResult(false);return;}
  }
  // --- spawns, enemies, boss
  if(ply.alive&&run.clearT<=0)updateSpawner(dt);
  for(const e of EN)if(e.alive)updEnemy(e,dt);
  updBoss(dt);
  // --- player bullets
  for(let i=pb.n-1;i>=0;i--){
    pb.life[i]-=dt;
    if(pb.home[i]){
      pb.tt[i]-=dt;if(pb.tt[i]<=0){pb.tt[i]=.15;pb.tgt[i]=nearestTarget(pb.x[i],pb.y[i]);}
      const tg=pb.tgt[i];let tx,ty,ok=false;
      if(tg===-2&&boss.on&&!boss.enter&&boss.dying<=0){tx=boss.x;ty=boss.y;ok=true;}else if(tg>=0&&EN[tg].alive){tx=EN[tg].x;ty=EN[tg].y;ok=true;}
      const sp=Math.hypot(pb.vx[i],pb.vy[i]),max=pb.home[i]===2?17:12,ns=Math.min(max,sp+dt*(pb.home[i]===2?22:8));
      let a=Math.atan2(pb.vy[i],pb.vx[i]);
      if(ok){let da=Math.atan2(ty-pb.y[i],tx-pb.x[i])-a;da=Math.atan2(Math.sin(da),Math.cos(da));a+=clamp(da,-7*dt,7*dt);}
      pb.vx[i]=Math.cos(a)*ns;pb.vy[i]=Math.sin(a)*ns;
      if(pb.home[i]===2&&Math.random()<.5)part(pb.x[i],pb.y[i],.2,0,0,.3,.22,.05,COL.orange,0,0);
    }
    pb.x[i]+=pb.vx[i]*dt;pb.y[i]+=pb.vy[i]*dt;
    let dead=pb.life[i]<=0||pb.y[i]>B.top+1||pb.y[i]<B.bottom-1||Math.abs(pb.x[i])>hw(pb.y[i])+1;
    if(!dead){
      const x=pb.x[i],y=pb.y[i];
      for(const e of EN){if(!e.alive||!e.entered||pb.last[i]===e.uid)continue;const dx=e.x-x,dy=e.y-y,r=e.r+.12;
        if(dx*dx+dy*dy<r*r){sparks(x,y,2,PB_VIS[pb.kind[i]][0],4,.18,.18);hurtEnemy(e,pb.dmg[i]);
          if(pb.pierce[i]>0){pb.pierce[i]--;pb.last[i]=e.uid;}else{dead=true;}break;}}
      if(!dead&&boss.on&&!boss.enter&&boss.dying<=0&&pb.last[i]!==-2){
        for(const h of boss.d.hit){const dx=boss.x+h[0]-x,dy=boss.y+h[1]-y,r=h[2]+.1;if(dx*dx+dy*dy<r*r){sparks(x,y,2,PB_VIS[pb.kind[i]][0],4,.2,.2);hurtBoss(pb.dmg[i]);Snd.play('hit');
          if(pb.pierce[i]>0){pb.pierce[i]--;pb.last[i]=-2;}else dead=true;break;}}}
    }
    if(dead)rmPB(i);
  }
  // --- enemy bullets
  const pr=.15,px=ply.x,py=ply.y;
  for(let i=eb.n-1;i>=0;i--){
    eb.t[i]+=dt;
    if(eb.cv[i]&&eb.t[i]<2.4){const a=eb.cv[i]*dt,c=Math.cos(a),s=Math.sin(a),vx=eb.vx[i];eb.vx[i]=vx*c-eb.vy[i]*s;eb.vy[i]=vx*s+eb.vy[i]*c;}
    eb.x[i]+=eb.vx[i]*dt;eb.y[i]+=eb.vy[i]*dt;const x=eb.x[i],y=eb.y[i];
    if(y<B.bottom-1||y>B.top+2.5||Math.abs(x)>hw(y)+1.5){rmEB(i);continue;}
    if(ply.alive){const dx=x-px,dy=y-py,r=(eb.big[i]===1?.2:.12)+pr;if(dx*dx+dy*dy<r*r){hurt(3);sparks(x,y,5,EBC[eb.c[i]],4,.25,.25);rmEB(i);}}
  }
  // --- pickups
  for(const p of PK){if(!p.alive)continue;p.t+=dt;
    const dx=ply.x-p.x,dy=ply.y-p.y,d2=dx*dx+dy*dy;
    if(ply.alive&&(run.magnet||d2<6.5)){const d=Math.sqrt(d2)||1,sp=run.magnet?16:10;p.vx+=(dx/d*sp-p.vx)*Math.min(1,dt*6);p.vy+=(dy/d*sp-p.vy)*Math.min(1,dt*6);}
    else{p.vx*=Math.exp(-2*dt);p.vy+=(-2-p.vy)*Math.min(1,dt*1.4);}
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    if(ply.alive&&d2<.55){p.alive=false;collect(p);}else if(p.y<B.bottom-1.5)p.alive=false;}
  // --- level clear countdown
  if(run.clearT>0){run.clearT-=dt;if(run.clearT<=0){showResult(true);return;}}
  updFx(dt);
}
function rmPB(i){const j=--pb.n;if(i!==j)for(const k of ['x','y','vx','vy','dmg','life','kind','pierce','last','home','tgt','tt'])pb[k][i]=pb[k][j];}
function rmEB(i){const j=--eb.n;if(i!==j){eb.x[i]=eb.x[j];eb.y[i]=eb.y[j];eb.vx[i]=eb.vx[j];eb.vy[i]=eb.vy[j];eb.c[i]=eb.c[j];eb.big[i]=eb.big[j];eb.cv[i]=eb.cv[j];eb.t[i]=eb.t[j];}}
function nearestTarget(x,y){let best=-1,bd=1e9;for(let i=0;i<EN.length;i++){const e=EN[i];if(!e.alive||!e.entered)continue;const d=(e.x-x)**2+(e.y-y)**2;if(d<bd){bd=d;best=i;}}
  if(boss.on&&!boss.enter&&boss.dying<=0){const d=(boss.x-x)**2+(boss.y-y)**2;if(d<bd)best=-2;}return best;}
function laser(dt){
  const w=ply.beamW,x=ply.x,y=ply.y,dmg=ply.beamD*dt;
  for(const e of EN){if(!e.alive||!e.entered||e.y<y)continue;if(Math.abs(e.x-x)<w/2+e.r){hurtEnemy(e,dmg,true);if(Math.random()<.4)sparks(e.x,e.y,1,COL.hot,5,.25,.2);}}
  if(boss.on&&!boss.enter&&boss.dying<=0){for(const h of boss.d.hit){if(Math.abs(boss.x+h[0]-x)<w/2+h[2]&&boss.y+h[1]>y){hurtBoss(dmg);if(Math.random()<.5)sparks(boss.x+h[0]+rand(-.4,.4),boss.y+h[1]-h[2]*.8,1,COL.hot,5,.25,.2);break;}}}
  for(let i=eb.n-1;i>=0;i--)if(eb.y[i]>y&&Math.abs(eb.x[i]-x)<w/2+.15){part(eb.x[i],eb.y[i],.3,0,0,.2,.35,.05,COL.white,0,0);rmEB(i);}
  shake(.015);
}
function collect(p){
  switch(p.type){
    case 0:case 1:S.credits+=p.val;run.credits+=p.val;Snd.play('credit');break;
    case 2:ply.shield=ply.maxS;ply.rd=0;toast('Shield restored',COL.blue);Snd.play('pick');break;
    case 3:if(ply.boost<2&&frontLv()+ply.boost<8){ply.boost++;toast('Power +'+ply.boost,COL.green);}else{run.score+=500;ply.energy=Math.min(100,ply.energy+25);toast('+500',COL.green);}Snd.play('power');break;
    case 4:ply.armor=Math.min(ply.maxA,ply.armor+ply.maxA*.35);toast('Hull patched',COL.orange);Snd.play('pick');break;
    case 5:ply.energy=Math.min(100,ply.energy+35);toast('Energy +35',COL.violet);Snd.play('pick');break;
  }
}
function updFx(dt){
  for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){const j=--pt.n;if(i!==j)for(const k of ['x','y','z','vx','vy','l','m','s0','s1','r','g','b','sh','dr'])pt[k][i]=pt[k][j];continue;}
    const dr=Math.max(0,1-pt.dr[i]*dt);pt.vx[i]*=dr;pt.vy[i]*=dr;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;}
  for(let i=db.n-1;i>=0;i--){db.l[i]-=dt;if(db.l[i]<=0){const j=--db.n;if(i!==j)for(const k of ['x','y','z','vx','vy','vz','rx','ry','rz','wx','wy','wz','l','m','s','c'])db[k][i]=db[k][j];continue;}
    db.x[i]+=db.vx[i]*dt;db.y[i]+=db.vy[i]*dt;db.z[i]+=db.vz[i]*dt;db.vz[i]-=9*dt;db.vx[i]*=1-1.5*dt;db.vy[i]*=1-1.5*dt;
    db.rx[i]+=db.wx[i]*dt;db.ry[i]+=db.wy[i]*dt;db.rz[i]+=db.wz[i]*dt;}
  run.shake*=Math.exp(-dt*7);
}

/* ================================================================ DRAW */
const _col=new T.Color();
function draw(dt,now){
  // camera shake
  const sk=run.shake*.35;camera.position.set(camBase.x+(Math.random()-.5)*sk,camBase.y+(Math.random()-.5)*sk,camBase.z);
  // ship
  const showShip=state==='play'||state==='paused'?ply.alive:(state==='title');
  ship.visible=showShip;
  if(state==='title'){ply.x=Math.sin(now*.0007)*1.2;ply.y=lerp(B.bottom,B.top,.38)+Math.sin(now*.0013)*.3;ply.bank=-Math.cos(now*.0007)*.4;ply.alive=true;}
  if(ship.visible){ship.position.set(ply.x,ply.y,0);ship.rotation.y=-ply.bank;ship.rotation.z=0;shipMat.userData.flash.value=ply.flash;
    const fl=.75+Math.random()*.4,ex=.14;
    for(const s of [-1,1]){fx.push(ply.x+s*ex,ply.y-.64,.05,0,.22,.55*fl,2,.95,COL.orange);fx.push(ply.x+s*ex,ply.y-.6,.06,0,.34,.34,0,.8,COL.hot);}
    if(ply.muz>0)fx.push(ply.x,ply.y+.62,.2,0,.55,.55,0,.9,PB_VIS[S.front.eq==='lance'?2:S.front.eq==='spread'?1:0][0]);
    if(state==='play'){fx.push(ply.x,ply.y,.4,0,.24,.24,0,.9,COL.white);
      if(ply.shF>0)fx.push(ply.x,ply.y,.3,0,1.9,1.9,1,ply.shF*.9,COL.blue);
      if(ply.beam>0){const top=B.top+1,len=top-ply.y,cy=(top+ply.y)/2+.3,fl2=.85+Math.random()*.3;
        fx.push(ply.x,cy,.25,0,ply.beamW*2.6*fl2,len,2,.9,COL.violet);fx.push(ply.x,cy,.26,0,ply.beamW*1.1,len,2,1,COL.hot);fx.push(ply.x,ply.y+.6,.3,0,1.4*fl2,1.4*fl2,0,1,COL.white);}}
  }
  // player bullets
  for(let i=0;i<pb.n;i++){const v=PB_VIS[pb.kind[i]];const rot=Math.atan2(pb.vy[i],pb.vx[i])-PI/2;fx.push(pb.x[i],pb.y[i],.15,rot,v[1],v[2],0,1,v[0]);}
  // particles
  for(let i=0;i<pt.n;i++){const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_tmp[0]=pt.r[i];_tmp[1]=pt.g[i];_tmp[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_tmp);}
  // enemy bullets
  for(let i=0;i<eb.n;i++){const bg=eb.big[i];if(bg===2){fx.push(eb.x[i],eb.y[i],.18,0,.6,.6,0,.5,EBC[eb.c[i]]);ebR.push(eb.x[i],eb.y[i],.2,Math.atan2(eb.vy[i],eb.vx[i])-PI/2,.36,.8,0,1,EBC[eb.c[i]]);}
    else ebR.push(eb.x[i],eb.y[i],.2,0,bg?.92:.62,bg?.92:.62,0,1,EBC[eb.c[i]]);}
  // enemies
  for(const k in EMESH)EMESH[k].n=0;
  for(const e of EN){if(!e.alive)continue;const M_=EMESH[e.type];if(M_.n>=M_.cap)continue;const i=M_.n++;
    _m4.compose(_p.set(e.x,e.y,0),_q.setFromEuler(_e.set(e.rx,e.ry,e.rz)),_s.setScalar(e.s));M_.m.setMatrixAt(i,_m4);M_.fl.array[i]=e.flash;
    if(e.type==='elite'||e.type==='drone')fx.push(e.x,e.y,.1,0,e.r*3,e.r*3,0,.25,e.type==='elite'?COL.pink:COL.orange);}
  for(const k in EMESH){const M_=EMESH[k];M_.m.count=M_.n;M_.m.instanceMatrix.needsUpdate=true;M_.fl.needsUpdate=true;}
  // pickups
  let no=0,nb=0;const tt=now*.001;
  for(const p of PK){if(!p.alive)continue;const ty=PKT[p.type],m=ty.oct?pkOct:pkBox,i=ty.oct?no++:nb++;if(i>=(ty.oct?120:60))continue;
    const pulse=1+Math.sin(tt*6+p.t)*.08;_m4.compose(_p.set(p.x,p.y,.2),_q.setFromEuler(_e.set(tt*1.3+p.t,tt*2+p.t,tt+p.t)),_s.setScalar(ty.s*pulse));
    m.setMatrixAt(i,_m4);m.setColorAt(i,ty.col);fx.push(p.x,p.y,.1,0,ty.s*3.2,ty.s*3.2,0,p.type>=2?.7:.45,ty.h);
    if(p.type===3)fx.push(p.x,p.y,.12,0,ty.s*4*pulse,ty.s*4*pulse,1,.8,COL.green);}
  pkOct.count=Math.min(no,120);pkBox.count=Math.min(nb,60);
  for(const m of [pkOct,pkBox]){m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  // debris
  for(let i=0;i<db.n;i++){const k=db.l[i]/db.m[i];_m4.compose(_p.set(db.x[i],db.y[i],db.z[i]),_q.setFromEuler(_e.set(db.rx[i],db.ry[i],db.rz[i])),_s.setScalar(db.s[i]*Math.min(1,k*2)));
    dbMesh.setMatrixAt(i,_m4);dbMesh.setColorAt(i,DB_COL[db.c[i]|0]);}
  dbMesh.count=db.n;dbMesh.instanceMatrix.needsUpdate=true;dbMesh.instanceColor.needsUpdate=true;
  fx.flush();ebR.flush();
  renderer.render(scene,camera);
}
const _tmp=[0,0,0];

/* ================================================================ HUD */
let lastHud={};
function setIf(k,v,fn){if(lastHud[k]!==v){lastHud[k]=v;fn(v);}}
function hud(){
  setIf('score',Math.round(run.score),v=>$('hScore').textContent=fmt(v));
  setIf('cred',S.credits,v=>$('hCred').textContent=fmt(v));
  setIf('lvl',run.lvl,v=>$('hLvl').textContent='Sector '+(v+1)+' · '+LEVELS[v].name);
  setIf('prog',Math.round(Math.min(1,run.t/(run.L.length+4))*100),v=>$('hProg').style.transform='scaleX('+v/100+')');
  setIf('sh',Math.round(ply.shield/ply.maxS*100),v=>$('hSh').style.transform='scaleX('+v/100+')');
  setIf('ar',Math.round(ply.armor/ply.maxA*100),v=>{$('hAr').style.transform='scaleX('+v/100+')';$('hArW').classList.toggle('low',v<30);});
  setIf('pow',frontLv()+'|'+ply.boost,()=>$('hPow').textContent=frontLv()+(ply.boost?' +'+ply.boost:''));
  const k=S.special.eq,lv=S.special.own[k]||1,cost=SPECIAL[k].cost[lv-1];
  setIf('en',Math.round(ply.energy),v=>$('enRing').style.strokeDashoffset=(276.5*(1-v/100)).toFixed(1));
  setIf('rdy',ply.energy>=cost&&ply.beam<=0&&ply.alive,v=>$('bSpecial').classList.toggle('ready',v));
  if(boss.on)setIf('boss',Math.round(boss.hp/boss.max*200),v=>$('bossHp').style.transform='scaleX('+v/200+')');
}
const ICONS={bomb:'<circle cx="20" cy="20" r="7" fill="currentColor"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M20 3v6M20 31v6M3 20h6M31 20h6M8 8l4 4M28 28l4 4M32 8l-4 4M8 32l4-4"/></g>',
  missiles:'<g fill="currentColor"><path d="M20 4l5 10h-10z"/><path d="M9 14l4 8H5z"/><path d="M31 14l4 8h-8z"/><rect x="17" y="14" width="6" height="16" rx="1"/><rect x="7" y="22" width="4" height="10" rx="1"/><rect x="29" y="22" width="4" height="10" rx="1"/></g>',
  laser:'<g fill="currentColor"><rect x="16" y="2" width="8" height="30" rx="4"/><rect x="10" y="30" width="20" height="7" rx="2"/></g><rect x="19" y="2" width="2" height="30" fill="#fff"/>'};
function setSpecialIcon(){const k=S.special.eq;$('spIco').innerHTML=ICONS[k];$('spName').textContent=SPECIAL[k].short;}
function toast(txt,c){const t=$('toast');t.textContent=txt;t.style.color='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';t.classList.remove('go');void t.offsetWidth;t.classList.add('go');}
function banner(eye,txt,warn){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.toggle('warn',!!warn);b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}

/* ================================================================ SCREENS */
const SCREENS=['title','shop','pause','result','settings'];
function hideScreens(){for(const s of SCREENS)$(s).hidden=true;}
function goTitle(){
  state='title';clearWorld();hideScreens();$('hud').hidden=true;$('title').hidden=false;$('tMain').hidden=false;$('tNewPanel').hidden=true;
  applyTheme(LEVELS[S.next]||LEVELS[0]);setPods();
  const c=$('tCont');c.hidden=!S.started;c.textContent='Continue · Sector '+(S.next+1);
  $('tNew').className=S.started?'':'primary';$('tBest').textContent=fmt(S.best);Mus.play('calm',S.next);releaseWake();
}
let shopTab='front',newDiff='normal',confirmNew=false,confirmReset=false;
function goShop(){state='shop';clearWorld();hideScreens();$('hud').hidden=true;$('shop').hidden=false;applyTheme(LEVELS[S.next]);renderShop();Mus.play('calm',S.next);releaseWake();}
function renderShop(){
  $('sCred').textContent=fmt(S.credits);
  const i=S.next,L=LEVELS[i];$('sNo').textContent='Sector '+(i+1)+' of '+LEVELS.length;$('sName').textContent=L.name;
  $('sMeta').textContent=(S.lvlBest[i]?'Best '+fmt(S.lvlBest[i]):'Not cleared yet')+' · Boss: '+BOSSES[L.boss].name;
  $('sPrev').disabled=i<=0;$('sNext').disabled=i>=Math.min(S.unlocked,LEVELS.length-1);
  $('sLaunch').textContent='Launch sector '+(i+1);
  for(const b of $('sTabs').children)b.classList.toggle('on',b.dataset.tab===shopTab);
  for(const b of $('sDiff').children)b.classList.toggle('on',b.dataset.v===S.diff);
  const pips=(l,m)=>'<span class="pips" aria-label="Level '+l+' of '+m+'">'+Array.from({length:m},(_,k)=>'<i'+(k<l?' class="on"':'')+'></i>').join('')+'</span>';
  const btn=(act,cat,key,label,cost)=>'<button class="'+(act==='buy'||act==='up'?'buy':'')+'" data-act="'+act+'" data-cat="'+cat+'" data-key="'+key+'"'+(cost!=null&&cost>S.credits?' disabled':'')+'>'+label+'</button>';
  let h='';
  if(shopTab==='hull'){
    const st=shipStats();
    for(const k in HULL){const d=HULL[k],l=S.ship[k],nx=l<d.max?d.up[l]:null;
      const stat={armor:['Hull',st.maxA,12+5*l],shield:['Shield',st.maxS,8+4*l],engine:['Speed',st.spd.toFixed(1),(11+2.6*l).toFixed(1)],gen:['Energy/s',st.en.toFixed(1),(5+2.5*l).toFixed(1)]}[k];
      h+='<div class="item"><div class="it-top"><div class="it-name">'+d.name+'</div>'+pips(l,d.max)+'</div><div class="it-desc">'+d.desc+'</div>'+
        '<div class="it-stat">'+stat[0]+' '+stat[1]+(nx!=null?' <em>&rarr; '+stat[2]+'</em>':'')+'</div><div class="it-act">'+
        (nx!=null?btn('up','hull',k,'Upgrade · '+fmt(nx)+' CR',nx):'<button class="lbl" disabled>Maxed</button>')+'</div></div>';}
  }else{
    const cat=shopTab,DB={front:FRONT,side:SIDE,special:SPECIAL}[cat],own=S[cat].own,eq=S[cat].eq;
    for(const k in DB){const d=DB[k],l=own[k]||0,nx=l&&l<d.max?d.up[l]:null;
      let stat='';
      if(cat==='front')stat=l?'Lv '+l+' · '+dps(k,l)+' DPS'+(nx!=null?' <em>&rarr; '+dps(k,l+1)+'</em>':''):'Lv 1 · '+dps(k,1)+' DPS';
      else if(cat==='side'){const t=SIDE_T[k][Math.max(0,l-1)];stat='Lv '+Math.max(1,l)+' · '+Math.round(t[1]/t[0]*(k==='seeker'?1:2))+' DPS';}
      else{const lv=Math.max(1,l),c=d.cost[lv-1];stat='Lv '+lv+' · '+c+' energy · '+(k==='bomb'?BOMB_D[lv-1]+' damage':k==='missiles'?MIS_N[lv-1]+' missiles':LAS_T[lv-1]+'s beam');}
      let act='';
      if(!l)act=btn('buy',cat,k,'Buy · '+fmt(d.buy)+' CR',d.buy);
      else{act+=(eq===k?'<button class="lbl" disabled>Equipped</button>':btn('eq',cat,k,'Equip'));
        if(cat==='side'&&eq===k)act+=btn('uneq',cat,k,'Remove');
        act+=nx!=null?btn('up',cat,k,'Upgrade · '+fmt(nx)+' CR',nx):'<button class="lbl" disabled>Maxed</button>';}
      h+='<div class="item'+(eq===k&&l?' eq':'')+'"><div class="it-top"><div class="it-name">'+d.name+'</div>'+pips(l,d.max)+'</div><div class="it-desc">'+d.desc+'</div><div class="it-stat">'+stat+'</div><div class="it-act">'+act+'</div></div>';}
  }
  $('sList').innerHTML=h;
}
function shopAct(act,cat,key){
  if(cat==='hull'){const d=HULL[key],l=S.ship[key];if(act==='up'&&l<d.max&&S.credits>=d.up[l]){S.credits-=d.up[l];S.ship[key]++;Snd.play('buy');}}
  else{const DB={front:FRONT,side:SIDE,special:SPECIAL}[cat],d=DB[key],own=S[cat].own,l=own[key]||0;
    if(act==='buy'&&!l&&S.credits>=d.buy){S.credits-=d.buy;own[key]=1;S[cat].eq=key;Snd.play('buy');}
    else if(act==='up'&&l&&l<d.max&&S.credits>=d.up[l]){S.credits-=d.up[l];own[key]=l+1;Snd.play('buy');}
    else if(act==='eq'&&l){S[cat].eq=key;Snd.play('click');}
    else if(act==='uneq'&&cat==='side'){S.side.eq='';Snd.play('click');}}
  save();renderShop();
}
function showResult(win){
  state='result';$('hud').hidden=true;releaseWake();ply.beam=0;Mus.play('calm',run.lvl);
  const i=run.lvl,L=run.L,rows=[];let bonus=0,hull=0;
  if(win){bonus=Math.round(250*(i+1)*DF().cred);hull=run.hullHit?0:Math.round(150*(i+1)*DF().cred);S.credits+=bonus+hull;
    if(i>=S.cleared)S.cleared=i+1;if(i===S.unlocked&&i<LEVELS.length-1)S.unlocked=i+1;S.next=Math.min(i+1,LEVELS.length-1);}
  S.best=Math.max(S.best,Math.round(run.score));S.lvlBest[i]=Math.max(S.lvlBest[i]||0,Math.round(run.score));save();
  rows.push(['Score',fmt(run.score)],['Kills',fmt(run.kills)],['Credits collected',fmt(run.credits)]);
  if(win){rows.push(['Clear bonus',fmt(bonus)]);rows.push(['Hull intact bonus',hull?fmt(hull):'Hit']);}
  rows.push(['Total earned',fmt(run.credits+bonus+hull)]);
  const r=$('result');r.className='screen dim '+(win?'win':'lose');
  $('rEye').textContent='Sector '+(i+1)+' · '+L.name;
  const final=win&&i===LEVELS.length-1;
  $('rTitle').textContent=final?'The Gate is closed':win?'Sector cleared':'Hull breached';
  $('rSub').textContent=final?'Campaign complete. Every sector stays open for replays, and Hard pays more.':win?'Next up: '+LEVELS[Math.min(i+1,LEVELS.length-1)].name+'. Spend your credits in the hangar first.':'You keep every credit you picked up. Upgrade and try again.';
  $('rRows').innerHTML=rows.map((x,k)=>'<dt'+(k===rows.length-1?' class="tot"':'')+'>'+x[0]+'</dt><dd'+(k===rows.length-1?' class="tot"':'')+'>'+x[1]+'</dd>').join('');
  $('rMain').textContent='Hangar';$('rAlt').textContent=win?'Replay sector':'Retry sector';
  hideScreens();r.hidden=false;
}
let pausedFrom=null;
function pause(){for(const k in keys)keys[k]=false;if(state!=='play')return;state='paused';moveId=null;ptrs.clear();$('pTitle').textContent='Sector '+(run.lvl+1);hideScreens();$('pause').hidden=false;
  Snd.suspend();save();releaseWake();}
function resume(){if(state!=='paused')return;hideScreens();state='play';Snd.init();Snd.resume();last=performance.now();requestWake();}
function openSettings(from){pausedFrom=from;$(from).hidden=true;$('settings').hidden=false;confirmReset=false;renderSettings();}
function closeSettings(){$('settings').hidden=true;$(pausedFrom||'title').hidden=false;if(pausedFrom==='shop')renderShop();}
function renderSettings(){
  for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);
  for(const sg of document.querySelectorAll('#settings .seg'))for(const b of sg.children)b.classList.toggle('on',S.set[sg.dataset.seg]===b.dataset.v);
  $('ctrlHint').textContent=S.set.ctrl==='offset'?'The ship flies to a point just above your finger.':'The ship moves by however far you drag, from wherever you touch.';
  $('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';
}

/* ================================================================ INPUT */
const keys={};let moveId=null,relStart=null;const OFFSET_PX=86;const ptrs=new Map();
function grab(id){const q=ptrs.get(id);moveId=id;const w=screenPlane(q.x,q.y);relStart={fx:w.x,fy:w.y,sx:ply.x,sy:ply.y};}
cv.addEventListener('pointerdown',e=>{
  if(state!=='play')return;ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});try{cv.setPointerCapture(e.pointerId);}catch(_){}
  if(moveId===null){grab(e.pointerId);aimAt(e);}e.preventDefault();
});
cv.addEventListener('pointermove',e=>{const q=ptrs.get(e.pointerId);if(q){q.x=e.clientX;q.y=e.clientY;}if(e.pointerId===moveId&&state==='play')aimAt(e);});
function endPtr(e){ptrs.delete(e.pointerId);if(e.pointerId===moveId){moveId=null;const nx=ptrs.keys().next();if(!nx.done&&state==='play')grab(nx.value);}}
cv.addEventListener('pointerup',endPtr);cv.addEventListener('pointercancel',endPtr);
function aimAt(e){
  if(S.set.ctrl==='relative'){const w=screenPlane(e.clientX,e.clientY);ply.tx=relStart.sx+(w.x-relStart.fx)*1.15;ply.ty=relStart.sy+(w.y-relStart.fy)*1.15;}
  else{const w=screenPlane(e.clientX,e.clientY-OFFSET_PX*Math.min(1.2,rect.height/760));ply.tx=w.x;ply.ty=w.y;}
}
// Browsers skip the click for a secondary touch while another finger is down, so menu buttons activate on that pointerup themselves.
let downBtn=null;
document.addEventListener('pointerdown',e=>{downBtn=!e.isPrimary&&e.target.closest?e.target.closest('.screen button'):null;},true);
document.addEventListener('pointerup',e=>{const b=!e.isPrimary&&e.target.closest?e.target.closest('.screen button'):null;if(b&&b===downBtn&&!b.disabled){e.preventDefault();b.click();}downBtn=null;},true);
$('bSpecial').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();useSpecial();});
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
window.addEventListener('keydown',e=>{keys[e.code]=true;
  if(e.code==='Space'||e.code==='KeyX'){useSpecial();e.preventDefault();}
  if(e.code==='KeyP'||e.code==='Escape'){if(state==='play')pause();else if(state==='paused')resume();}});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
document.addEventListener('touchmove',e=>{if(!e.target.closest||!e.target.closest('.scroll'))e.preventDefault();},{passive:false});
document.addEventListener('touchstart',e=>{if(e.touches.length>1&&!e.target.closest('button'))e.preventDefault();},{passive:false});
for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>{Snd.init();},{once:true});

// Auto-pause when the page is hidden, the phone locks or the window loses focus.
function autoPause(){for(const k in keys)keys[k]=false;if(state==='play')pause();else Snd.suspend();save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else if(state!=='paused'&&state!=='play'){Snd.resume();}last=performance.now();});
window.addEventListener('pagehide',autoPause);window.addEventListener('blur',autoPause);
window.addEventListener('resize',()=>{resize();});
if(window.visualViewport)window.visualViewport.addEventListener('resize',resize);

let wakeLock=null;
function requestWake(){try{if(navigator.wakeLock&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null;});}).catch(()=>{});}catch(e){}}
function releaseWake(){try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}

/* ----- buttons ----- */
$('tCont').onclick=()=>goShop();
$('tNew').onclick=()=>{$('tMain').hidden=true;$('tNewPanel').hidden=false;newDiff=S.diff;confirmNew=false;$('tWarn').hidden=true;markDiff();};
$('tBack').onclick=()=>{$('tMain').hidden=false;$('tNewPanel').hidden=true;};
$('tDiffs').onclick=e=>{const b=e.target.closest('button');if(!b)return;newDiff=b.dataset.d;markDiff();};
function markDiff(){for(const b of $('tDiffs').children)b.classList.toggle('on',b.dataset.d===newDiff);$('tGo').textContent=confirmNew?'Erase and launch':'Launch sector 1';}
$('tGo').onclick=()=>{
  if(S.started&&!confirmNew){confirmNew=true;$('tWarn').hidden=false;markDiff();return;}
  const keep={set:S.set,best:S.best,lvlBest:S.lvlBest,stats:S.stats};S=fresh();Object.assign(S,keep);S.diff=newDiff;S.started=true;save();startLevel(0);};
$('tSet').onclick=()=>openSettings('title');
$('sSet').onclick=()=>openSettings('shop');
$('pSet').onclick=()=>openSettings('pause');
$('sPrev').onclick=()=>{S.next=Math.max(0,S.next-1);save();applyTheme(LEVELS[S.next]);renderShop();};
$('sNext').onclick=()=>{S.next=Math.min(S.unlocked,LEVELS.length-1,S.next+1);save();applyTheme(LEVELS[S.next]);renderShop();};
$('sTabs').onclick=e=>{const b=e.target.closest('button');if(!b)return;shopTab=b.dataset.tab;renderShop();$('sList').scrollTop=0;};
$('sDiff').onclick=e=>{const b=e.target.closest('button');if(!b)return;S.diff=b.dataset.v;save();renderShop();};
$('sList').onclick=e=>{const b=e.target.closest('button[data-act]');if(!b||b.disabled)return;shopAct(b.dataset.act,b.dataset.cat,b.dataset.key);};
$('sLaunch').onclick=()=>startLevel(S.next);
$('pRes').onclick=resume;
$('pRestart').onclick=()=>{Snd.resume();startLevel(run.lvl);};
$('pQuit').onclick=()=>{Snd.resume();save();goShop();};
$('rMain').onclick=()=>goShop();
$('rAlt').onclick=()=>startLevel(run.lvl);
$('setClose').onclick=closeSettings;
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){S.set[t.dataset.set]=!S.set[t.dataset.set];Snd.apply();if(t.dataset.set==='vibe'&&S.set.vibe)vibe(30);save();renderSettings();return;}
  const b=e.target.closest('.seg button');if(b){const k=b.parentElement.dataset.seg;S.set[k]=b.dataset.v;if(k==='gfx'){gfxCap=2;applyPixelRatio();resize();}save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}
    const keep=S.set;S=fresh();S.set=keep;save();confirmReset=false;$('settings').hidden=true;goTitle();}
});

/* ================================================================ LOOP */
let last=performance.now(),perfAcc=0,perfN=0,slowFor=0;
function frame(now){
  requestAnimationFrame(frame);
  let dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(document.hidden)return;
  if(state==='paused'){return;}
  if(state==='play'){
    const ts=run.timeScale,sdt=dt*ts,steps=sdt>1/45?2:1;
    for(let i=0;i<steps&&state==='play';i++)step(sdt/steps);
    if(state==='play')hud();
    // adaptive resolution: drop pixel ratio if frames stay slow
    if(S.set.gfx==='auto'){perfAcc+=dt;perfN++;if(perfN>=30){const avg=perfAcc/perfN;perfAcc=0;perfN=0;
      if(avg>1/50){slowFor++;if(slowFor>=3&&pixelRatio>1){gfxCap=Math.max(1,pixelRatio-.25);applyPixelRatio();resize();slowFor=0;}}else slowFor=0;}}
  }else{updFx(dt);}
  updateBg(dt*(state==='play'?run.timeScale:.6));
  Mus.tick();
  draw(dt,now);
}

/* ================================================================ BOOT */
resize();goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
window.__starwake={get S(){return S;},run,ply,boss,EN,eb,pb,startLevel,goShop,goTitle,step,get state(){return state;},LEVELS,showResult};
})();
