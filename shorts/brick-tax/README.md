# The Man Who Made Bricks Too Big

A 67-second vertical animated short (1080x1920, 30 fps). In 1784 Britain taxed every brick, so Joseph Wilkes of Measham made his bricks twice as big. The government then charged double on oversized bricks, and his "gobs" still stand in Measham today.

It is made in the cartoon-characters-in-a-3D-world style of the [claude-animated-shorts](https://github.com/mromidev/claude-animated-shorts) skill (MIT, see `LICENSE-claude-animated-shorts`). That skill's look was measured from the latest 20 shorts of a reference channel.

## How it is built
1. **Script and facts:** `SCRIPT.md` has the sources. It follows the hook, setting, escalation, "Wait...", "You see," and ironic payoff formula.
2. **Voice:** the ElevenLabs take, with every pause shrunk to 70 ms (`voice/cut.py`, 78.3 s down to 67.0 s). Word timings come from faster-whisper (`voice/words.py`, saved as `voice/words.json`), and every reaction and cut is timed to these words.
3. **3D plates** (`remotion/src/videos/brick/{world,story,Plate}.tsx`): each set is rendered once per camera with three.js inside Remotion, using the skill's world ink, painted textures, two-tone sun, lens blur and grade. There are four sets:
   - Measham high street, with Wilkes' cottage of double-size bricks
   - the brickyard, with bottle kilns, drying shed, brick hacks and the moulding bench
   - the Treasury in London
   - the "same wall, half the bricks" pair of walls
4. **2D pass** (`shots.ts`, `Short.tsx`, `view.ts`, `props2d.ts`): a virtual camera moves over each plate. It does creeping push-ins, smootherstep glides, rolls and impact kicks. The skill's flat cartoon cast is projected onto the 3D ground with contact shadows, scene tint and depth blur. Props and effects sit on top (stamp, coins, mould, scroll, dimension arrows, question marks, steam, rain cloud), along with crossfades, the hook flash and one-word captions.
5. **Sound** (`audio/brick_audio.py`): an original synthesized caper score (oompah tuba, pizzicato, glockenspiel, brass) that changes with each story beat, with SFX on every gag. The music ducks under the voice, and the master is -14 LUFS at -1 dBTP.

## Re-render
```bash
cd remotion && npm install && npm install @remotion/bundler@4.0.290 @remotion/renderer@4.0.290 @fontsource/montserrat@5.1.0
```
```bash
node scripts/plates.mjs town_gob,town_ms,town_wide,town_end_g,yard_wide,yard_ms,yard_stack,yard_group,yard_table,yard_ms_g,tres_wide,tres_ms,walls public/plates
```
```bash
node scripts/render.mjs BrickShort out/video.mp4 all 1 4
```
```bash
python audio/brick_audio.py voice/voice.wav audio/out
```
```bash
ffmpeg -i out/video.mp4 -i audio/out/mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k final.mp4
```
Before rendering, set `browserExecutable` in the scripts to a Chrome or Chromium binary on your machine.
