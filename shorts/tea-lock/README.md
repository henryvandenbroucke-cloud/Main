# Why Tea Was Locked in a Box

A 53-second vertical animated short (1080x1920, 30 fps).
- Georgian tea was taxed at about 119%, so it was kept in locked caddies and the lady of the house held the key.
- Smugglers rowed it ashore at night, and by 1784 about two-thirds of the tea drunk in Britain was illegal.
- Crooks sold dyed ash leaves ("smouch") and resold used leaves.
- Then Pitt cut the tax to 12.5%, and smuggling collapsed.
- The facts and sources are in `SCRIPT.md`. The top existing Short on this topic had 13K views.

## What's new in this one
- **3D-rendered sprite atlas** (`Atlas.tsx`, rendered once with `scripts/atlas.mjs`): real toon-shaded 3D models with ink outlines and key/rim light.
  - Tea leaves, ash leaves, steam puffs and water spray.
  - The caddy at 8 lid angles and the key at 8 turn angles.
  - A sack, cup, spoon, coin, boat, barrel, quill and scissors.
  - The 2D pass animates them: bursts, pours, steam, spray and coin arcs, with motion smears. So the particles read as made in a 3D package, not flat circles.
- **One consistent world, no flat cut-away screens:**
  - a Georgian drawing room (wide, table close-up, the servants' door, Pitt's desk);
  - a moonlit beach as a wide panorama, with a 2D night grade and moon;
  - the crooks' shed, also a wide panorama.
- **Hook full of motion:** a camera push from frame 1, the lid slams with a leaf puff, the key slides in and turns with a glint, then a fast tilt up to her smug face.
- **Purpose-built foley** (`audio/tea_audio.py`):
  - a wooden lid clack with bounce-rattle and a two-stage brass lock click;
  - crisp leaf crackles and pours, porcelain clinks, a tea-pour gurgle, coins into a sack;
  - surf and oars, a scissors shink, and a penny spinning down to a ring.
  - The chill music bed sits about 18 dB under the voice.

## Re-render
- Plates: `node scripts/plates.mjs dr_wide,dr_cu,dr_door,dr_desk public/tlplates`, then `WIDE=beach_n,shed_d node scripts/plates.mjs beach_n,shed_d public/tlplates`.
- Atlas: `node scripts/atlas.mjs TeaAtlas public/tlplates/atlas.png`.
- Video: `PRESET=veryfast bash scripts/teachunks.sh` (3 workers; re-render any blank range with 2).
- Audio: `python audio/tea_audio.py voice/voice.wav voice/words.json audio/out`.
