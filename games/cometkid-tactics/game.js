/* Comet Kid Tactics: a real-time grid battler. 25 fights in a row on a 6x3 field (your 3x3 on the left, the aliens'
   on the right) with one life. Move between your tiles, charge the buster and fire cards from a deck you edit before the
   first fight and after every reward. Attacks light up the tiles they will hit before they land. THREE and ARC (shared/kit.js) load first. */
(function(){
'use strict';
const T=THREE,TAU=Math.PI*2,PI=Math.PI;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rand=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.random()*a.length|0];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const $=id=>document.getElementById(id);
const rgb=h=>[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255],hex=h=>'#'+h.toString(16).padStart(6,'0');
const {makeMat}=ARC;

/* ===== SAVE */
const KEY='cometkid-tactics.save.v1';
function fresh(){return{v:1,best:0,wins:0,bestT:0,runs:0,run:null,set:{sfx:true,music:true,vibe:true}};}
function merge(a,b){for(const k in b){const v=b[k];
  if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))merge(a[k],v);
  else if(k in a&&(typeof v===typeof a[k]||a[k]===null)&&Array.isArray(v)===Array.isArray(a[k]))a[k]=v;}return a;}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return merge(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ===== CARDS */
// dmg and heal grow 35% per upgrade level (max 2). s = the line on the card in hand, d = the text on reward picks, w = reward weight.
// once = spent for the rest of the fight when played (other cards go back into the draw pile).
const CARDS={
 shot:  {n:'Comet Shot',cost:1,c:0x3ec8ff,dmg:8,s:'First in row',d:'A fast shot at the first alien in your row.',w:2},
 scythe:{n:'Scythe',cost:2,c:0x9be04a,dmg:8,s:'Whole row',d:'A blade that cuts every alien in your row.',w:2},
 lance: {n:'Lance',cost:2,c:0xffc531,dmg:20,s:'2 tiles ahead',d:'A heavy stab at the two tiles in front of you. Get close first.',w:2},
 rocket:{n:'Rocket',cost:2,c:0xff9b3d,dmg:12,s:'Seeks weakest',d:'Homes in on the alien with the least HP, wherever it is.',w:2},
 flare: {n:'Flare',cost:2,c:0xff5a5a,dmg:12,s:'+ burst 3 ahead',d:'Lands three tiles ahead of you and bursts in a plus shape.',w:2},
 freeze:{n:'Freeze',cost:1,c:0x9fe8ff,dmg:4,s:'Freeze 3 s',d:'Freezes the first alien in your row for 3 seconds.',w:1.5},
 volley:{n:'Volley',cost:3,c:0x4aa8ff,dmg:10,s:'Every row',d:'One shot down each of the three rows.',w:1.2},
 quake: {n:'Quake',cost:3,c:0xb36bff,dmg:6,s:'All + stun',d:'Hits every alien and stuns them for 1.5 seconds.',w:1},
 ward:  {n:'Ward',cost:2,c:0xd08cff,s:'Block hits',d:'Crystals that block the next two hits (one more per upgrade).',w:1},
 patch: {n:'Patch',cost:1,c:0x5dff9b,heal:12,s:'Repair',d:'Repairs 12 HP. Once per fight.',w:1.4,once:1},
 nova:  {n:'Nova',cost:3,c:0xffe6b0,dmg:28,s:'Row blast',d:'A huge blast that pierces your whole row.',w:.6},
};
// A run starts owning START plus EXTRA; START is the opening deck. Decks hold DECK_MIN cards up to deckMax() (8, +1 per guardian beaten).
const START=['shot','shot','shot','scythe','lance','ward','patch'],EXTRA=['shot','rocket','flare','freeze'],DECK_MIN=5;

/* ===== ALIENS & GUARDIANS */
// a = attack cycle (names in ATK), mv = seconds between hops (0 = never moves), cd = seconds between attacks, s = model scale.
const ET={
 mite:   {k:'mite',n:'Mite',hp:50,mv:1.6,cd:2.4,a:['shot'],s:1.35},
 drone:  {k:'drone',n:'Drone',hp:70,mv:1.9,cd:2.7,a:['bomb'],s:.95},
 dart:   {k:'dart',n:'Dart',hp:60,mv:2.2,cd:3.2,a:['charge'],s:1},
 turret: {k:'turret',n:'Turret',hp:90,mv:0,cd:2.8,a:['burst'],s:.9},
 gunship:{k:'gunship',n:'Gunship',hp:120,mv:2.6,cd:3.2,a:['col'],s:.72},
 elite:  {k:'elite',n:'Elite',hp:150,mv:1.5,cd:2.9,a:['cross','shot'],s:.62},
};
// Guardians switch to p2 below half HP and attack 20% more often.
const BOSS={
 mantis: {n:'Mantis',hp:380,mv:1.1,cd:1.7,a:['charge','shot','cross'],p2:['charge','rows2','charge','shot']},
 warden: {n:'Warden',hp:420,mv:1.4,cd:1.8,a:['bomb','burst','rain'],p2:['rain','burst','col']},
 bastion:{n:'Bastion',hp:460,mv:1.6,cd:1.9,a:['col','wave','cross'],p2:['wave','safe','col']},
 hydra:  {n:'Hydra',hp:400,mv:1.2,cd:1.8,a:['wave','bomb','rows2'],p2:['wave','rain','rows2','bomb']},
 eclipse:{n:'Eclipse',hp:650,mv:1.2,cd:1.6,a:['wave','col','rain','charge'],p2:['safe','wave','rain','cross','charge']},
};
// The gauntlet. Each 'G' is the next of the four guardians, in an order shuffled per run; the last fight is always the Eclipse.
const FIGHTS=[
 ['mite','mite'],['mite','drone'],['dart','mite'],['turret','mite','mite'],'G',
 ['drone','drone','mite'],['dart','turret'],['gunship','mite'],['dart','drone','turret'],'G',
 ['gunship','dart','mite'],['elite','mite'],['turret','turret','drone'],['elite','drone','dart'],'G',
 ['gunship','gunship'],['elite','turret','mite'],['dart','dart','gunship'],['elite','elite'],'G',
 ['gunship','elite','drone'],['elite','dart','turret'],['gunship','gunship','elite'],['elite','elite','dart'],'eclipse'];
const NF=FIGHTS.length,GUARDS=['mantis','warden','bastion','hydra'];
const LV=[{key:45,bpm:134,prog:[0,8,3,10]},{key:43,bpm:138,prog:[0,5,3,10]},{key:47,bpm:140,prog:[0,3,8,10]},{key:41,bpm:136,prog:[0,8,5,3]},
  {key:44,bpm:142,prog:[0,10,8,3]},{key:46,bpm:144,prog:[0,5,8,10]},{key:40,bpm:146,prog:[0,1,8,3]}];

/* ===== TUNING (tiles, seconds) */
// Per fight, alien HP grows HPG and their hits DMGG (of the fight-1 values). Between fights Comet Kid repairs REST HP.
// Each Buster upgrade adds 2 to the charged shot (and 1 to the tap shot every second level).
const TS=1.5,FIX=1/60,HMAX=60,EMAX=5,EREG=1.6,CH=1.2,BCD=.3,STEP=.075,INV=.55,BUSTER=1,CHARGED=5,REST=8,DMG=2,ACD=.85,HPG=.045,DMGG=.05;
const tx=c=>(c-2.5)*TS,tz=r=>(r-1)*TS;

/* ===== RENDERER & CAMERA */
const view=$('view'),cv=$('cv');
const DPR=window.devicePixelRatio||1;
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5,powerPreference:'high-performance',stencil:false});renderer.setPixelRatio(Math.min(DPR,2));
const scene=new T.Scene();scene.background=new T.Color(0x07061a);
const camera=new T.PerspectiveCamera(30,1,.5,400);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.25);const sun=new T.DirectionalLight(0xffffff,2.1);sun.position.set(-4,9,7);scene.add(hemi,sun);
let W=1,H=1;
// The camera looks down on the field from the front and backs off until all six columns and the guardians fit. Aiming
// above the field's centre pushes it down the frame, clear of the HUD.
const EL=56*PI/180,AIM=new T.Vector3(0,.7,.1),CAMP=new T.Vector3();
function resize(){W=Math.max(1,view.clientWidth);H=Math.max(1,view.clientHeight);renderer.setSize(W,H,false);camera.aspect=W/H;
  const tv=Math.tan(camera.fov*PI/360),d=Math.max(4.9/(tv*camera.aspect),3.7/tv);
  CAMP.set(AIM.x,AIM.y+Math.sin(EL)*d,AIM.z+Math.cos(EL)*d);camera.position.copy(CAMP);camera.lookAt(AIM);camera.updateProjectionMatrix();}
