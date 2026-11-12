# STATUS (update at the end of every chat)

| Step | State | Notes |
|---|---|---|
| 0 Research and topic | DONE (2026-11-12) | Topic chosen: "What If You Could See Everyone's Future Job?" as a short (2026-11-12; replaced Skytree and Amsterdam ideas). Idea comes from the ConChaser channel's format. See inputs/ANALYSIS.md. 164 Mixkit SFX catalogued (inputs/SFX_CATALOG.md). |
| 1 Story | DONE (2026-11-12) | outputs/01_story/FACTS.md (10 facts, each with a source link and a confidence label; the 65% myth is marked DEBUNKED) and STORY.md (power rules, cast, icon list, 11 beats, about 237 words / 62 s). Hook (13 words): "You can see everyone's future job, and your best friend's is: your boss." Payoff "Now you're his boss." loops back into the hook. Next: step 2 (voiceover). |
| 2 Voiceover | DONE (2026-11-12) | outputs/02_voice/SCRIPT.md (243 words), words.json (242 words timed to voice.wav). Final voice: **voice.wav, 67.0 s** (on the user's PC, not in git). It is ElevenLabs take 1 (flowspeech-single-1794507803951.wav, 90.6 s) with the pauses shortened and sped up 1.2x, pitch kept, -16.6 LUFS. Last word ends at 66.71 s (frame 2001 at 30 fps). The real beat times are in SCRIPT.md section 6. Next: step 3 (shot plan). |
| 3 Shot plan | DONE (2026-11-12) | outputs/03_shots/: storyboard.md (40 rows covering frames 0-2010 = 67.0 s: words, what we see, light, camera, DOF, effects, plus sets, light presets, icon list, readability-trap table, step 5 sync points), story.ts (draft for step 4: 12 SHOTS, XFADE, FLASH_AT 123, 42 CAMS keys, 5 KICKS, DOF on 36 %, FOREGROUND, SETS/MARK coordinates, 82 word-locked CUES), check_story.mjs (0 errors: every cut/cue/shot start lands 0-3 f before its word, glides 18-36 f, no static hold, story.ts type-checks with tsc --strict), blocking_sheet.jpg (grey-box framing of every camera key). Next: step 4 (build). |
| 4 Build | not started | |
| 5 Sound | not started | |
| 6 Checks | not started | |
| 7 Render | not started | |

## Open problems / decisions
- Step 3 decided (details in outputs/03_shots/storyboard.md section 8):
  - The bathroom mirror is fogged from a shower and the hero wipes it on "YOUR"/"head?". This is the twist reveal, and it keeps the "no reflection before beat 8" rule.
  - The survey cutaway is a class photo (8 ring-light icons, 3 helmets).
  - There are no icons inside daydreams.
  - Kevin bites a glue stick in the present.
  - The co-workers' icons are not paper hats.
  - The icon disc is 0.42 m (0.8 head width), not 40 %, so the pictures read on a phone.
  - Dinner stays at night (the script is locked).
- For step 4:
  - Copy outputs/03_shots/story.ts to src/videos/futurejob/.
  - Add the light presets `lamp` and `nightblue` to lights.ts (starting values in storyboard.md section 4).
  - New drawings: the hero's back view, seated / on-chair / reclined / floor-sit poses, the walker at 3 ages, 30+ icon pictures.
  - Icons, signs and photos use unlit materials.
  - Re-run check_story.mjs and the blocking sheet after any camera change.
  - Compromises to watch in stills: the hero's head next to Kevin's arm (1a/12a), the middle-row icons over the back-row chins (3b), the hero touching the manager (7a).
- For step 5: every sync frame (flash, crossfades, cuts, glide centres, kicks, pops, flips) is listed in storyboard.md section 9 and in story.ts CUES.
- Step 2 decided: the user chose to keep take 1, sped up 1.2x with the silences cut, rather than re-record. The short is 67 s, slightly over the 55-65 s goal. Pauses are now tight (0.15 s between sentences), so step 3 must time the shots to words.json and leave the pacing to the visuals.
- Step 1 decided: the power (a picture icon over each head, 10 years ahead, it shows today's path so choices flip it; you only see your own in a reflection). The twist is the mirror, the pivot is a GPS analogy plus F1 (almost 13 jobs by 58, BLS), and the payoff is telling Kevin, which flips his icon.
- For step 2: use only the "safe wording" in FACTS.md. Say "jobs", never "careers" (BLS counts employers). The YouTuber survey (F5) is US and UK kids only. Check that the TTS reads the hook's "is: your boss" with a beat; spare hooks are in STORY.md.
- For steps 3-4: the 3D sets are dining room, school hallway, street with bus stop, burger counter and bathroom with mirror. The "office" in 04_BUILD.md exists only inside Kevin's 2D icon. The mirror needs a reflection trick (a mirrored duplicate set, or the bus-window fallback in STORY.md). The hero must never show an icon or a reflection before beat 8.
- No text labels in the video: jobs are shown with props, outfits and icons.
- Could not analyze Rick's real audio (YouTube blocks downloads). Needs the 6 mono mp3s above.
- Mixkit license text could not be read from the server; user checks mixkit.co/license.
