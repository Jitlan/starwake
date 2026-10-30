/* Comet Kid: a side-scrolling run-and-gun platformer. Four strongholds in any order, each ending in a guardian whose weapon
   you take, then the Eclipse Core. Stages are hand-drawn tile maps below; everything else is generated in code.
   THREE and ARC (shared/kit.js) load first. */
(function(){
'use strict';
const T=THREE,TAU=Math.PI*2,PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a);
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255],hex=h=>'#'+h.toString(16).padStart(6,'0');
function seeded(seed){let s=(Math.abs(seed|0)%2147483646)+1;return()=>{s=s*16807%2147483647;return(s-1)/2147483646;};}
const {P,geo,makeMat}=ARC;

/* ===== SAVE */
const KEY='cometkid.save.v1';
function fresh(){return{v:1,beat:[0,0,0,0,0],best:[0,0,0,0,0],set:{sfx:true,music:true,vibe:true},stats:{deaths:0,clears:0}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&typeof v===typeof a[k]&&Array.isArray(v)===Array.isArray(a[k]))a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ===== WEAPONS */
// Weapon 0 is the buster; weapon k (1-4) is won from stage k-1's guardian. cost = energy per use, out of EMAX.
const WEAP=[
 {name:'Comet Buster',short:'Buster',c:0x3ec8ff},
 {name:'Mantis Scythe',short:'Scythe',c:0x9be04a,cost:1,tip:'A blade that flies out and comes back, cutting through everything in its path.'},
 {name:'Warden Rocket',short:'Rocket',c:0xff9b3d,cost:2,tip:'A rocket that hunts down the nearest target.'},
 {name:'Bastion Ward',short:'Ward',c:0xb36bff,cost:2,tip:'Four crystals orbit you and stop shots. Fire again to throw them.'},
 {name:'Hydra Flare',short:'Flare',c:0xff5a5a,cost:1,tip:'Three fireballs in a fan.'},
];
const EMAX=28,HMAX=28;

/* ===== STAGES */
// Maps are chunks of rows (top row first, padded with sky up to ROWS), joined left to right. One char per tile:
// # rock  = metal  - one-way ledge  ^ spikes  v ceiling spikes  % crumbling block  f flame vent  D boss door
// M platform on a sideways track (:)  V platform on an up-down track (;)  P start  C checkpoint  B guardian
// enemies: m mite  d dart  o drone  t turret  r falling rock  g gunship  e elite      pickups: h/H health  w/W weapon energy
const ROWS=14;
const CORR=f=>['        ========','        ========','        ========','        ========','        ========','                ','                ',f,'################','################','################'];
const ARENA=['==============','==============','==============','=            =','=            =','=            =','=            =','=       B    =','D            =','D            =','D            =','==============','==============','=============='];
const STAGES=[
 {name:'Thornwood',boss:'mantis',bname:'Mantis',weak:4,c:0x9be04a,bg:0x07140f,top:0x4f8a4a,side:0x1d3324,edge:0x9be04a,metal:0x34485a,far:[0x123020,0x0b1c14],star:0xd0ffe0,planet:[0x5ab89a,0x2a5a4a,0xc8ffe0],key:45,bpm:134,prog:[0,8,3,10],
  map:[
   ['            d   ','                ','  P             ','################','################','################'],
   ['          d     ','                ','                ','      ----      ','   h            ','  ####      ####','######^^^^^^####','################','################'],
   ['             o  ','        ---     ','                ','    ---         ','                ','####        ####','####  m     ####','################','################'],
   ['         d      ','                ','     ---   ---  ','                ','##             #','##             #','##             #','##             #'],
   ['            w   ','           #####','                ','      ####      ','C     ####      ','################','################','################'],
   ['        t       ','###########     ','###########     ','###########     ','###########  m  ','################','################','################'],
   ['        d       ','                ','                ','    ---   ---   ','  ^^^^^^^^^^^^  ','################','################','################'],
   CORR('  H             '),ARENA]},
 {name:'Foundry',boss:'warden',bname:'Warden',weak:1,c:0xff9b3d,bg:0x150a0a,top:0x8a5e44,side:0x3a2018,edge:0xff9b3d,metal:0x4a4458,far:[0x2e1612,0x1c0d0b],star:0xffd6c0,planet:[0xd9734f,0x8f3a2a,0xffc59f],key:43,bpm:140,prog:[0,5,3,10],
  map:[
   ['  P          m  ','################','################','################'],
   ['          o     ','                ','                ','                ','             m  ','#####f####f#####','################','################'],
   ['        d       ','                ','                ','                ','##:MMM::::::::##','##            ##','##            ##'],
   ['################','################','   r    r    r  ','                ','                ','                ','                ','            t   ','################','################','################'],
   ['           w    ','          ######','     ##f########','C    ###########','################','################','################'],
   ['        o       ','                ','                ','                ','#:MMM::::::::###','#            ###','#            ###','#            ###','#            ###','#            ###'],
   ['###             ','###             ','###    m     t  ','#####f#####f####','################','################'],
   CORR('  h             '),ARENA]},
 {name:'Crystal Keep',boss:'bastion',bname:'Bastion',weak:2,c:0xb36bff,bg:0x0d0922,top:0x7a6ab8,side:0x2a2050,edge:0xd8b8ff,metal:0x3c3a6a,far:[0x221a44,0x150f2c],star:0xe0c8ff,planet:[0x9a4fd9,0x4a2a8f,0xd8b8ff],key:47,bpm:128,prog:[0,8,5,7],
  map:[
   ['           o    ','                ','                ','  P             ','################','################','################'],
   ['        d       ','                ','                ','                ','###%%%%%%%%%%###','###          ###','###          ###'],
   ['    ;      w    ','    ;    #######','    ;    #######','    ;    #######','    ;    #######','    VVV  #######','####   #########','####   #########','####   #########'],
   ['      g         ','                ','                ','#########       ','#########       ','#########       ','#########  h    ','################','################','################','################'],
   ['################','################','   vvvvvvvvvv   ','                ','                ','C               ','####  ##  ##  ##','####  ##  ##  ##','####  ##  ##  ##','####  ##  ##  ##'],
   ['            t   ','          ######','          ######','     %%%  ######','          ######','####      ######','####      ######','####      ######','####      ######'],
   ['        g       ','                ','                ','######          ','######          ','######          ','######     h    ','################','################','################','################'],
   CORR('####H           '),ARENA]},
 {name:'Ember Reef',boss:'hydra',bname:'Hydra',weak:3,c:0xff5a5a,bg:0x180710,top:0xa04a50,side:0x3e1420,edge:0xff7a5a,metal:0x4a2a3a,far:[0x34121e,0x200a12],star:0xffd0d8,planet:[0xd94f6a,0x8f2a3f,0xffb8c8],key:41,bpm:146,prog:[0,3,8,10],
  map:[
   ['            d   ','                ','                ','  P             ','################','################','################'],
   ['        o       ','                ','                ','                ','                ','####   ###   ###','####   ###   ###','####   ###   ###'],
   ['        MMM:::::','                ','#:::::::MMM     ','#               ','#               '],
   ['        o       ','                ','                ','   m            ','######f####f####','################','################','################','################'],
   ['         d      ','                ','C               ','###   ---   ----','###             ','###             ','###             ','###             '],
   ['       g        ','                ','                ','                ','                ','                ','####            ','####          t ','################','################','################'],
   ['        d       ','                ','                ','                ','##::::MMM:::::##','##            ##','##            ##'],
   CORR('  h             '),ARENA]},
 {name:'Eclipse Core',boss:'eclipse',bname:'Eclipse',weak:1,final:1,c:0xffc531,bg:0x07061a,top:0x5a6290,side:0x1b1d33,edge:0xffc531,metal:0x2a2f50,far:[0x1a1a40,0x101028],star:0xfff0c0,planet:[0x23203f,0x3a2f6a,0xffc531],key:44,bpm:150,prog:[0,1,5,3],
  map:[
   ['          d     ','                ','                ','  P        m    ','################','################','################'],
   ['################','################','  r      r      ','                ','                ','                ','                ','           m    ','####f#####f#####','################','################'],
   ['    ;      h    ','    ;    #######','    ;    #######','    ;    #######','    ;    #######','    VVV  #######','####   #########','####   #########','####   #########'],
   ['           e    ','                ','################','################','################','################','################','################','################','################'],
   ['         d      ','                ','C               ','####%%%%%%%%%###','####         ###','####         ###','####         ###','####         ###','####         ###','####         ###','####         ###'],
   ['       g        ','                ','                ','                ','#::::MMM::::  ##','#             ##','#             ##','#             ##','#             ##','#             ##','#             ##','#             ##'],
   ['         d      ','                ','##              ','##              ','##   ---        ','##              ','##        ---   ','##^^^^^^^^^^^^^^','################','################'],
   CORR('  H             '),ARENA]},
];
const TILE={'#':1,'=':2,'-':3,'^':4,'v':5,'%':6,'f':7,'D':8};
// Enemies. hp in buster shots, r = hit radius, dmg in health pips, sc = model scale.
const ET={
 m:{k:'mite',hp:2,r:.42,dmg:3,sc:1.2},
 d:{k:'dart',hp:1,r:.4,dmg:3,sc:.85},
 o:{k:'drone',hp:3,r:.5,dmg:3,sc:.75},
 t:{k:'turret',hp:4,r:.5,dmg:3,sc:.8},
 r:{k:'rock',hp:2,r:.5,dmg:4,sc:.8},
 g:{k:'gunship',hp:8,r:.8,dmg:4,sc:.8},
 e:{k:'elite',hp:16,r:.8,dmg:4,sc:.85},
};
const PK={h:{hp:4},H:{hp:12},w:{en:4},W:{en:12}};
// Guardians: sc = model scale, r = hit radius.
const BOSS={mantis:{hp:28,sc:.62,r:1},warden:{hp:28,sc:.55,r:1.05},bastion:{hp:28,sc:.55,r:1.05},hydra:{hp:28,sc:.55,r:.95},eclipse:{hp:40,sc:.5,r:1.05}};

/* ===== PHYSICS TUNING (tiles, seconds) */
// Full jump rises JUMP^2/(2*GRAV) = 3.15 tiles and covers ~4.9 tiles of ground at RUN speed; letting go of jump cuts the rise.
const FIX=1/60,RUN=5.5,JUMP=14.2,GRAV=32,FALL=15,CUT=3,PW=.36,PH=1.35,COYOTE=.08,BUFFER=.1;
const PER=5,PERT=300;          // every moving platform loops in 5 s (300 ticks)
const CRUMBLE=.6,VIEW_H=12,CH1=.45,CH2=1.15,KB=.32,INV=1.3;

/* ===== RENDERER & CAMERA */
const view=$('view'),cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});
renderer.setPixelRatio(Math.min(DPR,2));
const scene=new T.Scene();
const camera=new T.PerspectiveCamera(30,1,1,500);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.25);hemi.position.set(0,1,.4);
const sun=new T.DirectionalLight(0xffffff,2.1);sun.position.set(-4,7,9);
scene.add(hemi,sun);
let W=1,H=1;
function resize(){W=Math.max(1,view.clientWidth);H=Math.max(1,view.clientHeight);renderer.setSize(W,H,false);camera.aspect=W/H;camera.updateProjectionMatrix();}
const cam={x:0,y:6,h:VIEW_H,hw:5,hh:5.5,lead:0,snap:1};

/* ===== MODELS */
const MAT=makeMat(false),MAT_I=makeMat(true),MAT_2=makeMat(false,{side:T.DoubleSide});
function buildKid(){
  const g=new T.Group(),base=makeMat(false),acc=makeMat(false),mk=(pp,m)=>new T.Mesh(geo(pp),m);
  const body=new T.Group();g.add(body);
  body.add(mk([{g:P.ico(.34,1),c:0xe8eefc,p:[0,1.02,0]},{g:P.box(.1,.19,.44),c:0x3ef0ff,e:1,p:[.27,1.0,0]},
    {g:P.box(.44,.08,.38),c:0x2a3050,p:[0,.43,0]},{g:P.box(.18,.3,.3),c:0xc8d0ea,p:[-.28,.66,0]},
    {g:P.cone(.07,.12,6),c:0xff9b3d,e:1,p:[-.3,.46,.08],r:[PI,0,0]},{g:P.cone(.07,.12,6),c:0xff9b3d,e:1,p:[-.3,.46,-.08],r:[PI,0,0]},
    {g:P.box(.04,.22,.04),c:0x8a92c8,p:[-.08,1.42,0]},{g:P.oct(.075),c:0xffc531,e:1,p:[-.08,1.56,0]},{g:P.oct(.06),c:0x3ef0ff,e:1,p:[.21,.66,0]}],base));
  body.add(mk([{g:P.box(.4,.34,.34),c:0xffffff,p:[0,.62,0]},{g:P.box(.2,.09,.2),c:0xffffff,p:[-.02,1.35,0]},{g:P.box(.16,.16,.46),c:0xffffff,p:[-.06,1.0,0]}],acc));
  const legs=[.11,-.11].map(z=>{const l=new T.Group();l.position.set(0,.42,z);l.add(mk([{g:P.box(.15,.3,.15),c:0xd8deef,p:[0,-.15,0]}],base),mk([{g:P.box(.24,.14,.2),c:0xffffff,p:[.04,-.34,0]}],acc));body.add(l);return l;});
  const arm=new T.Group();arm.position.set(.02,.7,.25);arm.add(mk([{g:P.cyl(.11,.13,.44,8),c:0xffffff,p:[.2,0,0],r:[0,0,-PI/2]}],acc),mk([{g:P.tor(.1,.03,4,10),c:0x3ef0ff,e:1,p:[.43,0,0],r:[0,PI/2,0]},{g:P.box(.12,.12,.12),c:0xd8deef}],base));body.add(arm);
  const back=new T.Group();back.position.set(.02,.7,-.25);back.add(mk([{g:P.box(.12,.32,.12),c:0xd8deef,p:[0,-.14,0]}],base));body.add(back);
  return{g,body,legs,arm,back,base,acc};
}
const KID=buildKid();scene.add(KID.g);
// one instanced mesh per alien model (aFlash = per-instance hit flash)
const EM={};for(const c in ET){const k=ET[c].k;if(EM[k])continue;const g=ARC.ALIENS[k]();g.setAttribute('aFlash',new T.InstancedBufferAttribute(new Float32Array(32),1).setUsage(T.DynamicDrawUsage));
  const m=new T.InstancedMesh(g,MAT_I,32);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;scene.add(m);EM[k]=m;}
