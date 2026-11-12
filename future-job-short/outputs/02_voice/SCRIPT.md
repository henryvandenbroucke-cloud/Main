# SCRIPT: "What If You Could See Everyone's Future Job?"

Step 2 output (2026-11-12). Built from the 11 beats in `../01_story/STORY.md`. Every fact uses the "safe wording" in `../01_story/FACTS.md`.

- **Words:** 243 spoken words (tags not counted; "1960" counted as two words).
- **Target length:** 60-65 s. At 3.8 words/s that is 64 s.
- **Model:** ElevenLabs `eleven_v4` (it reads the [tags] as delivery directions).
- **Tags:** 12 tags for 32 sentences, about one per 2-3 sentences.

## 1. Paste this into ElevenLabs (exactly as written, tags included)

```text
[excited] You can see everyone's future job, and your best friend's is… your boss.
Imagine you're seventeen, and halfway through family dinner, a tiny picture pops up over every head: their job in ten years.
Your sister announces, "I'm going to the moon!" [sarcastic] Her picture says otherwise. In one survey, American and British kids picked YouTuber over astronaut nearly three to one.
[excited] Next day, you hint to Kevin. [laughs] "Me? I can't even open my locker." This guy once ate a glue stick on a dare.
Then the school bully: "What are you looking at?" He's going to be a dentist. [nervous] YOUR dentist.
[curious] On the way to work, a stranger's picture makes no sense. It's a job that doesn't exist yet.
At work, your manager beams. "Stick with me, kid. One day, all this could be yours." [deadpan] The typical restaurant worker has been at their job about two years. He's been here nineteen.
[softly] That night, it hits you. Wait… if everyone has one, what's over YOUR head? [excited] Yours won't sit still. It changes with every choice you make.
You see, it's not a prophecy. It's a GPS: it shows where you're headed, and it recalculates every turn. People turn a lot. Americans born around 1960 held almost thirteen jobs by age fifty-eight.
[happy] Luckily, that means your future can change. [deadpan] Unluckily, so can everyone else's.
[excited] So you tell Kevin he's going to be your boss. He's so sure, he stops trying. Now you're HIS boss.
```

## 2. Beat by beat (for the shot plan in step 3)

| # | Beat | Words | Ends at (s, at 3.8 w/s) | Fact |
|---|---|---|---|---|
| 1 | Hook | 13 | 3.4 | none |
| 2 | Setting and rules | 21 | 8.9 | none (fiction) |
| 3 | Family dinner (sister) | 27 | 16.1 | F5 |
| 4 | Best friend (Kevin) | 23 | 22.1 | none (fiction) |
| 5 | The bully | 17 | 26.6 | none (F7 left out) |
| 6 | The stranger | 18 | 31.3 | none (F3 left out) |
| 7 | The manager | 32 | 39.7 | F6 |
| 8 | "Wait...?" mirror | 25 | 46.3 | none |
| 9 | "You see," GPS pivot | 35 | 55.5 | F1 |
| 10 | Luckily / Unluckily | 12 | 58.7 | none |
| 11 | Payoff | 20 | 63.9 | none |
| | **Total** | **243** | **63.9** | |

Real times come from words.json once the audio is back.

## 3. Fact check (each line against FACTS.md)

