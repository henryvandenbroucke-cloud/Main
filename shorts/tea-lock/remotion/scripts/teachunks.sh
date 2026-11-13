#!/bin/bash
# resumable chunked render: renders frames in 300-frame chunks, skipping chunks already on disk, then concatenates
cd "$(dirname "$0")/.."
mkdir -p out/tchunks2
TOTAL=1604; N=300
for ((a=0; a<TOTAL; a+=N)); do
  b=$((a+N-1)); [ $b -ge $TOTAL ] && b=$((TOTAL-1))
  f=out/tchunks2/c_$(printf %04d $a).mp4
  [ -s "$f" ] && continue
  node scripts/render.mjs TeaShort "$f.tmp.mp4" "$a-$b" 1 3 2>&1 | grep -E "^done|rror" ; mv "$f.tmp.mp4" "$f" && echo "chunk $a-$b ok"
done
ls out/tchunks2/c_*.mp4 | sed 's/^/file /;s/$//' | sed "s|file |file '$PWD/|;s|\$|'|" > out/tchunks2/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/tchunks2/list.txt -c copy out/tea_video.mp4 && echo CONCAT_DONE
