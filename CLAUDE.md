# Starwake Arcade: notes for Claude

A for-fun project: offline, touch-first browser games built entirely in code, played mostly as an installed web app on iPhone. Live at https://jitlan.github.io/starwake/. Every push to `main` rebuilds and republishes the site, so treat `main` as production.

## Layout
- `games/<id>/`: one game per folder: `game.js`, `shell.html` (CSS + markup pasted into `<body>`), `game.json` (launcher card + save key), optional `icon.png`.
  - `starwake`: vertical bullet-hell shooter (the original game): 10 sectors, 5 ships, New Game+.
  - `wreckwatch`: isometric base-defense roguelite set in Starwake's universe.
  - `moondrop`: tilt-steered lunar lander (phone motion sensors, touch fallback).
  - `cometkid`: Mega Man-style platformer: 4 stages in any order + final, boss weapons and weaknesses, on-screen pad (bottom half in portrait, sides in landscape).
  - `cometkid-tactics`: real-time grid battler: a 25-fight gauntlet with one life on a 6×3 field, buster plus a card deck you edit (and shop for, with gold earned by performance) before the first fight and after every reward.
  - `rustybuckets`: turn-based team battler (prelude to Wreckwatch) with timed hits, puzzles before each battle, four of them tilt-driven.
  - `_template`: minimal starter. Folders starting with `_` are skipped by the build. Scaffold with `python3 tools/new_game.py <id> "<Title>"`.
- `shared/kit.js`: loaded as `window.ARC` before every game: low-poly model builder (`geo`, `P`, `M`, `makeMat`), Starwake's aliens (`ALIENS`) and bosses (`BOSSES`), glow batches (`Batch`, `FX_FS`, `EB_FS`, `VS_PLANE`, `VS_ISO`), the synth (`synth`, `music`, plus `snd.loop()` for sustained engine/wind sounds), phone tilt (`motion.read()` left-right, `motion.read2()` two-axis), the Comet Kid hero model (`kid()`), and haptics (`vibe(on, ms|pattern)`: the Vibration API where it exists; on iPhone, which lacks it, a hidden switch checkbox is clicked once per pulse, an undocumented iOS 18 Safari behaviour that may only fire during taps and could be removed). Reuse it before writing new versions, and move anything a second game would want into it.
- `arcade/launcher.html`: front page; `tools/build.py` inserts a card per game.
- `vendor/three.min.js`: Three.js r158, the only library.
- `tools/build.py` → `dist/` (gitignored). `tools/make_icons.js` redraws app icons and per-game `icon.png` (one drawer per game id).

## Hard rules
- **No network requests at runtime**: no CDNs, fonts or remote images. Models, sound and UI are generated in code. Offline play is the point.
- Game JS must not contain `</script` or `<!--` (it gets inlined; the build asserts this).
- **Game ids and save keys are permanent.** The id is the URL (`/starwake/<id>/`) and the start of the localStorage key (`<id>.save.v1`). All games share one origin, so keys must not collide. Renaming loses players' saves.
- Don't move or rename the site root: home-screen installs from before the arcade open `/starwake/` and their saves live in that app's storage.
- The service worker only deletes caches it made (`arcade-*`, and the legacy `starwake-*`). Keep that if you touch `sw.js` generation in `build.py`.
- The manifest's `orientation` stays `any`. Android locks an installed app to it (iOS ignores it), and Comet Kid has a landscape layout. Install steps for both platforms are in README.md and in the launcher's install tip.
- `window.ARCADE` is only set inside the arcade app (it powers the "Back to arcade" button); single-file builds don't have it.

## Code style
Match the existing dense style: compact single-letter locals, short one-line functions, data tables (`LEVELS`, `CARDS`, `ET`, `BOSSES`, `SITES`) near the top of each game, section banners `/* ===== NAME */`, and comments only where the why isn't obvious. Visual language is shared: palette and CSS variables in `shell.html` (`--player` cyan, `--enemy` pink, `--gold`, etc.), italic condensed uppercase display type, flat-shaded low-poly models with emissive accents.

