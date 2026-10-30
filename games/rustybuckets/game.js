/* Rusty & Buckets: a team battler and the prelude to Wreckwatch. Two combat engineers follow the Halcyon's distress call
   through twenty battles, each behind a small puzzle. Everything is generated in code; THREE and ARC (shared/kit.js) load first. */
(function(){
'use strict';
const T=THREE, TAU=Math.PI*2, PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v, lerp=(a,b,t)=>a+(b-a)*t, rand=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255];
const pick=a=>a[Math.floor(Math.random()*a.length)];
function seeded(seed){let s=(Math.abs(seed|0)%2147483646)+1;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
const {P,M,geo,makeMat}=ARC;
const REDUCED=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================================================================ SAVE */
const KEY='rustybuckets.save.v1';
function fresh(){return{v:1,stage:0,started:false,done:false,
  heroes:{rusty:{lvl:1,xp:0},buckets:{lvl:1,xp:0}},items:{kit:3,mega:0,spark:1,cell:0},
  set:{sfx:true,music:true,vibe:true,ctrl:'tilt',sens:'med'},stats:{great:0,dodges:0,counters:0,puzzles:0}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&typeof v===typeof a[k])a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ================================================================ THE DUO */
// lane 0 = Rusty (left of screen), lane 1 = Buckets (right). Stats at level 1 plus growth per level.
const HEROES=[
  {id:'rusty',name:'Rusty',hp:26,pow:6,def:3,g:{hp:5,pow:2,def:1},col:0xff8a3d,attack:'Wrench Bash',atkDesc:'One big swing. Tap as it lands.'},
  {id:'buckets',name:'Buckets',hp:20,pow:5,def:2,g:{hp:4,pow:2,def:.6},col:0x3ef0ff,attack:'Arc Weld',atkDesc:'Two quick welds. Tap each spark.'},
];
const xpNeed=l=>10+l*l*6;   // XP from level l to l+1
// Team moves share Team Points. n prompts on the lanes in `seq` ('a' alternate, 'r' random, 'b' both); all = hits every alien.
const TEAM=[
  {id:'relay',name:'Rivet Relay',tp:3,from:0,n:4,gap:.55,seq:'a',k:.9,all:false,desc:'Pass the rivet gun back and forth. Four hits on one alien.'},
  {id:'spin',name:'Spark Spin',tp:5,from:5,n:5,gap:.5,seq:'r',k:.6,all:true,desc:'Spin welding sparks into every alien on the field.'},
  {id:'cannon',name:'Junk Cannon',tp:6,from:10,n:3,gap:.7,seq:'b',k:1.3,all:false,desc:'Load scrap together, then fire. Both of you tap every beat.'},
  {id:'over',name:'Overclock',tp:8,from:15,n:8,gap:.42,seq:'a',k:.55,all:true,desc:'Eight escalating strikes on every alien.'},
];
const ITEMS={
  kit:{name:'Repair Kit',desc:'Restore 16 HP to one engineer.'},
  mega:{name:'Mega Kit',desc:'Restore 16 HP to both engineers.'},
  spark:{name:'Restart Spark',desc:'Revive a downed engineer at half HP.'},
  cell:{name:'Charge Cell',desc:'+5 Team Points.'},
};

/* ================================================================ ALIENS */
// Each alien move is a run of hits: [seconds until it lands, who: t target, o the other one, b both]. m = damage multiplier.
const MOVES={
  bite:{name:'Bite',p:[[.8,'t']],m:1,melee:1},
  shot:{name:'Shot',p:[[1,'t']],m:1},
  double:{name:'Double shot',p:[[.9,'t'],[1.3,'t']],m:.7},
  ring:{name:'Ring burst',p:[[1.1,'b']],m:.8},
  burst:{name:'Burst',p:[[.9,'t'],[1.15,'t'],[1.4,'t']],m:.55},
  roll:{name:'Rolling smash',p:[[1.35,'t']],m:1.3,melee:1},
  fan:{name:'Fan volley',p:[[.9,'t'],[1.2,'o'],[1.5,'t']],m:.7},
  spiral:{name:'Spiral',p:[[.8,'t'],[1.05,'o'],[1.3,'t'],[1.55,'o'],[1.85,'b']],m:.55},
  // boss moves
  cannon:{name:'Core cannon',p:[[1.2,'t'],[1.5,'o']],m:1.1},
  volley:{name:'Turret volley',p:[[.8,'t'],[1,'t'],[1.2,'o'],[1.4,'o'],[1.6,'b']],m:.6},
  coil:{name:'Coil lash',p:[[.7,'t'],[.95,'o'],[1.2,'t'],[1.45,'o'],[1.7,'t'],[1.95,'o']],m:.55},
  flower:{name:'Bloom',p:[[1,'b'],[1.45,'b']],m:.8},
  crown:{name:'Crown barrage',p:[[.75,'t'],[.95,'o'],[1.15,'t'],[1.35,'o'],[1.55,'t'],[1.75,'o'],[2,'b']],m:.5},
  slam:{name:'Bastion slam',p:[[1.6,'b']],m:1.5,melee:1},
  eclipse:{name:'Eclipse wave',p:[[.7,'b'],[1.05,'t'],[1.3,'o'],[1.55,'t'],[1.8,'o'],[2.1,'b']],m:.55},
  nova:{name:'Dark nova',p:[[2,'b']],m:1.8},
};
const FOES={
  mite:{name:'Mite',hp:9,atk:4,def:0,xp:3,s:.95,y:.6,mv:['bite']},
  dart:{name:'Dart',hp:11,atk:5,def:0,xp:4,s:.9,y:1.2,mv:['shot','double']},
  drone:{name:'Drone',hp:18,atk:4,def:1,xp:6,s:.9,y:1.4,mv:['ring','shot']},
  turret:{name:'Spitter',hp:20,atk:5,def:2,xp:7,s:.85,y:.9,mv:['burst']},
  rock:{name:'Meteor',hp:16,atk:6,def:2,xp:5,s:.95,y:.9,mv:['roll']},
  gunship:{name:'Gunship',hp:32,atk:6,def:2,xp:12,s:.75,y:1.5,mv:['fan','shot']},
  elite:{name:'Elite',hp:46,atk:7,def:2,xp:20,s:.7,y:1.7,mv:['spiral','fan']},
};
// Bosses fight twice per turn once they drop below half health.
const BOSS={
  warden:{name:'Warden',hp:105,atk:6,def:2,xp:40,s:.42,y:2.1,mv:['cannon','volley']},
  hydra:{name:'Hydra Coil',hp:190,atk:8,def:3,xp:60,s:.42,y:2.1,mv:['coil','flower']},
  bastion:{name:'Bastion',hp:280,atk:10,def:4,xp:90,s:.4,y:2.1,mv:['crown','slam']},
  eclipse:{name:'Eclipse Core',hp:400,atk:12,def:5,xp:0,s:.36,y:2.3,mv:['eclipse','nova','crown']},
};

/* ================================================================ THE JOURNEY */
const CHAPTERS=[
  {name:'Landing Zone',sky:0x0b0a26,star:0xbfd4ff,planet:[0x4f7bd9,0x2a3f8f,0x9fb8ff],ground:[0x5a6294,0x46507c],key:45,bpm:120,prog:[0,8,3,10]},
  {name:'Cinder Ridge',sky:0x1a0a12,star:0xffd6c0,planet:[0xd9734f,0x8f3a2a,0xffc59f],ground:[0x8a4e40,0x6e3a30],key:43,bpm:126,prog:[0,5,3,10]},
  {name:'Veil Caverns',sky:0x120a2a,star:0xe0c8ff,planet:[0x9a4fd9,0x4a2a8f,0xd8b8ff],ground:[0x6a5294,0x55407f],key:47,bpm:130,prog:[0,8,5,7]},
  {name:'Wreck Field',sky:0x0d1416,star:0xc8ffe8,planet:[0x5ab89a,0x2a5a4a,0xc8ffe0],ground:[0x5e8f85,0x3e605b],key:41,bpm:134,prog:[0,3,8,10]},
];
// pz = the puzzle before the battle: type and size. Gyro puzzles: slide, maze, wind, signal.
const STAGES=[
  {ch:0,name:'Drop Site',pz:['lights',3],foes:['mite','mite'],
    say:[['S','…Halcyon… hull breach… survivors aboard… anyone receiving…'],['B','Rust! That’s the frigate everyone’s been looking for!'],['R','Then we find it before the aliens do. Grab your torch.']]},
  {ch:0,name:'Crater Rim',pz:['slide',1],foes:['dart','mite'],
    say:[['R','The beacon’s past this crater. Only one way down.'],['B','Sled ride! Tilt to steer, right?'],['R','Tilt to steer. Try not to hit every rock this time.']]},
  {ch:0,name:'Debris Trail',pz:['wires',4],foes:['drone','mite'],
    say:[['B','This plating is Halcyon blue. We’re close.'],['R','Blast door. Its wiring’s scrambled. Your job.']]},
  {ch:0,name:'Beacon Hill',pz:['simon',4],foes:['dart','dart','mite'],
    say:[['R','Their relay hut uses a tone lock.'],['B','I’m great at tones. La la LAAA.'],['R','Please don’t.']]},
  {ch:0,name:'The Pass',pz:['crates',0],boss:'warden',
    say:[['S','Warning: large contact holding the pass.'],['R','A Warden. Stay behind me.'],['B','Bertha’s ready.'],['R','…You named my wrench?']]},
  {ch:1,name:'Ash Gate',pz:['wires',5],foes:['turret','mite','mite'],
    say:[['B','It’s so hot my eyebrows are welding themselves.'],['R','You don’t have eyebrows.'],['B','Not anymore!']]},
  {ch:1,name:'Ember Steps',pz:['lights',4],foes:['rock','rock','dart'],
    say:[['R','The signal’s bouncing off this ridge. Panel ahead should boost it.'],['B','Lights puzzle. Every panel lit, every time.']]},
  {ch:1,name:'Vent Maze',pz:['maze',1],foes:['drone','turret'],
    say:[['B','Oops.'],['R','What did you drop.'],['B','The beacon core. Into the vent maze. Tilt it back out?']]},
  {ch:1,name:'Slag Lake',pz:['simon',5],foes:['gunship'],
    say:[['R','Gunship parked on the only bridge.'],['B','The bridge has a tone lock too. Who builds these?'],['R','Aliens with taste.']]},
  {ch:1,name:'Coil Pit',pz:['crates',1],boss:'hydra',
    say:[['S','Contact: serpentine. Very large.'],['B','Is it friendly?'],['R','It’s coiled around our way through. So no.']]},
  {ch:2,name:'Glow Gallery',pz:['simon',6],foes:['drone','drone','mite'],
    say:[['B','Pretty caves. Pretty glowing… watching… caves.'],['R','Keep moving. Signal’s stronger down here.']]},
  {ch:2,name:'Hollow Lift',pz:['crates',2],foes:['gunship','dart'],
    say:[['R','Cargo lift. Crates on the pads should power it.'],['B','I’ll push. You supervise.'],['R','I always supervise.']]},
  {ch:2,name:'Mirror Pool',pz:['lights',5],foes:['turret','turret','mite'],
    say:[['B','There’s our reflection. Rust, you’re rusty.'],['R','That’s the joke, Buckets. Has been for nine years.']]},
  {ch:2,name:'Gale Bridge',pz:['wind',1],foes:['elite'],
    say:[['R','Ridge path. Wind comes through the cavern mouth in gusts.'],['B','Lean into it. Got it. Lean which way?'],['R','The other way.']]},
  {ch:2,name:'Crown Hall',pz:['wires',6],boss:'bastion',
    say:[['S','Halcyon signal: 2 klicks. Contact: fortress-class.'],['B','A fortress. With a crown. That’s just showing off.']]},
  {ch:3,name:'Scrap Plain',pz:['signal',1],foes:['gunship','drone'],
    say:[['B','The beacon’s drifting all over the sky.'],['R','Its antenna’s spinning. Lock onto it and we get a heading.']]},
  {ch:3,name:'Broken Spine',pz:['wires',6],foes:['elite','mite','mite'],
    say:[['R','That’s a Halcyon engine. Half of one.'],['B','Survivors would follow the hull line. So will we.']]},
  {ch:3,name:'Cargo Spill',pz:['crates',3],foes:['gunship','gunship'],
    say:[['B','Their cargo bay burst open. Medical crates!'],['R','Then they’ll need them. Push them clear.']]},
  {ch:3,name:'Hull Gate',pz:['lights',5],foes:['elite','drone'],
    say:[['S','…hear you… two klicks… hurry…'],['B','That’s a person! A real person!'],['R','Then let’s not keep them waiting.']]},
  {ch:3,name:'Eclipse',pz:['simon',7],boss:'eclipse',
    say:[['S','Contact: the dark at the crash site. It is feeding on the reactor.'],['R','That thing is between us and the crew.'],['B','Then it’s not anymore. Ready, Bertha?'],['R','…Ready.']]},
];
const ENDING=[['S','Halcyon crew to unknown engineers: we see you!'],['B','Twelve survivors! And one very grumpy captain.'],['R','The ship can fly if we fix the drive. It’ll take a while.'],
  ['B','While every alien in the sector tries to stop us?'],['R','Yep. Set up the turrets.']];
const WHO={R:'Rusty',B:'Buckets',S:'Signal'};

/* ================================================================ RENDERER, SCENE, CAMERA */
// World: y is up, the ground is the XZ plane. In battle the camera sits behind the duo looking at the aliens.
const stage=$('stage'),cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});renderer.setPixelRatio(Math.min(DPR,2));
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(52,.5,.1,300);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.3);const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(-4,9,6);scene.add(hemi,sun);
let W=1,H=1;
function resize(){W=window.innerWidth;H=window.innerHeight;renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
const _v=new T.Vector3();
function toScreen(x,y,z){_v.set(x,y,z).project(camera);return{x:(_v.x+1)/2*W,y:(1-_v.y)/2*H};}
const MAT=makeMat(false),MAT_SKY=makeMat(false,{fog:false});
const fx=new ARC.Batch(scene,1600,ARC.FX_FS,{vs:ARC.VS_ISO,blend:T.AdditiveBlending,order:5,lift:.4});

/* ================================================================ SCENERY (one backdrop per chapter) */
const STARN=420,starGeo=new T.BufferGeometry();
{const pos=new Float32Array(STARN*3),sz=new Float32Array(STARN);for(let i=0;i<STARN;i++){const a=rand(-1.4,1.4),e=rand(.05,1.2),r=120;
  pos[i*3]=Math.sin(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r;pos[i*3+2]=-Math.cos(a)*Math.cos(e)*r;sz[i]=Math.random()<.08?rand(2.4,3.4):rand(1,2);}
  starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aSize',new T.BufferAttribute(sz,1));}
const starMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:Math.min(DPR,2)},uColor:{value:new T.Vector3(1,1,1)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,fog:false,
  vertexShader:'uniform float uTime,uPx;attribute float aSize;varying float vB;\nvoid main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uPx;vB=(0.4+0.25*aSize)*(0.75+0.25*sin(uTime*1.5+position.x*3.1));}',
  fragmentShader:'uniform vec3 uColor;varying float vB;void main(){float d=length(gl_PointCoord-0.5);gl_FragColor=vec4(uColor*vB,smoothstep(0.5,0.05,d));}'});
const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;scene.add(stars);
const planet=new T.Group();scene.add(planet);let planetMesh=null;
const ringMesh=new T.Mesh(geo([{g:P.tor(1.65,.06,3,40),c:0xffffff}]),MAT_SKY);ringMesh.rotation.x=1.2;planet.add(ringMesh);
const land=new T.Group();scene.add(land);
// Faceted ground: a grid of quads with jittered heights, flat-shaded, two-tone.
function groundGeo(w,d,step,amp,cols,seed,yf){
  const r=seeded(seed),nx=Math.round(w/step),nz=Math.round(d/step),hs=[];
  for(let j=0;j<=nz;j++){hs.push([]);for(let i=0;i<=nx;i++){const x=-w/2+i*step,z=-d+10+j*step;hs[j].push((r()-.5)*amp+(yf?yf(x,z):0));}}
  const Pp=[],N=[],C=[],E=[],a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),ca=new T.Color(cols[0]),cb=new T.Color(cols[1]),tc=new T.Color();
  const tri=(p,q,s,col)=>{a.set(...p);b.set(...q);c.set(...s);n.subVectors(c,b).cross(a.clone().sub(b)).normalize();if(n.y<0)n.negate();
    for(const v of [a,b,c]){Pp.push(v.x,v.y,v.z);N.push(n.x,n.y,n.z);C.push(col.r,col.g,col.b);E.push(0);}};
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x0=-w/2+i*step,x1=x0+step,z0=-d+10+j*step,z1=z0+step;
    tri([x0,hs[j][i],z0],[x0,hs[j+1][i],z1],[x1,hs[j+1][i+1],z1],tc.copy(ca).lerp(cb,r()));tri([x0,hs[j][i],z0],[x1,hs[j+1][i+1],z1],[x1,hs[j][i+1],z0],tc.copy(ca).lerp(cb,r()));}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));
  g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('aEmis',new T.Float32BufferAttribute(E,1));g.computeBoundingSphere();return g;}
