# The GTA 6 Leak That Came From a Hotel TV

A 48-second vertical animated short (1080x1920, 30 fps), timed for GTA 6's launch week (19 November 2026). The facts, sources, virality score and shot plan are in `SCRIPT.md`.

## Making it read as GTA from frame 1
- **The hook:** the first frame is tight on the hotel TV, which shows our own neon "Leonida" sunset and a big **GTA 6** title. LEAKED stamps across, and the camera pulls back into the dark hotel room.
- **A GTA-style HUD runs all the way through** (our own design, not any game's assets):
  - a "GTA 6 LEAK" tag at the top left;
  - a **wanted meter** at the top right that fills one star per crime: on bail, hacking in, 90 clips, posted online, the threat.
  - At five stars it flashes red and blue until a big **BUSTED** at the hotel door.
- **Leonida:** a neon beach at sunset with palms, pastel art-deco hotels with neon trim, a lifeguard tower and the sun's glitter path. It plays three roles:
  - it's the picture on the hotel TV and in the leaked clips;
  - the record-breaking trailer plays on a roof billboard;
  - the "November 19" finale has a wave of gamepads.
- **No real logos or game art.** The title is set in our own type with a sunset gradient. The studio is a generic office, and the teenager is not named or caricatured.

## How it's made
- **3D sets, toon-shaded with ink outlines** (`remotion/src/videos/gta/world.ts`), each rendered once as a plate:
  - a budget hotel room (purple feature wall, bed, a window onto the city at night, a TV on the dresser, door 214);
  - the hotel corridor down to room 214;
  - the game studio (a wall of 12 screens between two sunset-beach murals, a pink neon strip, desks);
  - the Crown Court;
  - Leonida, under a new **"vice" light** (pink-orange low sun, violet shade, magenta-to-indigo sky).
  - The palm trees are new geometry: a curved, ringed trunk and drooping fronds.
- **Night is graded in 2D** over day-lit plates: deep blue, with the TV's blue glow as the light pool.
- **Cast** (`toon.ts`):
  - the teenager, in a dark hoodie with a new **hood** style;
  - UK police in hi-vis yellow;
  - the judge;
  - the studio staff, who freeze in shock.
- **Vector props** (`shots.ts`):
  - a laptop that slams shut and an evidence bag that zips;
  - a streaming stick with a blinking LED;
  - a phone rising out of its box;
  - a generic "STUDIO CHAT" window whose padlock opens and whose "GTA 6 TEST BUILD" folder glows;
  - a wall of 90 clip tiles;
  - a view counter, a world-record medal and gamepads.

## Sound
- **Music:** our own 80s synthwave groove (detuned saw pads, an octave-pumping saw bass, a plucked arpeggio, soft gated drums), ducked well under the voice.
  - It drops to pads for the set-up.
  - It cuts out hard on BUSTED and becomes a hushed pad in court.
  - It goes silent when the TV clicks off.
- **Effects:** only about 8 soft, real CC0 recordings: a remote click, one swish, the laptop shutting, a key-card beep, the stick clicking in, a knock, the gavel and the TV switching off.
- `audio/casino_audio.py` is the shared mix engine, and `audio/cues_gta.py` holds this short's music and cues. The master is −14 LUFS.

## Re-render
Run all of these from `remotion/`.
- **Plates:**
  ```bash
  PUBLIC=pub_empty node scripts/plates.mjs hotel_w,hotel_tv,corr_w,corr_door,studio_w,studio_mon,court,leo_w,leo_bb pub_gta/gtplates
  ```
- **Atlas:**
  ```bash
  PUBLIC=pub_empty node scripts/atlas.mjs GtaAtlas pub_gta/gtplates/atlas.png
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/gtachunks.sh
  ```
  Chrome draws the canvas on the CPU via `scripts/chrome-cpu.sh`.
- **Sound:**
  ```bash
  python3 audio/casino_audio.py voice.wav voice/words.json out gta
  ```
  Then mux `out/mix.wav` into the video as the audio track.

The voiceover repeated one line ("Then he messaged… the game's code is next"). The repeat was cut before timing (`voice/`).

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
