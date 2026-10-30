"""Builds dist/ for every game in games/ (folders starting with _ or . are skipped):
  dist/<id>.html          single file for a Claude artifact
  dist/<id>-offline.html  single file that runs straight from disk
  dist/arcade/            the installable web app: a launcher page plus one folder per game,
                          sharing one copy of three.js, the arcade kit and one offline service worker
  dist/arcade.zip         the same app, zipped
Run from anywhere: python3 tools/build.py"""
import os,json,hashlib,shutil,zipfile,html
here=os.path.dirname(os.path.abspath(__file__))
root=os.path.dirname(here)
out=os.path.join(root,'dist'); os.makedirs(out,exist_ok=True)

three=open(os.path.join(root,'vendor/three.min.js')).read()
first,rest=three.split('\n',1)
assert first.startswith('console.warn(') and first.endswith('),')
three='void 0,\n'+rest  # drop the r150+ deprecation warning
kit=open(os.path.join(root,'shared/kit.js')).read()  # code every game shares, loaded as window.ARC

games=[]
gdir=os.path.join(root,'games')
for gid in sorted(os.listdir(gdir)):
    d=os.path.join(gdir,gid)
    if gid[0] in '_.' or not os.path.isfile(os.path.join(d,'game.json')): continue
    g=json.load(open(os.path.join(d,'game.json')))
    g['id']=gid; g['dir']=d
    g['shell']=open(os.path.join(d,'shell.html')).read()
    g['game']=open(os.path.join(d,'game.js')).read()
    for name,src in (('three',three),('kit',kit),(gid,g['game'])):
        assert '</script' not in src.lower() and '<!--' not in src, name
    games.append(g)
games.sort(key=lambda g:(g.get('order',99),g['id']))
assert games, 'no games found in games/'

def head(title,extra=''):
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
     '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
     '<meta name="theme-color" content="#07061a">\n<meta name="apple-mobile-web-app-capable" content="yes">\n<meta name="mobile-web-app-capable" content="yes">\n'
     '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'+extra+'<title>'+html.escape(title)+'</title>\n</head>\n<body>\n')
inline=lambda g:'<script>\n'+three+'\n</script>\n<script>\n'+kit+'\n</script>\n<script>\n'+g['game']+'\n</script>\n'

# ---- Single-file builds, one pair per game ----
for g in games:
    t=html.escape(g['title'])
    open(os.path.join(out,g['id']+'.html'),'w').write('<title>'+t+'</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'+g['shell']+'\n'+inline(g))
    open(os.path.join(out,g['id']+'-offline.html'),'w').write(head(g['title'])+g['shell']+'\n'+inline(g)+'</body>\n</html>\n')
    for f in (g['id']+'.html',g['id']+'-offline.html'): print(f, os.path.getsize(os.path.join(out,f)))

# ---- The arcade: installable web app ----
app=os.path.join(out,'arcade')
if os.path.isdir(app): shutil.rmtree(app)
os.makedirs(app)
for f in ('icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png'):
    shutil.copy(os.path.join(root,'icons',f),os.path.join(app,f))
open(os.path.join(app,'three.js'),'w').write(three)
open(os.path.join(app,'kit.js'),'w').write(kit)
def sw_reg(base):  # registers the one service worker that covers the whole app
    return ('<script>\nif("serviceWorker" in navigator&&location.protocol.indexOf("http")===0){'
     'window.addEventListener("load",function(){navigator.serviceWorker.register("'+base+'sw.js",{scope:"'+base+'"}).catch(function(){});});}\n</script>\n')
def pwa(base,title):
    return ('<link rel="manifest" href="'+base+'manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="'+base+'icon-192.png">\n'
     '<link rel="apple-touch-icon" href="'+base+'apple-touch-icon.png">\n<meta name="apple-mobile-web-app-title" content="'+html.escape(title)+'">\n')
