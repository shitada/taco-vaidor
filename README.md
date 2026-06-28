# 🌮 Taco-Vaidor 🦑

A browser remake of a **Space Invaders–style** game, ported from a Python/pygame
original to vanilla JavaScript + HTML5 Canvas. No build step, no dependencies —
just open it in a browser.

**▶ Play it:** https://shitada.github.io/taco-vaidor/

---

## Gameplay

Blast your way through **7 stages** of invading octopuses and giant-squid bosses.

- 🐙 **Octopus waves** — classic invader formation that speeds up as you thin the ranks.
- 🦑 **Giant squid bosses** — aimed shots and radial spread patterns; the final stage has **two**.
- 🧪 **Life potions** — fall from the top a few times per stage; grab them to gain a life (up to 99).
- 🎚️ **Difficulty ramps** across stages: `easy → medium → difficult → insane`.
- 🎨 **Four backgrounds**: forest, city, outer space, and a certain blue robot's room.
- 🎵 **Procedural chiptune** — pop loop on normal stages, classical loop on boss stages, all synthesized live with the Web Audio API (no audio files).

## Controls

**Keyboard**

| Action  | Keys                    |
| ------- | ----------------------- |
| Move    | `←` `→` or `A` `D`      |
| Shoot   | `Space`                 |
| Volume  | `↑` `↓`                 |
| Mute    | `M`                     |
| Restart | `R` (after game over)   |

**Touch (iPad / iPhone)**

On-screen controls appear automatically on touch devices:

| Action  | Touch                                            |
| ------- | ------------------------------------------------ |
| Move    | **Drag** anywhere on the playfield, or hold ◀ / ▶ |
| Shoot   | Hold the **FIRE** button                         |
| Mute    | 🔊 button (top-right)                            |
| Restart | **Tap** the playfield (after game over)          |

Drag-to-move and the FIRE button are multitouch, so you can steer and shoot
at the same time.

> Browsers block audio until you interact with the page, so click **START**
> (or press `Space` / `Enter`) to begin.

## Run locally

It's a fully static site. Any static server works:

```bash
# Python
python3 -m http.server 8000
# then open http://localhost:8000
```

Or simply open `index.html` directly in your browser.

## Add to Home Screen (iPad / iPhone)

Open the site in Safari, tap **Share → Add to Home Screen**, then tap **Add**.
The game gets the Taco-Vaidor app icon and launches full-screen (standalone),
with no Safari chrome. iPad, iPad Pro and iPhone icon sizes are all provided.

## Project structure

```
taco-vaidor/
├── index.html             # page + canvas + start overlay + icon/meta tags
├── style.css              # layout and start screen styling
├── manifest.webmanifest   # PWA manifest (standalone, icons, theme)
├── icons/                 # iPad/iOS home-screen, PWA & favicon images
├── js/
│   ├── audio.js           # Web Audio synth: SFX + procedural BGM loops
│   └── game.js            # game loop, entities, collisions, rendering
├── tools/
│   └── generate_icons.py  # regenerates the icons (Pillow)
└── .github/workflows/
    └── deploy.yml          # GitHub Pages deployment
```

## Technical notes

- **Fixed 60 Hz timestep.** The original ran at a fixed 60 FPS with frame-based
  movement. The port uses an accumulator that steps the simulation in fixed
  `1000/60 ms` chunks, so gameplay speed is identical on 60 Hz, 120 Hz, or any
  display.
- **Everything is synthesized.** Sound effects and both music loops are generated
  into `AudioBuffer`s at runtime — a direct port of the original synth routines.
- **Pre-rendered sprites.** Each sprite is drawn once to an offscreen canvas and
  blitted each frame, mirroring how the original created its surfaces.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which uploads the
repository contents and publishes them to GitHub Pages.

## License

MIT
