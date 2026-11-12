# STORYBOARD and SHOT PLAN: "What If You Could See Everyone's Future Job?"

Step 3 output (2026-11-12). Built from `../01_story/STORY.md`, `../02_voice/SCRIPT.md` and `../02_voice/words.json`, using the camera, depth and lighting rules in the skill's `SKILL.md`, `references/STYLE_BIBLE.md` and `references/reports/*`.

Files in this folder:

| File | What it is |
|---|---|
| `storyboard.md` | This file: one row per shot, plus sets, light, icons, readability checks and notes for steps 4 and 5. |
| `story.ts` | Draft `story.ts` for step 4. It replaces `templates/bridge/story.ts`. It has SHOTS, XFADE, FLASH_AT, CAMS, KICKS, DOF, FOREGROUND, plus the sets, character marks, walk paths and CUES (82 word-locked acting and icon events). |
| `check_story.mjs` | Checks `story.ts` against `words.json` and this file. Run: `node --experimental-strip-types future-job-short/outputs/03_shots/check_story.mjs`. |
| `blocking.mjs`, `blocking_sheet.py`, `blocking_sheet.jpg` | Grey-box blocking preview: every camera key projected with the real numbers from `story.ts` (bodies, heads, cream icon discs, set outlines). It shows composition only, not the look. |

## 1. Summary

- **Length:** 2010 frames = 67.0 s at 30 fps (the length of voice.wav). The last word, "boss.", ends at frame 2001; the icon flip has landed by frame 1995.
- **12 SHOTS** (place or time changes), **40 storyboard rows**, **42 camera keys**: 16 cuts inside shots, 14 glides, 9 crossfades, 1 white flash (frame 123) and 1 hard cut into the dentist daydream (frame 813).
- **Light:** day hallway > evening lamp at dinner > day > late-afternoon street > golden burger place > **night-blue for the whole explanation** (mirror, GPS map, life road, Luckily/Unluckily) > fresh day for the payoff.
- **Depth of field** is on for 36 % of frames (target: about 1/3).
- **The checker passes with 0 errors:**
  - All 82 cues, 16 cuts, 12 shot starts and the flash land 0-3 frames before their word.
  - All glides are 18-36 frames long, and each is centred 0-4 frames before its word.
  - No frame is a static hold: every frame moves at least 0.3 px/f at 720p.
  - Glide peaks are 4-35 px/f. The reference's 90th percentile is 36.
  - Storyboard rows cover frames 0-2010 with no gaps.
- **Readability:** every shot was checked against the skill's "Readability traps" list (section 7). There is no text and no flag anywhere.

How to read the table:
- Frames are at 30 fps.
- "Time" is seconds.
- The words column shows the voice heard during the row.
- A frame number in brackets is when a reaction is first visible (0-3 f before its word).
- Camera abbreviations:
  - WS = wide shot, FS = full shot, MS = medium shot, CU = close-up, OTS = over the shoulder.
  - az / el / d = the camera's angle around its subject, its height angle and its distance (story.ts `orbit()`).
  - "creep" is the slow push-in on a hold, in % of image size per frame.
- DOF is the lens blur in px at 1080 wide for things at infinity (`cInf`); 0 means everything is sharp.

## 2. Storyboard (one row per shot)

