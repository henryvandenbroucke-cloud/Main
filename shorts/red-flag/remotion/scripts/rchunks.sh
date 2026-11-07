#!/bin/bash
# resumable chunked render: renders frames in 300-frame chunks, skipping chunks already on disk, then concatenates
cd "$(dirname "$0")/.."
mkdir -p out/rchunks
TOTAL=1597; N=300
for ((a=0; a<TOTAL; a+=N)); do
  b=$((a+N-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=out/rchunks/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  node scripts/render.mjs RedFlagShort "$f.tmp.mp4" "$a-$b" 1 4 2>&1 | grep -E "^done|rror" ; mv "$f.tmp.mp4" "$f" && echo "chunk $a-$b ok"
done
ls out/rchunks/c_*.mp4 | sed 's/^/file /;s/$//' | sed "s|file |file '$PWD/|;s|\$|'|" > out/rchunks/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/rchunks/list.txt -c copy out/redflag_video.mp4 && echo CONCAT_DONE