let chap=-1;
function setChapter(ci,force){
  if(ci===chap&&!force)return;chap=ci;const C_=CHAPTERS[ci];
  scene.background=new T.Color(C_.sky);scene.fog=new T.Fog(C_.sky,18,70);const sc=rgb(C_.star);starMat.uniforms.uColor.value.set(sc[0],sc[1],sc[2]);
  for(const m of land.children.slice()){land.remove(m);m.geometry.dispose();}
  land.add(new T.Mesh(groundGeo(40,44,1.6,.35,C_.ground,ci*11+3,(x,z)=>Math.max(0,Math.abs(x)-6)*.35+Math.max(0,-z-14)*.25),MAT));
  const r=seeded(ci*7+1),parts=[];
  for(let k=0;k<26;k++){const x=(r()<.5?-1:1)*rand(3.4,14),z=-rand(1,30),s=r()*.6+.3;parts.push({g:P.ico(s),c:C_.ground[1],p:[x,s*.4+Math.max(0,Math.abs(x)-6)*.35,z]});
    if(r()<.3)parts.push({g:P.oct(.16),c:C_.planet[2],e:1,s:[.7,2.2,.7],p:[x+.3,s+.2+Math.max(0,Math.abs(x)-6)*.35,z+.2]});}
  land.add(new T.Mesh(geo(parts),MAT));
  if(planetMesh){planet.remove(planetMesh);planetMesh.geometry.dispose();}
  const g=geo([{g:P.ico(1,1),c:0xffffff}]),col=g.getAttribute('color'),c1=new T.Color(C_.planet[0]),c2=new T.Color(C_.planet[1]),tc=new T.Color();
  for(let k=0;k<col.count;k+=3){tc.copy(c1).lerp(c2,Math.random()*.9);for(let j=0;j<3;j++)col.setXYZ(k+j,tc.r,tc.g,tc.b);}
  planetMesh=new T.Mesh(g,MAT_SKY);planet.add(planetMesh);ringMesh.geometry.dispose();ringMesh.geometry=geo([{g:P.tor(1.65,.06,3,40),c:C_.planet[2]},{g:P.tor(1.9,.03,3,40),c:C_.planet[2]}]);
  planet.scale.setScalar(14);planet.position.set(26,30,-90);
}

/* ================================================================ THE DUO (models face +z; the battle turns them toward the aliens) */
function buildRusty(){return geo([
  M({g:P.box(.24,.5,.28),c:0x3a3f66,p:[.18,.25,0]}),M({g:P.box(.28,.14,.36),c:0x1b1d33,p:[.18,.07,.04]}),
  {g:P.box(.8,.72,.52),c:0xff8a3d,p:[0,.88,0]},{g:P.box(.84,.1,.54),c:0x2a2f45,p:[0,.56,0]},{g:P.box(.5,.3,.06),c:0xffc531,p:[0,.95,.27]},
  M({g:P.box(.22,.56,.26),c:0xff8a3d,p:[.52,.84,0]}),M({g:P.box(.26,.18,.28),c:0x3a3f66,p:[.52,.5,0]}),
  {g:P.box(.62,.62,.32),c:0x5a6290,p:[0,.92,-.4]},{g:P.cyl(.1,.1,.6,6),c:0x8a92c8,p:[.22,.95,-.6]},
  {g:P.ico(.36,1),c:0xe8eefc,p:[0,1.46,0]},{g:P.box(.44,.18,.1),c:0x3ef0ff,e:1,p:[0,1.46,.3]},{g:P.box(.06,.26,.06),c:0x8a92c8,p:[.22,1.82,-.05]},{g:P.oct(.05),c:0xff3d55,e:1,p:[.22,1.97,-.05]}]);}
function buildWrench(){return geo([{g:P.box(.1,.9,.1),c:0x8a92c8,p:[0,.45,0]},{g:P.box(.38,.16,.12),c:0xb8c0dc,p:[0,.92,0]},{g:P.box(.12,.2,.12),c:0xb8c0dc,p:[-.13,1.06,0]},{g:P.box(.12,.2,.12),c:0xb8c0dc,p:[.13,1.06,0]}]);}
function buildBuckets(){return geo([
  M({g:P.box(.18,.4,.22),c:0x2a3050,p:[.14,.2,0]}),M({g:P.box(.22,.12,.3),c:0x1b1d33,p:[.14,.06,.04]}),
  {g:P.box(.58,.54,.42),c:0x2fb6c8,p:[0,.7,0]},{g:P.box(.36,.24,.05),c:0xffd23d,p:[0,.76,.22]},{g:P.box(.6,.08,.44),c:0x2a2f45,p:[0,.46,0]},
  M({g:P.box(.16,.44,.2),c:0x2fb6c8,p:[.38,.68,0]}),M({g:P.box(.2,.14,.22),c:0x3a3f66,p:[.38,.42,0]}),
  {g:P.box(.42,.46,.24),c:0xffc531,p:[0,.74,-.32]},
  {g:P.cyl(.3,.24,.38,10),c:0xb8c0dc,p:[0,1.18,0]},{g:P.cyl(.31,.31,.05,10),c:0x8a92c8,p:[0,1.38,0]},{g:P.box(.36,.08,.06),c:0x3ef0ff,e:1,p:[0,1.15,.26]},
  {g:P.tor(.24,.02,3,12),c:0x8a92c8,p:[0,1.38,0],r:[0,0,0],s:[1,1.4,1]}]);}
function buildTorch(){return geo([{g:P.cyl(.05,.06,.5,6),c:0x3a3f66,p:[0,.25,0]},{g:P.cone(.07,.16,6),c:0x8a92c8,p:[0,.56,0]},{g:P.oct(.05),c:0x4aa8ff,e:1,p:[0,.66,0]}]);}
const heroMat=[makeMat(false),makeMat(false)];
const heroG=[new T.Group(),new T.Group()],heroTool=[];
{heroG[0].add(new T.Mesh(buildRusty(),heroMat[0]));const w=new T.Mesh(buildWrench(),heroMat[0]);w.position.set(.56,.5,.1);w.rotation.set(-.4,0,-.3);heroG[0].add(w);heroTool[0]=w;
 heroG[1].add(new T.Mesh(buildBuckets(),heroMat[1]));const t=new T.Mesh(buildTorch(),heroMat[1]);t.position.set(.42,.42,.12);t.rotation.set(-.9,0,-.2);heroG[1].add(t);heroTool[1]=t;
 heroG[1].scale.setScalar(.95);for(const g of heroG)scene.add(g);}
const HOME=[[-1.25,0,0],[1.25,0,0]];

