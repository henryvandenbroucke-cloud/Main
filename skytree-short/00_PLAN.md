# Skytree short: master plan (read this first in every new chat)

Goal: ONE perfect ~60-65 s vertical animated short about Tokyo Skytree's central pillar (copied from Japanese pagodas),
in the "2D cartoon characters in a 3D painted world" style, made with the skill `mromidev/claude-animated-shorts`.
Rules: story, characters and voice are our own. Never copy Rick's scripts or shots. Never say his channel name. No captions unless asked.

## How to use (one new chat per step)
1. Open a new chat on the model in the table. Paste the "START PROMPT" from that step's file.
2. The chat reads this file, STATUS.md and the inputs it lists. It writes its outputs into `outputs/<step>/`.
3. At the end it updates STATUS.md (done / what is next / open problems). Then you start the next chat.
4. Do not run two steps at once. Each step needs the output of the one before it.

| # | Step file | Model and effort | Needs | Produces |
|---|---|---|---|---|
| 1 | 01_STORY.md | Opus 5.5, xhigh | inputs/ANALYSIS.md | outputs/01_story/FACTS.md, STORY.md |
| 2 | 02_VOICEOVER.md | Opus 5.5, high | 01 outputs | outputs/02_voice/SCRIPT.md, voice.wav, words.json |
| 3 | 03_SHOTPLAN.md | Opus 5.5, xhigh | 01, 02 | outputs/03_shots/storyboard.md, story.ts draft |
| 4 | 04_BUILD.md | Opus 5.5, xhigh | 02, 03 + the skill | Remotion project, stills |
| 5 | 05_SOUND.md | Sonnet 5.5 or Opus 5.5 high | 02, 03, reference audio | mix.wav, cues.md |
| 6 | 06_CHECKS.md | Opus 5.5, max (2-3 rounds only) | 04, 05 | scores + numbered fix list |
| 7 | 07_RENDER.md | Sonnet 5.5 (no model needed to render) | 04-06 | final.mp4 (1440x2560) |

Steps 4 and 5 can swap order, but the sound must be made AFTER the picture timing is locked (changing timing later means redoing the sound).

## Where files live
- This folder is `skytree-short/` in the repo `henryvandenbroucke-cloud/Main` (the only place that survives between chats).
- Big files (voice.wav, mp3s, renders) do NOT go in git. Keep them on your own PC or cloud drive and write their names in STATUS.md.
- Each new chat is a fresh machine: it must clone the skill again (`git clone https://github.com/mromidev/claude-animated-shorts`).

## Reference audio (30 MB upload limit)
Only audio is needed for the sound study, not video. On your PC, for 6 top Rick shorts:
`yt-dlp -x --audio-format mp3 --postprocessor-args "-ac 1 -b:a 64k" <url>` makes about 0.5 MB per 60 s short.
6 shorts is about 3 MB, so they fit in one upload to the step 5 chat. Top ones: VS1Z_Q-Klt8, 7xS87iActkU, 0m6G8pDtzNs, Mz72MuPgnGY, eQR3pgMiUF0, GM9UKnZ6JFw.
If you have no PC tool, screen-record or share links and say so: step 5 can then work from the written notes only.