function imesh(g,cap){const m=new T.InstancedMesh(g,MAT,cap);m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.count=0;m.frustumCulled=false;scene.add(m);return m;}
const PROJ={
 blade:imesh(geo([{g:P.cone(.16,.9,4),c:0xc8f060,e:1,p:[0,.3,0],s:[1,1,.3]},{g:P.cone(.16,.9,4),c:0x9be04a,p:[0,-.3,0],r:[0,0,PI],s:[1,1,.3]},{g:P.oct(.13),c:0xffffff,e:1}]),8),
 rocket:imesh(geo([{g:P.cyl(.09,.11,.5,6),c:0xe8eefc,r:[0,0,-PI/2]},{g:P.cone(.1,.2,6),c:0xff9b3d,e:1,p:[.34,0,0],r:[0,0,-PI/2]},{g:P.box(.12,.26,.04),c:0x5a6290,p:[-.18,0,0]}]),6),
 crystal:imesh(geo([{g:P.oct(.3),c:0xd8b8ff,e:1,s:[.8,1.2,.8]},{g:P.oct(.18),c:0xb36bff,p:[0,0,.12]}]),24),
 shard:imesh(geo([{g:P.oct(.3),c:0x3a0f3a,s:[.8,1.3,.8]},{g:P.oct(.2),c:0xff3d7f,e:1,s:[.8,1.3,.8],p:[0,0,.1]}]),40),
};
const PKM={h:imesh(geo([{g:P.box(.34,.26,.2),c:0xe8eefc},{g:P.box(.26,.1,.22),c:0xffc531,e:1}]),12),H:imesh(geo([{g:P.box(.56,.44,.3),c:0xe8eefc},{g:P.box(.44,.16,.32),c:0xffc531,e:1},{g:P.box(.16,.44,.32),c:0xffc531,e:1}]),12),
 w:imesh(geo([{g:P.oct(.2),c:0x3ef0ff,e:1,s:[1,1.3,1]},{g:P.tor(.24,.04,3,10),c:0x8a92c8}]),12),W:imesh(geo([{g:P.oct(.32),c:0x3ef0ff,e:1,s:[1,1.3,1]},{g:P.tor(.4,.06,3,12),c:0x8a92c8}]),12)};
const crumMesh=imesh(geo([{g:P.box(1,1,1.9),c:0x8a8a8a,p:[.5,.5,-.4]},{g:P.box(.86,.86,.05),c:0xc8c8c8,p:[.5,.5,.56]},{g:P.box(.55,.05,.06),c:0x2a2a2a,p:[.38,.62,.6],r:[0,0,.5]},
  {g:P.box(.42,.05,.06),c:0x2a2a2a,p:[.64,.34,.6],r:[0,0,-.6]},{g:P.box(.3,.05,.06),c:0x2a2a2a,p:[.3,.3,.6],r:[0,0,1.2]},{g:P.box(1.02,.07,.07),c:0xffffff,e:1,p:[.5,.97,.6]}]),64);crumMesh.setColorAt(0,new T.Color());
const fx=new ARC.Batch(scene,2400,ARC.FX_FS,{blend:T.AdditiveBlending,order:5});
const ebR=new ARC.Batch(scene,600,ARC.EB_FS,{blend:T.NormalBlending,order:6});
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color();
function setI(m,i,x,y,z,rx,ry,rz,s){_m4.compose(_p.set(x,y,z),_q.setFromEuler(_e.set(rx,ry,rz)),_s.setScalar(s));m.setMatrixAt(i,_m4);}

/* ===== SKY */
const STARN=420,starGeo=new T.BufferGeometry();
{const pos=new Float32Array(STARN*3),sz=new Float32Array(STARN);for(let i=0;i<STARN;i++){pos[i*3+2]=-90;sz[i]=Math.random()<.08?rand(2.4,3.4):rand(1,2);}
  starGeo.setAttribute('position',new T.BufferAttribute(pos,3));starGeo.setAttribute('aSize',new T.BufferAttribute(sz,1));}
const starMat=new T.ShaderMaterial({uniforms:{uTime:{value:0},uPx:{value:Math.min(DPR,2)},uColor:{value:new T.Vector3(1,1,1)}},transparent:true,depthWrite:false,blending:T.AdditiveBlending,
  vertexShader:'uniform float uTime,uPx;attribute float aSize;varying float vB;\nvoid main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=aSize*uPx;vB=(0.4+0.25*aSize)*(0.75+0.25*sin(uTime*1.5+position.x*3.1));}',
  fragmentShader:'uniform vec3 uColor;varying float vB;void main(){float d=length(gl_PointCoord-0.5);gl_FragColor=vec4(uColor*vB,smoothstep(0.5,0.05,d));}'});
const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;scene.add(stars);
const MAT_SKY=makeMat(false,{fog:false}),planet=new T.Group();scene.add(planet);let planetMesh=null,ringMesh=null;

/* ===== STAGE BUILD */
const G={i:0,tick:0,t:0,w:1,tl:new Uint8Array(1),ci:null,crum:[],plats:[],vents:[],cps:[],spawns:[],mpicks:[],en:[],shots:[],eb:[],picks:[],door:null,ar:null,boss:null,
  start:{x:2,y:3},cp:null,phase:'ready',pt:0,inArena:false,time:0,deaths:0,shake:0,god:0,noCrumble:0};
const stageMeshes=[];
function assemble(ch){const rows=Array.from({length:ROWS},()=>'');
  for(const c of ch){const w=Math.max(...c.map(s=>s.length)),pad=ROWS-c.length;for(let r=0;r<ROWS;r++)rows[r]+=(r<pad?'':c[r-pad]).padEnd(w,' ');}return rows;}
function parse(i){
  const L=STAGES[i],rows=assemble(L.map),w=rows[0].length,at=(x,y)=>(x<0||x>=w||y<0||y>=ROWS)?' ':rows[ROWS-1-y][x];
  Object.assign(G,{i,w,tl:new Uint8Array(w*ROWS),ci:new Int16Array(w*ROWS).fill(-1),crum:[],plats:[],vents:[],cps:[],spawns:[],mpicks:[],rails:[],door:null,ar:null,bossAt:null});
  for(let y=0;y<ROWS;y++)for(let x=0;x<w;x++){const c=at(x,y),k=TILE[c];if(k)G.tl[y*w+x]=k;
    if(c==='P')G.start={x:x+.5,y};else if(c==='C')G.cps.push({x:x+.5,y,on:0});else if(c==='B')G.bossAt={x:x+.5,y:y+.5};
    else if(ET[c])G.spawns.push({c,x:x+.5,y});else if(PK[c])G.mpicks.push({k:c,x:x+.5,y});
    if(c==='f')G.vents.push({x,y:y+1,ph:(x*.37)%3.2});
    if(c==='%'){G.ci[y*w+x]=G.crum.length;G.crum.push({x,y,t:-1,gone:0,back:0});}
    if(c==='D'&&!G.door)G.door={x,y,open:0,want:0};
    // sideways platform: a run of M on a track of : (both ends of the run of M or :)
    if(c==='M'&&at(x-1,y)!=='M'){let e=x;while(at(e+1,y)==='M')e++;const pw=e-x+1;let a=x,b=e;while(':M'.includes(at(a-1,y)))a--;while(':M'.includes(at(b+1,y)))b++;
      const s0=(b-pw+1-a)>0?(x-a)/(b-pw+1-a):0;G.plats.push({hz:1,w:pw,a,b:b-pw+1,row:y,ph:Math.acos(1-2*s0),x,y:y+1,dx:0,dy:0});G.rails.push([a,y+.75,b+1,y+.75]);}
    // up-down platform: a run of V; its track is the column of ; above and below the run's first tile
    if(c==='V'&&at(x-1,y)!=='V'){let e=x;while(at(e+1,y)==='V')e++;let a=y,b=y;while(';V'.includes(at(x,a-1)))a--;while(';V'.includes(at(x,b+1)))b++;
      const s0=b>a?(y-a)/(b-a):0;G.plats.push({hz:0,w:e-x+1,a,b,col:x,ph:Math.acos(1-2*s0),x,y:y+1,dx:0,dy:0});G.rails.push([x+(e-x+1)/2,a+.5,x+(e-x+1)/2,b+1]);}
  }
  const A=G.door?G.door.x:w-14;G.ar={x0:A+1,x1:A+13,y0:3,y1:11,cx:A+7};
  setPlats(0);
}
const tileK=(x,y)=>(x<0||x>=G.w)?1:(y<0||y>=ROWS)?0:G.tl[y*G.w+x];
function solid(x,y){if(x<0||x>=G.w)return true;if(y<0||y>=ROWS)return false;const k=G.tl[y*G.w+x];
  return k===1||k===2||k===7||(k===6&&!G.crum[G.ci[y*G.w+x]].gone)||(k===8&&G.door.open<.5);}
const oneway=(x,y)=>tileK(x,y)===3&&y>=0;
function platAt(p,tick){const s=.5-.5*Math.cos(TAU*tick/PERT+p.ph),v=p.a+(p.b-p.a)*s;return p.hz?[v,p.row+1]:[p.col,v+1];}
function setPlats(tick){for(const p of G.plats){const [x0,y0]=platAt(p,tick-1),[x,y]=platAt(p,tick);p.x=x;p.y=y;p.dx=x-x0;p.dy=y-y0;}}

