# Starwake

An offline, touch-first vertical space shooter in the spirit of Tyrian (1995). Five sectors with multi-phase bosses, a hangar of weapon and hull upgrades, three difficulty levels, and progress saved on the device. Every model, sound and screen is generated in code; Three.js r158 is inlined, so the game makes no network requests.

**Play:** https://jitlan.github.io/starwake/

## Install on iPhone or iPad
1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**, then **Add**.
3. Launch it once from the icon while online. After that it runs in airplane mode.

Each device keeps its own save.

## Layout
- `src/game.js`: all game logic. Sectors (`LEVELS`), bosses (`BOSSES`), enemies (`ET`) and the shop catalog are plain data near the top.
- `src/shell.html`: CSS and the HUD, hangar and menu markup.
- `vendor/three.min.js`: Three.js r158 (MIT, see `vendor/THREE-LICENSE`).
- `icons/`: app icons, regenerated with `node tools/make_icons.js icons` (needs Playwright).
- `tools/build.py`: writes `dist/`.

## Build and publish
```
python3 tools/build.py
```
This produces `dist/starwake-app/`, the installable web app. The `gh-pages` branch holds exactly that folder's contents; replace them and push to update the live game. Installed copies pick up the new version the next time they open online.