/* ================================================================ ALIEN MESHES */
// Kit aliens were designed to be seen from above (as in Starwake), so show them that way: flat to the camera, tipped back a
// little toward it, and pointing down at the duo. Bosses already point down.
function foeMesh(type,boss){const g=new T.Group(),inner=new T.Group(),mat=makeMat(false);g.add(inner);
  if(boss){const m=ARC.BOSSES[type](mat);inner.add(m.group);inner.rotation.x=-.35;return{g,mat,anim:m.anim,inner};}
  inner.add(new T.Mesh(ARC.ALIENS[type](),mat));inner.rotation.set(-.35,0,PI);return{g,mat,anim:null,inner};}
function dropFoe(f){scene.remove(f.m.g);ARC.disposeGroup(f.m.g);f.m.mat.dispose();}

/* ================================================================ PARTICLES & FLOATING TEXT */
const pt={n:0,cap:900,keys:['x','y','z','vx','vy','vz','l','m','s0','s1','r','g','b','sh','gy']};for(const k of pt.keys)pt[k]=new Float32Array(pt.cap);
function rmPt(i){const j=--pt.n;if(i!==j)for(const k of pt.keys)pt[k][i]=pt[k][j];}
function part(x,y,z,vx,vy,vz,l,s0,s1,c,sh,gy){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.vz[i]=vz;pt.l[i]=pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.gy[i]=gy||0;}
const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),green:rgb(0x5dff9b),hot:rgb(0xffe6b0),blue:rgb(0x4aa8ff),red:rgb(0xff4d4d),yellow:rgb(0xffd23d)};
function burst(x,y,z,n,c,sp,size,life){for(let i=0;i<n;i++){const a=rand(0,TAU),e=rand(-.5,1),s=rand(.4,1)*sp;part(x,y,z,Math.cos(a)*s,e*s,Math.sin(a)*s,rand(.6,1)*life,size,.02,c,0,4);}}
function boom(x,y,z,sz,c){burst(x,y,z,10+sz*14,c,2+sz*3,.35*(1+sz*.5),.6);part(x,y,z,0,0,0,.2+sz*.08,1+sz*1.4,.2,COL.hot,0,0);part(x,y,z,0,0,0,.35,.3,1.6+sz*2,c,1,0);}
const shots=[];   // glowing projectiles from an alien to an engineer, timed to land exactly when the dodge prompt closes
function shot(from,to,dur,c,arc){shots.push({x0:from[0],y0:from[1],z0:from[2],x1:to[0],y1:to[1],z1:to[2],t:0,dur,c,arc:arc||0});}
const pops=[];
function pop(txt,x,y,z,cls){const d=document.createElement('div');d.className='pop '+(cls||'');d.textContent=txt;$('pops').appendChild(d);pops.push({d,x,y,z,t:0});}

/* ================================================================ AUDIO */
const NOTES=[60,64,67,72];
const Snd=ARC.synth({sfx:()=>S.set.sfx,music:()=>S.set.music,onInit:()=>{if(Mus.want)Mus.play(Mus.want[0],Mus.want[1]);},
  thr:{hit:.04,step:.12,click:.04,tick:.05},
  sounds:{
    click:(s,t)=>{s.osc('square',880,0,t,.03,.035);},
    tick:(s,t)=>{s.osc('triangle',1200,0,t,.03,.03);},
    hit:(s,t,a)=>{s.osc('square',300,120,t,.08,.08);s.nz(t,.1,.12,'lowpass',2000,300);},
    great:(s,t)=>{s.osc('square',880,1760,t,.08,.06);s.osc('triangle',1320,0,t+.06,.12,.06);},
    good:(s,t)=>{s.osc('square',660,990,t,.07,.05);},
    miss:(s,t)=>{s.osc('square',220,150,t,.1,.05);},
    dodge:(s,t)=>{s.osc('sine',500,1100,t,.1,.08);},
    counter:(s,t)=>{s.osc('sawtooth',400,1600,t,.12,.07);s.nz(t,.1,.1,'highpass',3000);},
    hurt:(s,t)=>{s.osc('sawtooth',220,60,t,.25,.14);s.nz(t,.2,.2,'lowpass',1200,200);},
    ko:(s,t)=>{s.osc('sawtooth',300,40,t,.6,.14);},
    boom:(s,t,a)=>{s.nz(t,.4+(a||0)*.3,.32,'lowpass',2200,120);s.osc('sine',130,40,t,.3,.25);},
    big:(s,t)=>{s.nz(t,1.4,.6,'lowpass',1800,60);s.osc('sine',90,25,t,1,.5);},
    heal:(s,t)=>{[523,659,784].forEach((f,i)=>s.osc('triangle',f,0,t+i*.06,.14,.07));},
    tp:(s,t)=>{s.osc('sine',400,1200,t,.25,.07);},
    shoot:(s,t)=>{s.osc('square',900,300,t,.1,.04);},
    charge:(s,t)=>{s.osc('sawtooth',120,480,t,.5,.06);},
    win:(s,t)=>{[523,659,784].forEach((f,i)=>s.osc('square',f,0,t+i*.1,.16,.06));s.osc('square',1047,0,t+.32,.5,.07);},
    level:(s,t)=>{[523,659,784,1047,1319].forEach((f,i)=>s.osc('triangle',f,0,t+i*.07,.16,.07));},
    tone:(s,t,a)=>{s.osc('triangle',ARC.mtof(NOTES[a|0]+12),0,t,.32,.12);s.osc('sine',ARC.mtof(NOTES[a|0]),0,t,.32,.08);},
    buzz:(s,t)=>{s.osc('sawtooth',110,90,t,.3,.1);},
    solve:(s,t)=>{[659,784,1047,1319].forEach((f,i)=>s.osc('triangle',f,0,t+i*.08,.2,.08));},
    rotate:(s,t)=>{s.osc('square',520,0,t,.04,.04);},
    thud:(s,t)=>{s.osc('sine',140,60,t,.15,.18);},
    step:(s,t)=>{s.nz(t,.05,.05,'highpass',2500);},
  }});
const Mus=ARC.music(Snd,{level:i=>CHAPTERS[i],calmBpm:96});
const vibe=ms=>ARC.vibe(S.set.vibe,ms);

/* ================================================================ BATTLE */
// The whole battle is one generator (battleLoop). It yields:
//   a number                 wait that many seconds
//   {prompts:[...]}          timing taps; each prompt calls its cb the moment it resolves
//   {input:'cmd', hero}      wait for the player to pick a command from the menu
const B={on:false,foes:[],heroes:[],tp:0,tpMax:8,round:0,boss:false,si:0,active:null,result:'',gen:null,wait:null,auto:null,xp:0,drops:[]};
const heroStats=i=>{const H=HEROES[i],l=S.heroes[H.id].lvl;return{lvl:l,maxHp:Math.round(H.hp+H.g.hp*(l-1)),pow:H.pow+H.g.pow*(l-1),def:H.def+H.g.def*(l-1)};};
function startBattle(si){
  const st=STAGES[si],ch=st.ch;B.si=si;setChapter(ch);
  for(const f of B.foes)dropFoe(f);B.foes=[];pt.n=0;shots.length=0;
  const list=st.boss?[st.boss]:st.foes,xs=list.length===1?[0]:list.length===2?[-1.5,1.5]:[-2.4,0,2.4];
  list.forEach((t,k)=>{const d=st.boss?BOSS[t]:FOES[t],boss=!!st.boss,sc=boss?1:1.15*(1+.45*ch);
    const f={type:t,d,boss,name:d.name,max:Math.round(d.hp*sc),atk:d.atk+(boss?0:1+ch*1.6),def:d.def+(boss?0:ch*.5),xp:Math.round(d.xp*(1+.4*ch)),
      x:xs[k],y:d.y+(boss?.5:.35),z:boss?-8:-6,sc0:d.s*(boss?1.8:1.7),flash:0,t:rand(0,9),lunge:0,dead:false,ph:0,m:foeMesh(t,boss)};
    f.hp=f.max;f.m.g.scale.setScalar(f.sc0);f.m.g.position.set(f.x,f.y,f.z);scene.add(f.m.g);B.foes.push(f);});
  B.heroes=HEROES.map((H,i)=>{const s=heroStats(i);return Object.assign({i,name:H.name,hp:s.maxHp,down:false,x:HOME[i][0],y:0,z:HOME[i][2],swing:0,flash:0,dodge:0,hop:0},s);});
  B.tpMax=8+2*ch;B.tp=B.tpMax;B.round=0;B.boss=!!st.boss;B.on=true;B.result='';B.xp=0;B.drops=[];B.active=null;
  buildFoeLabels();renderPanels();state='battle';show('battle');Mus.play(B.boss?'boss':'level',ch);requestWake();
  B.gen=battleLoop();B.wait=null;advance();
}
const aliveFoes=()=>B.foes.filter(f=>!f.dead), upHeroes=()=>B.heroes.filter(h=>!h.down);
function advance(val){
  while(B.gen){const r=B.gen.next(val);val=undefined;if(r.done){B.gen=null;return;}const w=r.value;
    if(typeof w==='number'){B.wait={t:w};return;}
    if(w&&w.prompts){B.wait={prompts:w.prompts,res:[]};w.prompts.forEach(p=>{p.t=0;p.res=null;});if(B.auto)for(const p of w.prompts)p.auto=B.auto(p);return;}
    if(w&&w.input){B.wait={input:w.input,hero:w.hero};openMenu(w.hero);if(B.auto&&B.autoCmd){const c=B.autoCmd(w.hero);closeMenu();B.wait=null;val=c;continue;}return;}
  }
}
function tickBattle(dt){
  const w=B.wait;if(!w)return;
  if(w.t!=null){w.t-=dt;if(w.t<=0){B.wait=null;advance(dt);}return;}
  if(w.prompts){let open=false;for(const p of w.prompts){if(p.res)continue;p.t+=dt;
      if(p.auto&&p.t>=p.at+p.auto.err){resolve(p,p.auto.hit?grade(p.auto.err):'miss');continue;}
      if(p.t>p.at+.15)resolve(p,'miss');else open=true;}
    if(!open){B.wait=null;advance(w.prompts.map(p=>p.res));}}
}
// Timing windows, in seconds from the ideal moment.
const grade=err=>Math.abs(err)<=.075?'great':Math.abs(err)<=.16?'good':'miss';
function mk(lane,at,cb){return{lane,at,cb};}
function resolve(p,res){p.res=res;if(p.cb)p.cb(res);if(res==='great')S.stats.great++;}
function tapLane(l){
  const w=B.wait;if(!w||!w.prompts)return false;
  let best=null;for(const p of w.prompts)if(!p.res&&p.lane===l&&p.at-p.t<.34&&(!best||p.at<best.at))best=p;
  if(!best)return false;resolve(best,grade(best.t-best.at));heroHop(l);return true;}
function heroHop(l){const h=B.heroes[l];if(h&&!h.down)h.hop=1;}
const MULT={great:1.6,good:1.25,miss:.75};
function hitFoe(f,dmg,res,h){if(f.dead)return;const d=Math.max(1,Math.round(dmg-f.def*.5));f.hp=Math.max(0,f.hp-d);f.flash=1;
  pop(d,f.x,f.y+1.1,f.z,res==='great'?'crit':'');if(res==='great')pop('GREAT!',f.x,f.y+1.7,f.z,'tag good');else if(res==='good')pop('GOOD',f.x,f.y+1.7,f.z,'tag');
  burst(f.x,f.y,f.z+.4,res==='great'?16:8,res==='great'?COL.gold:COL.white,res==='great'?5:3,.25,.4);Snd.play(res==='great'?'great':res==='good'?'good':'hit');
  if(f.boss&&f.hp>0&&f.hp<f.max*.5&&!f.ph){f.ph=1;pop('ENRAGED',f.x,f.y+2.4,f.z,'tag bad');Snd.play('charge');}
  if(f.hp<=0){f.dead=true;B.xp+=f.xp;boom(f.x,f.y,f.z,f.boss?3:1.2,f.boss?COL.pink:COL.orange);Snd.play(f.boss?'big':'boom',1);vibe(f.boss?90:25);
    if(!f.boss&&Math.random()<.18)B.drops.push(pick(['kit','kit','cell','spark']));updateFoeLabels(true);}
  updateFoeLabels();}