// Static geometry: tile faces as quads (front, exposed top and sides), spikes, ledges, rails, props, skyline.
function buildMeshes(){
  for(const m of stageMeshes){scene.remove(m);m.geometry.dispose();}stageMeshes.length=0;
  const L=STAGES[G.i],r=seeded(G.i*97+3),Pp=[],N=[],C=[],E=[],cA=new T.Color(),cB=new T.Color();
  const v3=(a)=>{Pp.push(a[0],a[1],a[2]);};
  const quad=(a,b,c,d,n,cl,em)=>{for(const v of [a,b,c,a,c,d]){v3(v);N.push(n[0],n[1],n[2]);C.push(cl.r,cl.g,cl.b);E.push(em?1:0);}};
  const ZF=.6,ZB=-1.5,box=(x0,y0,x1,y1,zf,zb,cf,ct,cs,em)=>{
    quad([x0,y0,zf],[x1,y0,zf],[x1,y1,zf],[x0,y1,zf],[0,0,1],cf,em);
    if(ct)quad([x0,y1,zf],[x1,y1,zf],[x1,y1,zb],[x0,y1,zb],[0,1,0],ct,em);
    if(cs){quad([x0,y0,zb],[x0,y0,zf],[x0,y1,zf],[x0,y1,zb],[-1,0,0],cs);quad([x1,y0,zf],[x1,y0,zb],[x1,y1,zb],[x1,y1,zf],[1,0,0],cs);}};
  const sol=(x,y)=>{const k=tileK(x,y);return k===1||k===2||k===7||k===8||k===6;};
  const parts=[];
  for(let y=0;y<ROWS;y++)for(let x=0;x<G.w;x++){const k=G.tl[y*G.w+x];if(!k)continue;
    if(k===1||k===2||k===7){const met=k===2,sh=r(),open=!sol(x,y+1);
      cA.set(k===7?0x2a2f45:met?L.metal:L.side).multiplyScalar(.66+sh*.18+(y%2?0:.05));
      quad([x,y,ZF],[x+1,y,ZF],[x+1,y+1,ZF],[x,y+1,ZF],[0,0,1],cA);
      cB.copy(cA).multiplyScalar(met?1.35:1.18);quad([x+.07,y+.07,ZF+.01],[x+.93,y+.07,ZF+.01],[x+.93,y+.93,ZF+.01],[x+.07,y+.93,ZF+.01],[0,0,1],cB);
      if(met){cB.multiplyScalar(.7);quad([x+.42,y+.2,ZF+.015],[x+.58,y+.2,ZF+.015],[x+.58,y+.8,ZF+.015],[x+.42,y+.8,ZF+.015],[0,0,1],cB);}
      if(open){cB.set(L.top).multiplyScalar(.75+r()*.2);quad([x,y+1,ZF],[x+1,y+1,ZF],[x+1,y+1,ZB],[x,y+1,ZB],[0,1,0],cB);
        cB.multiplyScalar(.62);quad([x,y+.68,ZF+.02],[x+1,y+.68,ZF+.02],[x+1,y+.93,ZF+.02],[x,y+.93,ZF+.02],[0,0,1],cB);
        quad([x,y+.93,ZF+.02],[x+1,y+.93,ZF+.02],[x+1,y+1,ZF+.02],[x,y+1,ZF+.02],[0,0,1],_c.set(L.edge),1);
        if(r()<.16&&k===1&&!tileK(x,y+1))parts.push(...prop(L,x+.5,y+1,r));}
      cB.copy(cA).multiplyScalar(.6);
      if(!sol(x-1,y))quad([x,y,ZB],[x,y,ZF],[x,y+1,ZF],[x,y+1,ZB],[-1,0,0],cB);
      if(!sol(x+1,y))quad([x+1,y,ZF],[x+1,y,ZB],[x+1,y+1,ZB],[x+1,y+1,ZF],[1,0,0],cB);
      if(!sol(x,y-1)&&y>0)quad([x,y,ZB],[x+1,y,ZB],[x+1,y,ZF],[x,y,ZF],[0,-1,0],cB);
      if(k===7){quad([x+.3,y+.75,ZF+.03],[x+.7,y+.75,ZF+.03],[x+.7,y+.95,ZF+.03],[x+.3,y+.95,ZF+.03],[0,0,1],_c.set(0xff9b3d),1);}}
    else if(k===3){cA.set(L.top).multiplyScalar(.75);box(x,y+.72,x+1,y+1,.45,-.9,cA,_c.set(L.top),null);quad([x,y+.94,.46],[x+1,y+.94,.46],[x+1,y+1,.46],[x,y+1,.46],[0,0,1],_c.set(L.edge),1);}
    else if(k===4||k===5){const up=k===4;for(const [ox,oz] of [[.2,.2],[.5,-.15],[.8,.2],[.35,-.6],[.65,-.6]])parts.push({g:P.cone(.15,.5,5),c:0x8a92c8,p:[x+ox,up?y+.25:y+.75,oz],r:up?[0,0,0]:[PI,0,0]},{g:P.oct(.05),c:0xff3d7f,e:1,p:[x+ox,up?y+.5:y+.5,oz]});}
    else if(k===8){/* door drawn separately */}
  }
  for(let x=0;x<G.w;x++)if(sol(x,0)){cA.set(L.side).multiplyScalar(.32);quad([x,-30,ZF],[x+1,-30,ZF],[x+1,0,ZF],[x,0,ZF],[0,0,1],cA);}
  for(const [x0,y0,x1,y1] of G.rails){const hz=y0===y1;parts.push({g:P.box(hz?x1-x0:.08,hz?.08:y1-y0,.08),c:STAGES[G.i].edge,e:1,p:[(x0+x1)/2,(y0+y1)/2,-1.1]});}
  for(const v of G.vents)parts.push({g:P.cyl(.22,.3,.18,8),c:0x2a2f45,p:[v.x+.5,v.y+.09,0]});
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Pp,3));g.setAttribute('normal',new T.Float32BufferAttribute(N,3));
  g.setAttribute('color',new T.Float32BufferAttribute(C,3));g.setAttribute('aEmis',new T.Float32BufferAttribute(E,1));g.computeBoundingSphere();
  const add=(gg,m)=>{const ms=new T.Mesh(gg,m||MAT_2);scene.add(ms);stageMeshes.push(ms);return ms;};
  add(g);if(parts.length)add(geo(parts),MAT);
  // skyline: two rows of dark towers behind the stage
  const sk=[];for(let layer=0;layer<2;layer++){const z=layer?-46:-20,rr=seeded(G.i*13+layer),base=layer?-8:-6;
    for(let x=-40;x<G.w+40;){const bw=2+rr()*(layer?7:4),bh=(layer?14:9)+rr()*(layer?14:6);sk.push({g:P.box(bw,bh,2),c:_c.set(L.far[layer]).multiplyScalar(layer?.6:.75).getHex(),p:[x+bw/2,base+bh/2,z]});
      if(rr()<.35)sk.push({g:P.box(.3,.3,.1),c:L.far[0],e:1,p:[x+bw*rr(),base+bh*(.5+rr()*.45),z+1.05]});x+=bw+rr()*(layer?3:4);}}
  add(geo(sk),MAT_SKY);
  // door
  if(G.door){const d=add(geo([{g:P.box(.9,3,1.6),c:0x3a3f66,p:[.5,1.5,-.2]},{g:P.box(.92,.12,1.62),c:L.edge,e:1,p:[.5,.75,-.2]},{g:P.box(.92,.12,1.62),c:L.edge,e:1,p:[.5,1.5,-.2]},{g:P.box(.92,.12,1.62),c:L.edge,e:1,p:[.5,2.25,-.2]},
    {g:P.box(.7,.5,.1),c:0xff3d7f,e:1,p:[.5,1.5,.62]}]),MAT);d.position.set(G.door.x,G.door.y,0);G.doorMesh=d;}
  // moving platforms
  G.platMeshes=G.plats.map(p=>add(geo([{g:P.box(p.w,.42,1.7),c:0x8a92c8,p:[p.w/2,-.21,-.2]},{g:P.box(p.w-.2,.06,1.5),c:0xe8eefc,p:[p.w/2,.0,-.2]},{g:P.box(p.w*.6,.08,.1),c:L.edge,e:1,p:[p.w/2,-.3,.66]},
    {g:P.cone(.18,.3,6),c:0xff9b3d,e:1,p:[.4,-.55,0],r:[PI,0,0]},{g:P.cone(.18,.3,6),c:0xff9b3d,e:1,p:[p.w-.4,-.55,0],r:[PI,0,0]}]),MAT));
  // checkpoints
  G.cpMeshes=G.cps.map(c=>{const m=add(geo([{g:P.box(.5,.16,.5),c:0x3a3f66,p:[0,.08,-.6]},{g:P.box(.1,1.4,.1),c:0x8a92c8,p:[0,.8,-.6]}]),MAT);m.position.set(c.x,c.y,0);return m;});
  // sky
  scene.background=new T.Color(L.bg);scene.fog=new T.Fog(L.bg,30,120);const sc=rgb(L.star);starMat.uniforms.uColor.value.set(sc[0],sc[1],sc[2]);
  const sp=starGeo.getAttribute('position');for(let k=0;k<STARN;k++){sp.array[k*3]=rand(-60,G.w+60);sp.array[k*3+1]=rand(-20,50);}sp.needsUpdate=true;
  if(planetMesh){planet.remove(planetMesh,ringMesh);planetMesh.geometry.dispose();ringMesh.geometry.dispose();}
  const pg=geo([{g:P.ico(1,1),c:0xffffff}]),col=pg.getAttribute('color'),c1=new T.Color(L.planet[0]),c2=new T.Color(L.planet[1]),tc=new T.Color();
  for(let k=0;k<col.count;k+=3){tc.copy(c1).lerp(c2,Math.random()*.9);for(let j=0;j<3;j++)col.setXYZ(k+j,tc.r,tc.g,tc.b);}
  planetMesh=new T.Mesh(pg,MAT_SKY);ringMesh=new T.Mesh(geo([{g:P.tor(1.65,.06,3,40),c:L.planet[2]},{g:P.tor(1.9,.03,3,40),c:L.planet[2]}]),MAT_SKY);ringMesh.rotation.x=1.2;planet.add(planetMesh,ringMesh);planet.scale.setScalar(4.5);
}
function prop(L,x,y,r){const z=-.9+r()*.5;switch(G.i){
  case 0:return[{g:P.cone(.12,.7,4),c:0x2f6a3a,p:[x-.15,y+.35,z],r:[0,0,.3]},{g:P.cone(.1,.55,4),c:0x3f8a4a,p:[x+.12,y+.27,z],r:[0,0,-.4]},{g:P.oct(.07),c:0x9be04a,e:1,p:[x-.25,y+.7,z]}];
  case 1:return[{g:P.cyl(.14,.14,.9,6),c:0x4a4458,p:[x,y+.45,z]},{g:P.box(.2,.1,.2),c:0xff9b3d,e:1,p:[x,y+.95,z]}];
  case 2:return[{g:P.oct(.28),c:0x8a6ae0,s:[.7,1.6,.7],p:[x,y+.35,z],r:[0,0,.2]},{g:P.oct(.16),c:0xd8b8ff,e:1,s:[.7,1.6,.7],p:[x+.25,y+.2,z+.1],r:[0,0,-.3]}];
  case 3:return[{g:P.cone(.1,.8,5),c:0xc04a5a,p:[x,y+.4,z]},{g:P.cone(.08,.5,5),c:0xe06a6a,p:[x+.2,y+.25,z],r:[0,0,-.5]},{g:P.oct(.06),c:0xff7a5a,e:1,p:[x,y+.82,z]}];
  default:return[{g:P.box(.06,1,.06),c:0x8a92c8,p:[x,y+.5,z]},{g:P.oct(.08),c:0xffc531,e:1,p:[x,y+1.02,z]}];}}

/* ===== AUDIO */
const Snd=ARC.synth({sfx:()=>S.set.sfx,music:()=>S.set.music,onInit:()=>{if(Mus.want)Mus.play(Mus.want[0],Mus.want[1]);},
  thr:{shot:.03,hit:.04,tink:.06,eshot:.07,chg:.08,land:.12,crumble:.1,vent:.5,bhit:.05,kill:.04,pick:.06,dash:.15,hurt:.2},
  sounds:{
    shot:(s,t)=>{s.osc('square',1250,620,t,.06,.05);},
    shot1:(s,t)=>{s.osc('square',760,320,t,.12,.07);s.osc('sawtooth',1400,500,t,.1,.035);},
    shot2:(s,t)=>{s.osc('sawtooth',520,120,t,.28,.11);s.nz(t,.2,.12,'bandpass',2400,600);s.osc('square',1600,300,t,.2,.045);},
    chg:(s,t,a)=>{s.osc('triangle',300+a*1100,0,t,.05,.035);},
    hit:(s,t)=>{s.osc('square',320,120,t,.06,.06);},
    tink:(s,t)=>{s.osc('triangle',2400,2200,t,.05,.05);},
    kill:(s,t)=>{s.nz(t,.25,.25,'lowpass',2600,200);s.osc('square',420,60,t,.2,.07);},
    hurt:(s,t)=>{s.osc('sawtooth',620,150,t,.18,.11);s.osc('square',300,80,t+.04,.15,.07);},
    die:(s,t)=>{[784,659,523,392,262].forEach((f,i)=>s.osc('square',f,f*.8,t+i*.07,.1,.06));s.nz(t,.6,.3,'lowpass',2000,100);},
    land:(s,t)=>{s.osc('sine',140,60,t,.06,.12);},
    jump:(s,t)=>{s.osc('square',280,560,t,.06,.025);},
    pick:(s,t)=>{[660,880,1100].forEach((f,i)=>s.osc('square',f,0,t+i*.05,.05,.045));},
    door:(s,t)=>{s.nz(t,.5,.2,'bandpass',500,1500,0,2);s.osc('sawtooth',90,140,t,.5,.07);},
    cp:(s,t)=>{s.osc('triangle',880,0,t,.1,.08);s.osc('triangle',1320,0,t+.08,.14,.08);},
    alarm:(s,t)=>{for(let i=0;i<3;i++){s.osc('square',660,660,t+i*.3,.14,.05);s.osc('square',440,440,t+i*.3+.15,.14,.05);}},
    bhit:(s,t)=>{s.osc('square',220,80,t,.08,.09);s.nz(t,.06,.1,'highpass',3000);},
    weak:(s,t)=>{s.osc('sawtooth',880,220,t,.14,.11);s.nz(t,.12,.2,'bandpass',1800,600);},
    boom:(s,t)=>{s.nz(t,.5,.4,'lowpass',1800,80);s.osc('sine',120,40,t,.4,.3);},
    big:(s,t)=>{s.nz(t,1.6,.6,'lowpass',2600,50);s.osc('sawtooth',200,30,t,1.3,.2);},
    get:(s,t)=>{[523,659,784,1047,784,1047].forEach((f,i)=>s.osc('square',f,0,t+i*.11,.12,.055));s.osc('triangle',1047,0,t+.66,.6,.09);},
    ready:(s,t)=>{s.osc('triangle',523,0,t,.08,.06);s.osc('triangle',784,0,t+.1,.14,.06);},
    beam:(s,t)=>{s.osc('sine',200,1600,t,.3,.07);},
    vent:(s,t)=>{s.nz(t,.5,.12,'bandpass',700,300,0,1);},
    wave:(s,t)=>{s.osc('sine',90,40,t,.35,.35);s.nz(t,.3,.25,'lowpass',600,80);},
    eshot:(s,t)=>{s.osc('triangle',520,260,t,.08,.04);},
    dash:(s,t)=>{s.nz(t,.2,.1,'bandpass',1500,3000,0,3);},
    click:(s,t)=>{s.osc('square',880,0,t,.03,.035);},
    sw:(s,t)=>{s.osc('square',660,990,t,.06,.045);},
    scythe:(s,t)=>{s.nz(t,.2,.13,'bandpass',2600,1200,0,4);},
    rocket:(s,t)=>{s.nz(t,.3,.15,'bandpass',900,300,0,2);s.osc('sawtooth',200,500,t,.15,.035);},
    ward:(s,t)=>{[988,1319,1568].forEach((f,i)=>s.osc('triangle',f,0,t+i*.04,.08,.045));},
    flare:(s,t)=>{s.nz(t,.15,.15,'bandpass',1400,500,0,1);s.osc('sawtooth',400,180,t,.12,.045);},
    crumble:(s,t)=>{s.nz(t,.2,.12,'lowpass',900,200);},
    empty:(s,t)=>{s.osc('square',200,180,t,.06,.04);},
    beamin:(s,t)=>{s.osc('square',1600,400,t,.25,.04);s.osc('triangle',200,900,t+.2,.15,.06);},
  }});
const Mus=ARC.music(Snd,{level:i=>STAGES[i]||STAGES[0],calmBpm:100,calmBass:.22});
const vibe=ms=>ARC.vibe(S.set.vibe,ms);

/* ===== PARTICLES */
const pt={n:0,cap:1400,keys:['x','y','z','vx','vy','l','m','s0','s1','r','g','b','sh','dr','gy']};for(const k of pt.keys)pt[k]=new Float32Array(pt.cap);
function rm(o,i){const j=--o.n;if(i!==j)for(const k of o.keys)o[k][i]=o[k][j];}
function part(x,y,z,vx,vy,l,s0,s1,c,sh,dr,gy){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.l[i]=pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.dr[i]=dr||0;pt.gy[i]=gy||0;}
const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),green:rgb(0x5dff9b),lime:rgb(0x9be04a),hot:rgb(0xffe6b0),red:rgb(0xff4d4d),dim:rgb(0x5d5f99)};
const WCOL=WEAP.map(w=>rgb(w.c));
function boom(x,y,sz,c){for(let i=0;i<8+sz*14;i++){const a=rand(0,TAU),s=rand(.5,1)*(2+sz*4);part(x,y,.5,Math.cos(a)*s,Math.sin(a)*s,rand(.25,.55)*(.7+sz*.3),rand(.25,.5)*(.6+sz*.5),.05,c,0,3,0);}
  part(x,y,.6,0,0,.18+sz*.06,.9+sz*1.4,.2,COL.hot,0,0);part(x,y,.5,0,0,.3+sz*.1,.2,1.6+sz*2.2,c,1,0);}
function spark(x,y,c){for(let i=0;i<5;i++){const a=rand(0,TAU),s=rand(2,5);part(x,y,.6,Math.cos(a)*s,Math.sin(a)*s,rand(.12,.25),.18,.03,c,0,4,0);}}
// The classic: rings of orbs flying out from where the hero fell.
function burst(x,y,c){for(const sp of [3,6])for(let i=0;i<8;i++){const a=i*TAU/8;part(x,y,.7,Math.cos(a)*sp,Math.sin(a)*sp,2.2,.55,.55,c,0,0,0);}}

/* ===== RUN STATE */
let state='title';
const PL={x:0,y:0,vx:0,vy:0,hw:PW,h:PH,gr:0,on:null,drop:0,face:1,coy:0,buf:0,jh:0,kb:0,inv:0,hp:HMAX,dead:0,deadT:0,w:0,we:[0,EMAX,EMAX,EMAX,EMAX],chg:0,charging:0,shootT:0,anim:0,lvy:0,vis:1};
const owned=w=>w===0||!!S.beat[w-1];
function resetBody(b,x,y){Object.assign(b,{x,y,vx:0,vy:0,gr:0,on:null,drop:0,coy:0,buf:0,jh:0,kb:0});}

