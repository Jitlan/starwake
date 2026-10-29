# Starwake Arcade

Offline, touch-first games built entirely in code. Every model, sound and screen is generated at runtime. Three.js r158 is the only library, and the games make no network requests.

**Play:** https://jitlan.github.io/starwake/

| Game | What it is |
| --- | --- |
| **Starwake** | A vertical space shooter in the spirit of Tyrian (1995). Five sectors with multi-phase bosses, a hangar of weapon and hull upgrades, and three difficulty levels. |
| **Wreckwatch** | An isometric base-defense roguelite. Your frigate has crashed on a drifting rock. Build defenses from a hand of cards and hold every wave while the engineers repair it, across five rocks. |

## Install on iPhone or iPad
1. Open the link above in Safari.
2. Tap Share, then **Add to Home Screen**, then **Add**.
3. Launch it once from the icon while online. After that every game runs in airplane mode.

Each device keeps its own saves. If you installed Starwake before the arcade existed, your icon keeps working: it opens the arcade, and your Starwake progress is still there.

## Layout
- `games/<id>/`: one folder per game.
  - `game.json`: the launcher card (title, tagline, blurb, accent color, order) and the game's save key.
  - `game.js`: all game logic. `shell.html`: CSS plus HUD and menu markup. `icon.png`: launcher card art.
- `games/_template/`: a minimal game to start from. See its README. The build skips folders that start with `_`.
- `arcade/launcher.html`: the arcade's front page. The build adds a card for each game.
- `vendor/three.min.js`: Three.js r158 (MIT, see `vendor/THREE-LICENSE`), shared by every game.
- `icons/`: the arcade's app icons. `node tools/make_icons.js` redraws them and each game's `icon.png` (needs Playwright).
- `tools/build.py`: writes `dist/`. `tools/new_game.py`: starts a new game from the template.

### Starwake
Sectors (`LEVELS`), bosses (`BOSSES`), enemies (`ET`) and the shop catalog are plain data near the top of `games/starwake/game.js`.

### Wreckwatch
Cards (`CARDS`), aliens (`ET`), bosses (`BOSSES`) and rocks (`SITES`, including how many waves each has) are plain data near the top of `games/wreckwatch/game.js`. Waves are generated from each rock's budget and enemy pool, so every run differs. A run is saved at every build phase, so closing the app mid-wave replays that wave.

## Add a game
```
python3 tools/new_game.py mygame "My Game"
```
Then edit `games/mygame/`. The id is permanent because it is also the URL and the save key.

## Build and publish
```
python3 tools/build.py
```
This writes, for every game, `dist/<id>.html` (single file for a Claude artifact) and `dist/<id>-offline.html` (single file that runs from disk), plus `dist/arcade/`, the installable web app. You don't need to run it to publish: every push to `main` runs the **Publish** workflow (`.github/workflows/publish.yml`), which builds everything and pushes `dist/arcade/` to the `gh-pages` branch that GitHub Pages serves. It can also be run by hand from the Actions tab.

One service worker covers the whole arcade and caches every game on first visit. Installed copies download a new version the next time they open online and run it from the launch after that. Saved progress is kept.
