# ZenWidget

> **Read in:** **English** · [Русский](README.ru.md)

A floating widget with a collection of relaxing mini-games. Lives on top of other windows on desktop, runs as a regular app on mobile. Built for the moments when you want a 30-second break — not a session.

**Принципы / Core principles:** no timers, no game over, no scores. Calm visuals, light on resources, every game is self-contained.

---

## Why this exists

You're working or studying, you need to put your hands somewhere for a minute. Most "casual games" are not casual at all — they have goals, leaderboards, ads, login walls. ZenWidget is the opposite: pop a few bubbles, rake some sand, watch the lava lamp, switch back to your work. That's it.

---

## The games

20 mini-games, all rendered with plain Canvas, all with mouse + touch support.

| Game | Icon | What it is |
|---|:---:|---|
| Bubbles | 🫧 | Tap to pop, they refill in a wave |
| Clouds | ☁️ | Drag, throw, they drift back |
| Sand | ⌛ | Classic falling-sand. Right-click clears |
| Zen Garden | 🪨 | Rake patterns around three stones |
| Water | 🌊 | Height-field ripples, fish flee from splashes |
| Fireflies | ✨ | They scatter from the cursor |
| Pendulum Wave | 🌀 | Nine pendulums, mesmerising patterns |
| Campfire | 🔥 | Drag logs onto the pit, keep the fire alive |
| Holo Paper | 🌈 | Brush over invisible paper, hidden colours emerge |
| Newton's Cradle | 🔵 | Pull a ball, watch momentum travel |
| Metronome | 🎵 | Real ticking sound, slide the weight to change BPM |
| Lava Lamp | 🫠 | Metaballs, drag a blob to mess with the flow |
| Aurora | 🌌 | Northern lights, the cursor disturbs them |
| Ink | 🖋️ | A drop spreading in water |
| Aquarium | 🐟 | Click to drop food, fish chase it |
| Leaves | 🍂 | Falling, blow them with the cursor |
| Snow Globe | ❄️ | Shake it; loads your own photo as a scene |
| Tetris | 🟦 | No score, no game over — just blocks |
| Snake | 🐍 | Place food, the snake finds the path itself |
| Generator | ⚡ | Crank a handle, light a bulb, drive a train |

Six games have procedural sound (metronome, Newton's cradle, bubbles, generator, campfire, sand) generated entirely with Web Audio API — no audio files, no downloads. Toggle with the 🔊 button.

---

## Install

Pre-built binaries are attached to each release. Pick your platform:

### macOS

1. Download the `.dmg` from [Releases](../../releases).
2. Open it and drag ZenWidget to Applications.
3. **First launch:** right-click the app → **Open** → **Open**. This is needed once because the app isn't signed with an Apple Developer certificate. After that, it launches normally.

### Windows

1. Download the `.msi` from [Releases](../../releases).
2. Run it. SmartScreen will warn you ("Windows protected your PC") — click **More info** → **Run anyway**.
3. Look for ZenWidget in the system tray.

### Linux

1. Download the `.AppImage` from [Releases](../../releases) (works on most distros).
2. `chmod +x ZenWidget*.AppImage && ./ZenWidget*.AppImage`
3. Or grab `.deb` for Debian/Ubuntu and install with `sudo dpkg -i`.

Requirements: a compositing window manager for transparency (GNOME, KDE, Cinnamon — yes; bare i3 — no).

### iOS / Android

Distributed via TestFlight (iOS) or as an APK (Android) when a release is ready. See the latest release notes for the link.

---

## Build from source

You need Node.js 18+, Rust (stable), and platform-specific tooling (Xcode for macOS/iOS, Visual Studio Build Tools for Windows, Android Studio for Android).

```bash
git clone <this-repo>
cd swiper
npm install
```

### Desktop (Tauri)

```bash
# Run with hot reload
npm run tauri dev

# Build release artifacts (.dmg / .msi / .AppImage / .deb)
npm run tauri build
```

Output goes to `src-tauri/target/release/bundle/`.

### Mobile (Capacitor)

First-time setup:

```bash
npx cap add ios       # macOS + Xcode + CocoaPods
npx cap add android   # Android Studio + JDK 17
```

Then sync and open the native project:

```bash
npm run cap:ios       # opens Xcode
npm run cap:android   # opens Android Studio
```

Build the actual binary from inside the IDE.

### Multi-platform via GitHub Actions

A workflow at [.github/workflows/build.yml](.github/workflows/build.yml) builds **macOS, Windows and Linux in parallel** when you push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

It produces a draft GitHub Release with all the bundles attached.

---

## Architecture

The whole thing is **vanilla JS + Canvas**. No bundler, no framework, no npm dependencies in the runtime path. The Tauri / Capacitor layers only wrap the same `src/` directory into native shells.

```
src/
├── index.html          — game registry, runtime platform detection
├── style.css           — variables, .tauri / .capacitor / .macos / .windows / .linux modes
├── core/
│   ├── gameManager.js  — registry, switch, rAF loop, 30/10 FPS throttle, ResizeObserver
│   ├── widgetShell.js  — drag (mouse + touch), minimise, picker, mute, close
│   └── audio.js        — Web Audio API singleton: tick / clack / pop / motor / fire / sand
└── games/
    └── <name>/index.js — one game = one file
```

### Game module contract

Every game is a default-export object:

```js
export default {
  name:   'bubbles',           // unique id (camelCase)
  label:  'Bubbles',           // human-readable name shown in the picker
  icon:   '🫧',                // emoji shown in the picker tile

  init(canvas, ctx, opts) {},  // set up state, attach listeners
  update(dt) {},               // called every frame, dt in ms
  handleInput(event) {},       // optional — most games attach listeners directly
  pause() {},                  // widget hidden / not visible
  resume() {},                 // widget visible again
  destroy() {},                // remove listeners, drop references — must be exhaustive
}
```

### Conventions

- **No external dependencies** in `src/`. No npm, no CDN.
- **Animation via `requestAnimationFrame` only.** `setInterval` is allowed only for non-visual side-effects.
- **FPS throttling** is centralised in `gameManager.js` via timestamps, not separate timers.
- **Memory:** don't allocate inside the update loop. Use object pools when there are more than ~50 active particles.
- **Cleanup:** every `addEventListener` must have a matching `removeEventListener` in `destroy()`. The harness will not save you.
- **No `console.log`** in committed code.
- **No `localStorage` / cookies / network I/O.** The widget is self-contained.

---

## Adding a new game

1. Create `src/games/<name>/index.js` matching the contract above.
2. Register it in `src/index.html`:

```js
import myGame from './games/myGame/index.js';
// ...
manager.register(myGame);
```

3. Add a row to the table in this README (and `CLAUDE.md` if you're contributing).

That's it — the picker, drag, resize, mute, FPS throttle and pause-on-hide come for free.

---

## Acknowledgements

Built with [Tauri](https://tauri.app/), [Capacitor](https://capacitorjs.com/), and a stubborn refusal to use a framework.

Sounds are 100% procedural via Web Audio API — no samples, no licences.

---

## License

TBD. Suggestions welcome.