function startStage(i){
  state='play';hideScreens();parse(i);buildMeshes();
  G.tick=0;G.t=0;G.time=0;G.deaths=0;G.inArena=false;G.boss=null;G.cp={x:G.start.x,y:G.start.y,arena:0};G.picks=G.mpicks.map(p=>Object.assign({},p,{map:1,on:1,vy:0,life:1e9}));
  PL.we=[0,EMAX,EMAX,EMAX,EMAX];if(!owned(PL.w))PL.w=0;
  clearInput();respawn(true);cam.snap=1;
  document.body.classList.add('ingame');$('hud').hidden=false;$('hStage').textContent=(i<4?'Stage '+(i+1):'Final')+' · '+STAGES[i].name;$('bossW').hidden=true;
  for(const id of ['banner','toast'])$(id).classList.remove('go');
  Mus.play('level',i);requestWake();lastHud={};updWeapUI();resize();
}
// Back to the last checkpoint: everything except collected map pickups and lit checkpoints is put back.
function respawn(first){
  const c=G.cp;resetBody(PL,c.x,c.y);Object.assign(PL,{face:1,inv:0,hp:HMAX,dead:0,deadT:0,chg:0,charging:0,shootT:0,vis:0});
  if(!first)PL.we=PL.we.map((v,k)=>k?Math.max(v,EMAX*.5|0):0);
  G.en=G.spawns.map(s=>spawnE(s.c,s.x,s.y)).filter(e=>!c.arena||e.x<G.ar.x0-14);G.shots=[];G.eb=[];G.picks=G.picks.filter(p=>p.map);pt.n=0;
  for(const k of G.crum){k.t=-1;k.gone=0;}
  G.inArena=!!c.arena;if(G.door){G.door.open=0;G.door.want=0;}
  G.boss=null;$('bossW').hidden=true;G.phase='ready';G.pt=0;G.shake=0;
  banner('','Ready',1);Snd.play('ready');if(G.inArena)Mus.play('level',G.i);
}
function spawnE(c,x,y,tmp){const d=ET[c],e={c,k:d.k,x,y:c==='m'?y:y+.5,x0:x,y0:y+.5,hp:d.hp,r:d.r,dmg:d.dmg,t:Math.random()*3,cd:1+Math.random(),st:0,n:0,bt:0,vx:0,vy:0,face:-1,fl:0,on:1,act:0,tmp:!!tmp,ang:PI/2,fade:1};
  if(c==='m')Object.assign(e,{hw:.34,h:.62,drop:0,noPlat:1,gr:0});if(c==='t'&&solid(Math.floor(x),Math.floor(y)+1)&&!solid(Math.floor(x),Math.floor(y)-1))e.ceil=1;return e;}
const ey=e=>e.c==='m'?e.y+.31:e.y;

/* ===== INPUT */
// Keys, touch and the test hook are merged into one held state that the simulation samples each tick.
// Presses are latched so a tap shorter than a frame still registers.
const keys={},touch={l:0,r:0,d:0,u:0,jump:0,shoot:0},latch={jump:0,shoot:0,sw:0};
let auto=null;
const KMAP={ArrowLeft:'l',KeyA:'l',ArrowRight:'r',KeyD:'r',ArrowDown:'d',KeyS:'d',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyK:'jump',KeyZ:'jump',KeyJ:'shoot',KeyX:'shoot'};
window.addEventListener('keydown',e=>{const k=KMAP[e.code];if(k||e.code==='Space')e.preventDefault();
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pause();else if(state==='paused')resume();return;}
  if(e.repeat)return;if(k){keys[k]=1;if(k==='jump'||k==='shoot')latch[k]=1;}
  if(e.code==='KeyQ')latch.sw=-1;if(e.code==='KeyE'||e.code==='ShiftLeft'||e.code==='ShiftRight')latch.sw=1;});
window.addEventListener('keyup',e=>{const k=KMAP[e.code];if(k)keys[k]=0;});
const prev={jump:0,shoot:0};
function readInput(){
  let h;if(auto){const a=auto(PL,G)||{};h={l:!!a.l,r:!!a.r,d:!!a.d,jump:!!a.jump,shoot:!!a.shoot};if(a.sw)latch.sw=a.sw;}
  else h={l:!!(keys.l||touch.l),r:!!(keys.r||touch.r),d:!!(keys.d||touch.d),jump:!!(keys.jump||touch.jump||touch.u),shoot:!!(keys.shoot||touch.shoot)};
  h.jp=(h.jump&&!prev.jump)||!!latch.jump;h.sp=(h.shoot&&!prev.shoot)||!!latch.shoot;h.sr=!h.shoot&&(prev.shoot||!!latch.shoot);h.sw=latch.sw;
  if(latch.shoot&&!h.shoot)h.sr=1;prev.jump=h.jump;prev.shoot=h.shoot;latch.jump=latch.shoot=latch.sw=0;return h;}
// Touch pad: each pointer drives one control, so run + jump + shoot work together. The whole left half is the d-pad.
const ptr=new Map(),padPts=new Map();
// 8-way: the thumb's angle from the pad centre picks one of eight 45-degree sectors. Up and the upper diagonals jump
// (held, so a long press still jumps higher); diagonals light both arrows they combine.
function padDir(){let l=0,r=0,d=0,u=0;const b=$('dpad').getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2,dz=b.width*.11;
  for(const [,p] of padPts){const dx=p.x-cx,dy=p.y-cy;if(Math.hypot(dx,dy)<dz)continue;const k=((Math.round(Math.atan2(dy,dx)/(Math.PI/4))%8)+8)%8;
    if(k===7||k===0||k===1)r=1;if(k>=3&&k<=5)l=1;if(k>=1&&k<=3)d=1;if(k>=5&&k<=7)u=1;}
  if(u&&!touch.u)latch.jump=1;
  touch.l=l;touch.r=r;touch.d=d;touch.u=u;for(const [c,v] of [['l',l],['r',r],['d',d],['u',u]])$('dpad').querySelector('.'+c).classList.toggle('on',!!v);}
$('padL').addEventListener('pointerdown',e=>{e.preventDefault();Snd.init();try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}ptr.set(e.pointerId,'pad');padPts.set(e.pointerId,{x:e.clientX,y:e.clientY});padDir();});
$('padL').addEventListener('pointermove',e=>{if(padPts.has(e.pointerId)){padPts.set(e.pointerId,{x:e.clientX,y:e.clientY});padDir();}});
for(const [id,k] of [['bJump','jump'],['bShoot','shoot']])$(id).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();Snd.init();try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}
  ptr.set(e.pointerId,k);touch[k]=1;latch[k]=1;e.currentTarget.classList.add('on');});
$('bWep').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();Snd.init();latch.sw=1;const b=e.currentTarget;b.classList.add('on');setTimeout(()=>b.classList.remove('on'),120);});
function endPtr(e){const k=ptr.get(e.pointerId);if(!k)return;ptr.delete(e.pointerId);
  if(k==='pad'){padPts.delete(e.pointerId);padDir();return;}
  let still=0;for(const [,v] of ptr)if(v===k)still=1;touch[k]=still;if(!still)$(k==='jump'?'bJump':'bShoot').classList.remove('on');}
window.addEventListener('pointerup',endPtr);window.addEventListener('pointercancel',endPtr);
function clearInput(){ptr.clear();padPts.clear();for(const k in touch)touch[k]=0;for(const k in keys)keys[k]=0;prev.jump=prev.shoot=0;latch.jump=latch.shoot=latch.sw=0;
  for(const el of document.querySelectorAll('#pad .on'))el.classList.remove('on');}
if(matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0)document.body.classList.add('touch');
window.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!document.body.classList.contains('touch')){document.body.classList.add('touch');resize();}},true);

/* ===== BODY PHYSICS (shared by the hero, mites and the level checker) */
function moveX(b,dx){if(!dx)return 0;b.x+=dx;const y0=Math.floor(b.y+.001),y1=Math.floor(b.y+b.h-.001);
  if(dx>0){const tx=Math.floor(b.x+b.hw);for(let y=y0;y<=y1;y++)if(solid(tx,y)){b.x=tx-b.hw-1e-4;return 1;}}
  else{const tx=Math.floor(b.x-b.hw);for(let y=y0;y<=y1;y++)if(solid(tx,y)){b.x=tx+1+b.hw+1e-4;return -1;}}
  return 0;}
// Down: tiles, one-way ledges and platform tops (only when falling onto them from above). Up: tiles only.
function moveY(b,dy){b.gr=0;b.on=null;if(!dy)return 0;const py=b.y;b.y+=dy;const x0=Math.floor(b.x-b.hw+.001),x1=Math.floor(b.x+b.hw-.001);
  if(dy<0){let land=-1e9,on=null;const ty=Math.floor(b.y);
    for(let x=x0;x<=x1;x++)if(solid(x,ty)||(b.drop<=0&&oneway(x,ty)&&py>=ty+1-.001))land=ty+1;
    if(b.drop<=0&&!b.noPlat)for(const p of G.plats)if(b.x+b.hw>p.x&&b.x-b.hw<p.x+p.w&&py>=p.y-.001&&b.y<=p.y&&p.y>land){land=p.y;on=p;}
    if(land>-1e8){b.y=land;b.gr=1;b.on=on;return -1;}}
  else{const ty=Math.floor(b.y+b.h);for(let x=x0;x<=x1;x++)if(solid(x,ty)){b.y=ty-b.h-.001;return 1;}}
  return 0;}
function onOneway(b){if(b.on)return true;const y=Math.floor(b.y-.01),x0=Math.floor(b.x-b.hw+.001),x1=Math.floor(b.x+b.hw-.001);let ow=0;
  for(let x=x0;x<=x1;x++){if(solid(x,y))return false;if(oneway(x,y))ow=1;}return !!ow;}
// One tick of hero movement. inp: l, r, d, jump (held), jp (pressed this tick). Riding platforms move the body first.
function phys(b,inp,dt){
  if(b.on){moveX(b,b.on.dx);b.y+=b.on.dy;}
  const dir=(inp.r?1:0)-(inp.l?1:0);
  if(b.kb>0)b.kb-=dt;else{b.vx=dir*RUN;if(dir)b.face=dir;}
  b.coy=b.gr?COYOTE:b.coy-dt;b.buf=inp.jp?BUFFER:b.buf-dt;b.drop=Math.max(0,b.drop-dt);
  if(b.buf>0&&b.coy>0&&b.kb<=0){b.buf=0;b.coy=0;if(inp.d&&onOneway(b))b.drop=.22;else{b.vy=JUMP;b.jh=1;b.jumped=1;}}
  if(b.jh&&!inp.jump&&b.vy>CUT)b.vy=CUT;
  if(b.vy<=0)b.jh=0;
  b.vy=Math.max(-FALL,b.vy-GRAV*dt);b.lvy=b.vy;
  moveX(b,b.vx*dt);if(moveY(b,b.vy*dt))b.vy=0;
}
function spiked(b){const x0=Math.floor(b.x-b.hw),x1=Math.floor(b.x+b.hw),y0=Math.floor(b.y),y1=Math.floor(b.y+b.h);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const k=tileK(x,y);if(k!==4&&k!==5)continue;
    if(b.x+b.hw<x+.12||b.x-b.hw>x+.88)continue;const lo=k===4?y:y+.55,hi=k===4?y+.45:y+1;if(b.y<hi&&b.y+b.h>lo)return true;}return false;}
const ventOn=v=>{const p=(G.t+v.ph)%3.2;return p>2.2?2:p>1.7?1:0;};
// circle (x, y, r) against a body's box
function hitBox(b,x,y,r,sh){sh=sh||0;const cx=clamp(x,b.x-b.hw+sh,b.x+b.hw-sh),cy=clamp(y,b.y+sh,b.y+b.h-sh);return (x-cx)*(x-cx)+(y-cy)*(y-cy)<r*r;}

/* ===== SIMULATION */
function tick(inp){
  const dt=FIX;G.tick++;G.t=G.tick*FIX;inp=inp||readInput();
  setPlats(G.tick);updCrumble(dt);updDoor(dt);camTick(dt);
  G.shake=Math.max(0,G.shake-dt*1.6);PL.inv=Math.max(0,PL.inv-dt);PL.shootT=Math.max(0,PL.shootT-dt);
  if(inp.sw)switchWeap(inp.sw);
  const ph=G.phase;
  if(ph==='ready'){G.pt+=dt;if(G.pt>.55&&!PL.vis){PL.vis=1;Snd.play('beamin');for(let k=0;k<10;k++)part(PL.x+rand(-.4,.4),PL.y+rand(0,1.4),.8,0,rand(1,3),.4,.25,.05,COL.cyan,0,2,0);}
    if(G.pt>1.1){if(G.inArena)beginBoss();else G.phase='run';}
    phys(PL,{},dt);}
  else if(ph==='run'||ph==='boss'||ph==='won'){
    if(PL.dead){PL.deadT+=dt;if(PL.deadT>2.2)respawn(false);}
    else{const jumpedBefore=PL.gr;phys(PL,ph==='won'&&G.pt>2?{}:inp,dt);
      if(PL.jumped){PL.jumped=0;Snd.play('jump');}
      if(PL.gr&&!jumpedBefore&&PL.lvy<-7)Snd.play('land');
      if(ph!=='won')weapons(inp,dt);}
    if(ph==='run'||ph==='boss'){G.time+=dt;if(!PL.dead)hazards();}
    if(ph==='run'&&G.door&&!PL.dead&&PL.x+PL.hw>G.door.x-.25&&PL.y<G.door.y+3){G.phase='door';G.pt=0;G.door.want=1;Snd.play('door');PL.chg=0;PL.charging=0;G.shots=[];}
    if(ph==='won'){G.pt+=dt;wonTick(dt);}}
  else if(ph==='door'){G.pt+=dt;phys(PL,G.door.open>=1?{r:1}:{},dt);
    if(PL.x>G.door.x+2.3){G.door.want=0;G.inArena=true;G.cp={x:PL.x,y:PL.y,arena:1};G.en=G.en.filter(e=>Math.abs(e.x-PL.x)>20);G.eb=[];beginBoss();}}
  else if(ph==='intro'){G.pt+=dt;phys(PL,{},dt);const b=G.boss,u=Math.min(1,G.pt/1.3);b.y=lerp(G.ar.y1+2,b.hy,1-Math.pow(1-u,3));G.bossFill=clamp((G.pt-.6)/1.3,0,1);
    if(G.pt>2){G.phase='boss';b.st=b.first;b.tt=0;}}
  if(ph!=='ready'&&ph!=='intro'&&ph!=='door'){if(!PL.dead||ph==='won')enemies(dt);if(G.boss&&ph==='boss'&&!PL.dead)bossTick(dt);}
  shotsTick(dt);ebTick(dt);picksTick(dt);cpsTick();partsTick(dt);
}
function updCrumble(dt){for(const c of G.crum){
  if(c.gone){c.back-=dt;if(c.back<=0&&!(PL.x+PL.hw>c.x&&PL.x-PL.hw<c.x+1&&PL.y<c.y+1&&PL.y+PL.h>c.y)){c.gone=0;c.t=-1;}continue;}
  if(c.t<0){if(PL.gr&&!PL.on&&!PL.dead&&Math.abs(PL.y-(c.y+1))<.01&&PL.x+PL.hw>c.x+.02&&PL.x-PL.hw<c.x+.98)c.t=0;}
  else if(!G.noCrumble){c.t+=dt;if(c.t>=CRUMBLE){c.gone=1;c.back=3;Snd.play('crumble');for(let k=0;k<6;k++)part(c.x+rand(0,1),c.y+rand(0,1),.6,rand(-1,1),rand(-1,1),.6,.3,.05,rgb(STAGES[G.i].edge),0,1,8);}}}}
