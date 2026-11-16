#!/bin/bash
# usage: scripts/memtest.sh <gl> <range>   prints GPU-process memory while a short range renders
GL=$1 node scripts/render.mjs out/dbg/mem_$1.mp4 1 ${3:-1} $2 > out/dbg/mem_$1.log 2>&1 &
np=$!
while kill -0 $np 2>/dev/null; do
  rss=$(ps -eo rss,args | grep -- "--type=gpu-process" | grep -v grep | awk '{s+=$1} END {print int(s/1024)}')
  fr=$(grep -c "^frames" out/dbg/mem_$1.log)
  echo "$(date +%H:%M:%S) gl=$1 frames=$fr gpuMB=$rss"
  sleep 12
done
tail -1 out/dbg/mem_$1.log
