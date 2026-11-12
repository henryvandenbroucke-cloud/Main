# Step 6: Check passes   (Opus 5.5, max; at most 2-3 rounds)

START PROMPT:
"Read amsterdam-houses-short/00_PLAN.md and STATUS.md. Compare our stills with the reference frames in the skill (scripts/sbs_sheet.py), 1-3 images per round.
Score colour, lighting, ink, textures, characters, depth, composition out of 10 and give a numbered fix list with frame numbers. Verdict 200 words or less."

Stop rule: stop when every score is 6 or higher and no frame has a readability trap. Do not run more than 3 rounds (tokens).
Done when: scores saved in outputs/06_checks/REPORT.md and the fixes are applied by a step 4 chat.