const _v=new T.Vector3();
function toScreen(x,y,z){_v.set(x,y,z).project(camera);return{x:(_v.x+1)/2*W,y:(1-_v.y)/2*H};}
const fx=new ARC.Batch(scene,1600,ARC.FX_FS,{vs:ARC.VS_ISO,blend:T.AdditiveBlending,order:5,lift:.4});
const ebR=new ARC.Batch(scene,200,ARC.EB_FS,{vs:ARC.VS_ISO,blend:T.NormalBlending,order:6,lift:.3});

/* ===== FIELD */
// 18 tiles: each has its own material so warnings can light it. Blue = yours, pink = theirs.
const TILES=[];
{const bg=new T.BoxGeometry(TS*.93,.24,TS*.93),eg=new T.EdgesGeometry(bg);
  for(let r=0;r<3;r++)for(let c=0;c<6;c++){const me=c<3,m=new T.MeshStandardMaterial({color:me?0x1c3260:0x4a1a40,roughness:.7,metalness:.15,flatShading:true});
    const t=new T.Mesh(bg,m);t.position.set(tx(c),-.12,tz(r));const lm=new T.LineBasicMaterial({color:me?0x3ef0ff:0xff3d7f,transparent:true,opacity:.55}),ln=new T.LineSegments(eg,lm);
    ln.position.copy(t.position);scene.add(t,ln);TILES.push({c,r,me,m,lm,fl:0,fc:null});}}
const tile=(c,r)=>c>=0&&c<6&&r>=0&&r<3?TILES[r*6+c]:null;
{const base=new T.Mesh(new T.BoxGeometry(6*TS+.5,.6,3*TS+.5),new T.MeshStandardMaterial({color:0x14112e,roughness:.9,flatShading:true}));base.position.y=-.55;scene.add(base);
  const mid=new T.Mesh(new T.BoxGeometry(.06,.02,3*TS+.3),new T.MeshBasicMaterial({color:0xffc531}));mid.position.set(0,.01,0);scene.add(mid);
  const pos=new Float32Array(500*3);for(let i=0;i<500;i++){const a=rand(-PI,PI),e=rand(.02,1.3),r=160;pos[i*3]=Math.sin(a)*Math.cos(e)*r;pos[i*3+1]=Math.sin(e)*r-20;pos[i*3+2]=-Math.abs(Math.cos(a))*Math.cos(e)*r;}
  const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(pos,3));scene.add(new T.Points(sg,new T.PointsMaterial({color:0xcfd8ff,size:1.6,sizeAttenuation:false})));
  const planet=new T.Mesh(ARC.geo([{g:ARC.P.ico(16,1),c:0x2c3f7a},{g:ARC.P.tor(26,.7,3,40),c:0x9497cf,r:[1.2,0,.3]}]),makeMat(false,{fog:false}));planet.position.set(34,14,-120);scene.add(planet);}

/* ===== MODELS */
const K=ARC.kid();K.g.scale.setScalar(1.05);scene.add(K.g);
// Kit aliens face +y with +z toward the viewer, guardians face -y: both are turned to point at Comet Kid (-x) and tipped back toward the camera.
function foeMesh(e){const g=new T.Group(),tilt=new T.Group(),inner=new T.Group(),mat=makeMat(false);g.add(tilt);tilt.add(inner);tilt.rotation.x=-.5;let anim=null;
  if(e.boss){const b=ARC.BOSSES[e.type](mat);inner.add(b.group);inner.rotation.z=-PI/2;anim=b.anim;g.updateMatrixWorld(true);
    const sz=new T.Box3().setFromObject(g).getSize(new T.Vector3());inner.scale.setScalar(2.2/Math.max(sz.x,sz.y,sz.z));}
  else{inner.add(new T.Mesh(ARC.ALIENS[ET[e.type].k](),mat));inner.rotation.z=PI/2;inner.scale.setScalar(ET[e.type].s);}
  scene.add(g);return{g,mat,anim};}
function dropFoe(e){scene.remove(e.m.g);ARC.disposeGroup(e.m.g);e.m.mat.dispose();if(e.tag)e.tag.remove();}

/* ===== PARTICLES & FLOATING TEXT */
const COL={cyan:rgb(0x3ef0ff),white:[1,1,1],gold:rgb(0xffc531),orange:rgb(0xff9b3d),pink:rgb(0xff3d7f),violet:rgb(0xb36bff),green:rgb(0x5dff9b),hot:rgb(0xffe6b0),red:rgb(0xff4d4d),ice:rgb(0x9fe8ff),lime:rgb(0x9be04a)};
const pt={n:0,cap:900,keys:['x','y','z','vx','vy','vz','l','m','s0','s1','r','g','b','sh','gy']};for(const k of pt.keys)pt[k]=new Float32Array(pt.cap);
function rmPt(i){const j=--pt.n;if(i!==j)for(const k of pt.keys)pt[k][i]=pt[k][j];}
function part(x,y,z,vx,vy,vz,l,s0,s1,c,sh,gy){if(pt.n>=pt.cap)return;const i=pt.n++;pt.x[i]=x;pt.y[i]=y;pt.z[i]=z;pt.vx[i]=vx;pt.vy[i]=vy;pt.vz[i]=vz;pt.l[i]=pt.m[i]=l;
  pt.s0[i]=s0;pt.s1[i]=s1;pt.r[i]=c[0];pt.g[i]=c[1];pt.b[i]=c[2];pt.sh[i]=sh||0;pt.gy[i]=gy||0;}
function burst(x,y,z,n,c,sp,size,life){for(let i=0;i<n;i++){const a=rand(0,TAU),e=rand(-.3,1),s=rand(.4,1)*sp;part(x,y,z,Math.cos(a)*s,e*s,Math.sin(a)*s,rand(.6,1)*life,size,.02,c,0,5);}}
function boom(x,y,z,sz,c){burst(x,y,z,10+sz*14,c,2+sz*3,.35*(1+sz*.5),.6);part(x,y,z,0,0,0,.2+sz*.08,1+sz*1.4,.2,COL.hot,0,0);part(x,y,z,0,0,0,.35,.3,1.6+sz*2,c,1,0);}
const _t=[0,0,0];
function partsTick(dt){for(let i=pt.n-1;i>=0;i--){pt.l[i]-=dt;if(pt.l[i]<=0){rmPt(i);continue;}pt.vy[i]-=pt.gy[i]*dt;pt.x[i]+=pt.vx[i]*dt;pt.y[i]+=pt.vy[i]*dt;pt.z[i]+=pt.vz[i]*dt;
  const k=pt.l[i]/pt.m[i],s=lerp(pt.s1[i],pt.s0[i],k);_t[0]=pt.r[i];_t[1]=pt.g[i];_t[2]=pt.b[i];fx.push(pt.x[i],pt.y[i],pt.z[i],0,s,s,pt.sh[i],Math.min(1,k*1.4),_t);}}
const pops=[];
function pop(txt,x,y,z,cls){const d=document.createElement('div');d.className='pop '+(cls||'');d.textContent=txt;$('pops').appendChild(d);pops.push({d,x,y,z,t:0});}

