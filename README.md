# Starwake Arcade

Offline, touch-first games built entirely in code. Every model, sound and screen is generated at runtime. Three.js r158 is the only library, and the games make no network requests.

**Play:** https://jitlan.github.io/starwake/

| Game | What it is |
| --- | --- |
| **Starwake** | A vertical space shooter in the spirit of Tyrian (1995). Ten sectors with multi-phase bosses, five ships to unlock (each with its own upgrades and signature ability), a hangar of weapons, three difficulty levels and New Game+. |
| **Rusty & Buckets** | The prelude to Wreckwatch: a turn-based team battler in the spirit of *Mario & Luigi: Superstar Saga*. Two combat engineers follow the Halcyon's distress call through 20 timed-hit battles, each behind a puzzle. Four of the puzzles are steered by tilting the phone. |
| **Wreckwatch** | An isometric base-defense roguelite. Your frigate has crashed on a drifting rock. Build defenses from a hand of cards and hold every wave while the engineers repair it, across five rocks. |
| **Moondrop** | A tilt-steered lunar lander. Tilt the phone to angle the lander and hold anywhere to thrust; set cargo down softly on twelve missions across four moons, with wind, caves and drifting aliens. Touch steering is available too. |
| **Comet Kid** | A run-and-gun platformer in the spirit of Mega Man. Pick any of four strongholds, beat each guardian to take its weapon, then storm the Eclipse Core. Touch controls: an 8-way d-pad that moves and aims (shots follow the last direction you pushed), plus Jump and Shoot buttons (hold to charge); below the game in portrait, at the sides in landscape. |
| **Comet Kid Tactics** | A real-time grid battler: 25 fights in a row with one life, with a guardian every fifth fight. Dodge across your 3×3 side of the field as attacks light up the tiles they're about to hit, charge the buster, and play cards from a deck you edit before the first fight and after every reward. Wins pay gold for speed, dodging and energy efficiency; spend it in the shop on cards, card upgrades, Buster levels and energy slots. Touch: a 3×3 move pad, the buster and a hand of three cards. |

## Install as an app
The arcade installs to your home screen like an app: its own icon, full screen with no browser bars, and every game playable offline.

**iPhone or iPad**
1. Open the link above in **Safari**. Other iPhone browsers also have Add to Home Screen in their Share menu on iOS 16.4 and later, but Safari is the surest.
2. Tap **Share** (the square with an arrow). On newer iOS versions it may be inside the **•••** button.
3. Scroll down and tap **Add to Home Screen**. Leave **Open as Web App** on if it's shown, then tap **Add**.
4. Launch it once from the icon while online. After that every game runs in airplane mode.

**Android**
1. Open the link above in **Chrome**.
2. Tap **Install arcade** on the page if it's shown. Otherwise open the **⋮** menu and tap **Install app** (older Chrome versions call it **Add to Home screen**), then **Install**.
3. Launch it once from the icon while online. After that every game runs in airplane mode.

Samsung Internet: menu (☰), then **Add page to**, then **Home screen**. Firefox: menu (⋮), then **Install** or **Add to Home screen**.

Each device keeps its own saves. On iPhone the home-screen app also keeps saves separate from Safari, so progress from playing in a Safari tab doesn't carry into the installed app. On Android the installed app shares its saves with Chrome. If you installed Starwake before the arcade existed, your icon keeps working: it opens the arcade, and your Starwake progress is still there.

## Layout
- `games/<id>/`: one folder per game.
  - `game.json`: the launcher card (title, tagline, blurb, accent color, order) and the game's save key.
  - `game.js`: all game logic. `shell.html`: CSS plus HUD and menu markup. `icon.png`: launcher card art.
- `games/_template/`: a minimal game to start from. See its README. The build skips folders that start with `_`.
- `arcade/launcher.html`: the arcade's front page. The build adds a card for each game.
- `vendor/three.min.js`: Three.js r158 (MIT, see `vendor/THREE-LICENSE`), shared by every game.
- `shared/kit.js`: code every game shares, loaded as `window.ARC`: the low-poly model builder and material, Starwake's aliens and bosses, glow particles, the synthesizer for sound and music, phone tilt input (`ARC.motion`), the Comet Kid model (`ARC.kid`) and haptics (`ARC.vibe`).
- `icons/`: the arcade's app icons. `node tools/make_icons.js` redraws them and each game's `icon.png` (needs Playwright).
- `tools/build.py`: writes `dist/`. `tools/new_game.py`: starts a new game from the template.

### Starwake
Sectors (`LEVELS`), bosses (`BOSSES`), enemies (`ET`) and the shop catalog are plain data near the top of `games/starwake/game.js`. Sectors 6-10 build their waves with `genWaves` from a seed, so they play the same every time. Ships live in `SHIPS` (one unlocks with each even-numbered sector). Each keeps its own hull upgrades in the save's `fleet`. New Game+ scaling is the `NG` table, folded into `DF()`.

### Rusty & Buckets
The duo (`HEROES`), team moves (`TEAM`), aliens and bosses (`FOES`, `BOSS`, `MOVES`) and the 20 stages with their puzzles and dialogue (`STAGES`) are plain data near the top of `games/rustybuckets/game.js`. Progress saves after every battle.

### Moondrop
Moons (`MOONS`) and missions (`MISSIONS`: pads, terrain roughness, wind, caves, hazards, fuel, par time) are plain data near the top of `games/moondrop/game.js`. Each mission's terrain and hazard layout is seeded, so it is the same every attempt. iPhones ask once for motion access the first time you start a mission.

### Comet Kid
Stages are tile maps written as strings, and weapons and bosses (with their weaknesses) are data near the top of `games/cometkid/game.js`. Beaten guardians and won weapons save after each boss.

### Comet Kid Tactics
Cards (`CARDS`), aliens (`ET`), guardians (`BOSS`), their attacks (`ATK`) and the 25 fights (`FIGHTS`) are plain data near the top of `games/cometkid-tactics/game.js`. Cards you win or buy go into a collection; the deck editor picks which ones you fight with, and its shop (`PRICE`, `shopItems`) spends the gold each fight pays out (`payGold`). A run saves at the start of each fight, on the reward screen and in the deck editor.

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
