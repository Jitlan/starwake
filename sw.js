// Caches the whole arcade on first visit so every game launches with no connection. The version changes with every build.
// Only caches this app made are removed: "starwake-" is the name used before the arcade existed.
const CACHE="arcade-2f9a1e92ae";const FILES=["./", "starwake/", "rustybuckets/", "wreckwatch/", "moondrop/", "cometkid/", "apple-touch-icon.png", "cometkid/icon.png", "cometkid/index.html", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "index.html", "kit.js", "manifest.webmanifest", "moondrop/icon.png", "moondrop/index.html", "rustybuckets/icon.png", "rustybuckets/index.html", "starwake/icon.png", "starwake/index.html", "three.js", "wreckwatch/icon.png", "wreckwatch/index.html"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&(k.indexOf("arcade-")===0||k.indexOf("starwake-")===0)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).catch(()=>e.request.mode==="navigate"?caches.match("./"):Response.error())));});
