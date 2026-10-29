/* Arcade kit: the pieces every game shares. Loaded after three.js and before each game, as window.ARC.
   - The low-poly model builder and its material (flat shading, per-part colors, unlit glowing parts, hit flash).
   - Starwake's aliens and bosses, so every game fights the same cast.
   - Instanced glow quads (particles, bullets, beams) and their shaders.
   - The synthesizer: sound effects and the chiptune music generator.
   - Phone tilt input for motion-controlled games. */
window.ARC=(function(){
'use strict';
const T=THREE, TAU=Math.PI*2, PI=Math.PI;

/* ================================================================ MODEL BUILDER */
const P={box:(w,h,d)=>new T.BoxGeometry(w,h,d),cone:(r,h,s)=>new T.ConeGeometry(r,h,s||6),cyl:(a,b,h,s)=>new T.CylinderGeometry(a,b,h,s||8),
  oct:r=>new T.OctahedronGeometry(r),ico:(r,d)=>new T.IcosahedronGeometry(r,d||0),tet:r=>new T.TetrahedronGeometry(r),
  tor:(r,t,a,b)=>new T.TorusGeometry(r,t,a||4,b||14)};
// A part and its mirror image across x=0.
const M=pt=>[pt,Object.assign({},pt,{p:[-pt.p[0],pt.p[1],pt.p[2]],r:pt.r?[pt.r[0],-pt.r[1],-pt.r[2]]:undefined})];
const _m4=new T.Matrix4(),_q=new T.Quaternion(),_e=new T.Euler(),_p=new T.Vector3(),_s=new T.Vector3(),_c=new T.Color();
// Merge primitives into one flat-shaded geometry with per-vertex color and an emissive flag.
// Part: {g: geometry, c: hex color, p: position, r: euler rotation, s: scale, e: 1 = glows}.
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
// Lambert + vertex colors, emissive parts drawn unlit, white hit-flash: per instance (inst, aFlash attribute) or per material (userData.flash).
function makeMat(inst,opts){
  const m=new T.MeshLambertMaterial(Object.assign({vertexColors:true},opts||{}));const uFlash={value:0};m.userData.flash=uFlash;
  m.onBeforeCompile=sh=>{
    sh.uniforms.uFlash=uFlash;
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float aEmis;varying float vEmis;'+(inst?'attribute float aFlash;varying float vFlash;':''))
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvEmis=aEmis;'+(inst?'vFlash=aFlash;':''));
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vEmis;'+(inst?'varying float vFlash;':'uniform float uFlash;'))
      .replace('#include <dithering_fragment>','gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(vColor*1.25,1.0)).rgb,vEmis);\ngl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(1.0,.96,.9),'+(inst?'vFlash':'uFlash')+');\n#include <dithering_fragment>');
  };
  m.customProgramCacheKey=()=>(inst?'arc-inst':'arc-solo')+(opts&&opts.transparent?'-t':'');
  return m;
}

/* ================================================================ THE CAST */
// Aliens, modelled facing +y with +z toward the viewer. ALIENS[type]() returns a fresh geometry.
const ALIENS={
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
/* Bosses, modelled facing -y. BOSSES[name](mat) returns {group, anim(t,b,dt)}; every part shares mat so the whole boss flashes.
   b needs x, y and ph (phase index). If b.ax/b.ay are set, the Warden's turrets track that point; otherwise they sweep. */
function bmesh(parts,mat){return new T.Mesh(geo(parts),mat);}
const BOSSES={
 warden(mat){const g=new T.Group();
  g.add(bmesh([{g:P.box(3.4,1.5,.7),c:0x3a3f66},{g:P.box(2.2,1,.5),c:0x5a6290,p:[0,.9,.1]},{g:P.cone(.7,1.4,4),c:0x8a92c8,p:[0,-1.3,0],r:[0,0,PI]},
    M({g:P.box(1.3,.9,.4),c:0x262a48,p:[2,.5,0]}),M({g:P.box(.25,1.2,.25),c:0xff8a3d,e:1,p:[1.1,-.2,.38]}),M({g:P.cyl(.22,.3,.5,6),c:0x1b1d33,p:[.8,1.55,0]}),
    M({g:P.cone(.18,.4,6),c:0xff9b3d,e:1,p:[.8,2,0]})],mat));
  const core=bmesh([{g:P.oct(.5),c:0xff9b3d,e:1,s:[1,1,.6]}],mat);core.position.set(0,-.1,.45);
  const tur=[-1.9,1.9].map(x=>{const t=bmesh([{g:P.cyl(.45,.55,.3,8),c:0x5a6290,r:[PI/2,0,0]},{g:P.box(.18,.9,.18),c:0x1b1d33,p:[0,.5,.25]},{g:P.box(.24,.16,.24),c:0xff3d55,e:1,p:[0,.95,.25]}],mat);t.position.set(x,-.3,.35);g.add(t);return t;});
  g.add(core);
  return{group:g,anim(t,b){core.scale.setScalar(1+Math.sin(t*6)*.12);
    for(const u of tur)u.rotation.z=b.ax!=null?Math.atan2(b.ay-(b.y+u.position.y),b.ax-(b.x+u.position.x))-PI/2:Math.sin(t*1.3+u.position.x)*.5+PI;}};},
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
  return{group:g,anim(t){const o=.25+Math.sin(t*5)*.2;md[0].rotation.z=-o;md[1].rotation.z=o;}};},
 eclipse(mat){const g=new T.Group();
  g.add(bmesh([{g:P.ico(1.5,1),c:0x23203f}],mat));
  const core=bmesh([{g:P.oct(.8),c:0xfff0c0,e:1}],mat);core.position.z=.9;
  const r1=bmesh([{g:P.tor(2.2,.12,4,24),c:0xffc531,e:1}],mat), r2=bmesh([{g:P.tor(2.7,.08,4,24),c:0xff3d7f,e:1}],mat);
  const sat=new T.Group();const sp=[];for(let i=0;i<4;i++){const a=i*TAU/4;sp.push({g:P.oct(.3),c:0x8a92c8,p:[Math.cos(a)*3.2,Math.sin(a)*3.2,0]},{g:P.oct(.12),c:0xff3d7f,e:1,p:[Math.cos(a)*3.2,Math.sin(a)*3.2,.25]});}
  sat.add(bmesh(sp,mat));g.add(core,r1,r2,sat);
  return{group:g,anim(t,b,dt){r1.rotation.x=Math.sin(t*.7)*.6;r1.rotation.y=Math.cos(t*.5)*.4;r2.rotation.x=Math.cos(t*.6)*.7;r2.rotation.y=-Math.sin(t*.8)*.5;
    sat.rotation.z+=dt*(.5+b.ph*.3);core.scale.setScalar(1+Math.sin(t*7)*.1);core.rotation.z+=dt;}};},
};
const disposeGroup=g=>g.traverse(o=>{if(o.geometry)o.geometry.dispose();});

/* ================================================================ GLOW BATCHES (instanced quads, rebuilt every frame) */
// Per instance: iA = x,y,z,rotation; iB = width,height,shape,alpha; iC = color.
const VS_HEAD='attribute vec4 iA;attribute vec4 iB;attribute vec3 iC;varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n';
const VS_ROT='vUv=position.xy*2.0;float c=cos(iA.w),s=sin(iA.w);vec2 p=position.xy*iB.xy;p=vec2(c*p.x-s*p.y,s*p.x+c*p.y);\n';
// Quads lying in the XY plane (Starwake's camera looks down -z at that plane).
const VS_PLANE=VS_HEAD+'void main(){'+VS_ROT+'gl_Position=projectionMatrix*viewMatrix*vec4(iA.xy+p,iA.z,1.0);vC=iC;vA=iB.w;vS=iB.z;}';
// Shapes under 10 face the camera, nudged toward it by uLift so they never clip into the ground; shape + 10 lies flat on z.
const VS_ISO='uniform float uLift;'+VS_HEAD+'void main(){'+VS_ROT+'float fl=step(9.5,iB.z);vS=iB.z-fl*10.0;\n'+
 'if(fl>0.5){gl_Position=projectionMatrix*viewMatrix*vec4(iA.xy+p,iA.z,1.0);}\n'+
 'else{vec4 mv=viewMatrix*vec4(iA.xyz,1.0);mv.xy+=p;mv.z+=uLift;gl_Position=projectionMatrix*mv;}\nvC=iC;vA=iB.w;}';
// Additive glows. Shape 0 glow, 1 ring, 2 streak, 3 chevron.
const FX_FS='varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){float d=length(vUv);float a;float core;\n'+
 'if(vS<0.5){if(d>1.0)discard;a=exp(-d*d*4.5)*(1.0-d);core=smoothstep(0.32,0.0,d);}\n'+
 'else if(vS<1.5){if(d>1.0)discard;float k=(d-0.78)*7.0;a=exp(-k*k)*(1.0-d*0.6);core=0.0;}\n'+
 'else if(vS<2.5){float x=abs(vUv.x);float y=abs(vUv.y);a=exp(-x*x*5.0)*(1.0-smoothstep(0.75,1.0,y));core=smoothstep(0.25,0.0,x)*(1.0-smoothstep(0.6,1.0,y));}\n'+
 'else{float x=abs(vUv.x);float k=vUv.y+x*0.9-0.2;a=exp(-k*k*28.0)*(1.0-smoothstep(0.7,1.0,x));core=0.0;}\n'+
 'gl_FragColor=vec4(mix(vC,vec3(1.0),core*0.85),max(a,core)*vA);}';
// Enemy bullets: a dark-bodied orb with a bright rim, readable on any background.
const EB_FS='varying vec2 vUv;varying vec3 vC;varying float vA;varying float vS;\n'+
 'void main(){float d=length(vUv);if(d>1.0)discard;float body=1.0-smoothstep(0.52,0.6,d);float edge=1.0-smoothstep(0.68,0.76,d);\n'+
 'vec3 col=mix(vC,vec3(1.0),1.0-smoothstep(0.12,0.36,d));col=mix(vec3(0.06,0.02,0.1),col,body);\n'+
 'float glow=exp(-d*d*5.0)*0.55*(1.0-d);float a=max(edge,glow);gl_FragColor=vec4(mix(vC,col,edge),a*vA);}';
class Batch{
  // o: {vs, blend, order, lift, depth}
  constructor(scene,cap,fs,o){o=o||{};
    const g=new T.InstancedBufferGeometry(),pl=new T.PlaneGeometry(1,1);g.index=pl.index;g.setAttribute('position',pl.getAttribute('position'));
    this.A=new Float32Array(cap*4);this.Bb=new Float32Array(cap*4);this.C=new Float32Array(cap*3);
    this.aA=new T.InstancedBufferAttribute(this.A,4).setUsage(T.DynamicDrawUsage);this.aB=new T.InstancedBufferAttribute(this.Bb,4).setUsage(T.DynamicDrawUsage);
    this.aC=new T.InstancedBufferAttribute(this.C,3).setUsage(T.DynamicDrawUsage);
    g.setAttribute('iA',this.aA);g.setAttribute('iB',this.aB);g.setAttribute('iC',this.aC);g.instanceCount=0;
    this.mesh=new T.Mesh(g,new T.ShaderMaterial({uniforms:{uLift:{value:o.lift||0}},vertexShader:o.vs||VS_PLANE,fragmentShader:fs,transparent:true,depthWrite:false,
      depthTest:o.depth!==false,blending:o.blend!=null?o.blend:T.AdditiveBlending}));
    this.mesh.frustumCulled=false;this.mesh.renderOrder=o.order||0;this.g=g;this.cap=cap;this.n=0;scene.add(this.mesh);
  }
  push(x,y,z,rot,sx,sy,sh,a,c){if(this.n>=this.cap)return;const i=this.n++,k=i*4,j=i*3,A=this.A,Bb=this.Bb,C=this.C;
    A[k]=x;A[k+1]=y;A[k+2]=z;A[k+3]=rot;Bb[k]=sx;Bb[k+1]=sy;Bb[k+2]=sh;Bb[k+3]=a;C[j]=c[0];C[j+1]=c[1];C[j+2]=c[2];}
  flush(){const n=this.n;this.g.instanceCount=n;
    for(const [at,sz] of [[this.aA,4],[this.aB,4],[this.aC,3]]){at.updateRange.offset=0;at.updateRange.count=Math.max(1,n*sz);at.needsUpdate=true;}this.n=0;}
}

/* ================================================================ SYNTH */
const mtof=m=>440*Math.pow(2,(m-69)/12);
/* Sound effects. o.sounds = {name(snd, startTime, arg)} built from snd.osc and snd.nz; o.thr = minimum seconds between repeats;
   o.sfx() / o.music() = whether each is switched on; o.onInit runs once audio exists (browsers need a tap first). */
function synth(o){return{ctx:null,last:{},
  init(){if(this.ctx){this.resume();return;}const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    try{this.ctx=new AC();}catch(e){return;}const c=this.ctx;
    this.comp=c.createDynamicsCompressor();this.comp.threshold.value=-14;this.comp.ratio.value=4;this.comp.connect(c.destination);
    this.sfx=c.createGain();this.mus=c.createGain();this.sfx.connect(this.comp);this.mus.connect(this.comp);
    const buf=c.createBuffer(1,c.sampleRate,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.nb=buf;
    this.apply();if(o.onInit)o.onInit();},
  musicOn:()=>o.music(),
  apply(){if(!this.ctx)return;this.sfx.gain.value=o.sfx()?.5:0;this.mus.gain.value=o.music()?.2:0;},
  resume(){if(this.ctx&&this.ctx.state!=='running')this.ctx.resume().catch(()=>{});},
  suspend(){if(this.ctx&&this.ctx.state==='running')this.ctx.suspend().catch(()=>{});},
  osc(type,f0,f1,t,dur,vol,dest){const c=this.ctx,os=c.createOscillator(),g=c.createGain();os.type=type;os.frequency.setValueAtTime(f0,t);
    if(f1&&f1!==f0)os.frequency.exponentialRampToValueAtTime(f1,t+dur);g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
    os.connect(g);g.connect(dest||this.sfx);os.start(t);os.stop(t+dur+.03);},
  nz(t,dur,vol,ft,f0,f1,dest,q){const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=this.nb;f.type=ft;
    f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);if(q)f.Q.value=q;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);s.connect(f);f.connect(g);g.connect(dest||this.sfx);s.start(t,Math.random()*.5);s.stop(t+dur+.03);},
  // A sustained filtered-noise voice (engines, wind). Returns {set(volume, filterHz)}, or null before audio exists.
  loop(type,hz){if(!this.ctx)return null;const c=this.ctx,s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    s.buffer=this.nb;s.loop=true;f.type=type||'lowpass';f.frequency.value=hz||600;g.gain.value=0;s.connect(f);f.connect(g);g.connect(this.sfx);s.start();
    return{set(v,fq){const t=c.currentTime;g.gain.setTargetAtTime(v,t,.04);if(fq)f.frequency.setTargetAtTime(fq,t,.05);}};},
  play(n,a){const c=this.ctx;if(!c||!o.sfx()||c.state!=='running')return;const now=c.currentTime,th=(o.thr&&o.thr[n])||0;
    if(this.last[n]&&now-this.last[n]<th)return;this.last[n]=now;const f=o.sounds[n];if(f)f(this,now+.005,a);}
};}
/* Chiptune generator: bass, arpeggio and drums over a four-bar progression. o.level(i) = {key, bpm, prog};
   modes: 'level', 'boss' (faster, minor), 'calm' (menus). o.calmBpm and o.calmBass tune the calm mode. */
function music(snd,o){return{on:false,mode:'',step:0,next:0,bpm:128,key:45,prog:[0,8,3,10],want:null,
  play(mode,lvl){const L=o.level(lvl||0);this.want=[mode,lvl];if(!snd.ctx)return;if(this.on&&this.mode===mode&&this.key===L.key)return;this.mode=mode;this.key=L.key;
    this.bpm=mode==='boss'?L.bpm+18:mode==='calm'?(o.calmBpm||96):L.bpm;this.prog=mode==='boss'?[0,1,0,-2]:L.prog;this.on=true;this.step=0;this.next=snd.ctx.currentTime+.1;},
  stop(){this.on=false;},
  tick(){const c=snd.ctx;if(!this.on||!c||c.state!=='running'||!snd.musicOn())return;const st=60/this.bpm/4;
    if(this.next<c.currentTime-.25)this.next=c.currentTime+.05;
    while(this.next<c.currentTime+.18){this.note(this.step,this.next,st);this.next+=st;this.step++;}},
  note(i,t,st){const s=i%16,bar=(i>>4)%4,root=this.key+this.prog[bar],D=snd.mus,calm=this.mode==='calm',boss=this.mode==='boss';
    const ch=(bar===0||boss)?[0,3,7,10]:[0,4,7,11];
    if(s%2===0)snd.osc('triangle',mtof(root+(s%8===6?12:0)),0,t,st*1.8,calm?(o.calmBass||.3):.3,D);
    if(!calm||s%2===0){const n=root+24+ch[(calm?s>>1:s)%4]+((s>>2)%2?12:0);snd.osc('square',mtof(n),0,t,st*.9,calm?.03:.04,D);}
    if(!calm){if(s%4===0)snd.osc('sine',150,45,t,.16,.5,D);if(boss&&s%4===2)snd.osc('sine',150,45,t,.12,.3,D);
      if(s===4||s===12)snd.nz(t,.12,.2,'bandpass',1800,0,D,1);if(s%2===1)snd.nz(t,.035,.07,'highpass',7000,0,D);}
    else if(s===0)snd.osc('sine',110,40,t,.3,.22,D);}
};}
function vibe(on,ms){if(!on||!navigator.vibrate)return;try{navigator.vibrate(ms);}catch(e){}}

/* ================================================================ MOTION (phone tilt) */
/* motion.read() = left-right tilt in radians relative to calibrate(), positive = right side down. It works however the phone
   is held, upright like a steering wheel or flat like a tray, because it uses the gravity vector rather than raw Euler angles.
   iOS only grants sensor access from inside a tap, so call motion.start() from a button handler; it resolves true when
   permission is granted. motion.live says whether readings are actually arriving (false on desktops). */
const motion={ok:false,on:false,denied:false,raw:0,zero:0,last:0,
  start(){const D=window.DeviceOrientationEvent;if(!D)return Promise.resolve(false);
    const go=()=>{if(!this.on){this.on=true;window.addEventListener('deviceorientation',e=>this.ev(e));}return true;};
    if(typeof D.requestPermission==='function')return D.requestPermission().then(r=>{if(r==='granted')return go();this.denied=true;return false;}).catch(()=>{this.denied=true;return false;});
    return Promise.resolve(go());},
  ev(e){if(e.beta==null||e.gamma==null)return;const b=e.beta*PI/180,g=e.gamma*PI/180;
    // Gravity in device coordinates (W3C z-x'-y'' order), then turned into screen coordinates if the screen is rotated.
    const gx=Math.sin(g)*Math.cos(b),gy=-Math.sin(b),a=((screen.orientation&&screen.orientation.angle)||window.orientation||0)*PI/180;
    const sx=gx*Math.cos(a)-gy*Math.sin(a);this.raw=Math.asin(Math.max(-1,Math.min(1,sx)));this.ok=true;this.last=performance.now();},
  calibrate(){this.zero=this.raw;},
  get live(){return this.ok&&performance.now()-this.last<1500;},
  read(){return this.raw-this.zero;}};

return{P,M,geo,makeMat,ALIENS,BOSSES,disposeGroup,Batch,VS_PLANE,VS_ISO,FX_FS,EB_FS,synth,music,mtof,vibe,motion};
})();
