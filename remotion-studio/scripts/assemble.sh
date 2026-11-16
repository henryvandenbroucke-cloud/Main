#!/bin/bash
# usage: scripts/assemble.sh <chunkDir> <audio.wav> <out.mp4>
# Joins chunk_000.mp4 ... in order (no re-encode) and puts the sound mix on it. Remotion writes a silent
# audio track into every chunk, so the video and the audio are mapped explicitly.
set -euo pipefail
dir=$1; audio=$2; out=$3
list=$(mktemp)
for f in $(ls "$dir"/chunk_*.mp4 | sort); do echo "file '$(realpath "$f")'" >> "$list"; done
ffmpeg -v error -y -f concat -safe 0 -i "$list" -map 0:v:0 -c copy "$dir/video_only.mp4"
ffmpeg -v error -y -i "$dir/video_only.mp4" -i "$audio" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart -shortest "$out"
rm -f "$list"
ffprobe -v error -show_entries format=duration:stream=codec_name,nb_frames,width,height -of default=nw=1 "$out"
