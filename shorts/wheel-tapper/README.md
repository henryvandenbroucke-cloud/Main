# The Man Who Hit Trains With a Hammer

A 51-second vertical animated short (1080x1920, 30 fps) about railway wheel tappers. A tapper walked the train hitting every wheel with a long hammer. A sound wheel rings like a bell; a cracked one goes "thunk", and that carriage came off the train. Today, trackside detectors do the job. The facts and sources are in `SCRIPT.md`.

The topic is a sibling of the reference channel's "Why Perfect Railroads Don't Work" (23M views): the same railway world, but a different hidden-reason story with little competition on Shorts.

## What's new in this one
- **Hook in the reference style.** Frame 1 already shows the absurd action, the hammer hitting a wheel. The first line is a person plus an absurd job, with no date or setup.
- **One continuous scene, almost no cuts.** As in "Why the Second Draw Always Wins":
  - a panoramic 5400 px plate lets the camera track along the train;
  - a match zoom goes into the wheel close-up;
  - steam wipes carry the camera to the station and back;
  - a crash zoom into the wheel hub irises into the explainer, and the explainer irises back out onto the same wheel.
- **Satisfying micro-effects** on every hit:
  - expanding ring waves and a glint sweeping round the tyre;
  - a sparkle at the contact point;
  - a camera kick and push-in;
  - a tuned steel "ting" sound, each hit a note of the key.
  - Bad hits get a dull puff, a jagged red ring, a desaturating flash and a heavy kick.
- **Explainer insert** on a blueprint background:
  - the wheel next to a bell;
  - a crack that disappears from sight;
  - a live waveform panel showing a long ring versus a dead thunk;
  - wine-glass ting versus thud;
  - full speed, shatter, derail.
- **Ending:** the day plate is regraded warm in 2D. The tapper dissolves, and a trackside robot taps the rolling wheels and inherits his cap and moustache.
- **Quiet score:** pizzicato and glockenspiel in G that drops out for the two suspense beats. It sits about 15 dB under the voice after ducking.

## Re-render
Same steps as `shorts/brick-tax/README.md`, with these differences:
- Plates: `WIDE=strip,strip_g node scripts/plates.mjs wheel_cu,st_wide,strip,strip_g public/tplates`. Then copy `strip.png` to `strip_w.png`.
- The composition is `TapperShort`; render it with `scripts/tchunks.sh`.
- Audio: `python audio/tapper_audio.py voice/voice.wav audio/out`.