function updDoor(dt){const d=G.door;if(!d)return;d.open=clamp(d.open+(d.want?1:-1)*dt*2.4,0,1);}
function camTick(dt){
  const asp=W/H;let th,tx,ty;
  if(G.inArena){const A=G.ar;th=Math.max(VIEW_H-.5,(A.x1-A.x0+1.4)/asp);tx=(A.x0+A.x1)/2;ty=Math.max(th/2-.6,(A.y0+A.y1)/2+.3);}
  else{th=VIEW_H;cam.lead=lerp(cam.lead,PL.face*1.3,Math.min(1,dt*2));const hw=th*asp/2,right=G.door?G.door.x+1.3:G.w;
    tx=clamp(PL.x+cam.lead,hw,Math.max(hw,right-hw));ty=clamp(PL.y+1.4,th/2-.6,ROWS-th/2+.6);}
  if(cam.snap){cam.h=th;cam.x=tx;cam.y=ty;cam.snap=0;}
  cam.h+=(th-cam.h)*Math.min(1,dt*3);cam.x+=(tx-cam.x)*Math.min(1,dt*(G.inArena?3:9));cam.y+=(ty-cam.y)*Math.min(1,dt*(G.inArena?3:5));
  cam.hh=cam.h/2;cam.hw=cam.hh*asp;}
const vis=e=>Math.abs(e.x-cam.x)<cam.hw-.2&&Math.abs(ey(e)-cam.y)<cam.hh+.5;

/* ----- hero damage */
function hurt(d,fx_){const p=PL;if(p.dead||p.inv>0||G.god||G.phase==='won')return;p.hp-=d;
  if(p.hp<=0){p.hp=0;die();return;}
  p.inv=INV;p.kb=KB;p.vx=(p.x<fx_?-1:1)*2.6;if(p.vy>0)p.vy=0;p.jh=0;p.charging=0;p.chg=0;Snd.play('hurt');vibe(30);G.shake=Math.max(G.shake,.2);
  for(let k=0;k<6;k++)part(p.x,p.y+.7,.8,rand(-3,3),rand(-1,3),.3,.3,.05,COL.hot,0,2,0);}
function die(){const p=PL;if(p.dead)return;p.dead=1;p.deadT=0;p.hp=0;G.deaths++;S.stats.deaths++;Snd.play('die');vibe([40,40,90]);burst(p.x,p.y+.7,COL.cyan);burst(p.x,p.y+.7,WCOL[p.w]);G.shots=[];}
function hazards(){const p=PL;if(G.god===2)return;
  if(p.y<-1.5){die();return;}
  if(p.inv<=0&&spiked(p)){die();return;}
  for(const v of G.vents)if(ventOn(v)===2&&p.x+p.hw>v.x+.18&&p.x-p.hw<v.x+.82&&p.y<v.y+3&&p.y+p.h>v.y)hurt(4,v.x+.5);}
function cpsTick(){if(PL.dead)return;G.cps.forEach((c,k)=>{if(!c.on&&PL.x>c.x-.4&&Math.abs(PL.y-c.y)<3.5){c.on=1;if(!G.cp.arena)G.cp={x:c.x,y:c.y,arena:0};Snd.play('cp');toast('Checkpoint',COL.green);
  for(let j=0;j<10;j++)part(c.x,c.y+1.5,.2,rand(-2,2),rand(0,3),.6,.25,.05,COL.green,0,1,0);}});}

/* ----- weapons */
function switchWeap(d){const p=PL;if(p.dead)return;let w=p.w;for(let k=0;k<5;k++){w=(w+d+5)%5;if(owned(w))break;}if(w===p.w)return;
  p.w=w;p.chg=0;p.charging=0;G.shots=G.shots.filter(s=>s.k!=='orb'||s.thrown);Snd.play('sw');updWeapUI();toast(WEAP[w].name,WCOL[w]);}
function selectWeap(w){if(!owned(w)||w===PL.w)return;PL.w=w;PL.chg=0;PL.charging=0;G.shots=G.shots.filter(s=>s.k!=='orb'||s.thrown);updWeapUI();}
function updWeapUI(){const w=WEAP[PL.w];document.documentElement.style.setProperty('--wc',hex(w.c));$('hWeap').textContent=w.short;$('bWepN').textContent=w.short;$('weB').hidden=PL.w===0;
  $('bWep').hidden=!S.beat.slice(0,4).some(Boolean);}
function weapons(inp,dt){const p=PL;
  if(p.kb>0){if(inp.sp&&p.w===0)p.charging=1;return;}
  if(inp.sp){fire(0);if(p.w===0){p.charging=1;p.chg=0;}}
  if(p.w===0&&p.charging){if(inp.shoot||inp.sp){const c0=p.chg;p.chg+=dt;if(p.chg>.2&&Math.floor(p.chg*10)!==Math.floor(c0*10))Snd.play('chg',Math.min(1,p.chg/CH2));}
    if(inp.sr){if(p.chg>=CH2)fire(2);else if(p.chg>=CH1)fire(1);p.chg=0;p.charging=0;}}}
function fire(lvl){const p=PL,w=p.w,f=p.face,x=p.x+f*.66,y=p.y+.74;
  if(w===0){if(!lvl&&G.shots.filter(s=>s.k==='b'&&!s.lvl).length>=3)return;
    G.shots.push({k:'b',w:0,lvl,x,y,vx:f*(lvl?16:15),vy:0,r:[.2,.34,.55][lvl],dmg:[1,2,4][lvl],bd:[1,2,3][lvl],life:1.3,pierce:lvl===2,hit:new Map()});
    p.shootT=.3;Snd.play(lvl===2?'shot2':lvl?'shot1':'shot');return;}
  const W_=WEAP[w];
  if(w===3){const orbs=G.shots.filter(s=>s.k==='orb'&&!s.thrown);
    if(orbs.length){for(const s of orbs){s.thrown=1;s.vx=f*12;s.vy=0;s.life=1.4;}p.shootT=.3;Snd.play('ward');return;}}
  else if(w===1&&G.shots.some(s=>s.k==='blade'))return;
  else if(w===2&&G.shots.filter(s=>s.k==='rocket').length>=2)return;
  else if(w===4&&G.shots.filter(s=>s.k==='flare').length>=6)return;
  if(p.we[w]<W_.cost){Snd.play('empty');return;}
  p.we[w]-=W_.cost;p.shootT=.3;
  if(w===1){G.shots.push({k:'blade',w,x,y,vx:f*13,ax:-f*15,vy:0,r:.5,dmg:2,bd:1,life:2.6,pierce:1,re:.35,hit:new Map(),rot:0});Snd.play('scythe');}
  else if(w===2){G.shots.push({k:'rocket',w,x,y,vx:f*6,vy:1.2,sp:6,r:.32,dmg:3,bd:1,life:2.6,hit:new Map()});Snd.play('rocket');}
  else if(w===3){for(let k=0;k<4;k++)G.shots.push({k:'orb',w,a:k*TAU/4,x:p.x,y:p.y+.7,vx:0,vy:0,r:.36,dmg:2,bd:1,life:1e9,pierce:1,re:.3,hit:new Map()});Snd.play('ward');}
  else if(w===4){for(const a of [-.24,0,.24])G.shots.push({k:'flare',w,x,y,vx:Math.cos(a)*f*12.5,vy:Math.sin(a)*12.5,r:.28,dmg:2,bd:1,life:1.1,hit:new Map()});Snd.play('flare');}
}
// Damage to a guardian: its weakness hits hard and staggers it; otherwise buster shots count by charge, specials barely scratch.
function bossDmg(s,b){return s.w&&s.w===STAGES[G.i].weak?4:s.w?1:s.bd;}
function shotsTick(dt){
  const sh=G.shots;
  for(let i=sh.length-1;i>=0;i--){const s=sh[i];s.life-=dt;let dead=s.life<=0;
    if(s.k==='orb'&&!s.thrown){s.a+=dt*5.5;s.x=PL.x+Math.cos(s.a)*1.25;s.y=PL.y+.7+Math.sin(s.a)*1.25;if(PL.dead)dead=1;}
    else if(s.k==='blade'){s.vx+=s.ax*dt;s.x+=s.vx*dt;s.rot+=dt*18;const back=s.vx*s.ax>0;if(back){s.y+=(PL.y+.74-s.y)*Math.min(1,dt*5);if(Math.abs(s.x-PL.x)<.6)dead=1;}}
    else if(s.k==='rocket'){let tg=null,bd=81;if(G.boss&&!G.boss.dead&&G.phase==='boss'){tg={x:G.boss.x,y:G.boss.y};bd=0;}
      if(!tg)for(const e of G.en){if(!e.on||!e.act)continue;const d=(e.x-s.x)**2+(ey(e)-s.y)**2;if(d<bd){bd=d;tg={x:e.x,y:ey(e)};}}
      s.sp=Math.min(12,s.sp+dt*10);let a=Math.atan2(s.vy,s.vx);if(tg){const want=Math.atan2(tg.y-s.y,tg.x-s.x);let da=want-a;da=Math.atan2(Math.sin(da),Math.cos(da));a+=clamp(da,-5*dt,5*dt);}
      s.vx=Math.cos(a)*s.sp;s.vy=Math.sin(a)*s.sp;s.x+=s.vx*dt;s.y+=s.vy*dt;if(Math.random()<.7)part(s.x-s.vx*.03,s.y-s.vy*.03,.4,0,0,.25,.22,.05,COL.orange,0,0,0);}
    else{s.x+=s.vx*dt;s.y+=s.vy*dt;}
    if(s.k!=='blade'&&!(s.k==='orb'&&!s.thrown)&&solid(Math.floor(s.x),Math.floor(s.y))){dead=1;spark(s.x,s.y,WCOL[s.w]);if(s.k==='rocket')boom(s.x,s.y,.4,COL.orange);}
    if(Math.abs(s.x-cam.x)>cam.hw+1.5)dead=1;
    if(!dead)for(const e of G.en){if(!e.on||!e.act||(e.c==='e'&&e.st))continue;const er=e.r+s.r,dx=e.x-s.x,dy=ey(e)-s.y;if(dx*dx+dy*dy>er*er)continue;
      const h=s.hit.get(e);if(h!=null&&(s.re==null||G.t-h<s.re))continue;s.hit.set(e,G.t);
      if(e.c==='t'&&e.n===0&&e.cd>.5&&s.w===0&&!s.lvl){Snd.play('tink');spark(s.x,s.y,COL.white);if(!s.pierce){dead=1;break;}continue;}
      hurtE(e,s.dmg);if(s.k==='rocket')boom(s.x,s.y,.4,COL.orange);if(!s.pierce||(s.k==='b'&&e.on)){dead=1;break;}}
    const b=G.boss;
    // shots pass through a guardian while it flashes after a hit
    if(!dead&&b&&!b.dead&&G.phase==='boss'&&b.inv<=0){const r=b.r+s.r;if((b.x-s.x)**2+(b.y-s.y)**2<r*r){const h=s.hit.get(b);
      if(h==null||(s.re!=null&&G.t-h>=s.re)){s.hit.set(b,G.t);hitBoss(b,bossDmg(s,b),s);if(!s.pierce||s.k==='b')dead=1;}}}
    // Ward crystals soak up shots
    if(!dead&&s.k==='orb')for(let j=G.eb.length-1;j>=0;j--){const q=G.eb[j];if(q.k!==0&&q.k!==3)continue;if((q.x-s.x)**2+(q.y-s.y)**2<(q.r+s.r)**2){G.eb.splice(j,1);spark(q.x,q.y,COL.violet);Snd.play('tink');}}
    if(dead)sh.splice(i,1);}}
function hurtE(e,d){e.hp-=d;e.fl=1;if(e.hp<=0)kill(e,1);else Snd.play('hit');}
function kill(e,drop){e.on=0;const big=e.c==='g'||e.c==='e';boom(e.x,ey(e),big?1.2:.6,e.c==='m'||e.c==='r'?COL.orange:COL.pink);Snd.play(big?'boom':'kill');
  if(drop&&!e.tmp){const r=Math.random();const k=e.c==='e'?'H':r<.13?'h':r<.18?'H':r<.27?'w':r<.31?'W':null;if(k)G.picks.push({k,x:e.x,y:ey(e),vy:3,life:7,on:1,map:0});}}

