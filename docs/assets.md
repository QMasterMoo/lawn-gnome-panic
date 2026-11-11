# Free assets

Rule: only assets that cost nothing and carry no conditions. That means CC0 / public domain. Anything else (CC-BY, "free for non-commercial", "free with attribution") is out unless the human says otherwise for a specific asset. Record every external file in the game's `CREDITS.md`: file, source URL, author, license.

The cheapest asset is one generated in code: Phaser `Graphics` → `generateTexture`, WebAudio synth sounds, CSS/system fonts. Prefer that for a first prototype.

## CC0 sources

| Source | What | Notes |
|---|---|---|
| [Kenney](https://kenney.nl/assets) | 2D sprites, tilesets, UI, 3D models, audio, fonts | All CC0. Consistent styles, so packs mix well. Zips are direct downloads from each asset page. |
| [Quaternius](https://quaternius.com) | Low-poly 3D characters with **built-in animation clips** (walk, run, attack, death), environments | CC0. The way to get animated characters into Unity or three.js without touching an animation editor. glTF/FBX. |
| [Poly Pizza](https://poly.pizza) | Low-poly 3D models | Mixed licenses: filter to CC0, check each model. |
| [OpenGameArt](https://opengameart.org) | 2D, 3D, music, SFX | Mixed licenses: use the CC0 filter, check each item. |
| [ambientCG](https://ambientcg.com) | PBR textures, HDRIs | CC0. |
| [Poly Haven](https://polyhaven.com) | HDRIs, textures, models | CC0. |
| [Freesound](https://freesound.org) | Sound effects | Mixed licenses: filter to CC0. |
| [Game-icons.net](https://game-icons.net) | Icons | CC-BY 3.0, so attribution is required. Out by default. |

Not CC0, so ask first: Mixamo (free with an Adobe account, cannot be redistributed as raw files), the Unity Asset Store (free items use the Asset Store EULA, not CC0).

## Using a pack in a Phaser game

1. Download into `games/<name>/public/assets/<pack>/`. Vite serves `public/` at the site root.
2. Load with `this.load.image('key', 'assets/<pack>/file.png')` or `this.load.spritesheet('key', path, { frameWidth, frameHeight })`.
3. Animate from code: `this.anims.create({ key: 'walk', frames: this.anims.generateFrameNumbers('key', { start: 0, end: 3 }), frameRate: 8, repeat: -1 })`.
4. Add the line to `CREDITS.md`.
