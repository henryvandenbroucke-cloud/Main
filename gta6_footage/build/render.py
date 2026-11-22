"""Build the 9:16 GTA 6 short.

usage: python3 render.py preview|segments|final  <footage_dir> <work_dir>
"""
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from edl import SHOTS, END

MODE, FOOT, WORK = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(WORK, exist_ok=True)
SRC_W, SRC_H = 3840, 2160
CROP_W = round(SRC_H * 9 / 16)  # 1215
FPS = 30
ZOOM = 0.06  # slow punch-in over each shot
# Active picture inside the letterbox bars (height, top offset), from cropdetect, with a 4px safety margin.
ACTIVE = {"GTAVI_Trailer_2": (1720, 220), "GTAVI_Launch_Trailer": (1912, 124)}


def active(src):
    return ACTIVE.get(src, (SRC_H, 0))


def run(cmd):
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL)


def shots():
    for i, (t, src, sin, xc, note) in enumerate(SHOTS):
        end = SHOTS[i + 1][0] if i + 1 < len(SHOTS) else END
        yield i, t, end - t, src, sin, xc, note


def crop_x(xc, w=CROP_W, iw=SRC_W):
    return int(max(0, min(iw - w, xc * iw - w / 2)))


if MODE == "preview":
    os.makedirs(f"{WORK}/crops", exist_ok=True)
    for i, t, d, src, sin, xc, note in shots():
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(sin + d / 2), "-i", f"{FOOT}/{src}.mp4",
             "-frames:v", "1", "-vf",
             f"crop={round(active(src)[0]*9/16)}:{active(src)[0]}:{crop_x(xc, round(active(src)[0]*9/16))}:{active(src)[1]},scale=270:480,"
             f"drawtext=fontfile=/usr/share/fonts/opentype/inter/Inter-Bold.otf:text='{i}':"
             "x=8:y=8:fontsize=36:fontcolor=yellow:box=1:boxcolor=black@0.7",
             f"{WORK}/crops/c{i:02d}.jpg"])
    run(["ffmpeg", "-v", "error", "-y", "-framerate", "1", "-i", f"{WORK}/crops/c%02d.jpg",
         "-vf", "tile=10x4:padding=4", "-frames:v", "1", f"{WORK}/crops_sheet.jpg"])

elif MODE == "segments":
    # Each shot -> near-lossless 1080x1920 intermediate, so the final encode is the only lossy step.
    os.makedirs(f"{WORK}/seg", exist_ok=True)
    lst = open(f"{WORK}/seg/list.txt", "w")
    for i, t, d, src, sin, xc, note in shots():
        nframes = round((t + d) * FPS) - round(t * FPS)  # frame-exact cut points
        # Upscale a little over time (punch-in), then crop 9:16 around the chosen x-centre.
        ah, ay = active(src)
        cw = round(ah * 9 / 16)
        vf = (f"crop={SRC_W}:{ah}:0:{ay},"
              f"scale=w='trunc(iw*(1+{ZOOM}*t/{d:.3f})/2)*2':h=-2:eval=frame:flags=lanczos,"
              f"crop={cw}:{ah}:'max(0,min(iw-{cw},{xc}*iw-{cw}/2))':'(ih-{ah})/2',"
              f"scale=1080:1920:flags=lanczos,eq=saturation=1.06:contrast=1.03,setsar=1,fps={FPS}")
        if note.startswith("GTA VI logo"):
            # Logo is wider than a 9:16 slice: show a wider crop, fitted, over a blurred fill.
            vf = (f"split[a][b];"
                  f"[a]crop={CROP_W}:{SRC_H},scale=1080:1920,gblur=sigma=60,eq=brightness=-0.32:saturation=0.8[bg];"
                  f"[b]crop=2000:{SRC_H},scale=1080:-2:flags=lanczos[fg];"
                  f"[bg][fg]overlay=x='(W-w)/2':y='(H-h)/2',setsar=1,fps={FPS}")
        out = f"{WORK}/seg/s{i:02d}.mkv"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{sin:.3f}", "-i", f"{FOOT}/{src}.mp4",
             "-vf", vf, "-frames:v", str(nframes), "-an",
             "-c:v", "libx264", "-preset", "veryfast", "-qp", "0", "-pix_fmt", "yuv420p", out])
        lst.write(f"file '{out}'\n")
        print(f"shot {i:2d} {d:4.2f}s  {note}", flush=True)
    lst.close()

elif MODE == "final":
    ass = f"{WORK}/captions.ass"
    vo = sys.argv[4]
    out = sys.argv[5]
    run(["ffmpeg", "-v", "error", "-stats", "-y",
         "-f", "concat", "-safe", "0", "-i", f"{WORK}/seg/list.txt",
         "-i", vo,
         "-filter_complex",
         f"[0:v]ass={ass}:fontsdir=/usr/share/fonts/opentype/inter[v];"
         f"[1:a]apad,atrim=0:{END},afade=t=out:st={END-0.6}:d=0.6[a]",
         "-map", "[v]", "-map", "[a]",
         "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-profile:v", "high", "-level", "4.2",
         "-pix_fmt", "yuv420p", "-g", "60", "-bf", "2", "-movflags", "+faststart",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
         "-t", f"{END}", out])
