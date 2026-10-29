// Renders every icon with canvas 2D (needs Playwright): run `node tools/make_icons.js` from the repo root.
//   icons/                   the arcade app icons (the Starwake ship, since the app grew out of Starwake)
//   games/<id>/icon.png      each game's card art on the arcade launcher, for every game that has a drawer below
const {chromium}=require('playwright');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
// Each drawer paints a 512x512 square. mask = keep the art inside the maskable-icon safe zone.
const DRAW={
 starwake:`(g,mask)=>{
   const bg=g.createRadialGradient(256,150,20,256,256,380);bg.addColorStop(0,'#1d1760');bg.addColorStop(1,'#07061a');g.fillStyle=bg;g.fillRect(0,0,512,512);
   let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
   for(let i=0;i<60;i++){g.globalAlpha=.25+r()*.6;g.fillStyle='#cfd8ff';const z=r()*2.4+.6;g.fillRect(r()*512,r()*512,z,z);}g.globalAlpha=1;
   const k=mask?.78:1;g.translate(256,268);g.scale(k,k);g.translate(-256,-268);
   const ship=(dx,dy,fill)=>{g.save();g.translate(dx,dy);g.fillStyle=fill;g.beginPath();
     g.moveTo(256,70);g.lineTo(300,250);g.lineTo(420,330);g.lineTo(420,370);g.lineTo(300,340);g.lineTo(285,400);g.lineTo(227,400);g.lineTo(212,340);g.lineTo(92,370);g.lineTo(92,330);g.lineTo(212,250);g.closePath();g.fill();g.restore();};
   ship(16,16,'#ff3d7f');ship(0,0,'#3ef0ff');
   g.fillStyle='#07061a';g.beginPath();g.moveTo(256,150);g.lineTo(276,250);g.lineTo(256,282);g.lineTo(236,250);g.closePath();g.fill();
   for(const x of [240,272]){const fl=g.createRadialGradient(x,420,2,x,420,40);fl.addColorStop(0,'rgba(255,230,176,1)');fl.addColorStop(.4,'rgba(255,155,61,.8)');fl.addColorStop(1,'rgba(255,155,61,0)');g.fillStyle=fl;g.fillRect(x-40,390,80,80);}
 }`,
 wreckwatch:`(g)=>{
   const bg=g.createRadialGradient(256,140,20,256,256,380);bg.addColorStop(0,'#1d1760');bg.addColorStop(1,'#07061a');g.fillStyle=bg;g.fillRect(0,0,512,512);
   let seed=11;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
   for(let i=0;i<50;i++){g.globalAlpha=.25+r()*.6;g.fillStyle='#cfd8ff';const z=r()*2.4+.6;g.fillRect(r()*512,r()*512,z,z);}g.globalAlpha=1;
   const poly=(pts,fill)=>{g.fillStyle=fill;g.beginPath();g.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)g.lineTo(pts[i],pts[i+1]);g.closePath();g.fill();};
   const cx=256,cy=300,hw=200,hh=118,d=70;
   // the rock: iso top face, two cliff faces and a jagged underside
   poly([cx-hw,cy,cx,cy+hh,cx,cy+hh+d,cx-hw,cy+d],'#262d60');poly([cx,cy+hh,cx+hw,cy,cx+hw,cy+d,cx,cy+hh+d],'#161b40');
   poly([cx-hw*.7,cy+d+hh*.3,cx-hw*.35,cy+d+hh*.5,cx-hw*.52,cy+d+hh*.9],'#161b40');poly([cx+hw*.2,cy+hh+d,cx+hw*.5,cy+d+hh*.4,cx+hw*.3,cy+hh+d+60],'#10142f');
   poly([cx-hw,cy,cx,cy-hh,cx+hw,cy,cx,cy+hh],'#46558f');
   g.strokeStyle='#2c3668';g.lineWidth=3;
   for(let i=1;i<5;i++){const t=i/5;g.beginPath();g.moveTo(cx-hw+hw*t,cy-hh*t);g.lineTo(cx+hw*t,cy+hh-hh*t);g.stroke();g.beginPath();g.moveTo(cx-hw+hw*t,cy+hh*t);g.lineTo(cx+hw*t,cy-hh+hh*t);g.stroke();}
   // the wreck, nose up and to the right
   g.save();g.translate(250,292);g.rotate(.62);g.scale(.56,.56);
   g.fillStyle='rgba(0,0,10,.45)';g.beginPath();g.ellipse(18,30,150,80,0,0,7);g.fill();
   const ship=(dx,dy,fill)=>{g.save();g.translate(dx-256,dy-250);g.fillStyle=fill;g.beginPath();
     g.moveTo(256,70);g.lineTo(300,250);g.lineTo(420,330);g.lineTo(420,370);g.lineTo(300,340);g.lineTo(285,400);g.lineTo(227,400);g.lineTo(212,340);g.lineTo(150,350);g.lineTo(170,300);g.lineTo(212,250);g.closePath();g.fill();g.restore();};
   ship(14,14,'#2e3a8c');ship(0,0,'#e8eefc');
   g.fillStyle='#3ef0ff';g.beginPath();g.moveTo(0,-90);g.lineTo(20,10);g.lineTo(0,32);g.lineTo(-20,10);g.closePath();g.fill();
   for(const x of [-16,16]){const fl=g.createRadialGradient(x,170,2,x,170,36);fl.addColorStop(0,'rgba(255,230,176,1)');fl.addColorStop(.4,'rgba(255,155,61,.8)');fl.addColorStop(1,'rgba(255,155,61,0)');g.fillStyle=fl;g.fillRect(x-36,134,72,72);}
   g.restore();
   // defenses firing at incoming aliens
   const glow=(x,y,rad,c)=>{const q=g.createRadialGradient(x,y,1,x,y,rad);q.addColorStop(0,'#ffffff');q.addColorStop(.3,c);q.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=q;g.fillRect(x-rad,y-rad,rad*2,rad*2);};
   const tur=[[352,236],[150,262]];
   for(const [x,y] of tur){poly([x-22,y,x,y+13,x+22,y,x,y-13],'#5a6290');g.fillStyle='#e8eefc';g.beginPath();g.arc(x,y-14,12,0,7);g.fill();}
   g.strokeStyle='#3ef0ff';g.lineWidth=6;g.lineCap='round';
   g.beginPath();g.moveTo(362,222);g.lineTo(398,160);g.stroke();g.beginPath();g.moveTo(150,250);g.lineTo(120,190);g.stroke();
   glow(400,152,26,'#3ef0ff');
   const dart=(x,y,a,s)=>{g.save();g.translate(x,y);g.rotate(a);g.scale(s,s);poly([0,-30,22,22,0,10,-22,22],'#ff3d7f');g.fillStyle='#ffd23d';g.beginPath();g.arc(0,4,6,0,7);g.fill();g.restore();};
   dart(420,120,-2.5,1.3);dart(110,150,2.6,1.1);dart(466,196,-2.1,.9);
   g.fillStyle='#ffc531';for(const [x,y] of [[300,92],[330,120]]){g.beginPath();g.arc(x,y,9,0,7);g.fill();}
   glow(300,92,22,'#ff9a2e');
 }`,
};
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 const render=async(key,size,mask)=>{const data=await p.evaluate(([src,size,mask])=>{const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
   g.scale(size/512,size/512);(0,eval)(src)(g,mask);return c.toDataURL('image/png');},[DRAW[key],size,mask]);return Buffer.from(data.split(',')[1],'base64');};
 for(const [name,size,mask] of [['icon-512.png',512,0],['icon-192.png',192,0],['icon-maskable-512.png',512,1],['apple-touch-icon.png',180,0]])
   fs.writeFileSync(path.join(root,'icons',name),await render('starwake',size,mask));
 for(const id of fs.readdirSync(path.join(root,'games')))if(DRAW[id])fs.writeFileSync(path.join(root,'games',id,'icon.png'),await render(id,256,0));
 await b.close();})();