/* ===== AUDIO */
const Snd=ARC.synth({sfx:()=>S.set.sfx,music:()=>S.set.music,onInit:()=>{if(Mus.want)Mus.play(Mus.want[0],Mus.want[1]);},
  thr:{hit:.03,step:.04,eshot:.05,shot:.04},
  sounds:{
    step:(s,t)=>{s.osc('square',300,420,t,.03,.018);},
    shot:(s,t)=>{s.osc('square',900,450,t,.06,.045);},
    shot2:(s,t)=>{s.osc('sawtooth',300,1400,t,.12,.07);s.nz(t,.15,.15,'bandpass',2400,800,0,2);},
    full:(s,t)=>{s.osc('triangle',1320,0,t,.12,.06);},
    card:(s,t)=>{s.osc('square',660,1320,t,.06,.045);},
    hit:(s,t)=>{s.osc('square',320,120,t,.06,.06);},
    kill:(s,t)=>{s.nz(t,.25,.25,'lowpass',2600,200);s.osc('square',420,60,t,.2,.07);},
    hurt:(s,t)=>{s.osc('sawtooth',620,150,t,.18,.11);s.osc('square',300,80,t+.04,.15,.07);},
    block:(s,t)=>{s.osc('triangle',1600,1200,t,.12,.08);s.osc('triangle',2400,0,t+.04,.1,.05);},
    die:(s,t)=>{[784,659,523,392,262].forEach((f,i)=>s.osc('square',f,f*.8,t+i*.07,.1,.06));s.nz(t,.6,.3,'lowpass',2000,100);},
    big:(s,t)=>{s.nz(t,1.6,.6,'lowpass',2600,50);s.osc('sawtooth',200,30,t,1.3,.2);},
    boom:(s,t)=>{s.nz(t,.4,.35,'lowpass',1800,80);s.osc('sine',120,40,t,.35,.25);},
    win:(s,t)=>{[523,659,784,1047,784,1047].forEach((f,i)=>s.osc('square',f,0,t+i*.11,.12,.055));s.osc('triangle',1047,0,t+.66,.6,.09);},
    clear:(s,t)=>{[659,784,1047].forEach((f,i)=>s.osc('square',f,0,t+i*.08,.1,.05));},
    ready:(s,t)=>{s.osc('triangle',523,0,t,.08,.06);s.osc('triangle',784,0,t+.1,.14,.06);},
    alarm:(s,t)=>{for(let i=0;i<2;i++){s.osc('square',660,660,t+i*.3,.14,.05);s.osc('square',440,440,t+i*.3+.15,.14,.05);}},
    eshot:(s,t)=>{s.osc('triangle',520,260,t,.08,.04);},
    dash:(s,t)=>{s.nz(t,.25,.14,'bandpass',1500,3000,0,3);},
    lob:(s,t)=>{s.osc('sine',300,700,t,.18,.06);},
    lock:(s,t)=>{s.osc('square',1000,1000,t,.04,.03);s.osc('square',1000,1000,t+.09,.04,.03);},
    scythe:(s,t)=>{s.nz(t,.2,.13,'bandpass',2600,1200,0,4);},
    lance:(s,t)=>{s.nz(t,.18,.2,'bandpass',900,2600,0,3);s.osc('sawtooth',180,90,t,.15,.06);},
    rocket:(s,t)=>{s.nz(t,.3,.15,'bandpass',900,300,0,2);s.osc('sawtooth',200,500,t,.15,.035);},
    ward:(s,t)=>{[988,1319,1568].forEach((f,i)=>s.osc('triangle',f,0,t+i*.04,.08,.045));},
    heal:(s,t)=>{[523,659,784,1047].forEach((f,i)=>s.osc('triangle',f,0,t+i*.06,.1,.05));},
    flare:(s,t)=>{s.nz(t,.15,.15,'bandpass',1400,500,0,1);s.osc('sawtooth',400,180,t,.12,.045);},
    ice:(s,t)=>{s.osc('triangle',2000,2600,t,.1,.05);s.nz(t,.12,.08,'highpass',5000);},
    quake:(s,t)=>{s.nz(t,.7,.4,'lowpass',500,60);s.osc('sine',70,35,t,.6,.3);},
    click:(s,t)=>{s.osc('square',880,0,t,.03,.035);},
    empty:(s,t)=>{s.osc('square',200,180,t,.06,.04);},
  }});
const Mus=ARC.music(Snd,{level:i=>LV[i%LV.length],calmBpm:100,calmBass:.22});
const vibe=ms=>ARC.vibe(S.set.vibe,ms);

/* ===== RUN STATE */
// R is the run (what the save keeps between fights); G and PL are the current fight.
let state='title',R=null;
const G={fi:0,en:[],warns:[],ps:[],es:[],arcs:[],later:[],phase:'title',pt:0,t:0,ft:0,shake:0,lastAtk:-9,god:0,opts:null};
const PL={c:1,r:1,x:tx(1),z:tz(1),dest:null,mt:0,hp:HMAX,max:HMAX,inv:0,ward:0,en:3,chg:0,charging:0,cd:0,hand:[],next:null,pile:[],spent:[],dead:0,flash:0,shootT:0};
const alive=()=>G.en.filter(e=>!e.dead);
const cdmg=id=>Math.round((CARDS[id].dmg||0)*(1+.35*(R.up[id]||0)));
function cardLine(id){const C=CARDS[id],lv=R?R.up[id]||0:0;return id==='ward'?'Block '+(2+lv):id==='patch'?'+'+(C.heal+4*lv)+' HP':C.s+' · '+(R?cdmg(id):C.dmg);}
const cname=id=>CARDS[id].n+(R&&R.up[id]?'+'.repeat(R.up[id]):'');

function newRun(){R={fi:0,hp:HMAX,max:HMAX,lib:START.concat(EXTRA),deck:START.slice(),up:{},bl:0,t:0,bosses:shuffle(GUARDS.slice())};S.runs++;showEdit();}
// The save holds the run at each fight start, on the reward screen and in the deck editor (stage), so closing the app replays at
// most one fight. Runs saved before the editor and the 25-fight gauntlet have no lib/bosses: they get them here.
function snap(stage){S.run={fi:R.fi,hp:R.hp,max:R.max,lib:R.lib.slice(),deck:R.deck.slice(),up:Object.assign({},R.up),bl:R.bl,t:R.t,bosses:R.bosses.slice(),stage};save();}
function continueRun(){const r=S.run;if(!r)return;
  R={fi:r.fi,hp:r.hp,max:r.max,lib:(r.lib||r.deck).slice(),deck:r.deck.slice(),up:Object.assign({},r.up),bl:r.bl||0,t:r.t,
    bosses:r.bosses||(r.boss?[r.boss].concat(shuffle(GUARDS.filter(g=>g!==r.boss))):shuffle(GUARDS.slice()))};
  const st=r.stage||(r.pick?'pick':'fight');if(st==='pick')showReward();else if(st==='edit')showEdit();else startFight(R.fi);}
// the guardian (or Eclipse) of fight i, or null
const bossOf=i=>FIGHTS[i]==='eclipse'?'eclipse':FIGHTS[i]==='G'?R.bosses[FIGHTS.slice(0,i).filter(f=>f==='G').length]:null;
const deckMax=()=>8+FIGHTS.slice(0,R.fi).filter(f=>f==='G').length;
const fightName=i=>{const b=bossOf(i);return b?'Guardian · '+BOSS[b].n:FIGHTS[i].map(t=>ET[t].n).join(' · ');};
function clearFight(){for(const e of G.en)dropFoe(e);G.en=[];G.warns=[];G.ps=[];G.es=[];G.arcs=[];G.later=[];pt.n=0;for(const p of pops)p.d.remove();pops.length=0;}
function spawn(type,c,r,boss,hm){const d=boss?BOSS[type]:ET[type],e={type,boss:!!boss,d,c,r,x:tx(c),z:tz(r),hp:Math.round(d.hp*hm),max:0,mt:d.mv*rand(.6,1.2),cd:0,bz:0,frz:0,ai:0,p2:0,fl:0,dead:0,sc:0,t:rand(0,9),dash:0,dashT:0,lhp:-1};
  e.max=e.hp;e.m=foeMesh(e);e.tag=document.createElement('div');e.tag.className='tag'+(boss?' boss':'');$('tags').appendChild(e.tag);G.en.push(e);return e;}
function startFight(i){
  clearFight();state='play';hideScreens();R.fi=G.fi=i;snap('fight');
  const boss=bossOf(i),list=boss?[boss]:FIGHTS[i],hm=1+HPG*i;
  const spots=boss?[[4,1]]:shuffle([[3,0],[3,2],[4,1],[5,0],[5,2],[4,0],[4,2],[5,1]]);
  list.forEach((t,k)=>{const e=spawn(t,spots[k][0],spots[k][1],boss,hm);e.cd=e.d.cd*(.8+k*.5);});
  Object.assign(PL,{c:1,r:1,x:tx(1),z:tz(1),dest:null,mt:0,hp:R.hp,max:R.max,inv:0,ward:0,en:3,chg:0,charging:0,cd:0,dead:0,flash:0,shootT:0});
  PL.spent=[];PL.pile=shuffle(R.deck.slice());PL.hand=[draw(),draw(),draw()];PL.next=draw();
  Object.assign(G,{phase:'intro',pt:0,ft:0,shake:0,lastAtk:-9});clearInput();
  document.body.classList.add('ingame');$('hud').hidden=false;$('hFight').textContent='Fight '+(i+1)+' / '+NF;$('hFoe').textContent=boss?'Guardian · '+BOSS[boss].n:'';
  banner(boss?'Guardian · Fight '+(i+1)+' / '+NF:'Fight '+(i+1)+' / '+NF,boss?BOSS[boss].n:'Fight!');Snd.play('ready');
  Mus.play(boss?'boss':'level',i);requestWake();lastHud={};renderHand();resize();
}
function draw(){if(!PL.pile.length){const p=R.deck.slice();for(const id of PL.spent){const i=p.indexOf(id);if(i>=0)p.splice(i,1);}PL.pile=shuffle(p.length?p:['shot']);}return PL.pile.pop();}

