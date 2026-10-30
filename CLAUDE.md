# Starwake Arcade: notes for Claude

A for-fun project: offline, touch-first browser games built entirely in code, played mostly as an installed web app on iPhone. Live at https://jitlan.github.io/starwake/. Every push to `main` rebuilds and republishes the site, so treat `main` as production.

## Layout
- `games/<id>/`: one game per folder: `game.js`, `shell.html` (CSS + markup pasted into `<body>`), `game.json` (launcher card + save key), optional `icon.png`.
  - `starwake`: vertical bullet-hell shooter (the original game).
  - `wreckwatch`: isometric base-defense roguelite set in Starwake's universe.
  - `moondrop`: tilt-steered lunar lander (phone motion sensors, touch fallback).
  - `rustybuckets`: turn-based team battler (prelude to Wreckwatch) with timed hits, puzzles before each battle, four of them tilt-driven.
  - `_template`: minimal starter. Folders starting with `_` are skipped by the build. Scaffold with `python3 tools/new_game.py <id> "<Title>"`.
- `shared/kit.js`: loaded as `window.ARC` before every game: low-poly model builder (`geo`, `P`, `M`, `makeMat`), Starwake's aliens (`ALIENS`) and bosses (`BOSSES`), glow batches (`Batch`, `FX_FS`, `EB_FS`, `VS_PLANE`, `VS_ISO`), the synth (`synth`, `music`, plus `snd.loop()` for sustained engine/wind sounds), and phone tilt (`motion.read()` left-right, `motion.read2()` two-axis). Reuse it before writing new versions, and move anything a second game would want into it.
- `arcade/launcher.html`: front page; `tools/build.py` inserts a card per game.
- `vendor/three.min.js`: Three.js r158, the only library.
- `tools/build.py` → `dist/` (gitignored). `tools/make_icons.js` redraws app icons and per-game `icon.png` (one drawer per game id).

## Hard rules
- **No network requests at runtime**: no CDNs, fonts or remote images. Models, sound and UI are generated in code. Offline play is the point.
- Game JS must not contain `</script` or `<!--` (it gets inlined; the build asserts this).
- **Game ids and save keys are permanent.** The id is the URL (`/starwake/<id>/`) and the start of the localStorage key (`<id>.save.v1`). All games share one origin, so keys must not collide. Renaming loses players' saves.
- Don't move or rename the site root: home-screen installs from before the arcade open `/starwake/` and their saves live in that app's storage.
- The service worker only deletes caches it made (`arcade-*`, and the legacy `starwake-*`). Keep that if you touch `sw.js` generation in `build.py`.
- `window.ARCADE` is only set inside the arcade app (it powers the "Back to arcade" button); single-file builds don't have it.

## Code style
Match the existing dense style: compact single-letter locals, short one-line functions, data tables (`LEVELS`, `CARDS`, `ET`, `BOSSES`, `SITES`) near the top of each game, section banners `/* ===== NAME */`, and comments only where the why isn't obvious. Visual language is shared: palette and CSS variables in `shell.html` (`--player` cyan, `--enemy` pink, `--gold`, etc.), italic condensed uppercase display type, flat-shaded low-poly models with emissive accents.

## Building and testing
- `python3 tools/build.py`, then serve `dist/arcade/` (e.g. `python3 -m http.server 8765` in that folder). The build deletes and recreates `dist/arcade/`, so restart any server running inside it afterwards.
- Chromium + Playwright are preinstalled. Headless WebGL needs `chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})`. Use a 390×844 mobile viewport for the main layout check.
- Debug hooks: `window.__starwake`, `window.__wreck`, `window.__moondrop` and `window.__rb` expose state and functions (`startLevel`, `newRun`, `step`, `launchWave`, `play`, `spawnEnemy`, ...). Calling `step(1/30)` in a loop inside `page.evaluate` simulates fast without rendering.
- Click or tap once in tests so audio starts. Some bugs (music) only appear once the AudioContext exists.
- Before pushing a gameplay change: screenshot the affected screens, check for `pageerror`s, and for Wreckwatch run a scripted bot through whole runs on each difficulty to catch stalls and balance swings.
- Offline check: load the launcher, wait for an `arcade-*` cache, `context.setOffline(true)`, then reload and open each game.

## Wreckwatch notes
- World: ground is the XY plane, +z up, 1 unit per tile. Orthographic camera at 52° elevation; `fit()` sizes the rock into the space between the HUD bars. The rock sits on a 23×23 nav grid (`NAV`, center `C`); tile kinds `VOID/LAND/ROCK/SHIP`.
- Aliens float and path with a Dijkstra flow field from the ship (`buildNav`). Defenses are passable at a cost based on their HP, so aliens route around walls or chew through them. Mines don't block.
- Alien bullets hit the first blocking tile they cross; Shield Domes absorb bullets crossing into the bubble, and Interceptors shoot them down.
- Runs save at every build phase, at the post-wave supply pick and at the refit (`snap()` / `continueRun()`). A run ends immediately in the save when the ship dies.
- Balance lessons: shooters that stop at max range in the void caused unwinnable stalls, so they now hold at 60% of their range and press on after 6 s if their target won't die (a wall healed by Repair Bays, for example). Everything rushes after 120 s of one wave. Bosses decide most runs; tune their bullet damage per site before touching anything else. Reference from the scripted bot: Easy wins, Normal usually ends at rocks 2–4, Hard at rock 2.

## Moondrop notes
- Side view: XY plane, +y up, perspective camera that follows the lander and pulls back with altitude. Terrain is a heightfield sampled every unit (`world.h`, optional ceiling `world.c`).
- Tilt comes from `ARC.motion` (gravity vector from `deviceorientation`, so it works upright or flat). iOS only grants it from a tap: every button that leads to flying calls `ARC.motion.start()`. The first reading of a mission is taken as level.
- Headless Chromium also gates sensors: `context.grantPermissions(['accelerometer','gyroscope','magnetometer'])`, then dispatch `new DeviceOrientationEvent('deviceorientation',{beta,gamma})`.
- `__moondrop.auto = (ship, world) => ({ta, thr})` replaces player input; use it to fly an autopilot through every mission after changing terrain, fuel or hazards. All 12 missions must complete with hazards removed.
- Hazard and fuel-cell layouts are seeded per mission and keep their whole patrol area clear of the start and of the air above each pad. Lifting off a pad never counts as a landing.

## Rusty & Buckets notes
- World is y-up (XZ ground). In battle the camera sits behind the duo: Rusty is lane 0 (left), Buckets lane 1 (right), and their panels double as the timing buttons; tapping either half of the field counts too.
- A battle is one generator (`battleLoop`) that yields seconds, `{prompts}` (timing taps; each prompt's callback fires the moment it resolves) or `{input:'cmd'}`. Hero attacks, team moves and alien attacks are small generators built on that.
- Kit aliens are shown the Starwake way (flat to the camera, pointing at the duo); bosses come straight from `ARC.BOSSES`.
- Puzzles: `PUZ` holds lights, wires, crates (levels in `CRATES`, verified solvable with a BFS), simon, and the gyro four (slide, maze, wind, signal) that read `tilt()` (motion, or a drag stick).
- Balance check: set `__rb.auto = p => ({hit, err})` and `__rb.autoCmd = hero => command`, then run every stage with `tickBattle(1/30)`. Reference: 85% timing breezes, 50-60% finishes with retries on the last bosses, 40% stalls at the third boss.

## Workflow
- Branch, push, then merge to `main` when the user is happy. Merging publishes.
- Commit messages end with the attribution lines the session asks for.
