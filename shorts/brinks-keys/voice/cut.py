# shrink every pause in a voice take to a short breath; trims head/tail. usage: cut.py in.wav out.wav
import sys, numpy as np, wave
def rd(p):
    w = wave.open(p); n = w.getnframes(); sr = w.getframerate()
    return np.frombuffer(w.readframes(n), np.int16).astype(np.float32) / 32768, sr
x, sr = rd(sys.argv[1])
hop = int(0.005 * sr); win = int(0.02 * sr)
n = len(x) // hop
rms = np.array([np.sqrt(np.mean(x[i*hop:i*hop+win] ** 2) + 1e-12) for i in range(n)])
db = 20 * np.log10(rms)
quiet = db < -42
KEEP = 0.07   # seconds of pause kept between phrases
MIN = 0.09    # pauses shorter than this stay untouched
segs = []; i = 0
while i < n:
    if quiet[i]:
        j = i
        while j < n and quiet[j]: j += 1
        segs.append((i, j)); i = j
    else: i += 1
out = []; pos = 0; fade = int(0.006 * sr)
removed = 0
for a, b in segs:
    s0, s1 = a * hop, b * hop
    dur = (s1 - s0) / sr
    head = a == 0; tail = b >= n
    if head: keep = 0.0
    elif tail: keep = 0.15
    elif dur < MIN: continue
    else: keep = KEEP
    k = int(keep * sr)
    cut0 = s0 + k // 2; cut1 = s1 - (k - k // 2)
    if cut1 <= cut0: continue
    out.append(x[pos:cut0]); pos = cut1; removed += (cut1 - cut0) / sr
out.append(x[pos:])
y = out[0]
for seg in out[1:]:
    if len(y) > fade and len(seg) > fade:
        r = np.linspace(0, 1, fade)
        y = np.concatenate([y[:-fade], y[-fade:] * (1 - r) + seg[:fade] * r, seg[fade:]])
    else: y = np.concatenate([y, seg])
w = wave.open(sys.argv[2], "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes()); w.close()
print(f"in {len(x)/sr:.2f}s  out {len(y)/sr:.2f}s  removed {removed:.2f}s")