/* ===== INPUT */
// Keys, touch and the test hook merge into one state the simulation samples each tick. Presses are latched so a tap
// shorter than a frame still counts. Moves are a destination tile: Comet Kid walks there one tile per STEP.
const keys={},touch={b:0},latch={b:0,card:-1},prev={b:0};
let auto=null;
const KMOV={ArrowLeft:[-1,0],KeyA:[-1,0],ArrowRight:[1,0],KeyD:[1,0],ArrowUp:[0,-1],KeyW:[0,-1],ArrowDown:[0,1],KeyS:[0,1]};
const KCARD={Digit1:0,Digit2:1,Digit3:2,KeyU:0,KeyI:1,KeyO:2};
window.addEventListener('keydown',e=>{
  if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pause();else if(state==='paused')resume();return;}
  if(state!=='play')return;const m=KMOV[e.code];if(m||e.code==='Space')e.preventDefault();if(e.repeat)return;
  if(m){const b=PL.dest||[PL.c,PL.r];PL.dest=[clamp(b[0]+m[0],0,2),clamp(b[1]+m[1],0,2)];}
  if(e.code==='KeyJ'||e.code==='Space'||e.code==='KeyX'){keys.b=1;latch.b=1;}
  if(e.code in KCARD)latch.card=KCARD[e.code];});
window.addEventListener('keyup',e=>{if(e.code==='KeyJ'||e.code==='Space'||e.code==='KeyX')keys.b=0;});
function readInput(){
  let h;if(auto){const a=auto(PL,G)||{};if(a.dest)PL.dest=a.dest;h={b:!!a.b,card:a.card==null?-1:a.card};}
  else h={b:!!(keys.b||touch.b),card:latch.card};
  h.bp=(h.b&&!prev.b)||!!latch.b;h.br=!h.b&&(prev.b||!!latch.b);prev.b=h.b;latch.b=0;latch.card=-1;return h;}
function clearInput(){touch.b=0;keys.b=0;prev.b=0;latch.b=0;latch.card=-1;mpId=busId=null;$('bBus').classList.remove('on');}
// Move pad: a 3x3 copy of your side. Touch a square to walk there; slide the thumb to keep steering.
const mp=$('mpad');mp.innerHTML=Array.from({length:9},(_,i)=>'<i data-c="'+i%3+'" data-r="'+(i/3|0)+'"></i>').join('');
let mpId=null,busId=null;
function mpAt(e){const b=mp.getBoundingClientRect();if(state==='play'&&!PL.dead)PL.dest=[clamp(Math.floor((e.clientX-b.left)/b.width*3),0,2),clamp(Math.floor((e.clientY-b.top)/b.height*3),0,2)];}
mp.addEventListener('pointerdown',e=>{e.preventDefault();Snd.init();mpId=e.pointerId;try{mp.setPointerCapture(e.pointerId);}catch(_){}mpAt(e);});
mp.addEventListener('pointermove',e=>{if(e.pointerId===mpId)mpAt(e);});
$('bBus').addEventListener('pointerdown',e=>{e.preventDefault();Snd.init();busId=e.pointerId;try{e.currentTarget.setPointerCapture(e.pointerId);}catch(_){}touch.b=1;latch.b=1;e.currentTarget.classList.add('on');});
$('hand').addEventListener('pointerdown',e=>{const c=e.target.closest('.card');if(!c||c.classList.contains('nx'))return;e.preventDefault();Snd.init();latch.card=+c.dataset.i;
  c.classList.add('on');setTimeout(()=>c.classList.remove('on'),110);});
function endPtr(e){if(e.pointerId===mpId)mpId=null;if(e.pointerId===busId){busId=null;touch.b=0;$('bBus').classList.remove('on');}}
window.addEventListener('pointerup',endPtr);window.addEventListener('pointercancel',endPtr);

/* ===== ATTACKS */
// Aliens telegraph by lighting your tiles: warn(tiles, seconds, dmg) hits whatever stands there when time runs out
// (dmg 0 = orange heads-up for a shot that is about to fly). A warning tied to an alien is cancelled if it dies first.
const row3=r=>[[0,r],[1,r],[2,r]],col3=c=>[[c,0],[c,1],[c,2]],MINE=[0,1,2].flatMap(r=>row3(r));
const onMe=t=>t[0]===PL.c&&t[1]===PL.r;
function warn(tiles,at,dmg,src,o){G.warns.push(Object.assign({tiles,t:0,at,dmg,src},o));}
function later(t,fn,src){G.later.push({t,fn,src});}
function eshot(e,r,v,dmg){G.es.push({c:e.c-.45,r,v,dmg});Snd.play('eshot');}
function lob(x0,y0,z0,x1,z1,dur,c,fn,tg){G.arcs.push({x0,y0,z0,x1,y1:.4,z1,t:0,dur,c,fn,tg,h:2.2});}
const free=(c,r,me)=>c>=3&&c<6&&r>=0&&r<3&&!G.en.some(o=>!o.dead&&o!==me&&o.c===c&&o.r===r);
const ATK={
 shot(e,m){const r=e.r;warn(row3(r),.5,0,e);later(.5,()=>eshot(e,r,6.5,4*m),e);return .7;},
 burst(e,m){const r=e.r;warn(row3(r),.55,0,e);for(let k=0;k<3;k++)later(.55+k*.24,()=>eshot(e,r,7,3*m),e);return 1.3;},
 // line up with Comet Kid's row, then dash the whole row
 charge(e,m){if(e.r!==PL.r){const c=[e.c,3,4,5].find(c=>free(c,PL.r,e));if(c!=null){e.c=c;e.r=PL.r;}}
   warn(row3(e.r),.7,6*m,e);e.dash=.7;later(.7,()=>{e.dashT=.4;Snd.play('dash');},e);return 1.4;},
 bomb(e,m){const t=[PL.c,PL.r];warn([t],.85,6*m,null);lob(e.x,1.2,e.z,tx(t[0]),tz(t[1]),.85,COL.orange);Snd.play('lob');return .5;},
 col(e,m){warn(col3(PL.c),.75,5*m,null);Snd.play('lock');return 1;},
 cross(e,m){warn([[0,0],[-1,0],[1,0],[0,-1],[0,1]].map(([a,b])=>[PL.c+a,PL.r+b]).filter(([c,r])=>c>=0&&c<3&&r>=0&&r<3),.75,6*m,null);Snd.play('lock');return 1;},
 rain(e,m){const o=shuffle(MINE.filter(t=>!onMe(t))).slice(0,3);[[PL.c,PL.r],...o].forEach((t,k)=>warn([t],.75+k*.2,6*m,null));Snd.play('lob');return 1.3;},
 rows2(e,m){const o=pick([0,1,2].filter(r=>r!==PL.r));warn([...row3(PL.r),...row3(o)],.8,6*m,null);Snd.play('lock');return 1.1;},
 // shots down two rows; the gap is never the row Comet Kid is in
 wave(e,m){const gap=pick([0,1,2].filter(r=>r!==PL.r));for(const r of [0,1,2])if(r!==gap){warn(row3(r),.6,0,e);later(.6,()=>eshot(e,r,6.5,5*m),e);}return 1;},
 // everything but one nearby tile, shown green
 safe(e,m){const sf=pick(MINE.filter(t=>!onMe(t)&&Math.abs(t[0]-PL.c)+Math.abs(t[1]-PL.r)<=2));
   warn(MINE.filter(t=>t[0]!==sf[0]||t[1]!==sf[1]),1.3,8*m,null,{safe:sf});Snd.play('alarm');return 1.8;},
};

