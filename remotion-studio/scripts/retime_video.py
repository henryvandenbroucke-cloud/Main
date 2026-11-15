# Rebuilds a video from an existing one by showing, for each output frame, a chosen source frame.
# usage: python3 scripts/retime_video.py <in.mp4> <frames.json> <out.mp4>
#   frames.json: list of source frame indices, one per output frame, never decreasing (from retime.py).
# Frames stream through pipes one at a time, so memory stays small; nothing is re-rendered.
import sys, json, subprocess
src, fj, out = sys.argv[1:4]
idx = json.load(open(fj))
W, H, FPS = 1080, 1920, 30
fsize = W * H * 3
dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", src, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "15", "-pix_fmt", "yuv420p", "-an", out], stdin=subprocess.PIPE)
cur, frame = -1, None
for want in idx:
    while cur < want:
        frame = dec.stdout.read(fsize); cur += 1
        assert len(frame) == fsize, f"source ended at frame {cur}"
    enc.stdin.write(frame)
enc.stdin.close(); enc.wait(); dec.kill()
print("wrote", out, len(idx), "frames")