function hurtHero(h,dmg,f){if(h.down)return;const d=Math.max(1,Math.round(dmg-h.def*.5));h.hp=Math.max(0,h.hp-d);h.flash=1;pop(d,h.x,1.6,h.z,'hurt');Snd.play('hurt');vibe(25);
  burst(h.x,1,h.z,8,COL.red,3,.22,.35);if(h.hp<=0){h.down=true;pop('DOWN',h.x,2.1,h.z,'tag bad');Snd.play('ko');}renderPanels();}
function* walk(o,to,dur){const x0=o.x,z0=o.z,y0=o.y||0;let t=0;while(t<dur){t+=yield 0;const k=Math.min(1,t/dur),e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;o.x=lerp(x0,to[0],e);o.z=lerp(z0,to[2],e);if(o.y!=null&&to[1]!=null)o.y=lerp(y0,to[1],e);}}
// A 0-second wait yields back the frame's dt, which walk() uses as a tiny animation clock.
function* battleLoop(){
  yield .6;banner(STAGES[B.si].boss?'Boss battle':'Battle',STAGES[B.si].name);yield .9;
  for(;;){
    B.round++;
    for(const h of B.heroes){if(h.down||!aliveFoes().length)continue;B.active=h;renderPanels();
      const c=yield {input:'cmd',hero:h};B.active=null;renderPanels();yield* doCmd(h,c);}
    if(!aliveFoes().length)break;
    for(const f of aliveFoes()){const n=f.boss&&f.ph?2:1;for(let k=0;k<n&&upHeroes().length&&!f.dead;k++)yield* foeTurn(f);}
    if(!upHeroes().length)break;
    B.tp=Math.min(B.tpMax,B.tp+1);renderPanels();
  }
  yield .8;
  if(!aliveFoes().length)victory();else defeat();
}
function* doCmd(h,c){
  if(c.act==='attack')yield* heroAttack(h,c.foe);
  else if(c.act==='team')yield* teamMove(TEAM.find(m=>m.id===c.id),c.foe);
  else if(c.act==='item')yield* useItem(c.id,c.hero);
}
function* heroAttack(h,f){
  if(!f||f.dead)f=aliveFoes()[0];if(!f)return;
  const home=HOME[h.i];yield* walkDt(h,[f.x*.7,0,f.z+(f.boss?3:1.7)],.45);
  if(h.i===0){h.swing=0;let res;yield {prompts:[mk(0,.55,r=>{res=r;h.swing=1;hitFoe(f,h.pow*MULT[r]*1.25,r,h);})]};}
  else for(let k=0;k<2&&!f.dead;k++){yield {prompts:[mk(1,k?.38:.5,r=>{h.swing=1;hitFoe(f,h.pow*.7*MULT[r],r,h);burst(f.x,f.y,f.z+.4,6,COL.blue,4,.2,.3);})]};}
  yield .15;yield* walkDt(h,home,.4);
}
function* walkDt(o,to,dur){const g=walk(o,to,dur);let r=g.next();while(!r.done){const dt=yield 0;r=g.next(dt);}}
function* teamMove(m,f){
  B.tp-=m.tp;renderPanels();Snd.play('tp');pop(m.name,0,2.6,-1.5,'tag move');
  for(const h of B.heroes)if(!h.down)h.hop=1;
  yield .5;let combo=0,charge=0;const avg=(B.heroes[0].pow+B.heroes[1].pow)/2;
  for(let k=0;k<m.n;k++){
    if(!m.all&&(!f||f.dead))f=aliveFoes()[0];if(!aliveFoes().length)break;
    const lanes=m.seq==='b'?[0,1]:m.seq==='a'?[k%2]:[Math.random()<.5?0:1];
    const res=yield {prompts:lanes.map(l=>mk(l,k?m.gap:.8,null))};
    if(res.some(r=>r==='miss')){pop('Combo broken',0,2.2,-1.5,'tag bad');Snd.play('miss');break;}
    combo++;const great=res.every(r=>r==='great');
    if(m.seq==='b'){charge+=great?1.3:1;Snd.play('charge');burst(0,1.2,-.5,10,COL.gold,2,.25,.4);continue;}
    const dmg=avg*m.k*(great?1.35:1)*(1+k*.08),tg=m.all?aliveFoes():[f];
    for(const t of tg)hitFoe(t,dmg,great?'great':'good');
  }
  if(m.seq==='b'&&charge>0){if(!f||f.dead)f=aliveFoes()[0];if(f){shot([0,1.2,-.5],[f.x,f.y,f.z],.35,COL.gold);yield .35;hitFoe(f,avg*m.k*charge*1.5,charge>=3.6?'great':'good');boom(f.x,f.y,f.z,1.6,COL.gold);}}
  if(combo===m.n)pop('PERFECT',0,2.9,-1.5,'tag good');
  yield .4;
}
function* useItem(id,tgt){
  S.items[id]--;save();const hs=id==='mega'?B.heroes.filter(h=>!h.down):[B.heroes[tgt]];
  for(const h of hs){if(id==='spark'){h.down=false;h.hp=Math.round(h.maxHp/2);pop('REVIVED',h.x,2,h.z,'tag good');}
    else if(id==='cell'){B.tp=Math.min(B.tpMax,B.tp+5);pop('+5 TP',h.x,2,h.z,'tag move');}
    else{const a=Math.min(16,h.maxHp-h.hp);h.hp+=a;pop('+'+a,h.x,1.8,h.z,'heal');}
    burst(h.x,1,h.z,14,id==='cell'?COL.violet:COL.green,2.5,.25,.6);}
  Snd.play(id==='cell'?'tp':'heal');renderPanels();yield .7;
}
function* foeTurn(f){
  const up=upHeroes();if(!up.length)return;
  let mv=pick(f.d.mv);if(mv==='nova'&&Math.random()<.5)mv=pick(f.d.mv);const M_=MOVES[mv];
  const tgt=pick(up),other=up.find(h=>h!==tgt)||tgt;
  f.flash=.6;pop(M_.name,f.x,f.y+(f.boss?2.6:1.5),f.z,'tag foe');yield .55;
  const ps=[],src=[f.x,f.y,f.z+.5];
  for(const [at,who] of M_.p){const hs=who==='t'?[tgt]:who==='o'?[other]:B.heroes.filter(h=>!h.down);
    for(const h of hs){ps.push(mk(h.i,at,r=>{
        if(r==='great'){S.stats.counters++;pop('COUNTER!',h.x,2.1,h.z,'tag good');Snd.play('counter');h.dodge=1;hitFoe(f,h.pow*.5,'counter');}
        else if(r==='good'){S.stats.dodges++;pop('DODGE',h.x,2.1,h.z,'tag');Snd.play('dodge');h.dodge=1;}
        else hurtHero(h,f.atk*M_.m,f);}));
      if(M_.melee)f.lunge=Math.max(f.lunge,.001);else{shot(src,[h.x,1.1,h.z],at,f.boss?COL.pink:COL.orange,.6);}}}
  if(M_.melee){f.lungeAt=M_.p[0][0];f.lungeT=0;f.lungeTo=tgt;}
  Snd.play('shoot');
  yield {prompts:ps};f.lunge=0;yield .35;
}
function victory(){
  B.on=false;B.result='win';releaseWake();Snd.play('win');
  const st=STAGES[B.si],lines=[];
  for(const h of B.heroes){const s=S.heroes[HEROES[h.i].id];s.xp+=B.xp;const before=s.lvl;while(s.xp>=xpNeed(s.lvl)){s.xp-=xpNeed(s.lvl);s.lvl++;}
    if(s.lvl>before){const a=heroStats(h.i);lines.push(HEROES[h.i].name+' reached level '+s.lvl+' · HP '+a.maxHp+' · POW '+Math.round(a.pow)+' · DEF '+Math.round(a.def));}}
  for(const d of B.drops)S.items[d]++;
  const firstClear=B.si>=S.stage;if(firstClear)S.stage=B.si+1;save();
  showVictory(lines,firstClear);
}
function defeat(){B.on=false;B.result='lose';releaseWake();Snd.play('ko');showDefeat();}

/* ================================================================ PUZZLES */
// Every stage opens with one. Touch puzzles are HTML boards over the scenery; gyro puzzles are 3D scenes steered by tilting.
// Solving earns an item; skipping just walks on to the battle.
let PZ=null;
const REWARD=['kit','cell','kit','spark','mega'];
function startPuzzle(si){
  const st=STAGES[si],[type,n]=st.pz,def=PUZ[type];setChapter(st.ch);
  state='puzzle';show('puzzle');$('pzName').textContent=def.name;$('pzHint').textContent=def.hint(n);$('pzBoard').innerHTML='';$('pzBoard').hidden=!!def.gyro;
  $('pzGyro').hidden=!def.gyro;$('pzBalW').hidden=$('pzLockW').hidden=true;$('pzPad').hidden=type!=='crates';$('pzUndo').hidden=type!=='crates';$('pzStat').textContent='';
  PZ={type,n,si,def,done:false,t:0,seed:si*97+13};def.start(PZ);if(def.gyro){ARC.motion.calibrate();PZ.cal=true;}
  Mus.play('calm',st.ch);
}
function puzzleSolved(){
  if(!PZ||PZ.done)return;PZ.done=true;S.stats.puzzles++;const it=REWARD[PZ.si%REWARD.length];S.items[it]++;save();Snd.play('solve');vibe(30);
  $('pzDone').hidden=false;$('pzDoneTxt').textContent='Found a '+ITEMS[it].name+'.';
}
function endPuzzle(){if(PZ&&PZ.def.stop)PZ.def.stop(PZ);PZ=null;$('pzDone').hidden=true;$('pzBoard').innerHTML='';}
// Tilt as {x,y} in -1..1. Falls back to a drag joystick when the phone has no motion sensor or the player chose touch.
const joy={on:false,x0:0,y0:0,x:0,y:0};
const tiltLive=()=>S.set.ctrl==='tilt'&&ARC.motion.live;
function tilt(){
  if(tiltLive()){if(PZ&&PZ.cal){ARC.motion.calibrate();PZ.cal=false;}const r=ARC.motion.read2(),k={low:2.2,med:3,high:4}[S.set.sens]||3;
    return{x:clamp(r.x*k,-1,1),y:clamp(r.y*k,-1,1)};}
  if(!joy.on)return{x:0,y:0};const s=Math.min(W,H)*.22;return{x:clamp((joy.x-joy.x0)/s,-1,1),y:clamp(-(joy.y-joy.y0)/s,-1,1)};
}
const gyroGroup=new T.Group();scene.add(gyroGroup);
function clearGyro(){for(const o of gyroGroup.children.slice()){gyroGroup.remove(o);ARC.disposeGroup(o);}}
function svgPipe(mask){const seg={1:'M50 50V0',2:'M50 50H100',4:'M50 50V100',8:'M50 50H0'};let d='';for(const k of [1,2,4,8])if(mask&k)d+=seg[k];
  return '<svg viewBox="0 0 100 100"><path d="'+d+'" stroke-width="22" stroke-linecap="round" fill="none"/><circle cx="50" cy="50" r="13"/></svg>';}
const rot=m=>((m<<1)|(m>>3))&15;
const CRATES=[
 ["######","#    #","# $  #","#  @ #","#  . #","######"],
 ["#######","#     #","# $$  #","#  #  #","# .. @#","#######"],
 ["########","#  .   #","# $$#  #","#  .  @#","## $ ###"," # .  # "," ###### "],
 ["########","#  .   #","# #$## #","# . $  #","## #$  #","#  .  @#","########"]];