| # | Frames | Time | Words | What we see | Light | Camera | DOF | Effects and cues (frame) |
|---|---|---|---|---|---|---|---|---|
| 1a | 0–70 | 0.00–2.33 | You can see everyone's future job, and your best | **Hook, frame 0:** school hallway. Kevin (backwards cap, gap tooth) stands at his open locker, mid-bite of a sandwich. The cream icon over his head is readable at once: tiny Kevin in a necktie behind a big desk, tiny you (orange hoodie, hair tuft) holding out a coffee. Down the corridor, three still students each have an icon (hard hat, paint palette, fire helmet). The hero's hood and hair tuft are soft at the left edge (back 3/4, no icon over him, ever). | day: sun patches through the right-hand windows | OTS MS at eye level (az 6, el 2, d 2.75, fov 40); creep 0.25 %/f | 10 on Kevin's eyes (hero and students soft) | Students' icons ping, scale 1 > 1.15 > 1 + sparkle (12, "everyone's"). Kevin takes a big bite, crumb puff (34, "job"). Icons bob 1.5 s. |
| 1b | 70–100 | 2.33–3.33 | friend's is… your | **Cut** (big jump) to the icon close-up: the icon fills the top half, Kevin's face below with his cheeks full. | day | CU, slightly low (az 24, el -5, d 1.75, fov 38); punch 0.6 %/f | 14 on the icon | Kevin's gap-tooth grin, mouth full (84, "is…"). Steam curls from tiny you's coffee. |
| 1c | 100–123 | 3.33–4.10 | boss. | **Cut** to the hero's reaction, 3/4 front: his jaw drops; he squeezes his juice box and juice squirts out. Kevin is out of frame. | day | MS (az 118, d 1.8); punch 0.6 %/f | 0 | Shock face + squirt splash + **kick 0.8** (100, "boss."). **White flash 123-126.** |
| 2a | 123–176 | 4.10–5.87 | Imagine you're seventeen, and halfway through | Under the flash: the hero alone at the dinner table, chewing happily, fork in hand, half-eaten plate (meatballs). | **lamp:** evening, warm pendant lamp, dusk-blue window | MS 3/4 (az 130, el 6, d 2.3); creep 0.25 %/f | 0 | — |
| 2b | 176–265 | 5.87–8.83 | family dinner, a tiny picture pops up over every head: | **Cut** to the WS from the table end: the hero (left, back 3/4), Dad at the head of the table under the dusk window, Mom and the sister (cardboard astronaut helmet) on the right. Dad's real wrench lies by his plate. Pop, pop, pop. | lamp | WS, high (az 90, el 15, d 4.9, fov 46); creep 0.18 %/f | 0 | Dad's icon pops: wrench, and the real wrench glints (223, "pops"). The hero's fork stops halfway (223). Mom's chef's hat pops (237, "over"). The sister's phone-on-ring-light pops (253, "head"). |
| 2c | 265–315 | 8.83–10.50 | their job in ten years. | **Cut** to the hero CU: fork frozen halfway to his open mouth, a meatball on it; his eyes dart from icon to icon. | lamp | CU (az 158, d 1.45, fov 38); creep 0.3 %/f | 13 on his eyes | Eyes left (288, "ten"), eyes right (295, "years"). |
| 2d | 315–359 | 10.50–11.97 | Your sister announces, "I'm going to | **Cut** to the sister standing on her chair, low angle, rocket to her chest, chin up. Her icon is just above the frame. | lamp | Low MS, dutch 4° (az 25, el -4, d 2.1); creep 0.25 %/f | 0 | Proud pose (324, "announces"), open grin (346, "I'm"). |
| 2e | 359–418 | 11.97–13.93 | the moon!" Her picture says otherwise. | She thrusts the rocket overhead; the camera follows it up from the helmet to her icon: a phone in a glowing ring light with a red record dot. Helmet below, ring light above: that is the joke. | lamp | Glide up 34 f centred on "picture" (to az 25, el -6, d 2.3), then punch 0.6 %/f | 0 | Rocket thrust + star sparkle (360, "moon!"). The ring light flares and the record dot blinks (395, "otherwise"). |
| 3a | 418–516 | 13.93–17.20 | In one survey, American and British kids picked YouTuber over astronaut | **Crossfade 8 f** into a daydream: class-photo day. A mottled blue photo backdrop and gym bleachers: 8 kids on two steps, 3 kids sitting cross-legged on the floor in front, softboxes on stands. | day (bright, neutral) | WS frontal (az 0, el 4, d 5.8, fov 44); creep 0.15 %/f | 0 | Softbox flash pops (426, "survey"). 8 ring-light icons pop over the bleachers, two per frame (480-483, "YouTuber"). 3 astronaut-helmet icons pop over the front kids, smaller sparkle (503-505, "astronaut"). |
| 3b | 516–556 | 17.20–18.53 | nearly three to one. | The 8 hold up phones for selfies under their ring lights; the 3 look up at the ceiling, dreamy. 8 against 3 reads as "nearly three to one". | day | Punch-in glide 24 f centred on "three", roll -3.4° | 0 | Selfie poses / dreamy look (528, "three"). |
| 4a | 556–596 | 18.53–19.87 | Next day, you hint to Kevin. | **Crossfade 8 f.** Next morning, hallway: Kevin tugs at a locker that is not his (blue dot; his own has a yellow dot). The hero leans in to hint. Kevin's boss icon is seen again from a new angle. | day | Two-shot MS: hero left, Kevin right (az 138, d 3.2); creep 0.2 %/f | 0 | Hero cups his hand at his mouth (574, "hint"). Kevin turns to him (584, "Kevin"). |
| 4b | 596–649 | 19.87–21.63 | "Me? I can't even open my locker." | Kevin MS, laughing, holding the icon in frame. He yanks the handle and it comes off in his hand. The hero's shoulder is at the left edge. | day | Glide 24 f centred on "Me?" (az 112, d 2.4); creep 0.25 %/f | 0 | Points at himself, laughing (608, "Me?"). Yanks the handle (629, "open"). The handle comes off, puff + **kick 0.4** (640, "locker"). |
| 4c | 649–718 | 21.63–23.93 | This guy once ate a glue stick on a dare. | Kevin CU facing us: he pulls a glue stick from his pocket, bites it, then grins with a gap tooth, glue on his lip and a thumb up. His boss icon is overhead (the irony). A still student's shoulder and backpack are soft at the right edge. | day | Glide 24 f centred on "This guy" (az 100, el -3, d 2.0, fov 38); creep 0.3 %/f | 13 on his eyes | Glue stick appears (655). Bite + crunch puff (672, "ate"). Grin + thumb up (704, "dare"). |
| 4d | 718–733 | 23.93–24.43 | Then the school | **Cut:** a locker slams shut beside the hero's head. Profile two-shot: the bully (huge, lightning-bolt patch) on the left, the hero pinned to the lockers on the right. | day | Profile two-shot, dutch -4.6° (az 180, d 3.0) | 0 | Slam, **kick 1.2** (718, "Then"). Hero: shock. |
| 4e | 733–777 | 24.43–25.90 | bully: "What are you looking at?" He's | **Cut** to the hero's low eye-line: the bully looms and leans in. His icon is a sparkling molar with a small dental drill. | day | Low angle POV (az 290, el -22, d 1.7, fov 44), dutch 4°; punch 0.6 %/f | 0 | Leans in, stern V-brows (748, "What"). The hero's card is hidden (POV). |
| 4f | 777–813 | 25.90–27.10 | going to be a dentist. | The camera rises to the icon: the tooth sparkles, the drill spins. | day | Glide 24 f centred on "dentist." up to the icon | 0 | Tooth "ding" sparkle + drill speed lines (789, "dentist."). |
| 5a | 813–841 | 27.10–28.03 | YOUR dentist. | **Hard cut** to a daydream: the hero reclined in a dentist's chair, sweating, mouth open; the bully grins over him with a whirring cartoon drill. Mint tiles, a white lamp off to the side (never a halo behind his head). No icons in daydreams. Comic: no needles, no blood. | day + cool mint set dressing + emissive lamp | Low MS from the chair side (az 20, el -10, d 2.0, fov 42), roll -3°; creep 0.3 %/f | 12 | Nervous + sweat drop (813, "YOUR"). The drill whirrs closer (818, "dentist"). |
| 6a | 841–866 | 28.03–28.87 | On the way to work, | **Crossfade 8 f.** Street, late afternoon: the hero walks to work with a duffel bag (1.4 m/s, left to right on screen) toward a bus stop with an open shelter. A woman in a raincoat sits reading. | day, sun low ahead-right (az 35, el 20): late afternoon | Truck with the hero (az 180, d 4.4, fov 42), then a glide 28 f centred on "stranger's" into 6b | 0 | The hero stops and turns his head to her (866, "stranger's"). |
| 6b | 866–919 | 28.87–30.63 | a stranger's picture makes no sense. | Side-by-side two-shot from the road: the hero (left) and the seated stranger (right). Her icon is an object nobody can name: a glass bead with three petal fins and one blinking light. A lamp post frames the left edge. | day (late afternoon) | Two-shot (az 231, d 3.2); creep 0.25 %/f | 0 | The hero tilts his head ~18° like a confused dog and squints (893, "no"). The bead's light blinks (903, "sense"). |
| 6c | 919–963 | 30.63–32.10 | It's a job that doesn't exist yet. | **Cut** to the icon insert: the strange bead fills the frame, its fins turn slowly, the street is bokeh behind. | day (late afternoon) | Insert (az 205, d 1.3, fov 34); punch 0.6 %/f | 16 on the icon | The light blinks back at us, bigger glow (951, "yet."). |
| 7a | 963–1015 | 32.10–33.83 | At work, your manager beams. | **Crossfade 8 f.** Burger place at sunset, backlit through the drive-thru window and the storefront. The manager (moustache, paper hat, blank name tag) is behind the counter, centre-left. His icon is the very same paper hat, with a clear gap and the disc behind it. The hero is at the counter end, foreground right (back 3/4). Fryer and grill behind. The big sign is a burger shape. | **golden** | WS (az 20, el 8, d 4.4, fov 42), then a glide 30 f centred on "manager" to the two-shot | 0 | Manager beams: huge grin, arms wide, teeth-gleam sparkle (992, "beams"). |
| 7b | 1015–1068 | 33.83–35.60 | "Stick with me, kid. One day, all this | Two-shot across the counter: he holds out a paper hat and the hero takes it. "All this": he sweeps his arm across the kitchen. | golden | Two-shot (az 20, el 4, d 3.4); creep 0.2 %/f | 0 | Hat held out (1015, "Stick"). The hero takes it (1032, "kid"). Arm sweep (1056, "all"). |
| 7c | 1068–1092 | 35.60–36.40 | could be yours." | **Cut** to the hero CU from the staff side, sunset behind him: he looks down at the paper hat in his hands. | golden | CU (az 160, d 2.0); creep 0.3 %/f | 0 | Looks down, worried (1077, "yours"). |
| 7d | 1092–1176 | 36.40–39.20 | The typical restaurant worker has been at their job about two years. | **Cut**, frontal over the counter: the manager has not moved and grins; beside him, co-workers swap with a puff on each beat. Each co-worker has an icon of their own (a lab flask, a guitar, a surfboard, a trowel), never a paper hat: they will move on. | golden | MS frontal (az 0, d 3.0); creep 0.2 %/f | 0 | Swap 1 (1095, "typical"), 2 (1115, "worker"), 3 (1139, "job"), 4: a grandmother (1152, "two"). |
| 7e | 1176–1213 | 39.20–40.43 | He's been here nineteen. | **Cut** to the employee-of-the-month wall: 8 frames, 2 columns x 4 rows, with blank plaques. Every photo is the manager, balder each time. The camera rises to the oldest photo: young him with a full head of hair. | golden (window light patch on the wall) | WS of the wall (az 18, d 2.8), glide 24 f centred on "nineteen" up to the top-left photo | 0 | Arrives on the oldest photo (1190, "nineteen"). |
| 8a | 1213–1248 | 40.43–41.60 | That night, it hits you. | **Crossfade 8 f.** Night, the bathroom, in profile: the hero brushes his teeth at the sink. The mirror is **fogged from his shower**, so there is no clear reflection. One warm bulb over the mirror, night-blue window. | **nightblue** | Profile MS (az 90, d 1.9); creep 0.25 %/f | 0 | Fogged mirror (from 1213). Bulb flares like an idea + **kick 0.4** (1234, "hits"). He freezes mid-brush, eyes wide (1234). |
| 8b | 1248–1294 | 41.60–43.13 | Wait… if everyone has one, | **Cut** to the hero CU, 3/4 front (the mirror is at a grazing angle, so we see no reflection): his eyes roll up toward the top of his own head; he pats it and finds nothing. | nightblue + warm bulb | CU (az 105, el -5, d 1.45); creep 0.3 %/f | 13 on his eyes | Eyes up (1248, "Wait"). Pats his head (1281, "one"). |
| 8c | 1294–1329 | 43.13–44.30 | what's over YOUR head? | **Cut** to a high OTS (lens at 2.2 m): the hero's real head (no icon over it) at the bottom of the frame, the fogged mirror above. A faint warm glow shows through the fog above his reflection's head. He wipes the fog: first his face, then higher, and the icon appears. It is the **paper hat** (the manager's!). | nightblue + warm bulb | High OTS (az 3.5, el 13, d 3.4, fov 44), tilt-up glide 24 f centred on "head?" | 12 on the reflection (real head soft) | Wipe 1: the reflection's face appears (1305, "YOUR"). Wipe 2: the icon appears; reflection shocked (1312, "head?"). |
| 8d | 1329–1427 | 44.30–47.57 | Yours won't sit still. It changes with every choice you make. | The reflection grabs things one after another and the icon flips faster each time: textbook with a heart cover > stethoscope; guitar > microphone; phone > paper hat again; drops it all and shrugs > the stranger's unknown bead. | nightblue + warm bulb | Same framing, creep 0.15 %/f | 12 | Icon jitters ±8° (1329, "Yours"). Flips: 1348 "still" (8 f), 1373 "changes" (6 f), 1390 "every" (4 f), 1401 "choice" (4 f). The bead blinks (1414, "make"). |
| 8e | 1427–1479 | 47.57–49.30 | You see, it's not a prophecy. It's | **Cut** to the icon insert through the mirror (the lens is between him and the mirror): the icon flips into a crystal ball with purple mist on a gold claw stand, then cracks. | nightblue | Insert (d 1.6, fov 34); punch 0.6 %/f | 14 on the icon | Crystal ball (1442, "not"). Crack line + puff (1451, "prophecy"). |
| 9a | 1479–1556 | 49.30–51.87 | a GPS: it shows where you're headed, and it recalculates | **Crossfade 8 f, match dissolve:** the cracked ball becomes the head of a map pin on a glowing toy road map (navy ground, cream roads, little houses with lit windows, no street names, no digits). A blue "you" chevron drives up the road toward the pin, which shows a paper hat inside. | nightblue (emissive roads) | High 3/4 (az 0, el 55, d 16); creep 0.2 %/f | 0 | Chevron starts; the route lights up (1510, "shows"). A glow pulse runs to the pin; the pin bounces (1527, "headed"). The route flickers and rewrites (1542, "recalculates"). |
| 9b | 1556–1582 | 51.87–52.73 | every turn. | At the fork the chevron turns right; the pin hops in an arc to a new spot and its picture flips. | nightblue | Glide 30 f centred on "turn." toward the new pin | 0 | Turn + the pin lands, paper hat > stethoscope (1572, "turn."). |
| 9c | 1582–1615 | 52.73–53.83 | People turn a lot. | Crane up: a whole grid of roads, dozens of chevrons turning, pins hopping everywhere. | nightblue | Crane up and out, glide 36 f centred on "lot." (to el 66, d 34); ends inside the crossfade | 0 | Dozens of pins hop at once (1602, "lot."). |
| 10a | 1615–1706 | 53.83–56.87 | Americans born around 1960 held almost thirteen jobs | **Crossfade 6 f.** The "life road": a young man (late-1970s clothes, big hair) power-walks along a glowing road at night. Job icons pop and flip over his head, and each old one stays hanging in the air where it flipped. The first six come fast, packed close (over 40 % of jobs come before 25, F2). | nightblue | Side truck alongside him (az 0, d 4.3), him on the left third; creep 0.12 %/f | 0 | Job 1 pops (1639, "1960"). Flips at 1644, 1649, 1654, 1659 ("held"), 1664, 1672, 1680 ("thirteen"; he ages into his 30s), 1688, 1696, 1704. |
| 10b | 1706–1741 | 56.87–58.03 | by age fifty-eight. | **Cut** to 3/4 ahead: the man walks toward us and slows to a stop, grey-haired with glasses. Behind him, 13 icons hang over the road and recede into the night, closer together at the start: you can count them. No numbers anywhere. | nightblue | 3/4 front (az 71, el 3, d 5.0, fov 42); creep 0.2 %/f | 0 | Flip 12 (1711). Grey hair + glasses, stops, job 13 (1718, "fifty-eight"); glances back at the trail. |
| 11a | 1741–1792 | 58.03–59.73 | Luckily, that means your future can change. | **Crossfade 8 f.** Back in the mirror, reflection only (the lens is between him and the mirror): relieved grin, shoulders drop. The bead icon flips to a stethoscope. | nightblue + warm bulb | MS of the reflection (d 1.95); creep 0.25 %/f | 12 on the reflection | Relieved grin (1741, "Luckily"). Flip: bead > stethoscope (1782, "change"). |
| 11b | 1792–1857 | 59.73–61.90 | Unluckily, so can everyone else's. | The grin freezes and slides off his face. Deadpan. Then his eyes widen: he realises what that means. | nightblue + warm bulb | Punch-in glide 18 f centred on "Unluckily" + roll 4°; then punch 0.5 %/f | 12 | Grin > half > flat over 4 f (1801, "Unluckily"). Eyes widen (1842, "else's"). |
| 12a | 1857–1915 | 61.90–63.83 | So you tell Kevin he's going to be your boss. | **Crossfade 6 f.** Next morning, **framed exactly like 1a** (same camera): the hero (soft, left edge) tells Kevin at his locker. Kevin's boss icon is overhead. | day (fresh morning) | OTS MS as 1a (az 6, d 2.75); creep 0.22 %/f | 10 on Kevin's eyes | Kevin looks at the hero (1875, "Kevin"). Eyes go wide (1906, "boss"). |
| 12b | 1915–1969 | 63.83–65.63 | He's so sure, he stops trying. | A slow smug grin. He tosses his homework over his shoulder into the bin, then slides down the lockers to the floor, feet up on his backpack, hands behind his head, eyes shut. | day | Glide 24 f centred on "so" to Kevin's MS, then a glide 28 f down with him, arriving on "trying" | 0 | Smug grin (1920, "He's"). Homework toss + paper flutter (1933, "sure"). Slides down (1947, "stops"). Eyes shut (1954, "trying"). |
| 12c | 1969–2010 | 65.63–67.00 | Now you're HIS boss. | **Cut** to the icon close-up, framed like 1b, with Kevin asleep below it. On "boss." the icon flips: now tiny you wears the necktie at the desk and tiny Kevin holds out the coffee. The video ends here and loops into the hook. | day | CU (az 10, el -4, d 1.5, fov 38); punch 0.6 %/f | 14 on the icon | **Flip lands on "boss."**: edge-on swap at 1991, flip 1987-1995 + sparkle burst + **kick 0.6**. |

