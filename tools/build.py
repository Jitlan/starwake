"""Builds dist/: starwake.html (Claude artifact), starwake-offline.html (single file) and starwake-app/ (installable web app).
Run from anywhere: python3 tools/build.py"""
import sys,os
here=os.path.dirname(os.path.abspath(__file__))
root=os.path.dirname(here)
three=open(os.path.join(root,'vendor/three.min.js')).read()
first,rest=three.split('\n',1)
assert first.startswith('console.warn(') and first.endswith('),')
three='void 0,\n'+rest
shell=open(os.path.join(root,'src/shell.html')).read()
game=open(os.path.join(root,'src/game.js')).read()
for name,src in (('three',three),('game',game)):
    assert '</script' not in src.lower() and '<!--' not in src, name
scripts='<script>\n'+three+'\n</script>\n<script>\n'+game+'\n</script>\n'
head_meta='<title>Starwake</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
out=os.path.join(root,'dist'); os.makedirs(out,exist_ok=True)
open(os.path.join(out,'starwake.html'),'w').write(head_meta+shell+'\n'+scripts)
standalone=('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
 '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
 '<meta name="theme-color" content="#07061a">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
 '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n<title>Starwake</title>\n</head>\n<body>\n'+shell+'\n'+scripts+'</body>\n</html>\n')
open(os.path.join(out,'starwake-offline.html'),'w').write(standalone)
for f in ('starwake.html','starwake-offline.html'): print(f, os.path.getsize(os.path.join(out,f)))

# ---- Installable web app: same game plus manifest, icons and an offline service worker ----
import hashlib,json,shutil,zipfile
app=os.path.join(out,'starwake-app'); os.makedirs(app,exist_ok=True)
for f in ('icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'):
    shutil.copy(os.path.join(root,'icons',f),os.path.join(app,f))
pwa_head=('<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">\n'
 '<link rel="apple-touch-icon" href="apple-touch-icon.png">\n<meta name="apple-mobile-web-app-title" content="Starwake">\n')
sw_reg=('<script>\nif("serviceWorker" in navigator&&location.protocol.indexOf("http")===0){'
 'window.addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){});});}\n</script>\n')
index=standalone.replace('<title>Starwake</title>\n',pwa_head+'<title>Starwake</title>\n',1).replace('</body>',sw_reg+'</body>',1)
open(os.path.join(app,'index.html'),'w').write(index)
manifest={"name":"Starwake","short_name":"Starwake","description":"Offline vertical space shooter.",
 "start_url":"./","scope":"./","display":"fullscreen","display_override":["fullscreen","standalone"],"orientation":"portrait",
 "background_color":"#07061a","theme_color":"#07061a",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
          {"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
          {"src":"icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
open(os.path.join(app,'manifest.webmanifest'),'w').write(json.dumps(manifest,indent=1))
files=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']
ver=hashlib.sha1(index.encode()).hexdigest()[:10]
sw=('// Caches the whole game on first visit so it launches with no connection. The version changes with every build.\n'
 'const CACHE="starwake-'+ver+'";const FILES='+json.dumps(files)+';\n'
 'self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});\n'
 'self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});\n'
 'self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;\n'
 '  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).catch(()=>caches.match("index.html"))));});\n')
open(os.path.join(app,'sw.js'),'w').write(sw)
zp=os.path.join(out,'starwake-app.zip')
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(app)): z.write(os.path.join(app,f),f)
print('starwake-app/', sorted(os.listdir(app)), 'zip', os.path.getsize(zp))