const PUZ={
 lights:{name:'Power panel',hint:n=>'Light every cell. Each tap flips a cell and its neighbours.',
  start(p){const n=p.n,r=seeded(p.seed);p.on=new Array(n*n).fill(true);const press=i=>{const x=i%n,y=(i/n)|0;for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=y+dy;if(a>=0&&b>=0&&a<n&&b<n)p.on[b*n+a]=!p.on[b*n+a];}};
    p.press=press;do{for(let k=0;k<n+2;k++)press(Math.floor(r()*n*n));}while(p.on.every(v=>v));
    const bd=$('pzBoard');bd.className='board lights';bd.style.setProperty('--n',n);bd.innerHTML=p.on.map((_,i)=>'<button data-i="'+i+'" aria-label="Cell '+(i+1)+'"></button>').join('');
    p.moves=0;const draw=()=>{[...bd.children].forEach((b,i)=>b.classList.toggle('on',p.on[i]));$('pzStat').textContent=p.moves+' moves';};draw();
    bd.onclick=e=>{const b=e.target.closest('button');if(!b||p.done)return;press(+b.dataset.i);p.moves++;Snd.play('rotate');draw();if(p.on.every(v=>v))puzzleSolved();};}},
 wires:{name:'Blast door wiring',hint:n=>'Tap tiles to turn them. Run power from the plug on the left to the door on the right.',
  start(p){const n=p.n,r=seeded(p.seed),m=new Array(n*n).fill(0),r0=Math.floor(r()*n),r1=Math.floor(r()*n);
    // a random self-avoiding path from the left edge to the right edge, then decoy pieces everywhere else
    const path=[],seen=new Set();const dfs=(x,y)=>{path.push([x,y]);seen.add(y*n+x);if(x===n-1&&y===r1)return true;
      const ds=[[1,0],[0,1],[0,-1],[-1,0]].sort(()=>r()-.5);for(const [dx,dy] of ds){const a=x+dx,b=y+dy;if(a<0||b<0||a>=n||b>=n||seen.has(b*n+a))continue;if(dfs(a,b))return true;}path.pop();return false;};
    dfs(0,r0);const bit=(dx,dy)=>dx===1?2:dx===-1?8:dy===1?4:1;
    path.forEach(([x,y],k)=>{let v=0;if(k===0)v|=8;else{const [px,py]=path[k-1];v|=bit(px-x,py-y);}if(k===path.length-1)v|=2;else{const [nx,ny]=path[k+1];v|=bit(nx-x,ny-y);}m[y*n+x]=v;});
    for(let i=0;i<n*n;i++)if(!m[i])m[i]=[5,3,7][Math.floor(r()*3)];
    p.m=m;p.r0=r0;p.r1=r1;for(let i=0;i<n*n;i++){const k=Math.floor(r()*4);for(let j=0;j<k;j++)m[i]=rot(m[i]);}
    const bd=$('pzBoard');bd.className='board wires';bd.style.setProperty('--n',n);
    const draw=()=>{const pw=new Set();const q=[];if(m[r0*n]&8){q.push(r0*n);pw.add(r0*n);}
      while(q.length){const i=q.pop(),x=i%n,y=(i/n)|0;for(const [b,dx,dy,o] of [[1,0,-1,4],[2,1,0,8],[4,0,1,1],[8,-1,0,2]]){if(!(m[i]&b))continue;const a=x+dx,c=y+dy;if(a<0||c<0||a>=n||c>=n)continue;const j=c*n+a;if(m[j]&o&&!pw.has(j)){pw.add(j);q.push(j);}}}
      bd.innerHTML=m.map((v,i)=>'<button data-i="'+i+'" class="'+(pw.has(i)?'pw':'')+'">'+svgPipe(v)+'</button>').join('')+
        '<i class="plug" style="top:calc('+(r0+.5)+'/'+n+'*100% - 9px)"></i><i class="door'+(pw.has(r1*n+n-1)&&m[r1*n+n-1]&2?' open':'')+'" style="top:calc('+(r1+.5)+'/'+n+'*100% - 14px)"></i>';
      return pw.has(r1*n+n-1)&&(m[r1*n+n-1]&2);};
    draw();bd.onclick=e=>{const b=e.target.closest('button');if(!b||p.done)return;const i=+b.dataset.i;m[i]=rot(m[i]);Snd.play('rotate');if(draw())puzzleSolved();};}},
 crates:{name:'Cargo pads',hint:n=>'Swipe or use the arrows to push every crate onto a glowing pad. Crates only push, never pull.',
  start(p){const L=CRATES[p.n];p.h=L.length;p.w=Math.max(...L.map(r=>r.length));p.walls=new Set();p.goals=new Set();p.box=new Set();p.hist=[];
    L.forEach((row,y)=>[...row].forEach((c,x)=>{const i=y*p.w+x;if(c==='#')p.walls.add(i);if('.*+'.includes(c))p.goals.add(i);if('$*'.includes(c))p.box.add(i);if('@+'.includes(c))p.pl=i;}));
    p.L=L;p.start={pl:p.pl,box:[...p.box]};const bd=$('pzBoard');bd.className='board crates';bd.style.setProperty('--n',p.w);bd.style.setProperty('--rows',p.h);p.draw=()=>{let h='';
      for(let y=0;y<p.h;y++)for(let x=0;x<p.w;x++){const i=y*p.w+x,row=p.L[y]||'',c=row[x]||' ',out=c===' '&&(x<row.indexOf('#')||x>row.lastIndexOf('#'));
        h+='<i class="'+(p.walls.has(i)?'wall':out?'':'floor')+(p.goals.has(i)?' goal':'')+(p.box.has(i)?' box'+(p.goals.has(i)?' set':''):'')+(p.pl===i?' me':'')+'"></i>';}
      bd.innerHTML=h;$('pzStat').textContent=p.hist.length+' moves';};p.draw();}},
 simon:{name:'Tone lock',hint:n=>'Watch the lights, then play the tones back. '+n+' tones to open it.',
  start(p){const r=seeded(p.seed);p.seq=Array.from({length:p.n},()=>Math.floor(r()*4));p.len=1;p.at=0;p.showing=0;
    const bd=$('pzBoard');bd.className='board simon';bd.innerHTML=[0,1,2,3].map(i=>'<button data-i="'+i+'" aria-label="Tone '+(i+1)+'"></button>').join('');
    p.play=()=>{p.showing=1;p.at=0;let k=0;const step=()=>{if(!PZ||PZ!==p)return;if(k>=p.len){p.showing=0;$('pzStat').textContent='Your turn · '+p.len+' of '+p.n;return;}
      flashPad(p.seq[k]);k++;setTimeout(step,520);};$('pzStat').textContent='Listen…';setTimeout(step,700);};
    p.play();bd.onclick=e=>{const b=e.target.closest('button');if(!b||p.done||p.showing)return;const v=+b.dataset.i;flashPad(v);
      if(v!==p.seq[p.at]){Snd.play('buzz');vibe(40);$('pzStat').textContent='Wrong tone. Again…';p.at=0;setTimeout(p.play,600);return;}
      p.at++;if(p.at>=p.len){if(p.len>=p.n){puzzleSolved();return;}p.len++;setTimeout(p.play,500);}};}},
 slide:{name:'Crater slide',gyro:1,hint:()=>'Tilt to steer the sled down the crater. Rocks slow you down; grab the bolts.',start:startSlide,tick:tickSlide},
 maze:{name:'Vent maze',gyro:1,hint:()=>'Tilt the phone to roll the beacon core to its socket. Avoid the vents.',start:startMaze,tick:tickMaze},
 wind:{name:'Gale bridge',gyro:1,hint:()=>'They walk on their own. Tilt against the gusts to keep them balanced.',start:startWind,tick:tickWind},
 signal:{name:'Signal lock',gyro:1,hint:()=>'Tilt in any direction to hold the scope on the drifting signal until it locks. Three locks.',start:startSignal,tick:tickSignal},
};
function flashPad(i){const b=$('pzBoard').children[i];if(!b)return;b.classList.add('lit');Snd.play('tone',i);setTimeout(()=>b.classList.remove('lit'),300);}
function crateMove(dx,dy){const p=PZ;if(!p||p.type!=='crates'||p.done)return;const w=p.w,to=p.pl+dy*w+dx;if(p.walls.has(to))return;
  if(p.box.has(to)){const t2=to+dy*w+dx;if(p.walls.has(t2)||p.box.has(t2))return;p.hist.push({pl:p.pl,box:[...p.box]});p.box.delete(to);p.box.add(t2);Snd.play('thud');}
  else{p.hist.push({pl:p.pl,box:[...p.box]});Snd.play('step');}
  p.pl=to;p.draw();if([...p.box].every(b=>p.goals.has(b)))puzzleSolved();}
function crateUndo(){const p=PZ;if(!p||p.type!=='crates'||!p.hist.length||p.done)return;const s=p.hist.pop();p.pl=s.pl;p.box=new Set(s.box);p.draw();Snd.play('click');}

/* ----- gyro: crater slide ----- */
function sledGeo(){return geo([{g:P.box(1.3,.12,1.7),c:0x8a92c8,p:[0,.1,0]},M({g:P.box(.08,.12,1.8),c:0x3a3f66,p:[.62,.02,0]}),{g:P.box(1.3,.3,.1),c:0xffc531,p:[0,.3,-.82]},
  {g:P.box(.42,.42,.4),c:0xff8a3d,p:[-.3,.42,.2]},{g:P.ico(.2,1),c:0xe8eefc,p:[-.3,.78,.2]},{g:P.box(.24,.1,.06),c:0x3ef0ff,e:1,p:[-.3,.78,0]},
  {g:P.box(.32,.32,.3),c:0x2fb6c8,p:[.3,.36,-.25]},{g:P.cyl(.17,.14,.2,8),c:0xb8c0dc,p:[.3,.62,-.25]},{g:P.box(.2,.05,.05),c:0x3ef0ff,e:1,p:[.3,.6,-.4]}]);}
function startSlide(p){clearGyro();const C_=CHAPTERS[STAGES[p.si].ch],r=seeded(p.seed),L=150;p.L=L;
  gyroGroup.add(new T.Mesh(groundGeo(14,L+30,1.4,.25,C_.ground,p.seed,(x,z)=>Math.pow(Math.max(0,Math.abs(x)-4.6),1.5)*.6),MAT));gyroGroup.children[0].position.z=20;
  p.rocks=[];p.bolts=[];const parts=[],bp=[];
  for(let z=-14;z>-L+4;z-=rand(3.2,5.2)){const n=r()<.35?2:1;for(let k=0;k<n;k++){const x=rand(-3.8,3.8);p.rocks.push({x,z});parts.push({g:P.ico(.55),c:C_.ground[1],p:[x,.35,z]},{g:P.ico(.3),c:0x857065,p:[x+.3,.5,z+.2]});}
    if(r()<.7){const x=rand(-3.8,3.8);if(!p.rocks.some(o=>Math.abs(o.x-x)<1.2&&Math.abs(o.z-z+1.6)<1.2))p.bolts.push({x,z:z-1.6,on:true});}}
  gyroGroup.add(new T.Mesh(geo(parts),MAT));
  p.boltMesh=new T.InstancedMesh(geo([{g:P.oct(.22),c:0xffc531,e:1}]),MAT,p.bolts.length||1);p.boltMesh.frustumCulled=false;gyroGroup.add(p.boltMesh);
  p.sled=new T.Mesh(sledGeo(),MAT);gyroGroup.add(p.sled);p.x=0;p.z=0;p.vx=0;p.v=5;p.stun=0;p.got=0;p.hits=0;
  const fin=new T.Mesh(geo([{g:P.box(9,.12,.8),c:0x5dff9b,e:1,p:[0,.06,0]}]),MAT);fin.position.z=-L;gyroGroup.add(fin);
  $('pzStat').textContent='Bolts 0';}
