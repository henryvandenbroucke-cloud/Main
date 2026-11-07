# The Pensioner Who Stole a Masterpiece

A 60-second vertical animated short (1080x1920, 30 fps) about Kempton Bunton.
- In 1961 a Goya portrait vanished from London's National Gallery 19 days after it went on display. Police assumed a gang of master thieves, and the painting even turns up as a joke in the first James Bond film.
- The thief was a 61-year-old Newcastle pensioner protesting the TV licence fee.
- He gave the painting back in 1965. The jury found him not guilty of stealing the painting but guilty of stealing the frame: three months.
- Files released in 2012 showed his son had confessed to doing the break-in.
- The facts and sources are in `SCRIPT.md`. The top existing Short on this story had 15K views.

## What's new in this one
Studied from the reference short's frames:
- **Close-ups:** giant deadpan foreground faces (detective, judge) over soft-focus backgrounds.
- **Lighting:** a moonlit-blue night with a glowing window, and toy-bright interiors.
- **Cast:** white round heads.
- **Sets:** four 3D sets in one scene: the gallery (day, night, close-up), its back wall at night, a courtroom (wide panorama) and a 1960s front room.
- **Satisfying 2D beats:**
  - an evidence board whose red strings draw themselves;
  - a calendar riffling 19 pages;
  - thought bubbles (a masked gang, a rich collector);
  - a cinema gag with a generic villain's lair, with no film characters or branding;
  - a crumpled TV-licence bill lobbed at the TV;
  - a ransom note that assembles one cut-out letter at a time;
  - jurors nodding with ticks;
  - gavel strikes with NOT GUILTY on the portrait and GUILTY on the empty frame;
  - slamming jail bars, a SECRET file that opens on the son, and the law book;
  - a final "PLEASE DO NOT BORROW" sign.
- **Sound:** a chill, quiet caper bed about 18 dB under the voice, muted for "Wait...". The effects are soft: tiptoes, string zips, page ticks, a pop per letter, gavel knocks, stamps.

## Re-render
- Plates: `node scripts/plates.mjs gal_d,gal_n,gal_cu,ext_n,court_cu,home public/gyplates`, then `WIDE=court node scripts/plates.mjs court public/gyplates`.
- Video: `PRESET=veryfast bash scripts/gchunks.sh`. If memory is tight, use concurrency 2 for heavy ranges.
- Audio: `python audio/goya_audio.py voice/voice.wav voice/words.json audio/out`.
