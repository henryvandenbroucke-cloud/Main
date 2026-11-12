# Step 5: Music and sound effects   (Sonnet 5.5 or Opus 5.5 high)

START PROMPT:
"Read future-job-short/00_PLAN.md, STATUS.md, inputs/SFX_CATALOG.md, outputs/02_voice/*, outputs/03_shots/*. If reference mp3s are attached, measure them first.
Do step 5 only: build the sound with the skill's templates/audio (timeline.py, sfx.py, music.py, mix.py)."

Do: (a) measure the reference mp3s: loudness, music-to-voice gap, SFX per second, which sounds mark impacts, whooshes, camera moves;
(b) decide per shot which SFX; use the skill's synthesized SFX plus selected Mixkit files (inputs/mixkit_dl.py re-downloads them; mono mp3 previews);
(c) standard mix: music +3 dB, SFX -6 dB, voice unchanged, duck music under words, about -14 to -15 LUFS, true peak under -1.2 dBTP.
Rule: lock the picture timing first. Any later timing change means re-running the sound.
Done when: mix.wav (48 kHz, exact length), stems, cues.md. Files stay on the user's PC.