function tickSlide(p,dt){const t=tilt();p.stun=Math.max(0,p.stun-dt);
  p.v=Math.min(11,p.v+dt*.6);const sp=p.stun>0?p.v*.35:p.v;p.vx+=(t.x*7-p.vx)*Math.min(1,dt*6);p.x=clamp(p.x+p.vx*dt,-4.2,4.2);p.z-=sp*dt;
  for(const o of p.rocks)if(Math.abs(o.x-p.x)<.9&&Math.abs(o.z-p.z)<.8&&p.stun<=0){p.stun=.7;p.hits++;p.v=Math.max(4,p.v-2);Snd.play('thud');vibe(30);burst(p.x,.6,p.z,10,COL.white,3,.2,.4);}
  for(const b of p.bolts)if(b.on&&Math.abs(b.x-p.x)<.8&&Math.abs(b.z-p.z)<.8){b.on=false;p.got++;Snd.play('tick');$('pzStat').textContent='Bolts '+p.got;}
  if(Math.random()<dt*20)part(p.x+rand(-.6,.6),.15,p.z+.9,rand(-1,1),rand(.5,1.5),rand(1,2),.5,.3,.05,COL.white,0,3);
  p.sled.position.set(p.x,0,p.z);p.sled.rotation.set(0,PI-p.vx*.06,-p.vx*.05);
  let k=0;const tt=performance.now()*.003;for(const b of p.bolts){_m4.compose(_p.set(b.x,b.on?.5+Math.sin(tt+b.z)*.1:-5,b.z),_q.setFromEuler(_e.set(0,tt+b.z,0)),_s.setScalar(1));p.boltMesh.setMatrixAt(k++,_m4);}
  p.boltMesh.instanceMatrix.needsUpdate=true;
  camera.position.set(p.x*.5,4.6,p.z+8.5);camera.lookAt(p.x*.7,.2,p.z-6);
  if(p.z<=-p.L&&!p.done){$('pzStat').textContent='Bolts '+p.got+' · '+p.hits+' bumps';puzzleSolved();}}
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3();

/* ----- gyro: vent maze ----- */
function startMaze(p){clearGyro();const C_=CHAPTERS[STAGES[p.si].ch],r=seeded(p.seed),cw=6,ch=8,G=2*cw+1,GH=2*ch+1,blk=new Uint8Array(G*GH).fill(1);
  const carve=(x,y)=>{blk[(2*y+1)*G+2*x+1]=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]].sort(()=>r()-.5)){const a=x+dx,b=y+dy;if(a<0||b<0||a>=cw||b>=ch||!blk[(2*b+1)*G+2*a+1])continue;blk[(2*y+1+dy)*G+2*x+1+dx]=0;carve(a,b);}};
  carve(0,0);p.G=G;p.GH=GH;p.blk=blk;const S_=.72;p.S=S_;const ox=-G*S_/2,oz=-GH*S_/2;p.ox=ox;p.oz=oz;
  const parts=[{g:P.box(G*S_+.4,.2,GH*S_+.4),c:C_.ground[1],p:[0,-.1,0]}];
  for(let j=0;j<GH;j++)for(let i=0;i<G;i++)if(blk[j*G+i])parts.push({g:P.box(S_,.6,S_),c:(i+j)&1?C_.ground[0]:0x8a92c8,p:[ox+(i+.5)*S_,.3,oz+(j+.5)*S_]});
  // vents in a few dead ends (never the start or the goal)
  p.holes=[];for(let y=0;y<ch;y++)for(let x=0;x<cw;x++){if((x===0&&y===0)||(x===cw-1&&y===ch-1))continue;const i=(2*y+1)*G+2*x+1;let open=0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])if(!blk[i+dy*G+dx])open++;
    if(open===1&&r()<.55){p.holes.push([ox+(2*x+1.5)*S_,oz+(2*y+1.5)*S_]);parts.push({g:P.cyl(.32,.32,.04,10),c:0x07061a,p:[ox+(2*x+1.5)*S_,.01,oz+(2*y+1.5)*S_]});}}
  p.goal=[ox+(2*(cw-1)+1.5)*S_,oz+(2*(ch-1)+1.5)*S_];parts.push({g:P.tor(.3,.06,4,16),c:0x5dff9b,e:1,p:[p.goal[0],.03,p.goal[1]],r:[PI/2,0,0]});
  gyroGroup.add(new T.Mesh(geo(parts),MAT));p.ball=new T.Mesh(geo([{g:P.ico(.24,1),c:0xffc531,e:1}]),MAT);gyroGroup.add(p.ball);
  p.start=[ox+1.5*S_,oz+1.5*S_];p.x=p.start[0];p.z=p.start[1];p.vx=p.vz=0;p.falls=0;$('pzStat').textContent='';}
function tickMaze(p,dt){const t=tilt(),R=.24,S_=p.S;
  p.vx+=t.x*9*dt;p.vz-=t.y*9*dt;p.vx*=Math.exp(-dt*1.2);p.vz*=Math.exp(-dt*1.2);
  for(const ax of [0,1]){if(ax===0)p.x+=p.vx*dt;else p.z+=p.vz*dt;
    const ci=Math.floor((p.x-p.ox)/S_),cj=Math.floor((p.z-p.oz)/S_);
    for(let j=cj-1;j<=cj+1;j++)for(let i=ci-1;i<=ci+1;i++){if(i<0||j<0||i>=p.G||j>=p.GH||!p.blk[j*p.G+i])continue;
      const x0=p.ox+i*S_,z0=p.oz+j*S_,nx=clamp(p.x,x0,x0+S_),nz=clamp(p.z,z0,z0+S_),dx=p.x-nx,dz=p.z-nz,d2=dx*dx+dz*dz;
      if(d2<R*R){const d=Math.sqrt(d2)||1e-4;if(ax===0){p.x=nx+dx/d*R;p.vx*=-.25;}else{p.z=nz+dz/d*R;p.vz*=-.25;}}}}
  for(const [hx,hz] of p.holes)if(Math.hypot(p.x-hx,p.z-hz)<.2){p.falls++;Snd.play('buzz');vibe(40);burst(hx,.1,hz,12,COL.orange,3,.2,.4);p.x=p.start[0];p.z=p.start[1];p.vx=p.vz=0;$('pzStat').textContent='Lost it '+p.falls+'×';}
  p.ball.position.set(p.x,.24,p.z);p.ball.rotation.x+=p.vz*dt*3;p.ball.rotation.z-=p.vx*dt*3;
  fx.push(p.goal[0],.2,p.goal[1],0,.9,.9,0,.5+.3*Math.sin(performance.now()*.006),COL.green);fx.push(p.x,.3,p.z,0,.8,.8,0,.4,COL.gold);
  const fit=Math.max(p.G*S_/camera.aspect,p.GH*S_)*.62;camera.position.set(0,fit/Math.tan(26*PI/180)*.95+1,fit*.35);camera.lookAt(0,0,.2);
  if(Math.hypot(p.x-p.goal[0],p.z-p.goal[1])<.3&&!p.done)puzzleSolved();}

/* ----- gyro: gale bridge ----- */
function startWind(p){clearGyro();const C_=CHAPTERS[STAGES[p.si].ch],L=56;p.L=L;
  const parts=[];for(let z=2;z>-L-6;z-=1.2){parts.push({g:P.box(1.1+Math.sin(z)*.1,.5,1.25),c:(Math.round(z/1.2))&1?C_.ground[0]:C_.ground[1],p:[Math.sin(z*.13)*.6,-.25,z]});
    parts.push({g:P.cone(.5,2.6,5),c:C_.ground[1],p:[Math.sin(z*.13)*.6,-1.8,z],r:[PI,0,0]});}
  gyroGroup.add(new T.Mesh(geo(parts),MAT));p.duo=new T.Group();const a=new T.Mesh(buildRusty(),MAT),b=new T.Mesh(buildBuckets(),MAT);a.scale.setScalar(.5);b.scale.setScalar(.45);
  a.position.set(-.18,0,.15);b.position.set(.2,0,-.25);p.duo.add(a,b);gyroGroup.add(p.duo);
  p.z=0;p.th=0;p.w=0;p.gust=0;p.gt=1;p.check=0;p.falls=0;p.fall=0;$('pzStat').textContent='';}
function tickWind(p,dt){
  if(p.fall>0){p.fall-=dt;p.duo.position.y-=dt*6;p.duo.rotation.z+=Math.sign(p.th)*dt*3;if(p.fall<=0){p.z=p.check;p.th=p.w=0;p.duo.position.y=0;}}
  else{const t=tilt();p.gt-=dt;if(p.gt<=0){p.gt=rand(1.2,2.6);p.gust=(Math.random()<.5?-1:1)*rand(.8,1.6)*(.6+p.z/-p.L*.6);}
    p.gust*=Math.exp(-dt*.5);const acc=2.4*p.th+p.gust*1.4-t.x*4.2-1.6*p.w;p.w+=acc*dt;p.th+=p.w*dt;
    p.z-=1.6*dt;if(p.z<-p.L/3*(1+Math.floor(-p.check/(p.L/3)))&&p.z>-p.L)p.check=-p.L/3*Math.floor(-p.z/(p.L/3));
    if(Math.abs(p.th)>1){p.fall=1.1;p.falls++;Snd.play('ko');vibe(60);$('pzStat').textContent='Blown off '+p.falls+'× · back to the last marker';}
    if(Math.random()<dt*Math.abs(p.gust)*30){const s=Math.sign(p.gust);part(-s*5,rand(.3,2.5),p.z-rand(1,8),s*rand(8,12),0,0,rand(.5,.8),.08,.05,COL.white,2,0);}}
  const bx=Math.sin(p.z*.13)*.6;p.duo.position.x=bx;p.duo.position.z=p.z;if(p.fall<=0)p.duo.rotation.set(0,PI,-p.th*.6);
  $('pzBal').style.transform='translateX(-50%) rotate('+(p.th*50).toFixed(1)+'deg)';$('pzBalW').classList.toggle('bad',Math.abs(p.th)>.65);$('pzBalW').hidden=false;
  camera.position.set(bx,3.2,p.z+6.2);camera.lookAt(bx,.7,p.z-3);
  if(p.z<=-p.L&&!p.done){$('pzBalW').hidden=true;puzzleSolved();}}

/* ----- gyro: signal lock ----- */
function startSignal(p){clearGyro();p.lock=0;p.locks=0;p.t=0;p.rx=0;p.ry=0;p.ph=rand(0,TAU);p.speed=.5;$('pzStat').textContent='Locks 0 / 3';}
function tickSignal(p,dt){const t=tilt();p.t+=dt;
  // the reticle sits where the phone points; the blip drifts on a looping path that speeds up each lock
  p.rx+=(t.x*3.6-p.rx)*Math.min(1,dt*8);p.ry+=(t.y*5-p.ry)*Math.min(1,dt*8);
  const a=p.t*p.speed+p.ph,bx=Math.sin(a*1.3)*2.6+Math.sin(a*2.9)*.6,by=Math.sin(a*.9+1)*3.6+Math.cos(a*2.1)*.6,d=Math.hypot(bx-p.rx,by-p.ry),on=d<.65;
  p.lock=clamp(p.lock+(on?dt/1.6:-dt*.4),0,1);if(on&&Math.random()<dt*8)Snd.play('tick');
  if(p.lock>=1){p.locks++;p.lock=0;p.speed+=.25;Snd.play('solve');vibe(30);burst(bx,by+11,-12,20,COL.green,4,.4,.6);$('pzStat').textContent='Locks '+p.locks+' / 3';if(p.locks>=3)puzzleSolved();}
  camera.position.set(0,3,0);camera.lookAt(0,11,-12);
  fx.push(bx,by+11,-12,0,1.2,1.2,0,.9,COL.pink);fx.push(bx,by+11,-12,0,2.6+Math.sin(p.t*8)*.4,2.6+Math.sin(p.t*8)*.4,1,.5,COL.pink);
  fx.push(p.rx,p.ry+11,-11.9,0,1.5,1.5,1,.9,on?COL.green:COL.cyan);fx.push(p.rx,p.ry+11,-11.9,0,.12,1.2,2,.8,on?COL.green:COL.cyan);fx.push(p.rx,p.ry+11,-11.9,PI/2,.12,1.2,2,.8,on?COL.green:COL.cyan);
  $('pzLock').style.transform='scaleX('+p.lock.toFixed(3)+')';$('pzLockW').hidden=false;
  if(p.done)$('pzLockW').hidden=true;}

