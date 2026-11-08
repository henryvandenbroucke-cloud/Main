#!/bin/bash
# re-render only the changed frame ranges, in <=300-frame chunks (resumable)
cd "$(dirname "$0")/.."
mkdir -p out/afix
for r in 0-51 77-440 480-596 644-1720; do
  a=${r%-*}; e=${r#*-}
  for ((s=a; s<=e; s+=300)); do
    b=$((s+299)); [ $b -gt $e ] && b=$e
    f=out/afix/c_$(printf %04d $s).mp4
    [ -s "$f" ] && continue
    node scripts/render.mjs AceShort "$f.tmp.mp4" "$s-$b" 1 3 2>&1 | grep -E "^done|rror"; mv "$f.tmp.mp4" "$f" && echo "chunk $s-$b ok"
  done
done
echo FIX_DONE
