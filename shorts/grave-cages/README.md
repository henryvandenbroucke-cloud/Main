# Why People Locked Their Dead in Cages

A 75-second vertical animated short (1080x1920, 30 fps) about Scotland's mortsafes. These were iron cages padlocked over fresh graves to stop body snatchers, who sold corpses to anatomy schools. The cages stayed on for about six weeks and were then rented to the next family. Burke and Hare skipped the digging entirely, and the Anatomy Act of 1832 finally ended the trade. The facts and sources are in `SCRIPT.md`.

The topic is a sibling of the reference channel's grave-bell short (11M views), which is also a graveyard custom with a hidden reason. The story, script and characters are our own.

## What's new in this one (v2 engine)
- **Plates at 1.5x** (1620x2880), so push-ins up to 1.5x stay at native sharpness.
- **New night preset** (`lights.ts`, `grade.ts`): saturated moonlit blue, a moon disc, and HDR lanterns and windows that glow through the bloom pass.
- **Set variants:** one hero grave can be a fresh mound, the snatchers' head-end hole, a fully opened pit, or caged.
- **Clean animation** (`anim.ts`):
  - poses ease in with a small overshoot instead of snapping;
  - walkers follow paths with the stride locked to distance travelled, so feet don't slide;
  - every expression change is hidden by a blink.
- **Motion blur and whip pans** (`Short.tsx`): fast camera moves and whip transitions are averaged over 3–7 sub-frames.
- **Quieter music** (`audio/grave_audio.py`): the score sits about 3.6 dB under the brick short, ducks 6 dB under the voice, and the master is -14 LUFS.

## Re-render
Same steps as `shorts/brick-tax/README.md`, with these differences:
- the plates go to `public/gplates`;
- the composition is `GraveShort`;
- the audio script is `audio/grave_audio.py voice/voice.wav audio/out`.