/* ================================================================ DRAW */
const _t=[0,0,0];
function draw(dt,now){
  const tt=now*.001;
  const inBattle=state==='battle'||state==='victory'||state==='defeat';
  for(const g of heroG)g.visible=!(state==='puzzle'&&PZ&&PZ.def.gyro);gyroGroup.visible=state==='puzzle'&&!!(PZ&&PZ.def.gyro);land.visible=!(state==='puzzle'&&PZ&&PZ.def.gyro&&PZ.type!=='signal');
  if(state==='puzzle'&&PZ&&PZ.def.gyro){}  // the puzzle's tick placed the camera
  else if(inBattle){const sw=Math.sin(tt*.4)*.25;camera.position.set(sw,4.6,11.5);camera.lookAt(0,1,-2.6);}
  else{const a=tt*.12;camera.position.set(Math.sin(a)*1.5,2.2,6.4+Math.cos(a)*.6);camera.lookAt(0,1.1,-1);}
  // the duo
  for(let i=0;i<2;i++){const g=heroG[i],h=inBattle&&B.heroes[i];
    if(h){h.hop=Math.max(0,h.hop-dt*4);h.swing=Math.max(0,h.swing-dt*3.5);h.dodge=Math.max(0,h.dodge-dt*3);h.flash=Math.max(0,h.flash-dt*4);
      const hop=Math.sin((1-h.hop)*PI)*h.hop*.5+Math.sin((1-h.hop)*PI)*.0,dx=Math.sin(h.dodge*PI)*(i?.6:-.6);
      g.position.set(h.x+dx,h.down?0:Math.abs(Math.sin(tt*3+i))*.04+(h.hop>0?Math.sin(h.hop*PI)*.55:0),h.z);
      g.rotation.set(h.down?-1.3:0,PI+(i?-.45:.45),h.down?(i?.3:-.3):0);heroMat[i].userData.flash.value=h.flash*.8;
      heroTool[i].rotation.x=(i?-.9:-.4)-Math.sin(h.swing*PI)*1.8;
      if(B.active===h){fx.push(h.x,.05,h.z,0,1.5,1.5,1,.6+.3*Math.sin(tt*6),i?COL.cyan:COL.orange);fx.push(h.x,2.25+Math.sin(tt*5)*.08,h.z,PI,.5,.5,3,.95,COL.gold);}
      if(i===1&&!h.down){const tp=new T.Vector3(0,.66,0).applyMatrix4(heroTool[1].matrixWorld);fx.push(tp.x,tp.y,tp.z,0,.35,.35,0,.8+Math.random()*.2,COL.blue);}}
    else{g.position.set(HOME[i][0]*.7,Math.abs(Math.sin(tt*2.2+i))*.05,HOME[i][2]);g.rotation.set(0,(i?-.35:.35)+Math.sin(tt*.5+i)*.1,0);heroMat[i].userData.flash.value=0;heroTool[i].rotation.x=i?-.9:-.4;}
    g.updateMatrixWorld();}
  // aliens
  for(const f of B.foes){const g=f.m.g;if(!inBattle){g.visible=false;continue;}g.visible=true;f.t+=dt;f.flash=Math.max(0,f.flash-dt*3);
    let x=f.x,y=f.y+Math.sin(f.t*2)*.12,z=f.z;
    if(f.lunge>0&&f.lungeTo){f.lungeT+=dt;const k=clamp(f.lungeT/f.lungeAt,0,1),e=k*k;x=lerp(f.x,f.lungeTo.x,e*.9);z=lerp(f.z,f.lungeTo.z-.8,e*.9);y=lerp(y,1,e);}
    if(f.dead){f.sc=(f.sc==null?1:f.sc)-dt*3;if(f.sc<=0){g.visible=false;continue;}}else f.sc=1;
    g.position.lerp(_v.set(x,y,z),Math.min(1,dt*12));g.scale.setScalar(f.sc0*Math.max(.01,f.sc));
    if(f.boss)f.m.anim(f.t,f,dt);else f.m.inner.rotation.z=PI+Math.sin(f.t*1.4)*.2;
    f.m.mat.userData.flash.value=f.flash*.7;fx.push(g.position.x,f.boss?.05:.05,g.position.z,0,f.boss?3.2:1.3,f.boss?3.2:1.3,0,.2,f.boss?COL.pink:COL.orange);}
  // projectiles land exactly on their prompt
  for(let i=shots.length-1;i>=0;i--){const s=shots[i];s.t+=dt;const k=Math.min(1,s.t/s.dur),x=lerp(s.x0,s.x1,k),y=lerp(s.y0,s.y1,k)+Math.sin(k*PI)*s.arc,z=lerp(s.z0,s.z1,k);
    fx.push(x,y,z,0,.55,.55,0,1,s.c);fx.push(x,y,z,0,.25,.25,0,1,COL.hot);if(Math.random()<.5)part(x,y,z,0,0,0,.25,.3,.05,s.c,0,0);
    if(k>=1){burst(x,y,z,8,s.c,3,.25,.3);shots.splice(i,1);}}
  for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){rmPt(i);continue;}pt.vy[i]-=pt.gy[i]*dt;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;pt.z[i]+=pt.vz[i]*dt;
    const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_t[0]=pt.r[i];_t[1]=pt.g[i];_t[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_t);}
  for(let i=pops.length-1;i>=0;i--){const p=pops[i];p.t+=dt;const s=toScreen(p.x,p.y+p.t*.6,p.z);p.d.style.transform='translate('+Math.round(s.x)+'px,'+Math.round(s.y)+'px) translate(-50%,-50%)';
    if(p.t>1.1){p.d.remove();pops.splice(i,1);}}
  if(inBattle)placeFoeLabels();
  fx.flush();starMat.uniforms.uTime.value=tt;renderer.render(scene,camera);
}

/* ================================================================ BATTLE HUD */
function buildFoeLabels(){$('foes').innerHTML=B.foes.map((f,i)=>'<button class="foe'+(f.boss?' boss':'')+'" data-i="'+i+'"><b>'+f.name+'</b><span><i></i></span></button>').join('');updateFoeLabels();}
function updateFoeLabels(){[...$('foes').children].forEach((el,i)=>{const f=B.foes[i];if(!f)return;el.querySelector('i').style.transform='scaleX('+(f.hp/f.max).toFixed(3)+')';el.classList.toggle('dead',f.dead);});}
// Plates follow their aliens; when they would overlap (landscape, small phones) they spread apart in screen order,
// centred on the group, so each one stays a clean tap target.
function placeFoeLabels(){const ps=[];[...$('foes').children].forEach((el,i)=>{const f=B.foes[i];if(!f)return;const s=toScreen(f.x,f.y+(f.boss?2.3:1.05),f.z);
    ps.push({el,x:s.x,x0:s.x,y:Math.max(110,s.y),w:el.offsetWidth+8});});
  if(!ps.length)return;ps.sort((a,b)=>a.x-b.x);for(let k=1;k<ps.length;k++)ps[k].x=Math.max(ps[k].x,ps[k-1].x+(ps[k-1].w+ps[k].w)/2);
  let d=ps.reduce((a,p)=>a+p.x0-p.x,0)/ps.length;const lo=ps[0].x+d-ps[0].w/2,hi=ps[ps.length-1].x+d+ps[ps.length-1].w/2;
  if(lo<8)d+=8-lo;else if(hi>W-8)d-=hi-W+8;
  for(const p of ps)p.el.style.setProperty('--t','translate('+Math.round(p.x+d)+'px,'+Math.round(p.y)+'px) translate(-50%,-100%)');}
function renderPanels(){B.heroes.forEach((h,i)=>{const el=$('lane'+i);el.querySelector('.lv').textContent='Lv '+h.lvl;el.querySelector('.hp b').textContent=Math.ceil(h.hp)+' / '+h.maxHp;
    el.querySelector('.hp i').style.transform='scaleX('+(h.hp/h.maxHp).toFixed(3)+')';el.classList.toggle('down',h.down);el.classList.toggle('act',B.active===h);});
  $('tpN').textContent=B.tp+' / '+B.tpMax;$('tpBar').style.transform='scaleX('+(B.tp/B.tpMax).toFixed(3)+')';}
// Rings close in on a lane button; the tap lands as a ring meets the button's edge.
function drawRings(){for(let l=0;l<2;l++){const ring=$('ring'+l),w=B.wait;let best=null;
    if(w&&w.prompts)for(const p of w.prompts)if(!p.res&&p.lane===l&&(!best||p.at-p.t<best.at-best.t))best=p;
    if(!best||best.at-best.t>1.1){ring.style.opacity=0;continue;}const r=Math.max(0,best.at-best.t);ring.style.opacity=1;ring.style.transform='scale('+(1+r*1.6).toFixed(3)+')';
    ring.classList.toggle('now',r<.075);}}
let menuHero=null,pickMode=null;
function openMenu(h){menuHero=h;pickMode=null;const m=$('cmd');m.hidden=false;m.className='cmd '+(h.i?'r':'l');
  const H=HEROES[h.i],moves=TEAM.filter(t=>B.si>=t.from),items=Object.keys(ITEMS).filter(k=>S.items[k]>0);
  m.innerHTML='<div class="who">'+H.name+'’s turn</div><button data-c="attack"><b>'+H.attack+'</b><small>'+H.atkDesc+'</small></button>'+
    '<button data-c="team"'+(moves.some(t=>t.tp<=B.tp)?'':' disabled')+'><b>Team move</b><small>'+(moves.length?'Uses Team Points. You have '+B.tp+'.':'Learned later on the trail.')+'</small></button>'+
    '<button data-c="item"'+(items.length?'':' disabled')+'><b>Items</b><small>'+(items.length?items.map(k=>ITEMS[k].name+' ×'+S.items[k]).join(' · '):'Nothing in the pack.')+'</small></button>';}
function closeMenu(){$('cmd').hidden=true;menuHero=null;pickMode=null;$('pickHint').hidden=true;$('foes').classList.remove('pick');}
function choose(c){const w=B.wait;if(!w||!w.input)return;closeMenu();Snd.play('click');B.wait=null;advance(c);}
function askFoe(cmd){const alive=aliveFoes();if(alive.length===1){choose(Object.assign(cmd,{foe:alive[0]}));return;}
  pickMode=Object.assign({kind:'foe'},cmd);$('cmd').hidden=true;$('pickHint').hidden=false;$('pickHint').textContent='Tap an alien to target · tap here to go back';$('foes').classList.add('pick');}
$('cmd').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled||!menuHero)return;const h=menuHero,c=b.dataset.c;Snd.play('click');
  if(c==='attack')askFoe({act:'attack'});
  else if(c==='team'){const m=$('cmd');m.innerHTML='<div class="who">Team moves · '+B.tp+' TP</div>'+TEAM.filter(t=>B.si>=t.from).map(t=>'<button data-t="'+t.id+'"'+(t.tp>B.tp?' disabled':'')+'><b>'+t.name+' · '+t.tp+' TP</b><small>'+t.desc+'</small></button>').join('')+'<button data-c="back" class="ghost">Back</button>';}
  else if(c==='item'){const m=$('cmd');m.innerHTML='<div class="who">Items</div>'+Object.keys(ITEMS).filter(k=>S.items[k]>0).map(k=>'<button data-it="'+k+'"><b>'+ITEMS[k].name+' ×'+S.items[k]+'</b><small>'+ITEMS[k].desc+'</small></button>').join('')+'<button data-c="back" class="ghost">Back</button>';}
  else if(c==='back')openMenu(h);
  else if(b.dataset.t){const t=TEAM.find(x=>x.id===b.dataset.t);if(t.all)choose({act:'team',id:t.id});else askFoe({act:'team',id:t.id});}
  else if(b.dataset.it){const id=b.dataset.it;if(id==='mega'||id==='cell')choose({act:'item',id,hero:h.i});
    else{const ok=B.heroes.filter(x=>id==='spark'?x.down:!x.down&&x.hp<x.maxHp);if(!ok.length){toastMsg(id==='spark'?'Nobody is down':'Everyone is at full HP');return;}
      if(ok.length===1){choose({act:'item',id,hero:ok[0].i});return;}pickMode={kind:'hero',act:'item',id};$('cmd').hidden=true;$('pickHint').hidden=false;$('pickHint').textContent='Tap Rusty or Buckets · tap here to go back';}}
});
$('pickHint').onclick=()=>{if(menuHero)openMenu(menuHero);$('pickHint').hidden=true;$('foes').classList.remove('pick');};
$('foes').addEventListener('click',e=>{const b=e.target.closest('.foe');if(!b||!pickMode||pickMode.kind!=='foe')return;const f=B.foes[+b.dataset.i];if(!f||f.dead)return;
  const {kind,...c}=pickMode;choose(Object.assign(c,{foe:f}));});