## 3. Sets and props (step 4 builds these; coordinates are in `story.ts` SETS and MARK)

| Set | Used in | Must read as | Key dressing |
|---|---|---|---|
| School hallway (day) | 1, 4, 12 | a school hallway | Lockers on the left wall with colour dots instead of numbers (Kevin's is yellow). Windows on the right wall throw sun patches. Matte floor. A trash can by Kevin's locker (beat 12). Double doors at the far end with no EXIT sign and no glass. No trophy case. |
| Dining room (evening) | 2 | a family dinner table | Table with plates, meatballs and glasses. Dad's real wrench by his plate. Pendant lamp. Dusk window behind Dad with a tree and a neighbour's lit window (a scene, not a black pane). An empty chair at the near end. |
| Photo-day corner | 3 | school photo day | Mottled blue backdrop, two gym bleacher steps (0.5 m and 1.45 m), two softboxes on stands. |
| Dentist corner (daydream) | 5 | a dentist's chair | Reclined chair, mint tiles, a white lamp on an arm placed to the side, a tray of cartoon tools (no needles). |
| Street with bus stop (late afternoon) | 6 | on the way to work | Open shelter with a solid painted back panel (a picture ad, no text, no glass). Bench. Sign pole with a bus pictogram on an unlit material. Shopfronts with painted interiors (no reflecting glass). A lamp post near the camera in 6b. |
| Burger place (golden) | 7 | a burger restaurant | Counter, fryer with bubbling oil, grill, drive-thru window and storefront windows (sunset sky). A big burger-shaped sign. The photo wall of 8 frames with blank plaques. Blank name tag. Paper hats. |
| Bathroom (night) | 8, 11 | a bathroom at night | Sink and a tall mirror (0.84 x 1.24 m) with a white frame, a fog layer on it (wiped in 8c), one warm bulb above, a night-blue window with a moon, and a hamper with a textbook (heart cover), a guitar and a phone. **Mirror:** an opening into a copy of the room mirrored about the mirror plane, holding the mirrored hero card (the only hero card with an icon). |
| GPS map (night-blue) | 9 | a sat-nav map | Navy ground, cream glowing roads with a fork, toy houses with lit windows, a blue chevron, map pins whose round heads are icon discs. No street names, no digits, no arrival times. |
| Life road (night-blue) | 10 | a road through life | A glowing straight road, a dark meadow, low hills, small roadside lamps and stars. The walker ages in three stages: 18 (late-1970s look), 30s (tie), 58 (grey hair, glasses). |

The "office" in 04_BUILD.md exists only inside Kevin's icon (a tiny desk and necktie). No office set is needed.

## 4. Light plan (presets for `lights.ts`)

| Light | Shots | Status | Starting values (tune on stills against the reports) |
|---|---|---|---|
| `day` | 1, 3, 4, 5, 6, 12 | in the template (`lights.ts`) | As is. Shot 6 overrides the sun to az 35 / el 20 (low, ahead-right, longer shadows) for late afternoon; this is already in SHOTS (`sunAz`, `sunEl`). Shot 5 gets its coolness from the mint tiles, not from a new preset. |
| `golden` | 7 | in the template | As is: backlit low sun (az 6, el 7), violet-blue shade, peach haze. Sun through the windows behind the manager. Rim light on the paper hats: inner only (trap below). |
| `lamp` (new) | 2 | step 4 adds it | Interior evening. Key = the pendant lamp, warm (#ffcf94, about ×1.4); shade warm plum (dark band hue ~330°, like the reference interiors: L* p50 ~33, p98 ~92). Heads tinted warm-lamp #fcdfbd (charTint ≈ [1.0, 0.88, 0.76]). The window is a dusk-blue emissive picture (#3a4f9a). Bloom on the lamp bulb only. |
| `nightblue` (new) | 8, 9, 10, 11 | step 4 adds it | Reference night: L* p2 ~8, p50 ~32, p98 ~84, dark band violet (hue ~300°, C ~33), heads lavender-moonlit #b1ace7 to #edd9f7, violet fog #877aea. Key = cool moonlight from the window (lit ≈ [0.62, 0.68, 1.15]), shade ≈ [0.10, 0.10, 0.30] + violet lift. In the bathroom, the warm bulb over the mirror is a second, local warm key (glow r50 ≈ 18-34 px at 720). In the map and road, the cream roads and icons are emissive (HDR ×2-3, bloom threshold 1.0). |

The icons are lit by nothing: give them an unlit (MeshBasic) face plus a soft warm glow sprite, so the pictures read the same in day, golden and night-blue (trap: painted faces lit by a side sun go grey-blue).

## 5. The icons

- **Size:** disc d = 0.42 m for adults (0.8 head width) and 0.36 m for kids, centred 0.16 m + d/2 above the crown (`ICON`, `iconY` in story.ts). STORY.md said "40 % of a head wide"; at a medium shot that is about 85 px on a 1080-wide frame, too small to read a two-figure picture on a phone. At 0.42 m, the shots where the picture matters give the disc 25-55 % of the frame width (1b, 2e, 4c, 4f, 6c, 8c-8e, 11a, 12c).
- **Look:** cream disc, plum ink ring, soft warm glow. It faces the camera (billboard) and bobs 1.5 s. Inside: one prop, 2-3 flat colours. **Never** letters, numbers, logos, flags, $, ? or clock digits.
- **Timing grammar** (all in CUES):
  - **Pop:** scale 0 > 1.15 > 1 over 6 f + a 4-frame sparkle. Frame f is the pop start.
  - **Flip:** a Y-axis turn of 8 f (6 f and 4 f as the mirror montage speeds up). The picture swaps on the edge-on frame f, with a small sparkle burst.
  - **Ping** (1a): scale 1 > 1.15 > 1.
- **Who has one:** everyone except the hero. The hero's icon exists only on his reflection, behind the mirror's fog until 8c. There are no icons inside daydreams (dentist) and none in the survey before the pops.

| Picture | Where | Read check |
|---|---|---|
| Tiny Kevin in a necktie at a big desk, tiny you (orange hoodie + tuft) holding a coffee; later reversed | 1a-1b, 4, 12 | The hardest read: test at 0.5 scale. The hoodie colour and the tuft identify "you". |
| Wrench (Dad), chef's hat (Mom), phone in a ring light + red dot (sister) | 2 | The phone must be obvious, or the ring reads as a halo or a doughnut. |
| Ring light (8 kids), astronaut helmet (3 kids) | 3 | Two clearly different silhouettes at about 190 px. |
| Molar + small drill | 4e-4f | Without the drill it reads as a ghost or a marshmallow. |
| Glass bead with three petal fins and a blinking light | 6, 8d | Strange, not broken. Not a drone, VR headset or robot. |
| Paper hat (manager, mirror) | 7, 8c | Keep the gap and the disc behind it, or it reads as one tall hat. |
| Hard hat, palette, fire helmet (students); flask, guitar, surfboard, trowel (co-workers) | 1, 7d | Props only. |
| Stethoscope, microphone, crystal ball (purple mist, gold claw stand), map-pin head | 8-11 | Crystal ball: mist + stand, or it reads as a snow globe. |
| 13 road jobs (e.g. paper hat, hammer, headset, briefcase, wrench, chef's hat, laptop, truck, paintbrush, clipboard, toolbox, apron, watering can) | 10 | Distinct silhouettes; the trail discs shrink to 0.3 m once dropped. |

## 6. Camera grammar used (from the skill's motion and depth reports)

- **Cuts** happen only on big jumps: a new subject, more than half a frame width, or more than 40 % zoom. There are 16 inside shots, each on its word (0-3 f before). Places and times change with crossfades (8 f; 6 f into the road and into the payoff). There is one white 4-frame flash after the hook and one hard cut into the dentist daydream (a comic jump).
- **Glides** are symmetric smootherstep moves of 18-36 f, centred 0-4 f before their word (whooshes in step 5 peak there). The biggest are the tilt to the sister's icon (2e, 35 px/f), the crane in 9c (33 px/f) and the photo-wall rise (7e, 31 px/f).
- **Holds** always creep in: 0.12-0.3 %/f, with 0.5-0.6 %/f punches for 30-45 f on punch words ("boss", "otherwise", "dentist", "doesn't exist yet", "nineteen", "prophecy", "Unluckily", "HIS boss").
- **Dutch tilts** of 3-4.6° only on the sister's announcement, the locker slam, the bully, the dentist, the photo punch and "Unluckily".
- **Kicks** are 7-frame impact shakes that flip sign every frame: 100 (0.8), 640 (0.4), 718 (1.2), 1234 (0.4), 1991 (0.6). There is no hand-held float.
- **Camera height** is at eye level except: the low angles on the sister and the bully (power), the high OTS in the bathroom (it keeps his real head under the reflection in a 9:16 frame) and the high map views.
- **Foreground framing** in 8 of the 40 rows (20 %; the reference has it in 38 % of its MS/CU). Step 4 can add more once the sets exist:
  - People: the hero's back in 1a, 8c-8d and 12a; the hero's shoulder in 4b; a student's shoulder in 4c.
  - Props: the end chair in 2b and the lamp post in 6b.
  - Low props near an eye-level lens fall below the frame, which is why most of the near framing here is people.

## 7. Readability-trap check, shot by shot

The skill's list (SKILL.md "Readability traps"), plus this film's own rules (STORY.md):

| Trap | Where it could bite | What the plan does |
|---|---|---|
| A thing that reads as something else (the swing that read as a hanging) | Every icon (section 5). The sister's ring light. Kevin's two-figure icon. The bully's tooth. The crystal ball. The dentist lamp behind the bully's head (halo). The toothbrush foam (rabid). | Each icon has its must-read detail listed. The dentist lamp sits to the side, never centred behind a head. No foam at the mouth (foam only on the brush). The fogged mirror shows drips and a wipe streak so it reads as steam, not dirt. |
| Props closer than ~2 m to a lens become huge cut-off blobs | 1a/12a (hero's head), 4b (hero's shoulder), 4e (hero at the lens), 8c (real head), 6b (lamp post), 8e and 11 (lens between hero and mirror) | 1a/12a: the hero is 2.1 m from the lens, his head at the left edge, recognisable by the hood and tuft. 4e-4f: the hero's card is hidden (POV). 8c: his head is cut at the bottom with the hair tuft readable. 8e/11: the hero is behind the lens. 6b: a lamp post reads whole even when cut. 1b: the camera angle keeps the hero out of frame. All checked in `blocking_sheet.jpg`. |
| A foreground bush cut by the frame edge reads as a green ball | 2b, 9a | No bushes or round plants near any lens. The map has no foreground trees. |
| Flags | everywhere ("American and British", "Americans born around 1960") | No flags at all. Nationality is never shown; the voice carries it. |
| Painted signs lit by a side sun go grey-blue | Bus pictogram, burger sign, photo-wall photos, textbook heart cover, every icon | Unlit (MeshBasic) faces for every sign, photo and icon. |
| Golden rim light as an offset outer copy turns hats into picture frames | 7 (paper hats, the manager's icon is a paper hat) | Inner rim only, on the head and torso. Icons get no rim. |
| Rails at chest height through characters | The counter (7), the dinner table (2), the sink (8a) | The counter and table cross at the waist (normal). 7a/7b look over the counter from 1.7-2.1 m. No railings anywhere. |
| Flat holds read as freezes | every hold | The checker confirms no frame under 0.3 px/f. |
| No text on screen | Lockers, signs, name tag, plaques, phone screens, the GPS, the bus stop, clocks | Colour dots on lockers. Pictograms only. Blank tag and plaques. Phone screens show a picture. No digits anywhere (the 13 jobs are countable icons; "1960", "58" and "nearly three to one" are voice only). |
| The hero's reflection before the twist (STORY.md continuity rule) | Dining window, shopfront glass, burger steel, bathroom mirror in 8a-8b | The dusk window is a painted scene; there is no glass at the street; the fryer and counter steel are matte. The bathroom mirror is fogged until 8c and seen edge-on or grazing in 8a-8b. |
| The hero never has an icon | every shot with the hero | The hero's card has no icon in any shot; only the mirrored card in 8c-8e and 11 has one. 8c shows the empty space above his real head next to the reflection's icon. |
| Comic, never painful (dentist, locker slam) | 4d, 5a | The slam hits the locker, not him. Cartoon drill, no needles, no blood. |
| Two-figure icon too small | 1a, 4a, 12a | Picture-critical moments always have a CU: 1b, 4c, 12c. |

## 8. Changes from STORY.md (and why)

1. **The mirror is fogged from his shower and he wipes it** (8a-8c). This makes the reveal land exactly on "YOUR" / "head?". In a 9:16 frame, a camera behind him always sees the icon above his reflection, so a tilt could not hide it. It also explains in the story why he has never seen his own icon, and it keeps the "no reflection before the twist" rule.
2. **The survey cutaway is "class photo day"** (8 kids on bleachers + 3 in front) instead of a row of kids: a row does not fit a vertical frame, and stacked rows do.
3. **No icons inside daydreams** (the dentist chair), so the joke stays on the bully, not on the device.
4. **Kevin's glue stick happens now:** he takes a bite while the voice says he "once ate a glue stick". A flashback would need another set; the present-day bite is a second joke and keeps his boss icon in frame.
5. **The co-workers' icons are not paper hats**, which quietly supports the "about two years" fact (F6).
6. **Icon size 0.8 head width** (not 40 %), for readability on a phone.
7. **The hero stands back from the mirror from 8c onward** (cheated across the cut) so the mirror close-ups can put the lens between him and the mirror.
8. Dinner stays at night with a warm lamp because the locked script says "family dinner". The main arc is still day > golden > night-blue, with fresh day for the payoff.
9. The optional trophy-case reflection in beat 11 is dropped (glass in the hallway would risk an early hero reflection).

## 9. Notes for step 4 (build) and step 5 (sound)

**Step 4:**
- Copy `story.ts` into `src/videos/futurejob/`.
- Rewrite `world.ts` / `cast.ts` / `build.ts` around SETS, MARK, CROWN, ICON, CUES and the walk paths. The bridge physics exports (`D0`, `front`, `bridgeState` ...) are gone.
- `world.ts` reads `ShotDef.set` and `ShotDef.light`, and the per-shot sun override (`sunAz`/`sunEl`) as before.
- New drawings for `toon.ts`:
  - a back view of the hero (hood, tuft, backpack);
  - seated, standing-on-chair, reclined and floor-sit poses;
  - the walker in three ages;
  - the 30+ icon pictures (section 5).
- Run `check_story.mjs` after any timing or camera change. Re-run `blocking.mjs` + `blocking_sheet.py` after any camera change.
- Stills to look at first:
  - 2 and 72 (frame 0 and Kevin's icon);
  - 220 (the dinner WS);
  - 393 (the sister's icon);
  - 540 (class photo);
  - 880 (the stranger's two-shot);
  - 1000 (the burger two-shot);
  - 1320 (the mirror reveal);
  - 1480 (match dissolve);
  - 1720 (the trail of 13);
  - 1995 (final flip).
- Known compromises to watch in stills:
  - 1a/12a: the hero's head overlaps Kevin's left arm (keep the sandwich in Kevin's other hand).
  - 3b: the middle-row icons cover the back-row kids' chins.
  - 7a: the hero's head touches the manager's right side.

**Step 5 sync points** (all frames, from story.ts):

| Kind | Frames |
|---|---|
| Flash | 123 |
| Crossfades | 418 (414-422), 556, 841, 963, 1213, 1479, 1615 (6 f), 1741, 1857 (6 f) |
| Hard cut | 813 |
| Cuts inside shots | 70, 100, 176, 265, 315, 718, 733, 919, 1068, 1092, 1176, 1248, 1294, 1427, 1706, 1969 |
| Glide centres (whooshes) | 376, 528, 608, 661, 789, 866, 983, 1190, 1312, 1571, 1600, 1801, 1927, 1956 |
| Kicks | 100, 640, 718, 1234, 1991 |
| Icon pops | 12 (ping), 223, 237, 253, 480-483, 503-505, 1639 |
| Icon flips | 1348, 1373, 1390, 1401, 1442, 1572, 1644-1718 (12 road flips, `ROAD_JOBS`), 1782, 1991 |
| Other cues | the full list with acts is `CUES` in story.ts: juice squirt 100, bites 34/672, rocket 360, softbox flash 426, handle 640, drill 789/818, blinks 903/951/1414, co-worker puffs 1095/1115/1139/1152, bulb 1234, wipes 1305/1312, crack 1451, homework toss 1933 |