## Building and testing
- `python3 tools/build.py`, then serve `dist/arcade/` (e.g. `python3 -m http.server 8765` in that folder). The build deletes and recreates `dist/arcade/`, so restart any server running inside it afterwards.
- Chromium + Playwright are preinstalled. Headless WebGL needs `chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']})`. Use a 390×844 mobile viewport for the main layout check.
- Debug hooks: `window.__starwake`, `window.__wreck`, `window.__moondrop`, `window.__rb`, `window.__comet` and `window.__tactics` expose state and functions (`startLevel`, `newRun`, `step`, `launchWave`, `play`, `spawnEnemy`, ...). Calling `step(1/30)` in a loop inside `page.evaluate` simulates fast without rendering.
- Click or tap once in tests so audio starts. Some bugs (music) only appear once the AudioContext exists.
- Before pushing a gameplay change: screenshot the affected screens, check for `pageerror`s, and for Wreckwatch run a scripted bot through whole runs on each difficulty to catch stalls and balance swings.
- Offline check: load the launcher, wait for an `arcade-*` cache, `context.setOffline(true)`, then reload and open each game.

## Starwake notes
- Save migration lives in `migrate()`: old single-ship hull upgrades move to `fleet.starwake`, ships unlock for sectors already cleared, `lvlBest` grows to 10. Keep it when changing the save shape.
- `DF()` is difficulty with New Game+ folded in (per-loop multipliers in `NG`), cached by `diff|ng`. Read multipliers through it, never `DIFF` directly.
- Ship signatures hook into `fireFront` (Starwake rate, Phantom echo bolts), the enemy-bullet loop (Hornet graze), `hurt` (Bulwark reflector) and `specMul`/`specCost` (Valkyrie).

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
- Foe nameplates are placed through the `--t` CSS variable, never an inline `transform`: the target-pick pulse animates `var(--t) scale(…)`. `placeFoeLabels` spreads plates apart when they would overlap (landscape, small phones).
- Kit aliens are shown the Starwake way (flat to the camera, pointing at the duo); bosses come straight from `ARC.BOSSES`.
- Puzzles: `PUZ` holds lights, wires, crates (levels in `CRATES`, verified solvable with a BFS), simon, and the gyro four (slide, maze, wind, signal) that read `tilt()` (motion, or a drag stick).
- Balance check: set `__rb.auto = p => ({hit, err})` and `__rb.autoCmd = hero => command`, then run every stage with `tickBattle(1/30)`. Reference: 85% timing breezes, 50-60% finishes with retries on the last bosses, 40% stalls at the third boss.

## Comet Kid notes
- Stages are string tile maps. Every jump must be makeable: re-run the stage reachability search (a BFS over landing spots using the game's own `phys`) after editing a map; widening a gap past the jump reach should make it fail.
- Controls are pointer-tracked per finger, so run + jump + shoot work together. Left thumb: the d-pad (the whole left half) reads the thumb's angle from its centre as eight 45° sectors with a small dead zone. It moves and aims: `PL.ah`/`PL.ay` keep the last direction pushed (hero-relative, so it follows `face`), and `aimV()` turns them into the shot direction (straight down on the ground angles forward). Every weapon fires along it. Right thumb: Jump, Shoot (hold to charge) and the weapon switch. Keyboard Up/W aims; Space/K/Z jump. `S.set.rapid` is opt-in auto-fire (buster only, charge still builds).
- Drop-through is Down + Jump on a one-way ledge or platform. Holding Down alone never drops, because Down is also an aim.
- Test touch with CDP `Input.dispatchTouchEvent`, with touch points at angles around `#dpad`'s centre plus one on `#bShoot`. Wrapping `requestAnimationFrame` to pause the loop, then calling `__comet.tick()`, makes hold timings exact. For a scripted stage pass, drive `__comet.touch`/`latch` (the pad's own state) from a bot that plans by simulating candidate inputs with `phys` (call `setPlats(G.tick+k)` per simulated step, then restore). Plans must be able to stop partway, or the bot stalls before ledges over spikes. Have the bot jump through `touch.jump` + `latch.jump`; `touch.u` only aims.
- Kit candidates if a second platformer appears: tile collision and movement, the multi-touch pad, and the boss-portrait renderer. The hero model already lives in the kit (`ARC.kid()`).