function lanePress(l){
  if(state!=='battle')return;
  if(pickMode&&pickMode.kind==='hero'){const h=B.heroes[l];const id=pickMode.id;if((id==='spark')!==h.down)return;const {kind,...c}=pickMode;choose(Object.assign(c,{hero:l}));return;}
  tapLane(l);}
for(const l of [0,1])$('lane'+l).addEventListener('pointerdown',e=>{e.preventDefault();lanePress(l);});
// Taps on either half of the battlefield count for that engineer too: big targets for thumbs.
$('cv').addEventListener('pointerdown',e=>{if(state==='battle'&&B.wait&&B.wait.prompts){e.preventDefault();lanePress(e.clientX<W/2?0:1);}
  if(state==='puzzle'&&PZ&&PZ.def.gyro){joy.on=true;joy.x0=joy.x=e.clientX;joy.y0=joy.y=e.clientY;try{cv.setPointerCapture(e.pointerId);}catch(_){}}});
$('cv').addEventListener('pointermove',e=>{if(joy.on){joy.x=e.clientX;joy.y=e.clientY;}});
for(const ev of ['pointerup','pointercancel'])$('cv').addEventListener(ev,()=>{joy.on=false;});
window.addEventListener('keydown',e=>{
  if(state==='battle'){if(e.code==='ArrowLeft'||e.code==='KeyA')lanePress(0);if(e.code==='ArrowRight'||e.code==='KeyL'||e.code==='KeyD')lanePress(1);}
  if(state==='puzzle'&&PZ&&PZ.type==='crates'){const d={ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1],ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0]}[e.code];if(d){e.preventDefault();crateMove(d[0],d[1]);}if(e.code==='KeyZ')crateUndo();}
  if(state==='talk'&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();talkNext();}
  if(e.code==='Escape'&&(state==='battle'||state==='puzzle'))pause();});
// swipes push crates
let sw0=null;$('pzBoard').addEventListener('pointerdown',e=>{sw0=[e.clientX,e.clientY];});
$('pzBoard').addEventListener('pointerup',e=>{if(!sw0||!PZ||PZ.type!=='crates')return;const dx=e.clientX-sw0[0],dy=e.clientY-sw0[1];sw0=null;if(Math.max(Math.abs(dx),Math.abs(dy))<24)return;
  if(Math.abs(dx)>Math.abs(dy))crateMove(Math.sign(dx),0);else crateMove(0,Math.sign(dy));});
$('pzPad').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset.d.split(',').map(Number);crateMove(d[0],d[1]);});
$('pzUndo').onclick=crateUndo;

/* ================================================================ SCREENS & FLOW */
let state='title';
const SCREENS=['title','map','talk','puzzle','battle','victory','defeat','ending','pause','settings'];
function show(id){for(const s of SCREENS)$(s).hidden=s!==id;}
function toastMsg(t){const e=$('toast');e.textContent=t;e.classList.remove('go');void e.offsetWidth;e.classList.add('go');}
function banner(eye,txt){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}
function goTitle(){state='title';show('title');setChapter(Math.min(3,(STAGES[Math.min(S.stage,19)]||STAGES[0]).ch));clearBattle();
  $('tCont').hidden=!S.started;$('tCont').innerHTML=S.done?'Replay the ending':'Continue<small>Stage '+(S.stage+1)+' · '+STAGES[Math.min(S.stage,19)].name+'</small>';
  $('tNew').className=S.started?'':'primary';Mus.play('calm',chap);releaseWake();}
function clearBattle(){for(const f of B.foes)dropFoe(f);B.foes=[];B.gen=null;B.wait=null;B.on=false;closeMenu();shots.length=0;$('foes').innerHTML='';for(const p of pops)p.d.remove();pops.length=0;}
function goMap(){state='map';show('map');clearBattle();endPuzzle();clearGyro();const si=Math.min(S.stage,19),ch=STAGES[si].ch;setChapter(ch);
  $('mCh').textContent='Chapter '+(ch+1)+' of 4';$('mName').textContent=CHAPTERS[ch].name;
  $('mNodes').innerHTML=STAGES.map((s,i)=>s.ch!==ch?'':'<div class="node'+(i<S.stage?' done':i===S.stage?' cur':'')+(s.boss?' boss':'')+'"><i></i><span><b>'+(i+1)+' · '+s.name+'</b><small>'+PUZ[s.pz[0]].name+(PUZ[s.pz[0]].gyro?' · tilt':'')+' · '+(s.boss?BOSS[s.boss].name:s.foes.length+' alien'+(s.foes.length>1?'s':''))+'</small></span></div>').join('');
  const st=HEROES.map((H,i)=>{const s=heroStats(i);return H.name+' Lv '+s.lvl;}).join(' · ');$('mStats').textContent=st;
  $('mItems').textContent=Object.keys(ITEMS).filter(k=>S.items[k]>0).map(k=>ITEMS[k].name+' ×'+S.items[k]).join(' · ')||'No items';
  $('mGo').textContent=S.done?'See the ending':'Continue · Stage '+(S.stage+1);Mus.play('calm',ch);}
let talkQ=[],talkThen=null;
function talk(lines,then){talkQ=lines.slice();talkThen=then;state='talk';show('talk');talkNext();}
function talkNext(){if(!talkQ.length){const f=talkThen;talkThen=null;if(f)f();return;}const [w,t]=talkQ.shift();
  $('tkWho').textContent=WHO[w];$('tkWho').className='who '+w;$('tkTxt').textContent=t;Snd.play('tick');}
function beginStage(si){if(si>=STAGES.length){ending();return;}talk(STAGES[si].say,()=>startPuzzle(si));}
function showVictory(lines,first){state='victory';show('victory');
  $('vXp').textContent='+'+B.xp+' XP each';$('vLv').innerHTML=lines.map(l=>'<li>'+l+'</li>').join('');$('vLv').hidden=!lines.length;
  $('vItems').textContent=B.drops.length?'Found: '+B.drops.map(d=>ITEMS[d].name).join(', '):'';
  if(lines.length)setTimeout(()=>Snd.play('level'),500);
  $('vGo').textContent=B.si===STAGES.length-1?'Reach the Halcyon':'Onward';}
function showDefeat(){state='defeat';show('defeat');}
function ending(){S.done=true;S.stage=STAGES.length;save();setChapter(3);talk(ENDING,()=>{state='ending';show('ending');Snd.play('win');$('eArc').hidden=!window.ARCADE;});}
function pause(){if(state!=='battle'&&state!=='puzzle')return;pausedFrom=state;state='paused';show('pause');Snd.suspend();releaseWake();}
let pausedFrom='map';
function resume(){state=pausedFrom;show(state);Snd.resume();last=performance.now();}
let settingsFrom='title',confirmReset=false;
function openSettings(from){settingsFrom=from;show('settings');confirmReset=false;renderSettings();}
function renderSettings(){for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);
  for(const sg of document.querySelectorAll('#settings .seg'))for(const b of sg.children)b.classList.toggle('on',S.set[sg.dataset.seg]===b.dataset.v);
  $('ctrlHint').textContent=S.set.ctrl==='tilt'?(ARC.motion.denied?'Motion access was declined. Allow it in Safari’s website settings, or use Touch.':'Tilt puzzles read the phone’s motion. Level is however you hold it when a puzzle starts.'):'Tilt puzzles use a drag stick instead: drag from where you touch.';
  $('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';}
const wantMotion=()=>{if(S.set.ctrl==='tilt')ARC.motion.start();};

/* ----- buttons ----- */
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>Snd.init(),{once:true});
$('tCont').onclick=()=>{wantMotion();if(S.done){ending();return;}goMap();};
$('tNew').onclick=()=>{if(S.started&&!confirmNew){confirmNew=true;$('tNew').textContent='Tap again to start over';return;}
  const keep=S.set;S=fresh();S.set=keep;S.started=true;save();confirmNew=false;wantMotion();goMap();};
let confirmNew=false;
$('tSet').onclick=()=>openSettings('title');
if(window.ARCADE){for(const id of ['tArc','mArc']){$(id).hidden=false;$(id).onclick=()=>{save();location.href=window.ARCADE.home;};}
  $('eArc').onclick=()=>{save();location.href=window.ARCADE.home+'wreckwatch/';};}
$('mGo').onclick=()=>{wantMotion();beginStage(S.stage);};
$('mBack').onclick=()=>goTitle();
$('talk').addEventListener('click',e=>{if(e.target.id==='tkSkip'){talkQ=[];}talkNext();});
$('pzSkip').onclick=()=>{const si=PZ?PZ.si:S.stage;endPuzzle();clearGyro();startBattle(si);};
$('pzGo').onclick=()=>{const si=PZ.si;endPuzzle();clearGyro();startBattle(si);};
$('pzReset').onclick=()=>{if(!PZ)return;const si=PZ.si;endPuzzle();startPuzzle(si);};
$('vGo').onclick=()=>{if(B.si===STAGES.length-1)ending();else goMap();};
$('dRetry').onclick=()=>startBattle(B.si);
$('dMap').onclick=()=>goMap();
$('eAgain').onclick=()=>goTitle();
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
$('pzPause').onclick=()=>pause();
$('pRes').onclick=resume;
$('pCal').onclick=()=>{ARC.motion.calibrate();resume();};
$('pSet').onclick=()=>openSettings('pause');
$('pMap').onclick=()=>{Snd.resume();goMap();};
$('setClose').onclick=()=>{show(settingsFrom);};
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){S.set[t.dataset.set]=!S.set[t.dataset.set];Snd.apply();if(t.dataset.set==='music'&&!S.set.music)Mus.stop();save();renderSettings();return;}
  const b=e.target.closest('.seg button');if(b){const k=b.parentElement.dataset.seg;S.set[k]=b.dataset.v;if(k==='ctrl'&&b.dataset.v==='tilt')ARC.motion.start().then(()=>renderSettings());save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}const keep=S.set;S=fresh();S.set=keep;save();goTitle();}});
document.addEventListener('touchmove',e=>{if(!e.target.closest||!e.target.closest('.scroll'))e.preventDefault();},{passive:false});
for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
function autoPause(){if(state==='battle'||state==='puzzle')pause();else Snd.suspend();save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else if(state!=='paused')Snd.resume();last=performance.now();});
window.addEventListener('pagehide',autoPause);window.addEventListener('blur',autoPause);window.addEventListener('resize',resize);
let wakeLock=null;
function requestWake(){try{if(navigator.wakeLock&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null;});}).catch(()=>{});}catch(e){}}
function releaseWake(){try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}

/* ================================================================ LOOP */
let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(document.hidden||state==='paused')return;
  if(state==='battle'){tickBattle(dt);drawRings();}
  if(state==='puzzle'&&PZ&&PZ.def.tick&&!PZ.done)PZ.def.tick(PZ,dt);
  Mus.tick();draw(dt,now);}

/* ================================================================ BOOT */
resize();setChapter(0);goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
window.__rb={get S(){return S;},B,STAGES,startBattle,startPuzzle,tickBattle,tapLane,goMap,beginStage,victory,get state(){return state;},get PZ(){return PZ;},crateMove,puzzleSolved,
  set auto(f){B.auto=f;},set autoCmd(f){B.autoCmd=f;},heroStats,ending,motion:ARC.motion,PUZ};
})();
