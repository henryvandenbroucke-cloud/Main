# For Luck: the superstitious card trick that won £7.7 million

A 53.7-second vertical animated short (1080x1920, 30 fps), in the same style as the Brink's and stamps shorts. The facts, sources, virality score and shot plan are in `SCRIPT.md`.

## How it's made
- **3D sets, toon-shaded with ink outlines** (`remotion/src/videos/edge/world.ts`), each rendered once as a plate: Crockfords salon (damask walls, gilt mirrors, an oval baccarat table with a card shoe and chips, a chandelier); the UK Supreme Court (oak panels, the bench, the emblem); an Atlantic City floor with slot machines.
- **A 2D pass** animates the cast, props and camera on top, timed to the words (`shots.ts`).
- **Cards drawn as vectors** (`pcard`): the back's lattice has an uneven border, thin at the top and thick at the bottom, which is exactly what edge-sorting exploits. The thick edge glows when it matters.
- **Hook:** frame 1 is tight on a card being spun round by the dealer's hand, then the camera snaps back.
- **Cast:** Ivey (dark cap), his partner (red dress, hair in a bun, a new `bun` hairstyle in `toon.ts`), the croupier, the stout manager, five justices and an Atlantic City pit boss.
- **Clean frames:** props sit above the captions, nothing overlaps faces, and speech bubbles and labels stay up long enough to read.

## Sound: real recorded effects only
- Every effect is a real CC0 recording (Kenney packs and OpenGameArt CC0 packs): card slides and places (Kenney Casino Audio), chip stacks and cascades, a paper rip for the cheque, a wooden gavel and stamp thud, fluttering paper for the dollars, soft pops for speech bubbles.
- Effects only play on satisfying beats, with soft recorded swishes on the cuts. A compressor on the effects bus keeps them even at −32 LUFS, well behind the voice.
- **Music:** the brick-tax caper band, with a minor turn for the court, ducked under the voice. The master is −14 LUFS.
- `audio/casino_audio.py` is the shared mix engine; `audio/cues_edge.py` holds this short's word-anchored cues.

## Re-render
Run all of these from `remotion/`. The plates go in `pub_casino/csplates/` (a small public folder, so each render bundle stays small).
- **Plates:**
  ```bash
  PUBLIC=pub_empty node scripts/plates.mjs salon_w,salon_cu,uksc,acity pub_casino/csplates
  ```
- **Atlas:**
  ```bash
  PUBLIC=pub_empty node scripts/atlas.mjs CasinoAtlas pub_casino/csplates/atlas.png
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/edgechunks.sh
  ```
  Chrome draws the canvas on the CPU via `scripts/chrome-cpu.sh`, which is about 10x faster.
- **Sound:** fetch the CC0 packs into `../sfxlib` (Kenney packs from kenney.nl, plus `python3 audio/oga_get.py <pack slugs>`), then:
  ```bash
  python3 audio/casino_audio.py voice.wav voice/words.json out edge
  ```
  Mux `out/mix.wav` into the video as the audio track.

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
