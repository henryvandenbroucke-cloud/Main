# Why the Ace of Spades Is So Fancy

A 57-second vertical animated short (1080x1920, 30 fps), in the same style as the brick-tax short.

The story:
- In 1805, Richard Harding was hanged for printing the Ace of Spades.
- From 1765 the Stamp Office printed every duty ace itself, as proof the pack's tax was paid. Card makers printed only the other 51 cards.
- Harding forged the aces and sold cheaper packs.
- A Stamp Office printer named Hockley bought one of those packs and spotted the fake.
- Forgery was a capital crime, so Harding was hanged on 13 November 1805.
- The duty lasted until 1960, which is why the ace in your deck is still the fancy one.

The facts, sources and hook research are in `SCRIPT.md`. The top existing Short on this topic had about 1.5K views.

## Built for retention
The brick-tax analytics showed a drop in the first seconds, then a plateau around 75%. This hook is built against that early drop:
- **Frame 1 already moves:** the camera starts tight on the freshly printed ace on the press, then pulls out fast to reveal Richard lifting it off. You hear a press thunk, a paper peel and a soft whoosh, and puffs of press dust burst out from under the card.
- **The paradox comes first:** "a man was hanged for printing the Ace of Spades". It lands on a gavel slam in a dark courtroom by about 2 s, then the film cuts straight back to his nervous face with the ace's swirls blazing.
- **Always something moving:**
  - a deck fanning open;
  - tavern deals, with packs stamped one, two, three;
  - the duty press slamming;
  - 51 cards flying into a stack with a counter;
  - coins sliding across the counter;
  - the quill drawing the fake ace;
  - fake aces flung onto the drying line;
  - Hockley's magnifier and badge;
  - a dutch tilt with sweat drops and a shrinking candle;
  - the black cap lowered on "death";
  - a riffle shuffle and the duty seal at the end.

## How it's made
- **3D sets, toon-shaded, with ink outlines:**
  - the print shop by candlelight (a wide panorama and a press close-up);
  - the Stamp Office (wide);
  - a tavern card table;
  - the Old Bailey (wide, plus a night close-up);
  - a modern table.

  Each is rendered once as a plate. A 2D pass animates the cast, props and camera on top.
- **Vector playing cards** (`props2d.ts`: `card`, `fan`, `deck`, `hand`), so the ace is crisp at any size. It has spiral flourishes, a laurel ring, a gold-rimmed spade and a "STAMP OFFICE" banner. The forged ace is subtly wobbly and misspelled.
- **A 4096 px 3D sprite atlas** (`Atlas.tsx`) for puffs, drops, coins and the quill. No upscaled, pixelated sprites.
- **Candle grade:** a plum multiply plus warm light pools projected from the real candle positions. The courtroom ending darkens to a single beam.
- **Foley** (`audio/ace_audio.py`):
  - the press thunk and paper peel;
  - a gavel and card flicks;
  - 51 accelerating flicks;
  - coins, the quill scratch and a soft stamp;
  - a heartbeat, a candle snuff and a riffle shuffle.

  The chill music bed sits well under the voice and drops out for "Wait…" and the hanging.
- **Voice:** "Uncle Mike" from ElevenLabs. Pauses were cut to 70 ms and the take was sped up 1.06x. Captions are word-timed with faster-whisper (`voice/`).

## Re-render
Run all of these from `remotion/`.
- **Plates:**
  ```bash
  node scripts/plates.mjs shop_cu,tav_g,tav_cu,court_cu,court_n,today public/acplates
  ```
  ```bash
  WIDE=shop_n,tax_d,court node scripts/plates.mjs shop_n,tax_d,court public/acplates
  ```
- **Atlas:**
  ```bash
  node scripts/atlas.mjs AceAtlas public/acplates/atlas.png
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/acechunks.sh
  ```
  It uses 3 workers. Re-render any blank range with 2 workers, then check with `scripts/short_qa.py`.
- **Mux:** build the soundtrack with `python3 audio/ace_audio.py voice.wav voice/words.json out`, then mux `out/mix.wav` into the video as the audio track.

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