for g in games:
    gd=os.path.join(app,g['id']); os.makedirs(gd)
    page=(head(g['title'],pwa('../','Arcade'))+g['shell']+'\n'
      '<script>window.ARCADE={home:"../"};</script>\n<script src="../three.js"></script>\n<script src="../kit.js"></script>\n<script>\n'+g['game']+'\n</script>\n'+sw_reg('../')+'</body>\n</html>\n')
    open(os.path.join(gd,'index.html'),'w').write(page)
    icon=os.path.join(g['dir'],'icon.png'); g['has_icon']=os.path.isfile(icon)
    if g['has_icon']: shutil.copy(icon,os.path.join(gd,'icon.png'))

def card(g):
    e=html.escape; a=e(g.get('accent','#3ef0ff'))
    art=('<img src="'+e(g['id'])+'/icon.png" alt="" width="84" height="84">' if g['has_icon'] else '<span class="ph">'+e(g['title'][:1])+'</span>')
    return ('<a class="game" href="'+e(g['id'])+'/" style="--a:'+a+'" data-key="'+e(g.get('save_key',''))+'">'+art+
      '<span class="gt"><span class="eyebrow">'+e(g.get('tagline',''))+'</span><b>'+e(g['title'])+'</b><span class="bl">'+e(g.get('blurb',''))+'</span>'
      '<span class="saved" hidden>Saved progress on this device</span><span class="go" aria-hidden="true">Play</span></span></a>')
launcher=open(os.path.join(root,'arcade','launcher.html')).read()
assert '<!--GAMES-->' in launcher
launcher=launcher.replace('<!--GAMES-->','\n'.join(card(g) for g in games),1)
index=head('Starwake Arcade',pwa('','Arcade'))+launcher+'\n'+sw_reg('')+'</body>\n</html>\n'
open(os.path.join(app,'index.html'),'w').write(index)
manifest={"name":"Starwake Arcade","short_name":"Arcade","description":"Offline games made entirely in code.",
 "start_url":"./","scope":"./","display":"fullscreen","display_override":["fullscreen","standalone"],"orientation":"any",
 "background_color":"#07061a","theme_color":"#07061a",
 "icons":[{"src":"icon-192.png","sizes":"192x192","type":"image/png","purpose":"any"},
          {"src":"icon-512.png","sizes":"512x512","type":"image/png","purpose":"any"},
          {"src":"icon-maskable-512.png","sizes":"512x512","type":"image/png","purpose":"maskable"}]}
open(os.path.join(app,'manifest.webmanifest'),'w').write(json.dumps(manifest,indent=1))

# Every file in the app is cached on install. Game folders are also cached by their bare URL ("starwake/").
files=[]
for dp,_,fs in os.walk(app):
    for f in fs: files.append(os.path.relpath(os.path.join(dp,f),app).replace(os.sep,'/'))
files.sort()
h=hashlib.sha1()
for f in files: h.update(f.encode()); h.update(open(os.path.join(app,f),'rb').read())
ver=h.hexdigest()[:10]  # changes whenever any cached file changes, so installed copies refresh
urls=['./']+[g['id']+'/' for g in games]+files
sw=('// Caches the whole arcade on first visit so every game launches with no connection. The version changes with every build.\n'
 '// Only caches this app made are removed: "starwake-" is the name used before the arcade existed.\n'
 'const CACHE="arcade-'+ver+'";const FILES='+json.dumps(urls)+';\n'
 'self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});\n'
 'self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&(k.indexOf("arcade-")===0||k.indexOf("starwake-")===0)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});\n'
 'self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;\n'
 '  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==="navigate"?caches.match("./"):Response.error())));});\n')
open(os.path.join(app,'sw.js'),'w').write(sw)
zp=os.path.join(out,'arcade.zip')
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    for f in files+['sw.js']: z.write(os.path.join(app,f),f)
print('arcade/', len(files)+1, 'files,', ', '.join(g['id'] for g in games), '· zip', os.path.getsize(zp))
