# Step 4: Build the picture   (Opus 5.5, xhigh)

START PROMPT:
"Read amsterdam-houses-short/00_PLAN.md, STATUS.md, outputs/02_voice/*, outputs/03_shots/*. Install Remotion (+ @remotion/three), Node, ffmpeg. Clone the skill, copy templates/bridge/
to src/videos/amsterdam/, register a composition, replace the story parts (story.ts, build.ts layout, cast.ts roles). Keep the look values from SKILL.md unchanged.
Render stills (scripts/bridge-stills.mjs) and fix. Do step 4 only."

Rules: set REMOTION_TMP to a big folder (each bundle copies ~1.3 GB). Render stills at 0.5 scale. New props: a row of tall narrow canal houses, a hoisting beam and hook, a rope and pulley, a sofa, a canal and a bridge.
Look targets: ink about 3 px at 1080, DOF on about 1/3 of screen time, warm key light with blue-purple shadows, characters lit by the scene.
Done when: stills for every shot exist and look right next to references/frames/. Do not do the full render here.
