# Topic analysis for the one perfect short

Date: 2026-11-12. Source data: yt-dlp metadata for the latest 60 shorts of @RicksClips3000 (173K subscribers), the skill repo `mromidev/claude-animated-shorts` (its STYLE_BIBLE and 7 measured reports), YouTube search results for competition, and web search for fact checks.

## What I could NOT do (be aware)
- YouTube blocks video, audio and caption downloads from this server (bot check, then HTTP 429). I did not try to get around it.
  So I did not watch Rick's videos frame by frame, and I did not listen to his music or sound effects.
- What I used instead: the skill author's own measurements of 1,200 frames from Rick's 20 shorts (in the repo), plus channel metadata.
- To get a real audio study: upload 5-10 of his shorts (private study only) to this session and I will measure loudness, the music/SFX balance, and every sound-effect timing.
- I did not find any other channel with the exact same style. One web page describes the format, and one video transcript says a 3D cartoon channel got 31M views in two weeks (unverified).

## Rick's Clips: what the numbers say
- Format change on 7 Oct 2026. Before: 32 joke clips of 5-31 s, mostly 50K-500K views (a few 1M-4.6M). After: 28 story shorts of 31-78 s, median 9.1M views, mean 9.3M.
- Duration buckets (story shorts only):
  - 30-45 s: 5 videos, median 1.7M (includes the two flops: "The Science Behind Slot Machines" 133K, "How Painkillers Actually Work" 317K)
  - 45-58 s: 6 videos, median 9.4M
  - 58-70 s: 16 videos, median 9.5M (this is the sweet spot; 10 of the top 15 are here)
  - 78 s: 1 video, 532K
- Top 5: The Ancient Jar That Warned an Empire 33.7M; Why Perfect Railroads Don't Work 28.5M; The Job Nobody Wants in Japan 17.8M; Why Sailors Carried Storm Oil 16.1M; Your Brain's Secret Idea Zone 15.8M. Like rate is 1.8-3.6% of views.
- What flops: generic "how X works" / "science behind X" explainers. What wins: a specific story with a place, an object or a person, and a paradox.
- Themes that repeat among the winners: Japan (17.8M and 15.4M), gambling/lottery loopholes (4 videos, 6-15M), old objects with a hidden purpose (jar, grave bell, storm oil), counterintuitive engineering (railroads, roller-coaster shape).
- The 4 newest videos (3.6M, 3.9M, 10M, 10M) are only 1-5 days old, so their counts are still rising.
- All story shorts: 1080x1920, 30 fps, 1 narrator, no intro, no outro, no call to action.

## Script formula (from the skill's study of 20 shorts)
Hook paradox in sentence 1 (10-16 words, no setup) > setting in 1-2 lines with a named everyman > 3-6 escalating beats with doubters > a "Wait, ...?" question > "You see," pivot to the real mechanism, often through an everyday analogy > ironic one-or-two-sentence payoff. 3.5-4.1 words per second, about 13.5 words per sentence, voice starts in the first 1-4 frames.

## Look and animation (skill measurements)
- Characters: flat 2D bean-head cartoons with thin dark outlines, lit by the scene. World: hand-painted 3D, black ink outlines (about 3 px at 1080 wide), blurred backgrounds on about a third of screen time, warm key light with blue-purple shadows.
- Camera: holds about 80% of the time with slow push-ins; moves are ease-out bursts (fast start, 8-10 frames decay); 4-5 degree dutch tilts; continuous camera moves instead of hard cuts; 6-8 frame crossfades between places; 4-frame flash effects.
- Effects: flat 2D sprites on the 3D scene (sparkles, speed lines, dust puffs, stars, glows).

## Sound (what is known without the audio)
- Loudness about -14 LUFS integrated, loudness range about 2.4 LU (heavily compressed). The music and sound-effect bed sits only about 5-10 dB under the voice.
- The skill's own mix rule: music +3 dB, effects -6 dB, voice unchanged, voice ducking, final true peak about -1.2 dBTP. The skill synthesizes its own SFX and score (templates/audio).
- Not measured (needs the audio): Rick's actual music style, how many SFX per second, and which sounds he uses for impacts.

