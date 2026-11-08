# The Robbers Who Never Broke a Lock (the Brink's job, Boston 1950)

A 58-second vertical animated short (1080x1920, 30 fps). The script is written in the viral-twist format of the reference Shorts:
- an impossible first line;
- a clever routine;
- the perfect crime;
- a ticking clock;
- "then one of them…";
- a punchline that echoes the hook.

The facts and sources are in `SCRIPT.md`. The top existing Short on this story had 1.4K views.

## Look: studied from @segmentzero
- **Closer framing:** characters fill the frame, and there's a crowd shot of eleven masked men in two tight rows.
- **Signature items on the cast:**
  - **The gang:** rubber Halloween masks (painted rosy cheeks, eye holes, painted brows) and peaked chauffeur caps.
  - **Specs:** round wire glasses.
  - **The G-men, the detective and the hitman:** fedoras.
- **Expressions:** new gritted-teeth ("grit") and "angry" faces, plus talking mouths, brow pops, blinks and steam.
- **Night look:** night is graded in 2D over day-lit 3D plates (deep blue, warm lamp and window pools, vignette, light shafts). It avoids the flat look of real 3D night lighting.
- **Sets:**
  - the Brink's depot on a North End street;
  - a corridor of 1950s office doors with frosted-glass lettering (VAULT, COUNTING ROOM) and brass lock cylinders;
  - the locksmith's bench with a pegboard of keys;
  - the vault room with the cage, the open vault and a wall clock;
  - the hideout;
  - the hospital room.
- **Vector props:**
  - brass keys and a key ring that gains keys;
  - the lock cylinder and a spinning screwdriver;
  - money bags that bulge and fluttering bills;
  - handcuffs, the empty suitcase and a heart monitor;
  - ticks and crosses that draw on, and the alarm-bell and revolver icons.

## Sound: real recorded effects only
- **Where they come from:** every effect is a real recording, either from Kenney's CC0 packs (RPG Audio, Impact Sounds, Interface Sounds, Casino Audio, UI Audio) or from OpenGameArt CC0 packs. The OpenGameArt packs are:
  - "Swishes Sound Pack", "80 CC0 RPG SFX", "100 CC0 SFX", "58 random sound effects";
  - "air whoosh", "camera", "ticking clock", "clock tick", "heartbeat single sound", "10 book page flips";
  - "typewriter sounds", "coin drop", "footsteps", "muffled distant explosion";
  - and others downloaded by `audio/oga_get.py`, which checks the CC0 licence on each page.
- **Placement:** effects play only on satisfying beats:
  - the key in the lock, and the click, click, click;
  - footsteps and the file on the key;
  - page flips on the years and the handcuffs;
  - a muffled shot, then a heartbeat;
  - an FBI knock, the typewriter and a mugshot camera shutter;
  - soft recorded swishes on camera moves.
- **Mixing:** a soft compressor on the effects bus keeps them even, at −32 LUFS, well behind the voice.
- **Music:** the brick-tax caper band in a night-jazz minor mood, muted for the gunshot.

## Re-render
Run all of these from `remotion/`.
- **Plates:**
  ```bash
  node scripts/plates.mjs ext_door,ext_day,corr_cu,smith,vault,hide,hosp public/bkplates
  ```
  ```bash
  WIDE=ext_w,corr_w node scripts/plates.mjs ext_w,corr_w public/bkplates
  ```
- **Video:**
  ```bash
  PRESET=veryfast bash scripts/brinkschunks.sh
  ```
  Chrome uses CPU canvas drawing via `scripts/chrome-cpu.sh`, which is about 10× faster.
- **Sound:**
  1. Fetch the CC0 packs into `../sfxlib`: the Kenney packs from kenney.nl plus `python3 audio/oga_get.py <pack slugs>`.
  2. Build the soundtrack: `python3 audio/brinks_audio.py voice.wav voice/words.json out`.
  3. Mux `out/mix.wav` into the video as the audio track.

Built on the claude-animated-shorts skill (see `LICENSE-claude-animated-shorts`).
