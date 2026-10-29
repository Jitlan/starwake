/* __TITLE__: a starting point for an arcade game. Everything is generated in code; THREE and ARC (shared/kit.js) load before this file. */
(function(){
'use strict';
const T=THREE, TAU=Math.PI*2;
const $=id=>document.getElementById(id), rand=(a,b)=>a+Math.random()*(b-a);

/* ---------------------------------------------------------------- SAVE (one localStorage key per game) */
const KEY='__ID__.save.v1';
function fresh(){return{v:1,best:0};}
function load(){try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.v===1)return Object.assign(fresh(),s);}catch(e){}return fresh();}
let S=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}

/* ---------------------------------------------------------------- RENDERER */
const cv=$('cv'),DPR=Math.min(2,window.devicePixelRatio||1);
const renderer=new T.WebGLRenderer({canvas:cv,antialias:DPR<1.5});
const scene=new T.Scene();scene.background=new T.Color(0x07061a);
const camera=new T.PerspectiveCamera(50,1,.1,200);camera.position.set(0,0,14);
const hemi=new T.HemisphereLight(0xc8d4ff,0x3a2050,1.3);hemi.position.set(0,0,1);
const sun=new T.DirectionalLight(0xffffff,2.3);sun.position.set(-3,4,8);scene.add(hemi,sun);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setPixelRatio(DPR);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}

/* ---------------------------------------------------------------- MODELS
   window.ARC (shared/kit.js) has the arcade look: ARC.geo merges primitives into one flat-shaded mesh with per-part colors,
   parts flagged e:1 glow, and ARC.makeMat() is the material for it. ARC.ALIENS and ARC.BOSSES are Starwake's cast;
   ARC.Batch draws glow particles and ARC.synth / ARC.music make sound. */
const {P,geo}=ARC,MAT=ARC.makeMat(false);
const SHAPE=geo([{g:P.oct(.6),c:0x3ef0ff,s:[1,1,.7]},{g:P.tor(.85,.07,3,16),c:0xff3d7f,e:1},{g:P.oct(.2),c:0xffd23d,e:1,p:[0,0,.35]}]);

/* ---------------------------------------------------------------- GAME */
let state='title',score=0;
const shapes=[];
// Half the visible width and height at z=0, minus a margin, so shapes bounce off the screen edges.
const bounds=()=>{const h=Math.tan(camera.fov*Math.PI/360)*camera.position.z;return{x:h*camera.aspect-.9,y:h-.9};};
function spawn(){const B=bounds(),m=new T.Mesh(SHAPE,MAT);m.position.set(rand(-B.x,B.x),rand(-B.y,B.y),0);m.userData={vx:rand(-1,1),vy:rand(-1,1),w:rand(-2,2)};scene.add(m);shapes.push(m);}
function start(){for(const m of shapes)scene.remove(m);shapes.length=0;for(let i=0;i<8;i++)spawn();score=0;state='play';$('title').hidden=true;$('hud').hidden=false;$('hScore').textContent='0';}
function step(dt){const B=bounds();for(const m of shapes){const u=m.userData;m.position.x+=u.vx*dt;m.position.y+=u.vy*dt;m.rotation.z+=u.w*dt;m.rotation.x+=dt*.5;
  if(Math.abs(m.position.x)>B.x)u.vx=-Math.sign(m.position.x)*Math.abs(u.vx);if(Math.abs(m.position.y)>B.y)u.vy=-Math.sign(m.position.y)*Math.abs(u.vy);}}
const ray=new T.Raycaster(),ndc=new T.Vector2();
cv.addEventListener('pointerdown',e=>{if(state!=='play')return;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects(shapes)[0];if(hit){scene.remove(hit.object);shapes.splice(shapes.indexOf(hit.object),1);spawn();score++;$('hScore').textContent=score;if(score>S.best){S.best=score;save();}}});

/* ---------------------------------------------------------------- SCREENS & LIFECYCLE */
function pause(){if(state!=='play')return;state='paused';$('pause').hidden=false;save();}
$('tPlay').onclick=start;
$('bPause').onclick=pause;
$('pRes').onclick=()=>{state='play';$('pause').hidden=true;last=performance.now();};
$('pQuit').onclick=()=>{state='title';$('pause').hidden=true;$('hud').hidden=true;$('title').hidden=false;};
// window.ARCADE is only set when the game runs inside the arcade app (see tools/build.py).
if(window.ARCADE){$('tArc').hidden=false;$('tArc').onclick=()=>{save();location.href=window.ARCADE.home;};}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('resize',resize);
document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});

let last=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-last)/1000);last=now;if(state==='play')step(dt);renderer.render(scene,camera);}
resize();requestAnimationFrame(frame);
})();