/* ----- enemies */
function eshot(o){G.eb.push(Object.assign({k:0,vx:0,vy:0,ax:0,r:.24,dmg:2,life:4,c:COL.pink},o));}
function aimShot(x,y,sp,dmg,c,off){const a=Math.atan2(PL.y+.7-y,PL.x-x)+(off||0);eshot({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,dmg,c:c||COL.pink});}
function enemies(dt){const px=PL.x,py=PL.y+.7;
  for(const e of G.en){if(!e.on)continue;const ad0=Math.abs(e.x-cam.x);
    if(!e.act){if(ad0<cam.hw+1.5)e.act=1;else continue;}else if(ad0>cam.hw+9&&e.c!=='d'){e.act=0;continue;}
    const dx=px-e.x,dy=py-ey(e),ad=Math.abs(dx);e.t+=dt;e.fl=Math.max(0,e.fl-dt*6);
    switch(e.c){
    case 'm':{if(ad<9)e.face=dx<0?-1:1;e.vy=Math.max(-15,e.vy-30*dt);if(moveX(e,e.face*2.1*dt))e.face*=-1;if(moveY(e,e.vy*dt))e.vy=0;
      if(e.gr){e.cd-=dt;if(e.cd<=0&&ad<6){e.vy=7.5;e.cd=1.5+Math.random()*.8;}}if(e.y<-2)e.on=0;break;}
    case 'd':{if(e.st===0){e.y=e.y0+Math.sin(e.t*3)*.35;e.x=e.x0+Math.sin(e.t*1.3)*.5;e.ang=Math.atan2(dy,dx);if(ad<7.5&&vis(e)){e.st=1;e.cd=.5;}}
      else if(e.st===1){e.cd-=dt;e.ang=Math.atan2(dy,dx);if(e.cd<=0){const d=Math.hypot(dx,dy)||1;e.vx=dx/d*8.5;e.vy=dy/d*8.5;e.st=2;Snd.play('dash');}}
      else{e.x+=e.vx*dt;e.y+=e.vy*dt;if(solid(Math.floor(e.x),Math.floor(e.y)))kill(e,0);else if(Math.abs(e.x-px)>16||e.y<-3||e.y>ROWS+3)e.on=0;}break;}
    case 'o':{e.y=e.y0+Math.sin(e.t*2)*.35;e.x=clamp(e.x+clamp(dx,-1,1)*.9*dt,e.x0-3,e.x0+3);e.cd-=dt;if(e.cd<=0&&vis(e)&&ad<10){e.cd=2.3;aimShot(e.x,e.y,5.2,2);Snd.play('eshot');}break;}
    case 't':{const want=Math.atan2(dy,dx);e.ang=want;e.cd-=dt;if(e.cd<=0&&vis(e)&&ad<10.5){e.cd=2.8;e.n=3;e.bt=0;}
      if(e.n>0){e.bt-=dt;if(e.bt<=0){e.bt=.2;e.n--;const a=e.ang;eshot({x:e.x+Math.cos(a)*.6,y:e.y+Math.sin(a)*.6,vx:Math.cos(a)*6,vy:Math.sin(a)*6,dmg:2,c:COL.orange});Snd.play('eshot');}}break;}
    case 'r':{if(e.st===0){if(ad<2.6&&py<e.y){e.st=1;e.cd=.35;}}else if(e.st===1){e.cd-=dt;e.x=e.x0+Math.sin(e.t*50)*.06;if(e.cd<=0){e.st=2;e.vy=0;}}
      else{e.vy-=25*dt;e.y+=e.vy*dt;if(solid(Math.floor(e.x),Math.floor(e.y-.45))||e.y<-2){kill(e,0);Snd.play('crumble');}}break;}
    case 'g':{e.x=e.x0+Math.sin(e.t*.6)*3;e.y=e.y0+Math.sin(e.t*1.3)*.3;e.face=dx<0?-1:1;e.cd-=dt;
      if(e.cd<=0&&vis(e)){e.cd=2.6;for(const o of [-.32,0,.32])aimShot(e.x+e.face*.6,e.y-.2,5,3,COL.violet,o);Snd.play('eshot');}break;}
    case 'e':{e.cd-=dt;e.y=e.y0+Math.sin(e.t*1.6)*.4;
      if(e.st===0){e.fade=1;if(e.n===0&&e.cd<2.0){e.n=1;for(let k=0;k<8;k++){const a=k*TAU/8+e.t;eshot({x:e.x,y:e.y,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2,dmg:3,c:COL.violet});}Snd.play('eshot');}
        if(e.n===1&&e.cd<1.0){e.n=2;for(const o of [-.2,0,.2])aimShot(e.x,e.y,6,3,COL.pink,o);Snd.play('eshot');}
        if(e.cd<=0&&vis(e)){e.st=1;e.cd=.35;}}
      else if(e.st===1){e.fade=e.cd/.35;if(e.cd<=0){let nx=e.x;for(let k=0;k<8;k++){nx=e.x0+rand(-3.5,3.5);if(Math.abs(nx-px)>2.5)break;}e.x=nx;e.st=2;e.cd=.35;}}
      else{e.fade=1-e.cd/.35;if(e.cd<=0){e.st=0;e.cd=2.4;e.n=0;}}break;}}
    if(e.on&&!(e.c==='e'&&e.st)&&hitBox(PL,e.x,ey(e),e.r*.85,.06))hurt(e.dmg,e.x);}
  G.en=G.en.filter(e=>e.on||!e.tmp);}
function ebTick(dt){const b=G.eb;
  for(let i=b.length-1;i>=0;i--){const q=b[i];q.life-=dt;q.vx+=q.ax*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;let dead=q.life<=0;
    if(q.k===2){if(q.ly!=null)q.y+=(q.ly-q.y)*Math.min(1,dt*7);if(q.vx*q.ax>0&&Math.abs(q.x-q.ox)<.5)dead=1;}
    else if(solid(Math.floor(q.x),Math.floor(q.y))){dead=1;if(q.k!==1)spark(q.x,q.y,q.c);}
    if(!dead&&!PL.dead&&hitBox(PL,q.x,q.y,q.r,.1)){hurt(q.dmg,q.x-q.vx);if(q.k===0||q.k===3)dead=1;}
    if(dead)b.splice(i,1);}}
function picksTick(dt){for(const p of G.picks){if(!p.on)continue;if(!p.map){p.life-=dt;if(p.life<=0){p.on=0;continue;}
    p.vy=Math.max(-12,p.vy-28*dt);const ny=p.y+p.vy*dt;if(p.vy<0&&(solid(Math.floor(p.x),Math.floor(ny))||oneway(Math.floor(p.x),Math.floor(ny))&&p.y>=Math.floor(ny)+1)){p.y=Math.floor(ny)+1;p.vy=0;}else p.y=ny;if(p.y<-2)p.on=0;}
  if(!PL.dead&&hitBox(PL,p.x,p.y+.25,.45)){p.on=0;const d=PK[p.k];
    if(d.hp)PL.hp=Math.min(HMAX,PL.hp+d.hp);
    else{let w=PL.w;if(!w){let lo=1e9;for(let k=1;k<5;k++)if(owned(k)&&PL.we[k]<lo){lo=PL.we[k];w=k;}}if(w)PL.we[w]=Math.min(EMAX,PL.we[w]+d.en);}
    Snd.play('pick');for(let k=0;k<8;k++)part(p.x,p.y+.3,.6,rand(-2,2),rand(0,3),.4,.22,.05,d.hp?COL.gold:COL.cyan,0,2,0);}}
  G.picks=G.picks.filter(p=>p.on||p.map);}
function partsTick(dt){for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){rm(pt,i);continue;}const dr=Math.max(0,1-pt.dr[i]*dt);pt.vx[i]*=dr;pt.vy[i]=pt.vy[i]*dr-pt.gy[i]*dt;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;}}

/* ===== GUARDIANS */
function beginBoss(){
  const L=STAGES[G.i],d=BOSS[L.boss],A=G.ar,mat=makeMat(false),m=ARC.BOSSES[L.boss](mat);
  if(G.bossObj){scene.remove(G.bossObj.group);ARC.disposeGroup(G.bossObj.group);}
  G.bossObj=m;m.group.scale.setScalar(d.sc);scene.add(m.group);
  const at=G.bossAt||{x:A.cx+2,y:A.y0+4};
  const hy={mantis:A.y0+4.6,warden:A.y0+4.3,bastion:A.y0+1.05,hydra:A.y0+4.2,eclipse:A.y0+4.6}[L.boss];
  G.boss={k:L.boss,hp:d.hp,max:d.hp,r:d.r,sc:d.sc,x:at.x,y:A.y1+2,hy,vx:0,vy:0,st:'wait',first:{mantis:'perch',warden:'float',bastion:'idle',hydra:'path',eclipse:'aim'}[L.boss],
    tt:0,n:0,cd:1,pt:0,inv:0,fl:0,face:-1,side:1,tel:0,ao:0,sat:0,seq:0,cnt:0,dead:0,mat,rot:0,stun:0};
  if(L.boss==='warden')G.boss.pt=Math.asin(clamp((at.x-A.cx)/3.6,-1,1))/.75;
  G.phase='intro';G.pt=0;G.bossFill=0;G.weakShown=0;$('bossW').hidden=false;$('bossN').textContent=L.bname.toUpperCase();
  banner('Guardian of '+L.name,L.bname);Snd.play('alarm');Mus.play('boss',G.i);
}
function hitBoss(b,d,s){b.hp-=d;b.fl=1;b.inv=.25;spark(s.x,s.y,WCOL[s.w]);
  if(s.w&&s.w===STAGES[G.i].weak){b.stun=.4;b.inv=.5;Snd.play('weak');G.shake=.25;if(!G.weakShown){G.weakShown=1;toast('Weak point!',WCOL[s.w]);}for(let k=0;k<10;k++)part(b.x,b.y,.8,rand(-5,5),rand(-5,5),.4,.35,.05,WCOL[s.w],0,3,0);}
  else Snd.play('bhit');
  if(b.hp<=0){b.hp=0;b.dead=1;G.phase='won';G.pt=0;G.eb=[];G.shots=[];Snd.play('big');vibe([60,40,120]);for(const e of G.en)if(e.tmp)e.on=0;}}
function wave(x,dir){eshot({k:1,x,y:G.ar.y0+.42,vx:dir*6.5,r:.42,dmg:3,life:3,c:COL.gold});}
function bossTick(dt){const b=G.boss;b.inv=Math.max(0,b.inv-dt);b.fl=Math.max(0,b.fl-dt*5);b.tel=Math.max(0,b.tel-dt);
  if(b.stun>0){b.stun-=dt;return;}
  BAI[b.k](b,dt,G.ar,b.hp<=b.max/2);b.ph=b.hp<=b.max/2?1:0;
  if(!PL.dead&&hitBox(PL,b.x,b.y,b.r*.85,.08))hurt(4,b.x);}
const toward=(b,x,y,k)=>{b.x=lerp(b.x,x,k);b.y=lerp(b.y,y,k);};
const BAI={
 // Perches in a top corner, swoops through where you stood, then throws scythes: a low one to jump and a high one to stay under.
 mantis(b,dt,A,p2){const L=A.x0+1.6,R=A.x1-1.6,top=A.y0+4.6;b.tt+=dt;
  if(b.st==='perch'){toward(b,b.side?R:L,top+Math.sin(G.t*3)*.15,Math.min(1,dt*6));b.face=PL.x<b.x?-1:1;if(b.tt>(p2?.55:.9)){b.st='tele';b.tt=0;b.tel=.5;}}
  else if(b.st==='tele'){b.tx=clamp(PL.x,A.x0+1,A.x1-1);if(b.tt>.5){b.st='swoop';b.tt=0;b.sx=b.x;b.sy=b.y;b.ex=b.side?L:R;}}
  else if(b.st==='swoop'){const d=p2?.95:1.25,u=Math.min(1,b.tt/d),by=A.y0+.95,cx=2*b.tx-(b.sx+b.ex)/2,cy=2*by-(b.sy+top)/2,v=1-u;
    b.x=v*v*b.sx+2*u*v*cx+u*u*b.ex;b.y=v*v*b.sy+2*u*v*cy+u*u*top;b.face=b.ex>b.sx?1:-1;if(u>=1){b.side^=1;b.st='throw';b.tt=0;b.n=0;}}
  else if(b.st==='throw'){b.face=PL.x<b.x?-1:1;const k=p2?2:1;
    if(b.n<k&&b.tt>.3+b.n*.6){const hi=(b.cnt++)%2;eshot({k:2,x:b.x,y:b.y,ox:b.x,ly:A.y0+(hi?2.45:.6),vx:b.face*14,ax:-b.face*11,r:.42,dmg:3,life:3,c:COL.lime});b.n++;Snd.play('scythe');}
    if(b.tt>.6+k*.6){b.st='perch';b.tt=0;}}},
 // Drifts along the ceiling firing twin bursts; every third burst it tracks you, rises and slams down, sending shockwaves along the floor.
 warden(b,dt,A,p2){const home=A.y0+4.3;b.tt+=dt;
  if(b.st==='float'){b.pt+=dt;toward(b,A.cx+Math.sin(b.pt*.75)*3.6,home+Math.sin(b.pt*2)*.2,Math.min(1,dt*3));b.cd-=dt;
    if(b.cd<=0){b.cd=p2?1.5:2.1;b.n++;b.burst=3;b.bt=0;}
    if(b.burst>0){b.bt-=dt;if(b.bt<=0){b.bt=.17;b.burst--;for(const s of [-1,1])aimShot(b.x+s*1.05,b.y-.2,6,3,COL.orange);Snd.play('eshot');}}
    if(b.n>=3&&!(b.burst>0)){b.n=0;b.st='rise';b.tt=0;b.tel=.75;}}
  else if(b.st==='rise'){toward(b,clamp(PL.x,A.x0+1.4,A.x1-1.4),home+.8,Math.min(1,dt*3));if(b.tt>.75){b.st='slam';b.vy=-3;}}
  else if(b.st==='slam'){b.vy-=40*dt;b.y+=b.vy*dt;if(b.y<=A.y0+1.05){b.y=A.y0+1.05;b.st='land';b.tt=0;G.shake=.5;Snd.play('wave');wave(b.x-1,-1);wave(b.x+1,1);}}
  else if(b.st==='land'){if(b.tt>.7){b.st='lift';b.tt=0;}}
  else if(b.st==='lift'){b.y=lerp(b.y,home,Math.min(1,dt*2.5));b.pt=Math.asin(clamp((b.x-A.cx)/3.6,-1,1))/.75;if(b.tt>1){b.st='float';b.cd=.6;}}},
 // Hops at you (run underneath it) and every landing sends shockwaves both ways; then rises and fires rings of crystals.
 bastion(b,dt,A,p2){const fy=A.y0+1.05;b.tt+=dt;
  if(b.st==='idle'){b.y=fy;if(b.tt>(p2?.35:.6)){b.st='hop';b.tt=0;const tx=clamp(PL.x,A.x0+1.3,A.x1-1.3);b.vx=(tx-b.x)/.92;b.vy=12;}}
  else if(b.st==='hop'){b.vy-=26*dt;b.x=clamp(b.x+b.vx*dt,A.x0+1.1,A.x1-1.1);b.y+=b.vy*dt;b.rot-=b.vx*dt/1.05;
    if(b.y<=fy&&b.vy<0){b.y=fy;G.shake=.4;Snd.play('wave');wave(b.x-.9,-1);wave(b.x+.9,1);b.n++;b.tt=0;if(b.n>=(p2?3:2)){b.st='up';b.n=0;}else b.st='idle';}}
  else if(b.st==='up'){b.y=lerp(b.y,fy+2.4,Math.min(1,dt*5));if(b.tt>.45){b.st='burst';b.tt=0;b.n=0;b.cd=0;b.tel=.3;}}
  else if(b.st==='burst'){b.cd-=dt;if(b.cd<=0&&b.n<(p2?3:2)){b.cd=.75;b.ao+=.39;for(let i=0;i<8;i++){const a=b.ao+i*TAU/8;eshot({k:3,x:b.x+Math.cos(a)*.8,y:b.y+Math.sin(a)*.8,vx:Math.cos(a)*4.4,vy:Math.sin(a)*4.4,r:.3,dmg:3,life:4,c:COL.pink});}b.n++;Snd.play('ward');}
    if(b.n>=(p2?3:2)&&b.cd<.3){b.st='drop';b.tt=0;b.vy=0;}}
  else if(b.st==='drop'){b.vy-=30*dt;b.y+=b.vy*dt;if(b.y<=fy){b.y=fy;b.st='idle';b.tt=0;G.shake=.25;}}},
 // Loops a figure eight firing rotating rings, then locks on and dives straight at you.
 hydra(b,dt,A,p2){b.tt+=dt;
  if(b.st==='path'){b.pt+=dt;toward(b,A.cx+Math.sin(b.pt*.8)*3.8,A.y0+4.2+Math.sin(b.pt*1.6)*1.2,Math.min(1,dt*4));b.cd-=dt;
    if(b.cd<=0){b.cd=1.05;const n=p2?9:6;b.ao+=PI/n;for(let i=0;i<n;i++){const a=b.ao+i*TAU/n;eshot({x:b.x+Math.cos(a)*1.1,y:b.y+Math.sin(a)*1.1,vx:Math.cos(a)*4.2,vy:Math.sin(a)*4.2,r:.26,dmg:3,life:5,c:COL.red});}b.n++;Snd.play('eshot');}
    if(b.n>=3){b.n=0;b.st='tele';b.tt=0;b.tel=.75;}}
  else if(b.st==='tele'){if(b.tt<.45){b.tx=PL.x;b.ty=PL.y+.7;}if(b.tt>.75){b.st='dive';b.tt=0;const d=Math.hypot(b.tx-b.x,b.ty-b.y)||1;b.vx=(b.tx-b.x)/d*11;b.vy=(b.ty-b.y)/d*11;Snd.play('dash');}}
  else if(b.st==='dive'){b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.y<A.y0+.95||b.x<A.x0+.95||b.x>A.x1-.95||b.tt>1.2){b.x=clamp(b.x,A.x0+.95,A.x1-.95);b.y=Math.max(b.y,A.y0+.95);b.st='rec';b.tt=0;G.shake=.3;Snd.play('wave');}}
  else if(b.st==='rec'){if(b.tt>.5){b.st='path';b.cd=.8;}}},
 // Satellites fire aimed shots, the core spins out spirals; below half health it adds light columns and calls in darts.
 eclipse(b,dt,A,p2){b.tt+=dt;b.pt+=dt;b.sat+=dt*(.5+(p2?.3:0));toward(b,A.cx+Math.sin(b.pt*.5)*2.6,A.y0+4.6+Math.sin(b.pt*1.1)*.4,Math.min(1,dt*2));
  const seq=p2?['beam','aim','spiral','darts']:['aim','spiral'],next=()=>{b.seq=(b.seq+1)%seq.length;b.st=seq[b.seq];b.tt=0;b.n=0;b.cd=.4;b.cols=null;};
  if(!seq.includes(b.st)){b.seq=0;b.st=seq[0];b.tt=0;b.n=0;}
  if(b.st==='aim'){b.cd-=dt;if(b.cd<=0&&b.n<8){b.cd=.28;const a=b.sat+(b.n%4)*TAU/4;aimShot(b.x+Math.cos(a)*1.6,b.y+Math.sin(a)*1.6,6.2,3,COL.gold);b.n++;Snd.play('eshot');}if(b.n>=8&&b.cd<=0)next();}
  else if(b.st==='spiral'){b.cd-=dt;if(b.cd<=0){b.cd=p2?.1:.12;b.ao+=.52;for(const k of p2?[0,PI]:[0]){const a=b.ao+k;eshot({x:b.x,y:b.y,vx:Math.cos(a)*3.8,vy:Math.sin(a)*3.8,dmg:3,life:5,c:COL.pink});}}if(b.tt>2.4)next();}
  else if(b.st==='beam'){if(!b.cols){const px=clamp(PL.x,A.x0+.7,A.x1-.7);b.cols=[px,px+(px<A.cx?4:-4),px+(px<A.cx?-3.5:3.5)].map(x=>clamp(x,A.x0+.7,A.x1-.7));b.tt=0;Snd.play('beam');}
    if(b.tt>.95&&b.tt<1.5){for(const x of b.cols)if(Math.abs(PL.x-x)<.45+PL.hw)hurt(4,x);if(!b.zap){b.zap=1;G.shake=.3;Snd.play('wave');}}
    if(b.tt>1.6){b.zap=0;next();}}
  else if(b.st==='darts'){for(const s of [-1,1]){const e=spawnE('d',A.cx+s*5,A.y1-1.5,1);e.y=A.y1-1;e.st=1;e.cd=.6;e.act=1;G.en.push(e);}Snd.play('alarm');next();}},
};
function wonTick(dt){const b=G.boss;
  if(G.pt<1.6){if(Math.random()<dt*14){boom(b.x+rand(-1.2,1.2),b.y+rand(-1,1),.7,Math.random()<.5?COL.orange:rgb(STAGES[G.i].c));Snd.play('boom');}}
  else if(!b.gone){b.gone=1;G.bossObj.group.visible=false;burst(b.x,b.y,rgb(STAGES[G.i].c));boom(b.x,b.y,2,COL.hot);G.shake=.6;
    const i=G.i;S.beat[i]=1;S.stats.clears++;if(!S.best[i]||G.time<S.best[i])S.best[i]=Math.round(G.time*10)/10;save();
    if(i<4){PL.we[i+1]=EMAX;}banner(i<4?'Weapon get':'The core is dark',i<4?WEAP[i+1].name:'Victory');Snd.play('get');Mus.stop();}
  if(G.pt>4.4&&state==='play')result();}