/* ===== COMET KID */
function pshot(o){G.ps.push(Object.assign({c:PL.c+.4,r:PL.r,v:20,k:'b',hit:new Set()},o));PL.shootT=.25;}
function hitTile(c,r,d,col){const t=tile(c,r);if(t){t.fl=.35;t.fc=col;}for(const e of G.en)if(!e.dead&&e.c===c&&e.r===r)hurtE(e,d);}
const CARD_FX={
 shot:d=>{pshot({dmg:d,k:'card',col:COL.cyan});Snd.play('shot2');},
 scythe:d=>{pshot({dmg:d,v:13,k:'blade',pierce:1});Snd.play('scythe');},
 lance:d=>{for(const c of [PL.c+1,PL.c+2]){hitTile(c,PL.r,d,COL.gold);for(let k=0;k<6;k++)part(tx(c)+rand(-.6,.6),.7,tz(PL.r)+rand(-.2,.2),rand(2,5),rand(-1,1),0,.3,.35,.05,COL.gold,2,0);}Snd.play('lance');},
 rocket:d=>{const tg=alive().sort((a,b)=>a.hp-b.hp)[0];if(!tg)return;lob(PL.x+.5,.9,PL.z,tg.x,tg.z,.45,COL.orange,()=>{if(!tg.dead){hurtE(tg,d);boom(tg.x,1,tg.z,.5,COL.orange);Snd.play('boom');}},tg);G.arcs[G.arcs.length-1].h=1;Snd.play('rocket');},
 flare:d=>{const c=PL.c+3,r=PL.r;lob(PL.x+.5,.9,PL.z,tx(c),tz(r),.42,COL.red,()=>{for(const [a,b] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]])hitTile(c+a,r+b,d,COL.red);boom(tx(c),.6,tz(r),.7,COL.red);Snd.play('boom');});Snd.play('flare');},
 freeze:d=>{pshot({dmg:d,v:18,k:'ice',frz:3});Snd.play('ice');},
 volley:d=>{for(let r=0;r<3;r++)G.ps.push({c:PL.c+.4,r,v:20,dmg:d,k:'card',col:rgb(0x4aa8ff),hit:new Set()});PL.shootT=.25;Snd.play('shot2');},
 quake:d=>{for(const e of alive()){hurtE(e,d);e.frz=Math.max(e.frz,1.5);}G.shake=.6;Snd.play('quake');vibe([30,30,30]);},
 ward:(d,lv)=>{PL.ward=Math.min(5,PL.ward+2+lv);Snd.play('ward');},
 patch:(d,lv)=>{heal(CARDS.patch.heal+4*lv);},
 nova:d=>{pshot({dmg:d,v:15,k:'nova',pierce:1});G.shake=.3;Snd.play('shot2');},
};
function useCard(i){const id=PL.hand[i];if(!id||PL.dead)return;const C=CARDS[id];if(PL.en<C.cost){Snd.play('empty');return;}
  PL.en-=C.cost;if(C.once)PL.spent.push(id);PL.hand[i]=PL.next;PL.next=draw();vibe(10);CARD_FX[id](cdmg(id),R.up[id]||0);renderHand();}
function move(dt){PL.mt-=dt;if(PL.mt>0||!PL.dest)return;const [c,r]=PL.dest;if(c===PL.c&&r===PL.r){PL.dest=null;return;}
  // rows first: most attacks run along a row, so leaving it comes before closing in
  if(r!==PL.r)PL.r+=Math.sign(r-PL.r);else PL.c+=Math.sign(c-PL.c);PL.mt=STEP;Snd.play('step');}
function buster(inp,dt){PL.cd-=dt;
  // a hold that began before the fight (or before a card was played) still starts a charge
  if(inp.bp||(inp.b&&!PL.charging)){if(PL.cd<=0){pshot({dmg:BUSTER+(R.bl>>1)});PL.cd=BCD;Snd.play('shot');}PL.charging=1;PL.chg=0;}
  if(PL.charging){if(inp.b||inp.bp){const c0=PL.chg;PL.chg+=dt;if(c0<CH&&PL.chg>=CH)Snd.play('full');}
    if(inp.br){if(PL.chg>=CH){pshot({dmg:CHARGED+2*R.bl,v:22,lvl:1});Snd.play('shot2');}PL.chg=0;PL.charging=0;}}}
function hurt(d){if(G.god||PL.inv>0||G.phase!=='fight'||PL.dead)return;
  if(PL.ward>0){PL.ward--;PL.inv=.35;Snd.play('block');pop('BLOCK',PL.x,1.9,PL.z,'tag2');burst(PL.x,.9,PL.z,10,COL.violet,3,.3,.4);vibe(15);return;}
  d=Math.round(d);PL.hp=Math.max(0,PL.hp-d);PL.inv=INV;PL.flash=.3;G.shake=.35;pop('-'+d,PL.x,1.9,PL.z,'hurt');Snd.play('hurt');vibe(45);
  if(PL.hp<=0&&G.god!==2){PL.dead=1;G.phase='dead';G.pt=0;boom(PL.x,.8,PL.z,1.2,COL.cyan);Snd.play('die');vibe([60,40,120]);}}
function heal(n){const h=Math.min(PL.max-PL.hp,n);PL.hp+=h;pop('+'+h,PL.x,1.9,PL.z,'heal');burst(PL.x,.8,PL.z,10,COL.green,2,.3,.5);Snd.play('heal');}
function hurtE(e,d){if(e.dead)return;e.hp-=d;e.fl=1;pop(String(d),e.x,e.boss?2.6:1.8,e.z,d>=8?'big':'');Snd.play('hit');
  if(e.boss&&!e.p2&&e.hp<e.max*.5&&e.hp>0){e.p2=1;e.ai=0;toast('Enraged',COL.pink);Snd.play('alarm');}
  if(e.hp<=0){e.hp=0;e.dead=1;e.dash=0;e.dashT=0;boom(e.x,1,e.z,e.boss?1.6:.8,e.boss?COL.gold:COL.pink);Snd.play(e.boss?'big':'kill');vibe(e.boss?[40,30,90]:20);if(e.boss)G.shake=.8;}}

/* ===== SIMULATION */
function tick(inp){
  const dt=FIX;G.t+=dt;inp=inp||readInput();const ph=G.phase;
  G.shake=Math.max(0,G.shake-dt*1.8);PL.flash=Math.max(0,PL.flash-dt);PL.shootT=Math.max(0,PL.shootT-dt);for(const t of TILES)t.fl=Math.max(0,t.fl-dt);
  if(ph==='intro'){G.pt+=dt;move(dt);for(const e of G.en)e.sc=Math.min(1,G.pt/.6);if(G.pt>1.3){G.phase='fight';G.pt=0;}return;}
  if(ph==='fight'){G.ft+=dt;R.t+=dt;PL.inv=Math.max(0,PL.inv-dt);move(dt);buster(inp,dt);if(inp.card>=0)useCard(inp.card);PL.en=Math.min(EMAX,PL.en+dt/EREG);aliens(dt);}
  else G.pt+=dt;
  for(let i=G.later.length-1;i>=0;i--){const l=G.later[i];l.t-=dt;if(l.t<=0){G.later.splice(i,1);if(!(l.src&&l.src.dead)&&G.phase==='fight')l.fn();}}
  for(let i=G.warns.length-1;i>=0;i--){const w=G.warns[i];w.t+=dt;if(w.t<w.at)continue;G.warns.splice(i,1);if((w.src&&w.src.dead)||!w.dmg||G.phase!=='fight')continue;
    for(const t of w.tiles){part(tx(t[0]),.3,tz(t[1]),0,0,0,.25,1.2,.3,COL.red,1,0);if(w.tiles.length<5)boom(tx(t[0]),.5,tz(t[1]),.35,COL.orange);}
    if(w.tiles.length>=5)Snd.play('boom');if(w.tiles.some(onMe))hurt(w.dmg);}
  for(let i=G.ps.length-1;i>=0;i--){const s=G.ps[i];s.c+=s.v*dt;let gone=s.c>6.6;
    for(const e of G.en){if(gone||e.dead||e.r!==s.r||s.hit.has(e)||Math.abs(s.c-e.c)>.45)continue;s.hit.add(e);hurtE(e,s.dmg);if(s.frz)e.frz=Math.max(e.frz,s.frz);
      burst(tx(e.c)-.3,.9,tz(e.r),6,s.k==='ice'?COL.ice:COL.cyan,3,.2,.3);if(!s.pierce)gone=1;}
    if(gone)G.ps.splice(i,1);}
  for(let i=G.es.length-1;i>=0;i--){const s=G.es[i];s.c-=s.v*dt;if(G.phase==='fight'&&s.r===PL.r&&Math.abs(s.c-PL.c)<.42&&!PL.dead){G.es.splice(i,1);hurt(s.dmg);continue;}if(s.c<-.8)G.es.splice(i,1);}
  for(let i=G.arcs.length-1;i>=0;i--){const a=G.arcs[i];a.t+=dt;if(a.tg&&!a.tg.dead){a.x1=a.tg.x;a.z1=a.tg.z;a.y1=1;}if(a.t>=a.dur){G.arcs.splice(i,1);if(a.fn&&G.phase==='fight')a.fn();}}
  if(G.phase==='fight'&&!alive().length){G.phase='clear';G.pt=0;G.warns=[];G.es=[];G.later=[];banner(G.fi===NF-1?'The Eclipse falls':'Fight '+(G.fi+1)+' clear','Clear');Snd.play('clear');}
  if(G.phase==='clear'&&G.pt>1.7)fightWon();
  else if(G.phase==='dead'&&G.pt>2.2)runOver(false);
}
function aliens(dt){const m=DMG*(1+DMGG*G.fi);
  for(const e of G.en){if(e.dead)continue;e.t+=dt;e.fl=Math.max(0,e.fl-dt*5);if(e.dashT>0)e.dashT=Math.max(0,e.dashT-dt);if(e.dash>0)e.dash-=dt;
    if(e.frz>0){e.frz-=dt;continue;}if(e.bz>0){e.bz-=dt;continue;}
    const d=e.d;if(d.mv){e.mt-=dt;if(e.mt<=0){e.mt=d.mv*rand(.8,1.25);hop(e);}}
    // attacks start at least 0.45 s apart, so a crowd never fires everything at once
    e.cd-=dt;if(e.cd<=0){if(G.t-G.lastAtk<.45){e.cd=.2;continue;}const L=e.p2?d.p2:d.a,n=L[e.ai++%L.length];G.lastAtk=G.t;e.bz=ATK[n](e,m);e.cd=d.cd*ACD*rand(.85,1.15)*(e.p2?.8:1);}}}
