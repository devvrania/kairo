# Kairo

Kairo is Rania's coding companion. His name means "the victorious one" in Arabic
(from القاهرة, *al-Qāhirah*, Cairo) and "circuit" in Japanese (回路). He is a 3D anime-style character who sits at a
late-night desk, types, follows the visitor's cursor with his eyes and head, and greets people who click him.

This repo holds the character itself: the model, his profile, and a standalone demo scene.
The portfolio lives in a separate repo and uses this one as its source for Kairo.

## What's here

```
kairo/
├── index.html        The scene page
├── main.js           Scene code (Three.js + @pixiv/three-vrm, no build step)
├── kairo.json        Profile: name, role, theme colors, rig limits, greeting lines
├── model/kairo.vrm   The 3D model (VRM 0.x, ~30k triangles, 20 MB)
├── serve.py          Local server: serves only Kairo's files and opens the browser
├── package.json      `npm start` shortcut for serve.py
├── LICENSE-MODEL.md  License and credit for the model
└── README.md
```

## Run

```sh
cd kairo
npm start            # or: python3 serve.py
```

Kairo opens at http://127.0.0.1:5180. Press Ctrl+C to stop.
If the port is busy, run `python3 serve.py 5181`.

The server only serves `index.html`, `main.js`, `kairo.json` and `model/kairo.vrm`.
There are no folder listings, and `.git` and other files are never exposed.
The page loads Three.js from a CDN, so it needs an internet connection.

## What the scene does

- **Seated typing pose**, computed from the model's own bones, so the desk and chair fit his proportions.
- **Eye tracking:** eyes follow the cursor (±16° yaw), the head and neck follow with a lag (±60°, split 40% neck / 60% head).
- **Moods run on their own**, no buttons needed:

  | Moment | What he does |
  |---|---|
  | Page loads | Says hello with a warm smile, looks at the visitor, lips move |
  | Typing, nobody around | Calm, focused face, eyes on the screen |
  | Visitor moves the mouse | Watches the cursor, relaxed |
  | Visitor clicks him | Brief happy smile, says his next line (one line per click; a second quick click does nothing) |
  | Three quick clicks | Startled for a second, then laughs it off; more clicks are ignored until he finishes |
  | First after 12–18 s, then every 15–25 s while idle | Gazes out the window, or does a full stretch (below), then gets back to work |

- **The stretch** (about 5.5 s):
  1. Lifts his hands off the keyboard and shrugs his shoulders.
  2. Reaches up and leans back, wrists bent back, fingers spread, yawning with his eyes closed.
  3. Leans to one side, then the other, arms still up.
  4. Lowers his arms and rolls his neck side to side.
  5. Settles with a satisfied smile and goes back to typing.
- **Life:** random blinking, breathing, finger presses while typing, code typing itself on the monitor.
- **Greeting lines** come from `kairo.json` (`greetings`, plus an optional `reactions.surprised`).
- **Physics:** hair and jacket spring bones, with seat and backrest colliders.
- **Scene:** dark room, snowy night-city window, moonlight, monitor glow, warm desk lamp, red accent rim light.

## Debug panel

Hidden for visitors. Open it with `?debug` in the URL (http://127.0.0.1:5180/?debug) or press **D**.
It shows his current mood and lets you force gaze, expression, typing, and a free camera.
While it's open, **S** makes him stretch and **W** makes him look out the window.
During a stretch the readout shows the time into the sequence.

## Model details

| | |
|---|---|
| Format | VRM 0.x (VRoid Studio 1.26) |
| Skeleton | 54 humanoid bones incl. eyes and all fingers |
| Look-at | Bone type (eye bones) |
| Expressions | neutral, relaxed, happy, angry, sad, Surprised, blink (L/R), visemes aa ih ou ee oh |
| Spring bones | 10 groups (hair, jacket arms and legs), 12 collider groups |
| Size | ~30k triangles, 20 MB (mostly textures) |

## Known issues / next steps

- **File size:** compress textures (KTX2/WebP) before shipping on the web; target 3–5 MB.
  Use a VRM-aware tool (e.g. the VRM Add-on for Blender) so the VRM extension data survives.
- **Desk lamp shadow is off:** three-vrm 3.1 MToon fails to compile with spot-light shadows on three r169.
- **Seat collider is an infinite plane:** hair can't fall below seat height even past the seat edge.

## Credit

3D model: AvatarSample_C by VRoid Project (pixiv). See `LICENSE-MODEL.md`.
Character name, profile, scene and code: Rania.