/* ===== DRAW */
const _col=[0,0,0];
function draw(dt,now){
  const tt=now*.001;
  if(state==='title'||state==='select'){const asp=W/H;cam.h=asp<1?13:9;cam.hh=cam.h/2;cam.hw=cam.hh*asp;cam.x=G.start.x-.3+cam.hw*(asp<1?.55:.62)+Math.sin(tt*.2)*.4;cam.y=G.start.y-cam.h*(asp<1?.4:.12)+cam.hh;}
  const sk=G.shake>0?G.shake*.35:0,dist=cam.hh/Math.tan(camera.fov*PI/360);
  camera.position.set(cam.x+(Math.random()-.5)*sk,cam.y+1.1+(Math.random()-.5)*sk,dist);camera.lookAt(cam.x,cam.y,0);
  planet.position.set(cam.x*.9+16,cam.y*.7+15,-150);planet.rotation.y=tt*.02;
  // hero
  const p=PL,K=KID;const flick=p.inv>0&&!p.dead&&Math.floor(tt*20)%2===0;K.g.visible=!p.dead&&p.vis&&!flick&&state!=='select';
  if(state==='title'){p.x=G.start.x+.2;p.y=G.start.y;p.face=1;p.gr=1;p.vx=0;}
  K.g.position.set(p.x,p.y,0);K.g.scale.set(p.face,1,1);K.g.rotation.y=p.face>0?-.55:.55;
  const run=p.gr&&Math.abs(p.vx)>.1&&p.kb<=0;if(run)p.anim+=dt*13;else p.anim=0;
  const sw=Math.sin(p.anim);K.legs[0].rotation.z=p.gr?(run?sw*.8:0):.6;K.legs[1].rotation.z=p.gr?(run?-sw*.8:0):-.35;
  K.body.position.y=run?Math.abs(Math.cos(p.anim))*.06:0;K.body.rotation.z=p.kb>0?.35:p.gr?0:-.08;
  K.arm.rotation.z=lerp(K.arm.rotation.z,p.shootT>0||p.charging&&p.chg>.15?0:-1.15,Math.min(1,dt*20));K.back.rotation.z=run?-sw*.6:.2;
  const wc=WEAP[p.w].c;let ac=_c.setHex(wc);if(p.charging&&p.chg>CH1){const f=p.chg>=CH2?Math.floor(tt*16)%2:Math.floor(tt*9)%2;if(f)ac=_c.setHex(p.chg>=CH2?0xffe6b0:0xffffff);}
  K.acc.color.copy(ac);K.base.userData.flash.value=K.acc.userData.flash.value=p.kb>0?.6:0;
  if(K.g.visible){const cx=p.x+p.face*.68,cy=p.y+.74+K.body.position.y;
    if(p.charging&&p.chg>.2){const lv=p.chg>=CH2?2:p.chg>=CH1?1:0,s=(.35+lv*.3)*(1+Math.sin(tt*30)*.15);fx.push(cx,cy,.9,0,s,s,0,.85,lv===2?COL.hot:WCOL[0]);
      if(Math.random()<.5){const a=rand(0,TAU),r=.6+lv*.3;part(cx+Math.cos(a)*r,cy+Math.sin(a)*r,.9,-Math.cos(a)*r*4,-Math.sin(a)*r*4,.15,.12,.05,lv===2?COL.gold:COL.cyan,0,0,0);}}
    if(!p.gr&&p.vy>0)fx.push(p.x-p.face*.3,p.y+.42,.2,0,.25,.4,0,.7,COL.orange);}
  // beam-in streak
  if(G.phase==='ready'&&state==='play'&&!p.vis){const u=Math.min(1,G.pt/.55),y=lerp(cam.y+cam.hh+1,p.y+.7,u);fx.push(p.x,y,1,0,.35,1.6,2,.95,WCOL[p.w]);}
  // enemies
  for(const k in EM)EM[k].count=0;
  for(const e of G.en){if(!e.on||Math.abs(e.x-cam.x)>cam.hw+3)continue;const m=EM[e.k],i=m.count++,s=ET[e.c].sc,y=ey(e);let rx=0,ry=0,rz=0;
    if(e.c==='m'){rx=e.t*4;ry=e.t*3;}else if(e.c==='d'){rz=e.st===2?Math.atan2(e.vy,e.vx)-PI/2:e.ang-PI/2;rx=.3;}else if(e.c==='o'){rz=e.t*1.5;rx=.25;}
    else if(e.c==='t'){rz=e.ang-PI/2;}else if(e.c==='r'){rx=e.t*.5;ry=e.t*.3;}else if(e.c==='g'){rz=e.face<0?PI/2:-PI/2;rx=.3;}else if(e.c==='e'){rz=e.t*1.2;rx=.2;}
    setI(m,i,e.x,y,0,rx,ry,rz,s*(e.c==='e'?e.fade:1));m.geometry.attributes.aFlash.array[i]=e.fl;
    if(e.c==='d'&&e.st===1)fx.push(e.x,y,.5,0,1.1,1.1,1,.7,COL.pink);
    if(e.c==='r'&&e.st===1)fx.push(e.x,y-.6,.4,0,.6,.2,0,.6,COL.orange);
    if(e.c==='t'){fx.push(e.x,y,-.2,0,1.2,1.2,0,.18,COL.orange);if(e.n===0&&e.cd>.5)fx.push(e.x,y,.7,0,1.25,1.25,1,.55,COL.violet);}}
  for(const k in EM){EM[k].instanceMatrix.needsUpdate=true;EM[k].geometry.attributes.aFlash.needsUpdate=true;}
  // guardian
  const b=G.boss,bo=G.bossObj;
  if(bo){bo.group.visible=!!b&&!b.gone&&state!=='title';if(b&&!b.gone){bo.group.position.set(b.x,b.y,0);
    const fl=b.fl>0?b.fl:b.tel>0&&Math.floor(tt*14)%2?.45:0;b.mat.userData.flash.value=fl;
    if(b.k==='warden'){bo.anim(tt,{x:0,y:0,ph:b.ph||0,ax:(PL.x-b.x)/b.sc,ay:(PL.y+.7-b.y)/b.sc},dt);bo.group.rotation.set(-.35,0,0);}
    else if(b.k==='mantis'){const want=b.face>0?PI/2:-PI/2;bo.group.rotation.z+=(want-bo.group.rotation.z)*Math.min(1,dt*8);bo.group.rotation.x=-.5;bo.anim(tt,b,dt);}
    else if(b.k==='bastion'){bo.anim(tt,b,dt);bo.group.rotation.set(-.3,0,b.rot);}
    else if(b.k==='eclipse'){bo.anim(tt,b,dt);bo.group.children[4].rotation.z=b.sat;bo.group.rotation.x=-.25;
      if(b.st==='beam'&&b.cols){const on=b.tt>.95&&b.tt<1.5;for(const x of b.cols){if(b.tt<=.95)fx.push(x,(G.ar.y0+G.ar.y1)/2,.9,0,.12+Math.floor(tt*12)%2*.06,G.ar.y1-G.ar.y0,2,.7,COL.pink);
        else if(on)fx.push(x,(G.ar.y0+G.ar.y1)/2,.9,0,1.3,G.ar.y1-G.ar.y0+.5,2,1,COL.hot);}}}
    else{bo.anim(tt,b,dt);bo.group.rotation.x=-.3;}
    fx.push(b.x,b.y,-1.2,0,b.r*4,b.r*4,0,.25,rgb(STAGES[G.i].c));
    if(b.k==='warden'&&b.st==='rise')fx.push(b.x,G.ar.y0+.05,1,0,2.4,.4,0,.6+.4*Math.sin(tt*20),COL.orange);}}
  // platforms, crumbles, door, vents, checkpoints
  G.plats.forEach((q,k)=>{const m=G.platMeshes&&G.platMeshes[k];if(m)m.position.set(q.x,q.y,0);fx.push(q.x+.4,q.y-.7,.1,0,.3,.5,0,.5+Math.random()*.3,COL.orange);fx.push(q.x+q.w-.4,q.y-.7,.1,0,.3,.5,0,.5+Math.random()*.3,COL.orange);});
  let nc=0;const ec=new T.Color(STAGES[G.i].edge),tc=new T.Color(STAGES[G.i].top);for(const c of G.crum){if(c.gone)continue;const i=nc++,sh=c.t>=0?Math.sin(tt*60)*.04*(c.t/CRUMBLE+.3):0;
    setI(crumMesh,i,c.x+sh,c.y,0,0,0,0,1);crumMesh.setColorAt(i,c.t>=0?_c.copy(ec):_c.copy(tc).multiplyScalar(.8));}
  crumMesh.count=nc;crumMesh.instanceMatrix.needsUpdate=true;if(crumMesh.instanceColor)crumMesh.instanceColor.needsUpdate=true;
  if(G.doorMesh){G.doorMesh.scale.y=Math.max(.02,1-G.door.open);G.doorMesh.position.y=G.door.y+3*G.door.open;}
  for(const v of G.vents){const s=ventOn(v);if(s===1&&Math.random()<.5)part(v.x+rand(.3,.7),v.y+.1,.3,rand(-.3,.3),rand(1,2.5),.3,.15,.05,COL.orange,0,0,0);
    if(s===2){const fl=.85+Math.random()*.3;fx.push(v.x+.5,v.y+1.5,.3,0,.9*fl,3.2,2,.95,COL.orange);fx.push(v.x+.5,v.y+1.2,.35,0,.5*fl,2.4,2,.9,COL.hot);
      if(Math.abs(v.x-cam.x)<cam.hw+1)Snd.play('vent');}}
  G.cps.forEach(c=>fx.push(c.x,c.y+1.55,-.5,0,.6,.6,0,.7+.3*Math.sin(tt*4),c.on?COL.green:COL.red));
  // pickups
  for(const k in PKM)PKM[k].count=0;
  for(const q of G.picks){if(!q.on||(q.life<2&&Math.floor(tt*10)%2))continue;const m=PKM[q.k],i=m.count++;setI(m,i,q.x,q.y+.3+(q.map?Math.sin(tt*3+q.x)*.08:0),.2,0,tt*2,0,1);
    fx.push(q.x,q.y+.3,.1,0,1,1,0,.35,'hH'.includes(q.k)?COL.gold:COL.cyan);}
  for(const k in PKM)PKM[k].instanceMatrix.needsUpdate=true;
  // shots
  for(const k in PROJ)PROJ[k].count=0;
  for(const s of G.shots){const c=WCOL[s.w];
    if(s.k==='b'){const L=s.lvl;fx.push(s.x,s.y,.8,0,s.r*3.2,s.r*2.6,0,1,L===2?COL.hot:c);if(L)fx.push(s.x-Math.sign(s.vx)*s.r*1.6,s.y,.7,PI/2,s.r*1.6,s.r*5,2,.8,c);}
    else if(s.k==='blade'){const m=PROJ.blade;setI(m,m.count++,s.x,s.y,.6,0,0,s.rot,1.1);fx.push(s.x,s.y,.5,0,1.4,1.4,1,.5,c);}
    else if(s.k==='rocket'){const m=PROJ.rocket;setI(m,m.count++,s.x,s.y,.6,0,0,Math.atan2(s.vy,s.vx),1.2);fx.push(s.x-s.vx*.04,s.y-s.vy*.04,.5,0,.5,.5,0,.9,COL.hot);}
    else if(s.k==='orb'){const m=PROJ.crystal;setI(m,m.count++,s.x,s.y,.6,0,tt*3,s.a,1);fx.push(s.x,s.y,.5,0,1,1,0,.5,c);}
    else{fx.push(s.x,s.y,.8,0,.75,.75,0,1,c);fx.push(s.x,s.y,.7,0,.35,.35,0,1,COL.hot);}}
  // hostile shots
  for(const q of G.eb){if(q.k===1){fx.push(q.x,q.y+.2,.7,0,.8,1.3,2,.95,q.c);fx.push(q.x,q.y,.7,0,1.3,.5,0,.8,COL.hot);}
    else if(q.k===2){const m=PROJ.blade;setI(m,m.count++,q.x,q.y,.6,0,0,G.t*20,1.1);fx.push(q.x,q.y,.5,0,1.3,1.3,1,.5,q.c);}
    else if(q.k===3){const m=PROJ.shard;setI(m,m.count++,q.x,q.y,.6,0,G.t*4,Math.atan2(q.vy,q.vx)-PI/2,.9);fx.push(q.x,q.y,.5,0,1,1,0,.4,q.c);}
    else ebR.push(q.x,q.y,.9,0,q.r*3.2,q.r*3.2,0,1,q.c);}
  for(const k in PROJ)PROJ[k].instanceMatrix.needsUpdate=true;
  for(let i=0;i<pt.n;i++){const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_col[0]=pt.r[i];_col[1]=pt.g[i];_col[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_col);}
  fx.flush();ebR.flush();renderer.render(scene,camera);
}

