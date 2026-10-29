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
This produces `dist/starwake-app/`, the installable web app. You don't need to run it to publish: every push to `main` runs the **Publish** workflow (`.github/workflows/publish.yml`), which builds the game and pushes `dist/starwake-app/` to the `gh-pages` branch that GitHub Pages serves. It can also be run by hand from the Actions tab.

Installed copies download a new version the next time they open online and run it from the launch after that. Saved progress is kept.
