#!/bin/bash
# Builds the voice track and the final mix for the water short.
# usage: bash make_audio.sh <tight.wav>   (run inside chatgpt-water-short/audio)
#   <tight.wav> = voice_original.mp3 at 48 kHz mono with pauses shortened to 0.2 s (silence = 36 dB under the peak).
# 1. speed-up 1.17x with the Rubber Band R3 engine (the older engine in ffmpeg's filter made the voice sound robotic)
# 2. light polish: rumble cut, a little less mud, a little more presence, de-ess, gentle 2.5:1 compression
# 3. voice set to -16 LUFS with plain gain (no dynamic loudnorm), effects mixed under it by sfx.py
# 4. mix set to -14 LUFS with plain gain and a soft peak limiter at -1 dBFS
set -euo pipefail
tight=$1
lufs() { ffmpeg -hide_banner -i "$1" -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | tail -1 | awk '{print $2}'; }

rubberband -q -3 -F -T1.17 "$tight" vo_fast.wav
ffmpeg -v error -y -i vo_fast.wav -af "highpass=f=70,equalizer=f=280:width_type=q:w=1.0:g=-1.5,equalizer=f=4200:width_type=q:w=0.9:g=1.5,deesser=i=0.35,acompressor=threshold=-21dB:ratio=2.5:attack=8:release=160:makeup=1" -ar 48000 -ac 1 -c:a pcm_s16le vo_polish.wav
g=$(python3 -c "print(-16 - ($(lufs vo_polish.wav)))")
ffmpeg -v error -y -i vo_polish.wav -af "volume=${g}dB,alimiter=limit=0.89:attack=3:release=60:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le voice.wav
python3 sfx.py
g=$(python3 -c "print(-14 - ($(lufs mix_raw.wav)))")
ffmpeg -v error -y -i mix_raw.wav -af "volume=${g}dB,alimiter=limit=0.89:attack=3:release=60:level=disabled" -ar 48000 -ac 1 -c:a pcm_s16le mix.wav
ffmpeg -v error -y -i voice.wav -b:a 128k voice.mp3
rm -f vo_fast.wav vo_polish.wav mix_raw.wav
echo "voice $(lufs voice.wav) LUFS | mix $(lufs mix.wav) LUFS | $(ffprobe -v error -show_entries format=duration -of csv=p=0 mix.wav) s"