/* ===== HUD */
let lastHud={};
function setIf(k,v,fn){if(lastHud[k]!==v){lastHud[k]=v;fn(v);}}
const pips=n=>'calc('+(n/HMAX*109)+'px)';
function hud(){
  setIf('hp',Math.ceil(PL.hp),v=>$('hpI').style.height=pips(v));
  setIf('we',PL.w?Math.ceil(PL.we[PL.w]):-1,v=>{if(v>=0)$('weI').style.height=pips(v);});
  const b=G.boss;if(b)setIf('boss',Math.ceil(G.phase==='intro'?b.max*G.bossFill:b.hp)*40/b.max|0,v=>$('bossI').style.height='calc('+(v/40*109)+'px)');
  setIf('t',Math.floor(G.time),v=>$('hTime').textContent=Math.floor(v/60)+':'+String(v%60).padStart(2,'0'));
}
function toast(txt,c){const t=$('toast');t.textContent=txt;t.style.color='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';t.classList.remove('go');void t.offsetWidth;t.classList.add('go');}
function banner(eye,txt,blink){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.toggle('blink',!!blink);b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}

/* ===== SCREENS */
const SCREENS=['title','select','pause','result','settings'];
function hideScreens(){for(const s of SCREENS)$(s).hidden=true;}
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
function titleScene(){parse(0);buildMeshes();G.en=[];G.picks=[];G.shots=[];G.eb=[];G.boss=null;if(G.bossObj)G.bossObj.group.visible=false;
  PL.vis=1;PL.dead=0;PL.inv=0;PL.charging=0;PL.shootT=0;}
function goTitle(){state='title';hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;$('title').hidden=false;titleScene();
  $('tBeat').textContent=S.beat.slice(0,4).filter(Boolean).length+' / 4';Mus.play('calm',0);releaseWake();resize();}
function goSelect(){state='select';hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;$('select').hidden=false;if(G.i!==0||!stageMeshes.length)titleScene();
  const th=thumbs(),n=S.beat.slice(0,4).filter(Boolean).length;
  $('stGrid').innerHTML=STAGES.map((L,i)=>{const lock=L.final&&n<4,beat=S.beat[i],c=hex(L.c);
    return '<button class="st'+(L.final?' fin':'')+(lock?' lock':'')+(beat?' beat':'')+'" data-i="'+i+'"'+(lock?' disabled':'')+' style="--c:'+c+'">'+
      '<img src="'+th[i]+'" alt=""><span class="n">'+(L.final?'FINAL':'STAGE '+(i+1))+'</span><b>'+L.bname+'</b><small>'+L.name+(lock?' · beat all four guardians':beat&&S.best[i]?' · best '+fmt(S.best[i]):'')+'</small>'+
      (beat?'<span class="got">'+(L.final?'CLEAR':WEAP[i+1].short.toUpperCase())+'</span>':'')+'</button>';}).join('');
  Mus.play('calm',0);releaseWake();resize();}
function result(){
  state='result';releaseWake();const i=G.i,L=STAGES[i],fin=!!L.final,r=$('result');r.className='screen dim win';
  $('rEye').textContent=(fin?'Final':'Stage '+(i+1))+' · '+L.name;$('rTitle').textContent=fin?'Victory':'Stage clear';
  $('rGet').hidden=fin;if(!fin){const w=WEAP[i+1];$('rGet').style.setProperty('--c',hex(w.c));$('rWep').textContent=w.name;
    const vs=STAGES.find(s=>s.weak===i+1&&!s.final);$('rTip').textContent=w.tip+(vs?' '+vs.bname+' hates it.':'');}
  const n=S.beat.slice(0,4).filter(Boolean).length;
  $('rSub').textContent=fin?'Comet Kid shut down the Eclipse Core. The sector is quiet again.':n<4?(4-n)+' guardian'+(4-n>1?'s':'')+' left. Switch weapons with the weapon button or Q/E.':'All four guardians are down. The Eclipse Core is open.';
  $('rRows').innerHTML=[['Time',fmt(G.time)],['Retries',G.deaths],['Best',S.best[i]?fmt(S.best[i]):'-']].map(x=>'<dt>'+x[0]+'</dt><dd>'+x[1]+'</dd>').join('');
  $('rMain').textContent=fin?'Title':'Stage select';$('rMain').dataset.act=fin?'title':'select';$('rAlt').textContent='Play again';$('rAlt').dataset.act='retry';
  hideScreens();r.hidden=false;Mus.play('calm',i);}
function renderWeapList(){$('pWeap').innerHTML=WEAP.map((w,k)=>owned(k)?'<button data-w="'+k+'" class="'+(k===PL.w?'on':'')+'" style="--c:'+hex(w.c)+'"><i></i><span>'+w.short+'</span>'+(k?'<em>'+Math.ceil(PL.we[k])+'</em>':'')+'</button>':'').join('');}
function pause(){if(state!=='play')return;state='paused';clearInput();hideScreens();$('pause').hidden=false;$('pTitle').textContent=STAGES[G.i].name;renderWeapList();$('pWeap').hidden=!S.beat.slice(0,4).some(Boolean);Snd.suspend();releaseWake();}
function resume(){if(state!=='paused')return;hideScreens();state='play';clearInput();Snd.resume();last=performance.now();acc=0;requestWake();}
let settingsFrom='title',confirmReset=false;
function openSettings(from){settingsFrom=from;$(from).hidden=true;$('settings').hidden=false;confirmReset=false;renderSettings();}
function renderSettings(){for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);$('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';}
// Guardian portraits for the stage select, rendered once into a small target and read back.
let thumbCache=null;
function thumbs(){if(thumbCache)return thumbCache;thumbCache=[];const N=128,sc=new T.Scene(),cm=new T.PerspectiveCamera(30,1,.1,100);cm.position.set(0,0,15);
  sc.add(new T.HemisphereLight(0xc8d4ff,0x3a2050,1.3));const dl=new T.DirectionalLight(0xffffff,2.2);dl.position.set(-4,6,8);sc.add(dl);
  const rt=new T.WebGLRenderTarget(N,N),buf=new Uint8Array(N*N*4),c2=document.createElement('canvas');c2.width=c2.height=N;const x2=c2.getContext('2d'),img=x2.createImageData(N,N);
  const lut=new Uint8Array(256);for(let i=0;i<256;i++){const v=i/255;lut[i]=Math.round(255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055));}
  for(const L of STAGES){const m=makeMat(false),bb=ARC.BOSSES[L.boss](m),g=bb.group;bb.anim(1.3,{x:0,y:0,ph:0,ax:-2,ay:-6},.016);
    if(L.boss==='mantis')g.rotation.set(-.5,0,-PI/2+.3);else g.rotation.set(-.35,.2,0);
    const box=new T.Box3().setFromObject(g),sz=box.getSize(new T.Vector3()),ce=box.getCenter(new T.Vector3()),k=7.2/Math.max(sz.x,sz.y);g.scale.setScalar(k);g.position.set(-ce.x*k,-ce.y*k,0);
    sc.add(g);renderer.setRenderTarget(rt);renderer.setClearColor(0,0);renderer.clear();renderer.render(sc,cm);renderer.readRenderTargetPixels(rt,0,0,N,N,buf);
    for(let y=0;y<N;y++)for(let x=0;x<N;x++){const s=((N-1-y)*N+x)*4,d=(y*N+x)*4;img.data[d]=lut[buf[s]];img.data[d+1]=lut[buf[s+1]];img.data[d+2]=lut[buf[s+2]];img.data[d+3]=buf[s+3];}
    x2.putImageData(img,0,0);thumbCache.push(c2.toDataURL());sc.remove(g);ARC.disposeGroup(g);}
  renderer.setRenderTarget(null);renderer.setClearColor(0,1);rt.dispose();return thumbCache;}

/* ----- buttons */
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>Snd.init(),{once:true});
$('tPlay').onclick=()=>{Snd.play('click');goSelect();};
$('tSet').onclick=()=>openSettings('title');
if(window.ARCADE){$('tArc').hidden=false;$('tArc').onclick=()=>{save();location.href=window.ARCADE.home;};}
$('stGrid').onclick=e=>{const b=e.target.closest('.st');if(!b||b.disabled)return;Snd.play('click');startStage(+b.dataset.i);};
$('stBack').onclick=()=>goTitle();
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
$('pRes').onclick=resume;
$('pRetry').onclick=()=>{Snd.resume();startStage(G.i);};
$('pSel').onclick=()=>{Snd.resume();goSelect();};
$('pSet').onclick=()=>openSettings('pause');
$('pWeap').onclick=e=>{const b=e.target.closest('button');if(!b)return;selectWeap(+b.dataset.w);renderWeapList();Snd.resume();Snd.play('sw');};
$('rMain').onclick=e=>act(e.target.dataset.act);$('rAlt').onclick=e=>act(e.target.dataset.act);
function act(a){if(a==='retry')startStage(G.i);else if(a==='title')goTitle();else goSelect();}
$('setClose').onclick=()=>{$('settings').hidden=true;$(settingsFrom).hidden=false;};
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){const k=t.dataset.set;S.set[k]=!S.set[k];Snd.apply();if(k==='vibe'&&S.set.vibe)vibe(30);if(k==='music'&&!S.set.music)Mus.stop();else if(k==='music'&&Mus.want)Mus.play(Mus.want[0],Mus.want[1]);save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}const keep=S.set;S=fresh();S.set=keep;save();confirmReset=false;PL.w=0;$('settings').hidden=true;goTitle();}});
document.addEventListener('touchmove',e=>{if(!e.target.closest||!e.target.closest('.scroll'))e.preventDefault();},{passive:false});
for(const ev of ['gesturestart','gesturechange','dblclick','contextmenu'])document.addEventListener(ev,e=>e.preventDefault(),{passive:false});
function autoPause(){if(state==='play')pause();else Snd.suspend();save();}
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoPause();else if(state!=='paused')Snd.resume();last=performance.now();});
window.addEventListener('pagehide',autoPause);window.addEventListener('blur',autoPause);
window.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,60));
if(window.ResizeObserver)new ResizeObserver(resize).observe(view);
let wakeLock=null;
function requestWake(){try{if(navigator.wakeLock&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l;l.addEventListener('release',()=>{wakeLock=null;});}).catch(()=>{});}catch(e){}}
function releaseWake(){try{if(wakeLock)wakeLock.release();}catch(e){}wakeLock=null;}

/* ===== LOOP */
let last=performance.now(),acc=0;
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
  if(document.hidden)return;
  if(state==='play'){acc+=dt;let n=0;while(acc>=FIX&&n<4){tick();acc-=FIX;n++;}if(n>=4)acc=0;hud();}
  else if(state!=='paused')partsTick(dt);
  starMat.uniforms.uTime.value+=dt;Mus.tick();draw(state==='paused'?0:dt,now);
}

/* ===== BOOT */
resize();goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
// Test hook. step(dt) runs fixed ticks; auto = (hero, G) => ({l, r, d, jump, shoot, sw}) replaces player input; god 1 = no damage, 2 = nothing kills.
window.__comet={get S(){return S;},G,PL,STAGES,WEAP,ET,BOSS,ROWS,FIX,PERT,consts:{RUN,JUMP,GRAV,CUT,PW,PH,COYOTE,CRUMBLE},startStage,respawn,tick,
  step(dt){let n=Math.round(dt/FIX);while(n-->0&&state==='play')tick();},get state(){return state;},set auto(f){auto=f;},get auto(){return auto;},
  set god(v){G.god=v;},get god(){return G.god;},keys,touch,latch,phys,moveX,moveY,solid,oneway,tileK,spiked,setPlats,platAt,assemble,parse,cam,
  goTitle,goSelect,pause,resume,result,switchWeap,selectWeap,beginBoss,hitBoss,thumbs,save,
  killBoss(){if(G.boss&&!G.boss.dead)hitBoss(G.boss,999,{x:G.boss.x,y:G.boss.y,w:0});},
  teleport(x,y){resetBody(PL,x,y);PL.dead=0;PL.vis=1;PL.hp=Math.max(PL.hp,1);cam.snap=1;}};
})();