function hop(e){const n=[[e.c+1,e.r],[e.c-1,e.r],[e.c,e.r+1],[e.c,e.r-1]].filter(([c,r])=>free(c,r,e));
  if(e.boss&&Math.random()<.5){const c=[3,4,5].filter(c=>free(c,PL.r,e));if(c.length){e.c=pick(c);e.r=PL.r;return;}}
  if(n.length){const t=pick(n);e.c=t[0];e.r=t[1];}}
function fightWon(){R.hp=PL.hp;R.fi=G.fi+1;S.best=Math.max(S.best,R.fi);if(R.fi>=NF){runOver(true);return;}R.hp=Math.min(R.max,R.hp+REST);showReward();}

/* ===== REWARDS */
function wpick(ids){let s=0;for(const id of ids)s+=CARDS[id].w;let r=Math.random()*s;for(const id of ids){r-=CARDS[id].w;if(r<=0)return id;}return ids[0];}
// Two new cards plus a repair (when hurt), or else one of: an upgrade for a card you own, a Buster upgrade, more max HP.
function genRewards(){const ids=Object.keys(CARDS),o=[];while(o.length<2){const id=wpick(ids);if(!o.some(x=>x.id===id))o.push({k:'card',id});}
  const ups=[...new Set(R.lib)].filter(id=>(R.up[id]||0)<2),alt=[];if(ups.length)alt.push({k:'up',id:pick(ups)},{k:'up',id:pick(ups)});if(R.bl<4)alt.push({k:'bust'});alt.push({k:'max',n:8});
  o.push(R.hp<R.max*.6?{k:'heal',n:20}:pick(alt));return o;}
function showReward(){state='reward';G.phase='done';clearFight();snap('pick');hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;
  G.opts=genRewards();$('rwEye').textContent='Fight '+R.fi+' / '+NF+' clear · '+R.hp+' / '+R.max+' HP';
  $('rwPicks').innerHTML=G.opts.map((o,i)=>{let c,ic,t,d;
    if(o.k==='card'){const C=CARDS[o.id];c=C.c;ic=C.cost;t=C.n;d=C.d;}
    else if(o.k==='up'){const C=CARDS[o.id],lv=R.up[o.id]||0;c=C.c;ic='+';t='Upgrade '+C.n;
      d=o.id==='ward'?'Ward blocks '+(3+lv)+' hits instead of '+(2+lv)+'.':o.id==='patch'?'Patch repairs '+(C.heal+4*(lv+1))+' HP instead of '+(C.heal+4*lv)+'.':'Every '+C.n+' you own hits for '+Math.round(C.dmg*(1+.35*(lv+1)))+' instead of '+cdmg(o.id)+'.';}
    else if(o.k==='heal'){c=0x5dff9b;ic='+';t='Repair';d='Restore '+o.n+' HP.';}
    else if(o.k==='bust'){c=0x3ef0ff;ic='+';t='Upgrade Buster';d='Charged shots hit for '+(CHARGED+2*R.bl+2)+' instead of '+(CHARGED+2*R.bl)+(R.bl%2?', taps for '+(BUSTER+(R.bl>>1)+1):'')+'.';}
    else{c=0x5dff9b;ic='+';t='Reinforce';d='+'+o.n+' max HP, and repair '+o.n+'.';}
    return '<button data-i="'+i+'" style="--c:'+hex(c)+'"><i>'+ic+'</i><b>'+t+'</b><small>'+d+'</small></button>';}).join('');
  $('rwDeck').innerHTML=deckHtml();$('rwNext').textContent='Next: fight '+(R.fi+1)+' · '+fightName(R.fi);$('reward').hidden=false;Mus.play('calm',0);releaseWake();}
function pickReward(i){const o=G.opts&&G.opts[i];if(!o||state!=='reward')return;
  // a new card joins the collection, and the deck too while there's room
  if(o.k==='card'){R.lib.push(o.id);if(R.deck.length<deckMax())R.deck.push(o.id);}else if(o.k==='up')R.up[o.id]=(R.up[o.id]||0)+1;else if(o.k==='bust')R.bl++;
  else if(o.k==='heal')R.hp=Math.min(R.max,R.hp+o.n);else{R.max+=o.n;R.hp+=o.n;}
  G.opts=null;Snd.play('click');showEdit();}

/* ===== DECK EDITOR */
// Before the first fight and after every reward: tap a deck card to take one copy out, a collection card to put one in.
const groups=a=>{const n={};for(const id of a)n[id]=(n[id]||0)+1;return Object.keys(CARDS).filter(id=>n[id]).map(id=>({id,n:n[id]}));};
function libRest(){const r=R.lib.slice();for(const id of R.deck){const i=r.indexOf(id);if(i>=0)r.splice(i,1);}return r;}
function showEdit(){state='edit';G.phase='done';clearFight();snap('edit');hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;
  $('edit').hidden=false;renderEdit();Mus.play('calm',0);releaseWake();}
function renderEdit(){const mx=deckMax(),n=R.deck.length,full=n>=mx,thin=n<=DECK_MIN;
  $('edEye').textContent='Before fight '+(R.fi+1)+' / '+NF+' · '+R.hp+' / '+R.max+' HP';$('edNext').textContent='Next: '+fightName(R.fi);
  $('edN').textContent=n+' / '+mx;$('edGo').textContent='Start fight '+(R.fi+1);
  const tile=(g,where,off)=>{const C=CARDS[g.id];return '<button class="ec'+(off?' off':'')+'" data-id="'+g.id+'" data-w="'+where+'" style="--c:'+hex(C.c)+'"><i>'+C.cost+'</i><b>'+cname(g.id)+'</b><small>'+cardLine(g.id)+'</small>'+(g.n>1?'<em>×'+g.n+'</em>':'')+'</button>';};
  $('edDeck').innerHTML=groups(R.deck).map(g=>tile(g,'deck',thin)).join('');
  const rest=groups(libRest());$('edLib').innerHTML=rest.length?rest.map(g=>tile(g,'lib',full)).join(''):'<p class="hint">Every card you own is in the deck.</p>';
  $('edHint').textContent=full?'Deck is full: take a card out to put another in.':thin?'Decks need at least '+DECK_MIN+' cards.':'Tap a card to move it. Smaller decks draw their best cards more often.';}
