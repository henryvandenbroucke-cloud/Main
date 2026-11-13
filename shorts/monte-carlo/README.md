# The Man Who Beat Monte Carlo With a Notebook (Joseph Jagger, 1873)

A 57.1-second vertical animated short (1080x1920, 30 fps), in the same style as the Brink's and stamps shorts. The facts, sources, virality score and shot plan are in `SCRIPT.md`.

## How it's made
- **3D sets, toon-shaded with ink outlines** (`remotion/src/videos/monte/world.ts`), each rendered once as a plate: the Monte Carlo salon (gilt walls, columns, arched windows, three roulette tables, chandeliers); a Yorkshire cotton mill (brick, spinning frames, flywheels); a Yorkshire street of terraced houses at golden hour.
- **A 2D pass** animates the cast, props and camera on top, timed to the words (`shots.ts`).
- **A live 2D roulette wheel laid exactly over the 3D wheel** (`rwheel`, `spinWheel`): it spins, the ball runs and drops, it wobbles when lopsided, and a hair-thin scratch on the rim glints under the magnifier.
- **Hook:** frame 1 is tight on the spinning wheel and ball, then the camera snaps back.
- **Props:**
  - the clerks' tally notebooks filling up, with the sixth one glowing;
  - a lopsided mill flywheel against a dashed perfect circle;
  - nine chips dropping on nine numbers;
  - porters carrying wheels across at night;
  - SOLD boards on the row of houses.
- **Clean frames:** props sit above the captions, nothing overlaps faces, and speech bubbles and labels stay up long enough to read.

## Sound: real recorded effects only
- Every effect is a real CC0 recording (Kenney packs and OpenGameArt CC0 packs): a ball rattling round the frets (recorded ticks that slow down), chips laid and stacked (Kenney Casino Audio), coins, page flips, metal clanks for the cogs, tiptoed footsteps, soft wooden thuds for SOLD boards, a book snapping shut.
- Effects only play on satisfying beats, with soft recorded swishes on the cuts. A compressor on the effects bus keeps them even at −32 LUFS, well behind the voice.
- **Music:** the brick-tax caper band, a hushed night bar for the panic and the swap, warm for Yorkshire, ducked under the voice. The master is −14 LUFS.
- `audio/casino_audio.py` is the shared mix engine; `audio/cues_monte.py` holds this short's word-anchored cues.

## Re-render
Run all of these from `remotion/`. The plates go in `pub_casino/csplates/` (a small public folder, so each render bundle stays small).
- **Plates:**
  ```bash
  PUBLIC=pub_empty node scripts/plates.mjs mc_cu,mill,yorks pub_casino/csplates
  ```
  ```bash
  PUBLIC=pub_empty WIDE=mc_w node scripts/plates.mjs mc_w pub_casino/csplates
  ```
- **Atlas:**
  ```bash
  PUBLIC=pub_empty node scripts/atlas.mjs CasinoAtlas pub_casino/csplates/atlas.png
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/montechunks.sh
  ```
  Chrome draws the canvas on the CPU via `scripts/chrome-cpu.sh`, which is about 10x faster.
- **Sound:** fetch the CC0 packs into `../sfxlib` (Kenney packs from kenney.nl, plus `python3 audio/oga_get.py <pack slugs>`), then:
  ```bash
  python3 audio/casino_audio.py voice.wav voice/words.json out monte
  ```
  Mux `out/mix.wav` into the video as the audio track.

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
