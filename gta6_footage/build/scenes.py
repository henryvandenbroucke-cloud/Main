"""Catalogue every scene in a source: exact cut times + one labelled thumbnail per scene.

usage: python3 scenes.py <footage_dir> <out_dir> <name>...
"""
import json, os, re, subprocess, sys

FOOT, OUT, names = sys.argv[1], sys.argv[2], sys.argv[3:]
os.makedirs(OUT, exist_ok=True)
FONT = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
cat = {}
for n in names:
    src = f"{FOOT}/{n}.mp4"
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src],
                               capture_output=True, text=True).stdout)
    o = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-vf", r"scale=480:-1,select=gt(scene\,0.3),showinfo",
                        "-an", "-f", "null", "-"], capture_output=True, text=True, stdin=subprocess.DEVNULL).stderr
    cuts = [0.0] + [float(x) for x in re.findall(r"pts_time:([0-9.]+)", o)] + [dur]
    scenes = [(round(a, 2), round(b, 2)) for a, b in zip(cuts, cuts[1:]) if b - a >= 0.5]
    cat[n] = scenes
    d = f"{OUT}/{n}"
    os.makedirs(d, exist_ok=True)
    for k, (a, b) in enumerate(scenes):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{(a + b) / 2:.2f}", "-i", src, "-frames:v", "1",
                        "-vf", f"scale=320:-1,drawtext=fontfile={FONT}:text='{a:.2f}-{b:.2f}':x=4:y=4:fontsize=24:"
                               "fontcolor=yellow:box=1:boxcolor=black@0.75", f"{d}/{k:03d}.jpg"],
                       check=True, stdin=subprocess.DEVNULL)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", f"{d}/%03d.jpg",
                    "-vf", "tile=8x8:padding=3", f"{OUT}/{n}_scenes_%d.jpg"], check=True, stdin=subprocess.DEVNULL)
    print(n, len(scenes), "scenes")
json.dump(cat, open(f"{OUT}/scenes.json", "w"), indent=1)
