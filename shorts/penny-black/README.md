# Why Stamps Exist

A 63-second vertical animated short (1080x1920, 30 fps), in the brick-tax style.

The story:
- Before 1840 you paid to *receive* a letter.
- Coleridge watched a woman refuse her brother's letter. He paid the shilling for her, and the sheet was blank: it was her brother's free "I'm fine" signal.
- People drew secret marks on the outside of letters, read them at the door and refused to pay. The Post Office carried mail for nothing.
- Rowland Hill proposed that the sender pays one penny, proved by a tiny picture of the Queen. That became the Penny Black (1840).
- Letters more than doubled that year.

The facts and sources are in `SCRIPT.md`. The top existing Short on this angle had 3.8K views.

## How it's made
- **3D sets, toon-shaded with ink outlines** (`world.ts`), each rendered once as a plate. A 2D pass animates the cast, props and camera on top.
  - A **Lake District cottage**: whitewashed, slate roof, porch, roses, a dry-stone wall and gate, a flagstone path, sheep, a lake with an island, and fells in the haze. It has a wide panorama, a doorstep close-up, and a golden-hour version of the close-up.
  - A **Georgian London terrace**: brick houses, iron railings, lamp posts, cobbles. Wide panorama plus a doorstep close-up.
  - The **Post Office sorting hall**: a wall of pigeonholes stuffed with letters, a clock and crests, sorting tables heaped with stacks of letters, mail sacks, hanging lamps, a brass-grilled counter.
  - **Rowland Hill's study**: bookshelves, a sash window, a desk with papers, an inkwell and an oil lamp, and a globe.
  - A modern desk for the ending.
- **Living faces** (`toon.ts`):
  - mouths that open and close in syllables while a character talks (`talk`);
  - an eyebrow pop and a little hop on every expression change;
  - blinks that hide every expression swap.
- **Vector props, crisp at any size** (`props2d.ts`):
  - a folded 1830s letter with a wax seal and handwritten address, which flips over;
  - the blank sheet unfolding;
  - secret marks that draw themselves;
  - the Penny Black (Queen Victoria's profile, POSTAGE / ONE PENNY, check letters, imperforate);
  - shilling and penny coins;
  - the Royal Mail coach with galloping horses.
- **Hook:** frame 1 is tight on the letter being pushed back into the postman's hand. The camera snaps out with a paper flick and a whoosh.
- **Sound** (`audio/penny_audio.py`): the brick-tax caper band (oompah tuba, pizzicato, glockenspiel, brushes, brass stabs), kept chill and well under the voice. Soft foley on every beat:
  - knocks, coin flicks and spins, seal cracks, paper unfolds;
  - calendar flips and rubber-stamp thumps;
  - hooves, the coach horn and a moth;
  - the "idea" ding, cheering, and raining letters.
- **Voice:** "Uncle Mike" from ElevenLabs, with emotion tags (`VOICEOVER_TAGGED.txt`). Pauses were cut to 70 ms and the take was sped up 1.10x. Captions are word-timed with faster-whisper (`voice/`).

## Re-render
Run all of these from `remotion/`.
- **Plates:**
  ```bash
  node scripts/plates.mjs door_cu,door_g,street_cu,po_cu,study,today public/pnplates
  ```
  ```bash
  WIDE=lake_w,street_w,po_w node scripts/plates.mjs lake_w,street_w,po_w public/pnplates
  ```
- **Atlas:**
  ```bash
  node scripts/atlas.mjs PennyAtlas public/pnplates/atlas.png
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/pennychunks.sh
  ```
  It uses 3 workers. Re-render any blank range with 2 workers, then check with `scripts/short_qa.py`.
- **Sound:** build it with `python3 audio/penny_audio.py voice.wav voice/words.json out`, then mux `out/mix.wav` into the video as the audio track.

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