## Comet Kid Tactics notes
- World is y-up (XZ ground). The field is 6×3 tiles (`TS` units each): columns 0-2 are Comet Kid's, 3-5 the aliens'; row 0 is at the back. `tx(c)`/`tz(r)` map tiles to world. The camera looks down from the front at `EL` and backs off until all six columns fit.
- Real time at a fixed 60 Hz (`tick`). Movement is a destination tile (`PL.dest`) walked one tile per `STEP`, rows before columns. Touch: a 3×3 move pad (tap or slide), Buster (tap 1 dmg, hold `CH` s for `CHARGED`) and a hand of 3 cards with a next-card preview. Cards cost energy (max `EMAX`, +1 per `EREG` s). `once` cards (Patch) are spent for the rest of the fight; the others cycle back into the draw pile.
- Every alien attack telegraphs on your tiles with `warn(tiles, seconds, dmg, src)`: red = damage when the timer ends, orange (dmg 0) = a shot about to fly down that row, green = the one safe tile. Warnings tied to an alien are cancelled if it dies first. Attacks start at least 0.45 s apart. Attack names are the `a`/`p2` lists in `ET`/`BOSS`; guardians use `p2` below half HP.
- Cards you own are `R.lib`; the deck you fight with (`R.deck`) is a subset of it, between `DECK_MIN` and `deckMax()` cards (8, +1 per guardian beaten). The deck editor opens on New run and after every reward pick; new cards go into the collection, and into the deck while there's room. 25 fights (`FIGHTS`): guardians at 5/10/15/20 (all four, order shuffled per run in `R.bosses`; `bossOf(i)`) and the Eclipse at 25. Alien HP grows `HPG` and hits `DMGG` per fight.
- Gold (`payGold`): each win pays a clear bonus (8 + fight index, doubled for guardians) plus tiers for time against a par (aliens' total HP / `PAR_DPS` + 5 s), damage taken (`G.dmg`) and energy efficiency (share of regenerated energy not lost at the cap: `G.gen`, `G.waste`). The breakdown shows on the reward screen. The editor's Shop tab (`shopItems`/`buy`, prices in `PRICE`) sells 4 stock cards (`R.stock`, rerolled after each fight), card upgrades, Buster levels (`R.bl`, max `BL_TOP`) and energy slots (`R.emax`, max `EMAX_TOP`). Patch costs extra in the shop: every copy is another heal each fight.
- Runs save at each fight start, on the reward screen and in the editor (`snap(stage)`/`continueRun`), so closing the app replays at most one fight. Deaths clear the saved run. Runs saved by the 7-fight version (no `lib`, a single `boss`) are migrated in `continueRun`; keep that when changing the run shape.
- Balance check: `__tactics.auto = (PL, G) => ({dest, b, card})` with a dodging bot that re-reads the warnings every `react` seconds and ignores them with probability `miss`; pick rewards with `pickReward(i)`, shop with `buy(key)`, edit with `deckAdd`/`deckRemove`, then `editDone()`. The bot shops energy slots, then Buster, then upgrades for its deck cards, then strong stock cards, and its editor keeps Patch (a player would; without healing every profile dies early). Reference over the 25 fights (8 runs each; win counts swing by 2–3 between batches): react 0.1 wins every run in about 12 min; react 0.25 miss 0.1 wins about 5 of 8; react 0.33 miss 0.15 about 1 of 8, losing at fights 9–20; react 0.4 miss 0.25 dies at fights 9–16. Late alien damage growth (`DMGG`) decides where average players fall. Watch healing first: cheap Patch copies have made every bot unkillable twice.
- Holding Buster from before a fight (or a card) must still start a charge: `buster` treats a held button with no charge running as a fresh press.

## Workflow
- Branch, push, then merge to `main` when the user is happy. Merging publishes.
- Commit messages end with the attribution lines the session asks for.
