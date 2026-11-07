#!/bin/bash
# resumable chunked render: renders frames in 300-frame chunks, skipping chunks already on disk, then concatenates
cd "$(dirname "$0")/.."
mkdir -p out/gchunks
TOTAL=1805; N=300
for ((a=0; a<TOTAL; a+=N)); do
  b=$((a+N-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=out/gchunks/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  node scripts/render.mjs GoyaShort "$f.tmp.mp4" "$a-$b" 1 4 2>&1 | grep -E "^done|rror" ; mv "$f.tmp.mp4" "$f" && echo "chunk $a-$b ok"
done
ls out/gchunks/c_*.mp4 | sed 's/^/file /;s/$//' | sed "s|file |file '$PWD/|;s|\$|'|" > out/gchunks/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/gchunks/list.txt -c copy out/goya_video.mp4 && echo CONCAT_DONE
