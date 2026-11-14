#!/bin/bash
# usage: scripts/render_chunks.sh <outDir> <totalFrames> <chunkFrames>   Renders the short in chunks, skipping finished ones.
out=$1; total=$2; step=$3; i=0
for ((a=0; a<total; a+=step)); do
  b=$((a+step-1)); [ $b -ge $total ] && b=$((total-1))
  f=$(printf "%s/chunk_%02d.mp4" "$out" $i)
  if [ ! -s "$f" ]; then
    echo "[$(date +%H:%M:%S)] chunk $i frames $a-$b"
    node scripts/render.mjs "$f.tmp.mp4" 1 4 "$a-$b" 2>&1 | grep -E "^done|rror" ; [ -s "$f.tmp.mp4" ] && mv "$f.tmp.mp4" "$f"
  fi
  i=$((i+1))
done
echo "[$(date +%H:%M:%S)] ALL CHUNKS DONE"
