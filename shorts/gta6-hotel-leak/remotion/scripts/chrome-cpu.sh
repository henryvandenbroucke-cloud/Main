#!/bin/bash
# Chromium with canvas 2D rasterized on the CPU in each renderer (no shared emulated-GPU process bottleneck)
exec /opt/pw-browsers/chromium --disable-gpu --disable-accelerated-2d-canvas --disable-gpu-compositing "$@"
