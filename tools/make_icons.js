// Renders the app icons with canvas 2D: a cyan arrowhead ship with a pink offset, on the game's deep indigo.
const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage();
 const out=process.argv[2];
 for(const [name,size,mask] of [['icon-512.png',512,0],['icon-192.png',192,0],['icon-maskable-512.png',512,1],['apple-touch-icon.png',180,0]]){
  const data=await p.evaluate(([size,mask])=>{const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');
   const s=size/512;g.scale(s,s);
   const bg=g.createRadialGradient(256,150,20,256,256,380);bg.addColorStop(0,'#1d1760');bg.addColorStop(1,'#07061a');g.fillStyle=bg;g.fillRect(0,0,512,512);
   // stars
   let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
   for(let i=0;i<60;i++){g.globalAlpha=.25+r()*.6;g.fillStyle='#cfd8ff';const z=r()*2.4+.6;g.fillRect(r()*512,r()*512,z,z);}g.globalAlpha=1;
   const k=mask?.78:1;g.translate(256,268);g.scale(k,k);g.translate(-256,-268);
   const ship=(dx,dy,fill)=>{g.save();g.translate(dx,dy);g.fillStyle=fill;g.beginPath();
     g.moveTo(256,70);g.lineTo(300,250);g.lineTo(420,330);g.lineTo(420,370);g.lineTo(300,340);g.lineTo(285,400);g.lineTo(227,400);g.lineTo(212,340);g.lineTo(92,370);g.lineTo(92,330);g.lineTo(212,250);g.closePath();g.fill();g.restore();};
   ship(16,16,'#ff3d7f');ship(0,0,'#3ef0ff');
   g.fillStyle='#07061a';g.beginPath();g.moveTo(256,150);g.lineTo(276,250);g.lineTo(256,282);g.lineTo(236,250);g.closePath();g.fill();
   // engine glow
   for(const x of [240,272]){const fl=g.createRadialGradient(x,420,2,x,420,40);fl.addColorStop(0,'rgba(255,230,176,1)');fl.addColorStop(.4,'rgba(255,155,61,.8)');fl.addColorStop(1,'rgba(255,155,61,0)');g.fillStyle=fl;g.fillRect(x-40,390,80,80);}
   return c.toDataURL('image/png');},[size,mask]);
  fs.writeFileSync(out+'/'+name,Buffer.from(data.split(',')[1],'base64'));}
 await b.close();})();
