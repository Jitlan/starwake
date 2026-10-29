# Game template

A minimal arcade game: a title screen, a Three.js scene in the arcade's low-poly style, a score that saves, pause, and the "Back to arcade" button. The build skips this folder because its name starts with `_`.

## Start a new game

```
python3 tools/new_game.py mygame "My Game"
```

This copies the template to `games/mygame/` and fills in the id and title. The id is permanent: it is the folder, the URL (`/mygame/`) and the start of the save key, so renaming it later loses players' saves.

## The files

- `game.json`: the launcher card (`title`, `tagline`, `blurb`, `accent` color), the card order (`order`, lowest first) and `save_key`, which the launcher reads to show "Saved progress".
- `shell.html`: CSS and markup. It is pasted into `<body>`, so it has no `<html>` or `<head>`.
- `game.js`: the game. `THREE` (r158) and `ARC`, the arcade kit in `shared/kit.js`, are already loaded when it runs. Reuse the kit's model builder, Starwake's aliens and bosses, glow particles and synth before writing your own, and move anything a second game would want into the kit.
- `icon.png` (optional): 256×256 art for the launcher card. Add a drawer for your id to `tools/make_icons.js` and run `node tools/make_icons.js`, or drop in any PNG. Without one the card shows the title's first letter.

## Rules that keep it working offline

- No network requests: no CDNs, web fonts or remote images. Generate models, sound and textures in code, or inline them.
- `game.js` must not contain `</script` or `<!--`, because it is inlined into a `<script>` tag. The build checks this.
- Use your own `localStorage` key. Every game in the arcade shares one origin.
- Check `window.ARCADE` before showing anything arcade-specific. It is unset in the single-file builds.

`python3 tools/build.py` then writes `dist/mygame.html`, `dist/mygame-offline.html` and adds the game to `dist/arcade/`. The offline service worker picks it up automatically.