| Line in the script | FACTS.md safe wording | OK? |
|---|---|---|
| "In one survey, American and British kids picked YouTuber over astronaut nearly three to one." | F5, word for word | Yes. Not "kids everywhere", not "three times". |
| "The typical restaurant worker has been at their job about two years. He's been here nineteen." | F6, word for word | Yes. The 19 is fiction (invented manager). |
| "Americans born around 1960 held almost thirteen jobs by age fifty-eight." | F1, word for word | Yes. "Jobs", never "careers". |
| "It's a job that doesn't exist yet." | Fiction (the stranger's icon) | Yes. It is a story claim about one person, not a statistic. The 65% myth (F10) is not used. |
| GPS line | Analogy, no numbers | Yes. |

Optional facts F2, F3 and F7 are not used (no room in the budget).

## 4. Changes from the STORY.md line ideas (and why)

- Hook: "is: your boss" is written "is… your boss" so the voice takes a beat before "your boss".
- Beat 4: "you hint to Kevin" explains why Kevin answers "Me?". The full telling stays for the payoff.
- Beat 5: "Then the school bully:" tells the listener who speaks, without describing the locker slam we already see.
- Beats 8 and 11: "the mirror" and "his icon flips" are cut. The picture shows them (rule: never say what the viewer already sees).
- Beat 9: "GPS arrival time" became "a GPS" to save words. "People turn a lot" is the bridge to the fact.
- The voice calls the icon "a picture" every time (never "icon"), so it stays plain English.

## 5. Voice and settings

Recommended voices (all in the ElevenLabs voice library; search the name, press play on the preview, then "Add to my voices"):

| Pick | Voice | Why |
|---|---|---|
| 1st | **Marcus - Bright, Upbeat and Clear** (young American male) | Made for Shorts: fast, bright, clean diction. Best fit for 3.8 words/s. |
| 2nd | **Haven Sands** (energetic YouTube narrator, a bit sarcastic) | Best for the deadpan lines ("Her picture says otherwise", "Unluckily..."). Can sound a bit dramatic. |
| 3rd | **Tyler - Clear US YouTube Creator Voice** | Sounds like a creator talking to camera. Safe, natural. |

Settings in ElevenLabs:
- Model: **Eleven v4**.
- If your screen shows a Stability setting, use the middle ("Natural"). Move it toward "Creative" if the read is flat, toward "Robust" if the tags make it go strange.
- v4 has no speed slider. If the take is longer than 66 s, tell me the length and I'll trim words. Or speed it up a little in your editor (keep the pitch, at most 1.1x).
- Make 2-3 takes. Pick the one where: (1) there is a clear beat before "your boss" in the hook, (2) "YOUR dentist" and "HIS boss" are stressed, (3) "Unluckily" sounds flat and deadpan, (4) speech starts right at the start (cut any silence before the first word).

If a line reads badly, spare versions:
- Hook B: "You can see everyone's future job, and your best friend will be your boss."
- Beat 10 B: "Luckily, nothing's set in stone. Unluckily, that includes Kevin."

## 6. Final voice (take 1, edited)

Take 1 was 90.6 s. On 2026-11-12 the user asked to speed it up a little and remove the silences. What was done:
1. Pauses shortened: between sentences to 0.15 s, breaths inside a sentence to 0.07 s, and the hook beat before "your boss" kept at 0.24 s. Each cut has an 8 ms crossfade, so there are no clicks. Result: 80.4 s.
2. Sped up 1.2x with rubberband (pitch and formants kept, so it does not sound like a chipmunk). Result: **67.0 s**.
3. Loudness set to -16.6 LUFS (true peak -1.5 dB), 48 kHz mono 16-bit.

Check: a fresh speech-to-text pass on the final file matches the script (mean word confidence 0.956, against 0.965 for the original), and "YOUR dentist" is clear when checked on its own.

Real beat times (from words.json, in seconds):

| # | Beat | Starts | Ends | Words/s |
|---|---|---|---|---|
| 1 | Hook | 0.00 | 3.84 | 3.4 |
| 2 | Setting and rules | 4.19 | 10.33 | 3.4 |
| 3 | Family dinner | 10.55 | 18.42 | 3.4 |
| 4 | Kevin | 18.61 | 23.78 | 4.4 |
| 5 | Bully | 24.01 | 27.69 | 4.6 |
| 6 | Stranger | 28.09 | 32.05 | 4.5 |
| 7 | Manager | 32.18 | 40.14 | 4.0 |
| 8 | "Wait...?" mirror | 40.51 | 47.45 | 3.6 |
| 9 | "You see," GPS | 47.65 | 57.75 | 3.4 |
| 10 | Luckily / Unluckily | 58.10 | 61.98 | 3.1 |
| 11 | Payoff | 61.98 | 66.71 | 4.2 |

The last word ("boss.") ends at 66.71 s. At 30 fps that is frame 2001.

## 7. Files

| File | Where | State |
|---|---|---|
| Take 1 original: `flowspeech-single-1794507803951.wav` (90.6 s) | user's PC (not in git) | the raw ElevenLabs take; keep it as a backup |
| **voice.wav** (67.0 s, the edited take 1) | user's PC (not in git) | **FINAL** |
| **words.json** | here (git) | **FINAL**: 242 entries `{w, s, e}` in seconds, timed to voice.wav (the format the skill's mix.py reads). Made with faster-whisper small.en on take 1, checked word by word against the script, 2 zero-length words fixed by hand, then remapped through the cuts and the 1.2x speed-up. A second speech-to-text pass on voice.wav agrees: median start error 0.011 s, 90% under 0.042 s. |
| words_take1.json | here (git) | word times for the unedited 90.6 s take (reference only) |