function deckAdd(id){const r=libRest();if(!r.includes(id)||R.deck.length>=deckMax())return false;R.deck.push(id);snap('edit');return true;}
function deckRemove(id){const i=R.deck.indexOf(id);if(i<0||R.deck.length<=DECK_MIN)return false;R.deck.splice(i,1);snap('edit');return true;}
function editDone(){if(state!=='edit')return;Snd.play('click');startFight(R.fi);}
const deckHtml=()=>groups(R.deck).map(g=>'<span style="--c:'+hex(CARDS[g.id].c)+'">'+cname(g.id)+(g.n>1?' ×'+g.n:'')+'</span>').join('');
function runOver(win){state='result';S.run=null;const t=R.t;if(win){S.wins++;if(!S.bestT||t<S.bestT)S.bestT=t;}save();releaseWake();
  const r=$('result');r.className='screen dim '+(win?'win':'lose');$('rEye').textContent=win?'Gauntlet cleared':'Run over';$('rTitle').textContent=win?'Victory':'Comet Kid is down';
  const b=bossOf(G.fi);$('rSub').textContent=win?'All '+NF+' fights, one life. The Eclipse is scrap.':'Fell in fight '+(G.fi+1)+(b?' against the '+BOSS[b].n:'')+'.';
  $('rRows').innerHTML=[['Fights cleared',R.fi+' / '+NF],['Time',fmt(t)],['Deck',R.deck.length+' of '+R.lib.length+' cards'],['Best',S.best+' / '+NF],['Wins',S.wins]].map(x=>'<dt>'+x[0]+'</dt><dd>'+x[1]+'</dd>').join('');
  hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;r.hidden=false;Snd.play(win?'win':'die');Mus.play('calm',0);}

/* ===== DRAW */
let lastHud={};
const _c=new T.Color(),_red=new T.Color(0xff3040),_org=new T.Color(0xff9b3d),_grn=new T.Color(0x5dff9b);
function drawScene(dt,now){const tt=now/1000;
  // shake
  const sk=G.shake*G.shake*.5;camera.position.set(CAMP.x+rand(-sk,sk),CAMP.y+rand(-sk,sk),CAMP.z);
  // tiles: red ramps up as a hit gets closer, orange for a shot about to fly, green for the safe tile
  const dz=new Float32Array(9),tl=new Uint8Array(9),sf=new Uint8Array(9);
  for(const w of G.warns){const k=w.t/w.at;for(const t of w.tiles){const i=t[1]*3+t[0];if(t[0]>2||i<0)continue;if(w.dmg)dz[i]=Math.max(dz[i],k);else tl[i]=1;}if(w.safe)sf[w.safe[1]*3+w.safe[0]]=1;}
  for(const t of TILES){_c.setRGB(0,0,0);let line=t.me?0x3ef0ff:0xff3d7f,op=.55;
    if(t.me){const i=t.r*3+t.c,d=dz[i];
      if(d>0){const f=d>.75?(Math.floor(tt*14)%2?1:.55):1;_c.copy(_red).multiplyScalar((.25+d*.85)*f);line=0xff4d6a;op=.9;}
      else if(tl[i]){_c.copy(_org).multiplyScalar(.35+.15*Math.sin(tt*20));line=0xff9b3d;op=.8;}
      else if(sf[i]){_c.copy(_grn).multiplyScalar(.45);line=0x5dff9b;op=.9;}}
    if(t.fl>0&&t.fc){_c.r+=t.fc[0]*t.fl*1.6;_c.g+=t.fc[1]*t.fl*1.6;_c.b+=t.fc[2]*t.fl*1.6;}
    t.m.emissive.copy(_c);t.lm.color.setHex(line);t.lm.opacity=op;}
  for(const el of mp.children){const c=+el.dataset.c,r=+el.dataset.r,i=r*3+c;el.classList.toggle('at',c===PL.c&&r===PL.r);el.classList.toggle('go',!!PL.dest&&PL.dest[0]===c&&PL.dest[1]===r);el.classList.toggle('dz',dz[i]>0);el.classList.toggle('sf',!!sf[i]);}
  // Comet Kid
  PL.x=lerp(PL.x,tx(PL.c),Math.min(1,dt*28));PL.z=lerp(PL.z,tz(PL.r),Math.min(1,dt*28));
  const flick=PL.inv>0&&Math.floor(tt*20)%2===0;K.g.visible=!PL.dead&&!flick&&state!=='reward';
  const mv=Math.hypot(PL.x-tx(PL.c),PL.z-tz(PL.r))>.05;K.g.position.set(PL.x,0,PL.z);K.g.rotation.y=-.5;
  K.body.position.y=mv?.08:Math.sin(tt*3)*.02;K.legs[0].rotation.z=mv?.5:0;K.legs[1].rotation.z=mv?-.3:0;K.back.rotation.z=.2;
  K.arm.rotation.z=lerp(K.arm.rotation.z,PL.shootT>0||PL.charging&&PL.chg>.15?0:-1.15,Math.min(1,dt*20));
  const full=PL.charging&&PL.chg>=CH;_c.setHex(full&&Math.floor(tt*12)%2?0xffe6b0:0x3ec8ff);K.acc.color.copy(_c);K.base.userData.flash.value=K.acc.userData.flash.value=PL.flash>0?.6:0;
  if(K.g.visible){const mx=PL.x+.6,my=.72,mz=PL.z+.3;
    if(PL.charging&&PL.chg>.15){const lv=full?1:0,s=(.35+lv*.35)*(1+Math.sin(tt*30)*.15);fx.push(mx,my,mz,0,s,s,0,.85,full?COL.hot:COL.cyan);
      if(Math.random()<.5){const a=rand(0,TAU),r=.5+lv*.3;part(mx+Math.cos(a)*r,my+Math.sin(a)*r,mz,-Math.cos(a)*r*4,-Math.sin(a)*r*4,0,.15,.12,.05,full?COL.gold:COL.cyan,0,0);}}
    for(let k=0;k<PL.ward;k++){const a=tt*3+k*TAU/Math.max(1,PL.ward);fx.push(PL.x+Math.cos(a)*.7,.8+Math.sin(a*2)*.1,PL.z+Math.sin(a)*.7,0,.32,.32,0,.9,COL.violet);}
    fx.push(PL.x,.05,PL.z,0,1.4,1.4,0,.25,COL.cyan);}
  // aliens
  for(const e of G.en){const g=e.m.g;
    if(e.dead){e.sc-=dt*3;if(e.sc<=0){g.visible=false;e.tag.hidden=true;continue;}}
    e.x=lerp(e.x,tx(e.c),Math.min(1,dt*12));e.z=lerp(e.z,tz(e.r),Math.min(1,dt*12));
    let x=e.x,y=(e.boss?1.25:.95)+Math.sin(e.t*2.2)*.08;
    if(e.dash>0)x+=Math.sin(tt*60)*.05;
    if(e.dashT>0){const u=1-e.dashT/.4;x-=Math.sin(u*PI)*(e.c+.7)*TS;}
    g.position.set(x,y,e.z);g.scale.setScalar(Math.max(.01,e.sc));g.visible=true;
    if(e.m.anim)e.m.anim(tt,{x,y,ph:e.p2},dt);else g.children[0].children[0].rotation.y=Math.sin(e.t*1.7)*.3;
    e.m.mat.userData.flash.value=Math.max(e.fl*.8,e.frz>0?.35:0);
    if(e.frz>0&&Math.random()<.2)part(x+rand(-.5,.5),y+rand(-.4,.4),e.z,0,.5,0,.5,.18,.05,COL.ice,0,0);
    fx.push(x,.03,e.z,0,e.boss?2:1.2,e.boss?2:1.2,0,.2,e.boss?COL.gold:COL.pink);
    const hp=Math.max(0,Math.ceil(e.hp));if(e.lhp!==hp){e.lhp=hp;e.tag.textContent=hp;}e.tag.classList.toggle('frz',e.frz>0);e.tag.hidden=e.dead||state!=='play';
    const s=toScreen(e.x,0,e.z+TS*.42);e.tag.style.transform='translate('+Math.round(s.x)+'px,'+Math.round(s.y)+'px) translate(-50%,-50%)';}
  // shots
  for(const s of G.ps){const x=tx(0)+s.c*TS,z=tz(s.r);
    if(s.k==='blade'){fx.push(x,.8,z,tt*20,.9,.9,1,.9,COL.lime);fx.push(x,.8,z,0,.4,.4,0,.9,COL.lime);}
    else if(s.k==='nova'){fx.push(x,.8,z,0,1.6,1.6,0,1,COL.hot);fx.push(x-.6,.8,z,PI/2,.5,2.4,2,.8,COL.gold);}
    else if(s.k==='ice'){fx.push(x,.8,z,0,.6,.6,0,1,COL.ice);}
    else{const big=s.lvl||s.k==='card';fx.push(x,.8,z,0,big?.9:.45,big?.75:.4,0,1,s.lvl?COL.hot:s.col||COL.cyan);if(big)fx.push(x-.4,.8,z,PI/2,.25,1.2,2,.8,s.col||COL.cyan);}}
  for(const s of G.es)ebR.push(tx(0)+s.c*TS,.8,tz(s.r),0,.62,.62,0,1,COL.pink);
  for(const a of G.arcs){const u=Math.min(1,a.t/a.dur),x=lerp(a.x0,a.x1,u),z=lerp(a.z0,a.z1,u),y=lerp(a.y0,a.y1,u)+Math.sin(u*PI)*a.h;fx.push(x,y,z,0,.55,.55,0,1,a.c);fx.push(x,y,z,0,.25,.25,0,1,COL.hot);}
  partsTick(dt);
  for(let i=pops.length-1;i>=0;i--){const p=pops[i];p.t+=dt;const s=toScreen(p.x,p.y+p.t*.7,p.z);p.d.style.transform='translate('+Math.round(s.x)+'px,'+Math.round(s.y)+'px) translate(-50%,-50%)';
    p.d.style.opacity=Math.min(1,(1-p.t)*3);if(p.t>1){p.d.remove();pops.splice(i,1);}}
  fx.flush();ebR.flush();renderer.render(scene,camera);}