## Topic candidates and competition (YouTube search, 12 results each)
| Candidate | Best existing result | Viral short already? | Verdict |
|---|---|---|---|
| Tokyo Skytree's central pillar, copied from Japanese pagodas | Half as Interesting 555K (long), Bloomberg 491K, Science Channel 133K | No | **Best.** Japan is Rick's strongest theme. |
| The Vasa warship (sank 1628, stability test) | Smithsonian Channel 333K | No, but crowded with tiny channels | Good second choice |
| Boston Molasses Flood | Atlas Obscura 181K | No, but crowded with tiny channels | Backup |
| Leaning Tower of Pisa fix | Idan David Animations 5.4M (43 s) | Yes | Skip |
| Millennium Bridge wobble | British Pathe 4.5M (Tacoma), mdepablo 1.1M | Yes, and too close to the skill's bridge example | Skip |

## Chosen topic: Skytree's pillar that is not holding anything up
- Why it fits: a physical cause and effect, a visual (a tall tower swaying, a pillar swinging inside it), an everyday analogy (a spoon swung inside a cup / a tail swinging to balance), a Japan link, and a paradox hook.
- Draft hook (needs fact check): "Tokyo's tallest tower has a giant concrete pillar in the middle, and it isn't holding anything up."
- Facts that need checking before the script (web search found contested points):
  - The Skytree pillar is a free-swinging reinforced concrete column that moves at a different period from the tower body, with oil dampers between them: supported.
  - The "50%" figure: sources disagree on whether it means less sway or less energy. Say neither, or word it carefully.
  - "No Japanese pagoda has ever fallen in an earthquake": NOT confirmed. Say "almost no records of one toppling".
  - Newer research suggests the wide eaves also help pagodas, so the pillar is not the only reason.
- Sources: [Shinbashira (Wikipedia)](https://en.wikipedia.org/wiki/Shinbashira), [nippon.com on Skytree](https://www.nippon.com/en/articles/-/12382), [A Tokyo Skytree Tour](https://nippon.com/en/views/b01101), [Pillars of Strength (gov-online.go.jp)](https://gov-online.go.jp/eng/publicity/book/hlj/html/201112/201112_01.html), [The B1M on Skytree](https://theb1m.com/video/tokyo-skytree-insane-engineering)

## Sound effects downloaded
164 free previews from Mixkit (28 categories, 6 each), 1,453 s in total, saved at:
`/tmp/claude-0/-home-user-Main/08a2a9c2-14f7-5064-bf63-1413b8087efd/scratchpad/sfx/mixkit/` with `manifest.json` (title, category, length, LUFS, peak).
License: Mixkit's free sound-effects license (free for commercial video, no credit needed, but do not resell the files alone). I could not load the license text itself from here, so please check https://mixkit.co/license/ before posting.
Kenney's CC0 packs (impact, interface, digital audio) are also free, but their download button did not work from here. Freesound, Pixabay and Zapsplat were blocked.
Useful for this short: whooshes (air, arrow, fast), cartoon (boing, whistle, failure), wood creaks and plank drops, impacts (wood hard hit, deep heartbeat impact), collapsing structure, bells (church bell), wind (graveyard, mountain), camera shutter, riser/transition, clock tick, crowd reactions.

## Model plan (tokens are limited)
1. Analysis / topic: Sonnet 5.5 (done).
2. Planning (fact check, script, shot plan): Opus 5.5, xhigh.
3. Building (copy templates/bridge, change only the story parts): Opus 5.5, xhigh.
4. Checking passes: Opus 5.5, max, 2-3 rounds, 1-3 images each, verdict 200 words or less.
5. Rendering: no model; run Remotion locally.
