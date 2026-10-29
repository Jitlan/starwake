/* __TITLE__: a starting point for an arcade game. Everything is generated in code; THREE is loaded before this file. */
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

/* ---------------------------------------------------------------- LOW-POLY MODELS
   The arcade look: primitives merged into one flat-shaded mesh, per-part colors, and parts flagged e:1 drawn unlit so they glow. */
const P={box:(w,h,d)=>new T.BoxGeometry(w,h,d),oct:r=>new T.OctahedronGeometry(r),ico:(r,d)=>new T.IcosahedronGeometry(r,d||0),tor:(r,t,a,b)=>new T.TorusGeometry(r,t,a||4,b||14)};
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color();
function geo(parts){
  const Pp=[],N=[],C=[],E=[];const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),ab=new T.Vector3(),cb=new T.Vector3();
  for(const pt of parts){const g=pt.g.index?pt.g.toNonIndexed():pt.g,pos=g.getAttribute('position'),p=pt.p||[0,0,0],r=pt.r||[0,0,0],s=pt.s||[1,1,1];
    _m4.compose(_p.set(p[0],p[1],p[2]),_q.setFromEuler(_e.set(r[0],r[1],r[2])),_s.set(s[0],s[1],s[2]));_c.setHex(pt.c);
    for(let i=0;i<pos.count;i+=3){a.fromBufferAttribute(pos,i).applyMatrix4(_m4);b.fromBufferAttribute(pos,i+1).applyMatrix4(_m4);c.fromBufferAttribute(pos,i+2).applyMatrix4(_m4);
      cb.subVectors(c,b);ab.subVectors(a,b);cb.cross(ab).normalize();
      for(const v of [a,b,c]){Pp.push(v.x,v.y,v.z);N.push(cb.x,cb.y,cb.z);C.push(_c.r,_c.g,_c.b);E.push(pt.e?1:0);}}}
  const out=new T.BufferGeometry();out.setAttribute('position',new T.Float32BufferAttribute(Pp,3));out.setAttribute('normal',new T.Float32BufferAttribute(N,3));
  out.setAttribute('color',new T.Float32BufferAttribute(C,3));out.setAttribute('aEmis',new T.Float32BufferAttribute(E,1));return out;
}
function makeMat(){const m=new T.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aEmis;varying float vEmis;').replace('#include <begin_vertex>','#include <begin_vertex>\nvEmis=aEmis;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEmis;').replace('#include <dithering_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(vColor*1.25,1.0)).rgb,vEmis);\n#include <dithering_fragment>');};
  return m;}
const MAT=makeMat();
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
