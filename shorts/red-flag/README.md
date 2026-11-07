# The Man Who Walked in Front of Cars

A 53-second vertical animated short (1080x1920, 30 fps) about Britain's "Red Flag" law.
- From 1865, a man walked 60 yards ahead of every road engine waving a red flag, at 4 mph (2 in towns).
- The flag went in 1878, but the walking man stayed until 1896.
- The end of the law was celebrated with the Emancipation Run to Brighton, which is still driven every November.
- The facts and sources are in `SCRIPT.md`.

## How it's made
- **Set:** one 3D village road with two plates: a 5400 px side-on panorama the camera follows along, and a high wide shot.
- **Few cuts:** the camera tracks the procession continuously. A steam wipe, crossfades and one whip pan join the beats.
- **Characters and vehicles:** 2D, sorted by depth with each other.
  - A steam road engine with strake wheels, a spinning flywheel and chimney puffs.
  - An 1890s car with wire wheels and a squeezable bulb horn.
  - A rearing horse with a tipping hay cart.
  - A red flag whose cloth moves with a travelling wave.
- **Effects:**
  - a springy MPH dial;
  - the "60 YARDS" line drawing itself during a camera glide;
  - a law scroll, crew pop-ins with labels, the flag blowing away;
  - confetti for the torn flag;
  - November leaves over the vintage-car parade.
- **Timing:** every event hangs off a spoken word (`A("word")` in `shots.ts`), so a new voice take re-times the film by itself.
- **Sound** (`audio/redflag_audio.py`, timed from the same words):
  - a chill pizzicato and glockenspiel bed in F, sitting about 18 dB under the voice and ducked 8 dB;
  - soft SFX: chuffs, hooves, horn, dial ticks, paper, pops, a light cheer.

## Re-render
- Plates: `WIDE=road node scripts/plates.mjs road_wide,road public/rplates`, then copy `road.png` to `road_w.png`.
- Voice: `cut.py`, then `atempo=1.08`, then `words.py`.
- Video: `PRESET=veryfast bash scripts/rchunks.sh`.
- Audio: `python audio/redflag_audio.py voice/voice.wav voice/words.json audio/out`.
