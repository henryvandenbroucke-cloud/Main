# Step 7: Final render and delivery   (Sonnet 5.5; rendering itself needs no model)

Commands (on the PC with Remotion, set TEMP/TMP to a big drive first):
`npx remotion render src/index.ts <Comp> out/amsterdam/video.mp4 --codec h264 --crf 16 --scale 1.3333`
Mux the sound: `ffmpeg -i video.mp4 -i mix.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k final.mp4`
QA: `python scripts/short_qa.py final.mp4 out/amsterdam/qa shots.json` (black, white, frozen, pop frames, loudness).
Keep film grain OFF (it turns a 250 MB file into 900 MB). About 10 minutes for 67 s at 2K.
Upload: title in the style "Why Amsterdam's Houses Lean Forward on Purpose" (check the fact first), no description needed, vertical 1080x1920 or 1440x2560.