function setIf(k,v,fn){if(lastHud[k]!==v){lastHud[k]=v;fn(v);}}
function hud(){
  setIf('hp',PL.hp+'/'+PL.max,()=>{$('hHp').textContent=PL.hp+' / '+PL.max;$('hpI').style.transform='scaleX('+(PL.hp/PL.max).toFixed(3)+')';});
  setIf('ward',PL.ward,v=>$('hWard').innerHTML='<i></i>'.repeat(v));
  setIf('en',Math.floor(PL.en*20),()=>{[...$('enBar').children].forEach((el,k)=>el.style.setProperty('--f',clamp(PL.en-k,0,1).toFixed(2)));$('enN').textContent=Math.floor(PL.en);
    for(const el of $('hand').children)if(el.dataset.i!=null&&!el.classList.contains('nx'))el.classList.toggle('off',PL.en<CARDS[PL.hand[+el.dataset.i]].cost);});
  setIf('full',PL.charging&&PL.chg>=CH,v=>$('bBus').classList.toggle('full',v));
  setIf('foe',G.en.filter(e=>!e.dead).length,v=>{if(!G.en.some(e=>e.boss))$('hFoe').textContent=v?v+(v>1?' aliens':' alien'):'';});}
function renderHand(){const h=$('hand');
  h.innerHTML=PL.hand.map((id,i)=>{const C=CARDS[id];return '<button class="card'+(PL.en<C.cost?' off':'')+'" data-i="'+i+'" style="--c:'+hex(C.c)+'"><i class="cost">'+C.cost+'</i><b>'+cname(id)+'</b><small>'+cardLine(id)+'</small></button>';}).join('')+
    (PL.next?'<div class="card nx" style="--c:'+hex(CARDS[PL.next].c)+'"><b>'+cname(PL.next)+'</b></div>':'');lastHud.en=null;}
function toast(txt,c){const t=$('toast');t.textContent=txt;t.style.color='rgb('+c.map(v=>Math.round(v*255)).join(',')+')';t.classList.remove('go');void t.offsetWidth;t.classList.add('go');}
function banner(eye,txt){const b=$('banner');$('banEye').textContent=eye;$('banTxt').textContent=txt;b.classList.remove('go');void b.offsetWidth;b.classList.add('go');}

/* ===== SCREENS */
const SCREENS=['title','reward','edit','pause','result','settings'];
function hideScreens(){for(const s of SCREENS)$(s).hidden=true;}
const fmt=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
// The title shows the field with a couple of idle aliens.
function titleScene(){clearFight();G.phase='title';const m=spawn('mite',4,0,false,1),d=spawn('drone',5,2,false,1);m.sc=d.sc=1;Object.assign(PL,{c:1,r:1,dest:null,dead:0,ward:0,charging:0,inv:0});}
function goTitle(){state='title';hideScreens();document.body.classList.remove('ingame');$('hud').hidden=true;$('title').hidden=false;titleScene();
  const r=S.run;$('tCont').hidden=!r;if(r)$('tCont').textContent='Continue · fight '+Math.min(NF,r.fi+1)+' / '+NF;$('tPlay').classList.toggle('primary',!r);$('tPlay').textContent=r?'New run (replaces it)':'New run';
  $('tBest').textContent=S.best+' / '+NF;$('tWins').textContent=S.wins;Mus.play('calm',0);releaseWake();resize();}
function pause(){if(state!=='play')return;state='paused';clearInput();hideScreens();$('pause').hidden=false;$('pTitle').textContent=(bossOf(G.fi)?'Guardian ':'Fight ')+(G.fi+1)+' / '+NF;
  $('pDeck').innerHTML=deckHtml();Snd.suspend();releaseWake();}
function resume(){if(state!=='paused')return;hideScreens();state='play';clearInput();Snd.resume();last=performance.now();acc=0;requestWake();}
let settingsFrom='title',confirmReset=false;
function openSettings(from){settingsFrom=from;$(from).hidden=true;$('settings').hidden=false;confirmReset=false;renderSettings();}
function renderSettings(){for(const t of document.querySelectorAll('#settings .tog'))t.classList.toggle('on',!!S.set[t.dataset.set]);$('setReset').textContent=confirmReset?'Tap again to erase everything':'Reset all progress';}

/* ----- buttons */
document.addEventListener('click',e=>{if(e.target.closest('button'))Snd.init();},true);
document.addEventListener('pointerdown',()=>Snd.init(),{once:true});
$('tPlay').onclick=()=>{Snd.play('click');newRun();};
$('tCont').onclick=()=>{Snd.play('click');continueRun();};
$('tSet').onclick=()=>openSettings('title');
if(window.ARCADE){$('tArc').hidden=false;$('tArc').onclick=()=>{save();location.href=window.ARCADE.home;};}
$('rwPicks').onclick=e=>{const b=e.target.closest('button');if(b)pickReward(+b.dataset.i);};
$('edit').addEventListener('click',e=>{const b=e.target.closest('.ec');if(!b)return;const ok=b.dataset.w==='deck'?deckRemove(b.dataset.id):deckAdd(b.dataset.id);Snd.play(ok?'click':'empty');if(ok)renderEdit();});
$('edGo').onclick=editDone;
$('bPause').addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();pause();});
$('pRes').onclick=resume;
$('pSet').onclick=()=>openSettings('pause');
$('pQuit').onclick=()=>{Snd.resume();R.fi=G.fi;S.best=Math.max(S.best,R.fi);runOver(false);};
$('rNew').onclick=()=>{Snd.play('click');newRun();};
$('rTitleB').onclick=()=>goTitle();
$('setClose').onclick=()=>{$('settings').hidden=true;$(settingsFrom).hidden=false;};
$('settings').addEventListener('click',e=>{
  const t=e.target.closest('.tog');if(t){const k=t.dataset.set;S.set[k]=!S.set[k];Snd.apply();if(k==='vibe'&&S.set.vibe)vibe(30);if(k==='music'&&!S.set.music)Mus.stop();else if(k==='music'&&Mus.want)Mus.play(Mus.want[0],Mus.want[1]);save();renderSettings();return;}
  if(e.target.id==='setReset'){if(!confirmReset){confirmReset=true;renderSettings();return;}const keep=S.set;S=fresh();S.set=keep;save();confirmReset=false;$('settings').hidden=true;goTitle();}});
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
  else if(state==='title')for(const e of G.en)e.t+=dt;
  Mus.tick();drawScene(state==='paused'?0:dt,now);
}

/* ===== BOOT */
resize();goTitle();requestAnimationFrame(t=>{last=t;frame(t);});
// Test hook. step(dt) runs fixed ticks; auto = (PL, G) => ({dest:[c,r], b: buster held, card: hand index}) replaces player input;
// god 1 = no damage, 2 = can't die.
window.__tactics={get S(){return S;},get R(){return R;},G,PL,CARDS,ET,BOSS,FIGHTS,ATK,consts:{TS,FIX,HMAX,EMAX,EREG,CH,BCD,STEP,INV,BUSTER,CHARGED,REST,DECK_MIN,HPG,DMGG},
  newRun,startFight,continueRun,showReward,pickReward,showEdit,deckAdd,deckRemove,editDone,deckMax,bossOf,useCard,hurtE,goTitle,pause,resume,tick,alive,
  step(dt){let n=Math.round(dt/FIX);while(n-->0&&state==='play')tick();},get state(){return state;},set auto(f){auto=f;},get auto(){return auto;},
  set god(v){G.god=v;},get god(){return G.god;},killAll(){for(const e of alive())hurtE(e,999);}};
})();
