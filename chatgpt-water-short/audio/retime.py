# Puts a new, natural voice take on the finished picture without re-rendering it.
# usage: python3 retime.py <new48k.wav> <new_words.json> <old_words.json> <workdir>
#   new48k.wav / new_words.json : the new take (48 kHz mono) and its word timings
#   old_words.json              : word timings on the picture's current timeline (words.json)
# Writes into <workdir>:
#   voice_tight.wav  the new take, untouched except that pauses longer than CAP are shortened to CAP
#   timemap.json     anchors [old_time, new_time]: each matched word start in the picture -> the same word now
#   frames.json      for every output frame (30 fps), the source frame of the old picture to show
# The voice is never stretched. The picture follows the voice: between anchors it plays slightly slower or
# faster (frames repeated or skipped), so every cut and reaction still lands on its word.
import sys, json, re, wave, difflib
import numpy as np

src, new_j, old_j, wd = sys.argv[1:5]
SR, FPS, OLD_TOTAL = 48000, 30, 71.0
CAP = 0.26          # longest pause kept, seconds
MIN_ANCHOR = 0.9    # anchors closer than this (in the old timeline) are thinned out
RATE = (0.62, 1.3)  # allowed picture playback speed between anchors

w = wave.open(src); assert w.getframerate() == SR and w.getnchannels() == 1
a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
nw, ow = json.load(open(new_j)), json.load(open(old_j))

# 1. shorten long pauses (10 ms frames, silence = 42 dB under the loudest frame)
hop = SR // 100; n = len(a) // hop
db = 20 * np.log10(np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-12)
sil = db < db.max() - 32
keep = np.ones(len(a), bool); cut_at = []          # (time in take, seconds removed)
i = 0
while i < n:
    if sil[i]:
        j = i
        while j < n and sil[j]: j += 1
        d = (j - i) / 100
        if d > CAP and i > 0 and j < n:
            h = CAP / 2
            c0, c1 = int((i / 100 + h) * SR), int((j / 100 - h) * SR)
            keep[c0:c1] = False; cut_at.append((i / 100 + h, (c1 - c0) / SR))
        i = j
    else: i += 1
f = int(0.006 * SR)
edges = np.flatnonzero(np.diff(keep.astype(int)))
b = a.copy()
for e in edges:                                    # short fades around every cut
    if keep[e] and not keep[e + 1]: b[max(0, e - f): e + 1] *= np.linspace(1, 0, min(f, e) + 1)
    elif not keep[e] and keep[e + 1]: b[e + 1: e + 1 + f] *= np.linspace(0, 1, len(b[e + 1: e + 1 + f]))
v = b[keep]
nz = np.flatnonzero(np.abs(v) > 10 ** ((db.max() - 42) / 20))
lead = nz[0] / SR - 0.02
v = v[max(0, int(lead * SR)):]
NEW_TOTAL = len(v) / SR + 0.35
def compact(t):
    return t - sum(d for at, d in cut_at if at < t) - max(0, lead)

# 2. anchors: matched words, old picture time -> new voice time
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
sm = difflib.SequenceMatcher(a=[norm(x["w"]) for x in ow], b=[norm(x["w"]) for x in nw], autojunk=False)
pairs = []
for blk in sm.get_matching_blocks():
    for k in range(blk.size): pairs.append((ow[blk.a + k]["s"], compact(nw[blk.b + k]["s"])))
anc = [(0.0, 0.0)]
for o, nn in pairs:
    if o - anc[-1][0] < MIN_ANCHOR or nn <= anc[-1][1]: continue
    r = (o - anc[-1][0]) / (nn - anc[-1][1])
    if RATE[0] <= r <= RATE[1]: anc.append((o, nn))
anc.append((OLD_TOTAL, NEW_TOTAL))
A = np.array(anc)
rates = np.diff(A[:, 0]) / np.diff(A[:, 1])
print(f"pauses shortened {len(cut_at)} (saved {sum(d for _, d in cut_at):.1f}s) | voice {len(v) / SR:.2f}s | video {OLD_TOTAL} -> {NEW_TOTAL:.2f}s")
print(f"anchors {len(anc)} of {len(pairs)} matched words | picture speed min {rates.min():.2f} max {rates.max():.2f} mean {OLD_TOTAL / NEW_TOTAL:.2f}")

# 3. source frame for every output frame
nout = int(round(NEW_TOTAL * FPS))
src_t = np.interp((np.arange(nout) + 0.5) / FPS, A[:, 1], A[:, 0])
frames = np.clip(np.floor(src_t * FPS).astype(int), 0, int(OLD_TOTAL * FPS) - 1)
frames = np.maximum.accumulate(frames)

with wave.open(f"{wd}/voice_tight.wav", "w") as o:
    o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR); o.writeframes((np.clip(v, -1, 1) * 32767).astype(np.int16).tobytes())
json.dump({"anchors": anc, "old_total": OLD_TOTAL, "new_total": NEW_TOTAL}, open(f"{wd}/timemap.json", "w"))
json.dump(frames.tolist(), open(f"{wd}/frames.json", "w"))
print("frames", nout, "| repeated", int(np.sum(np.diff(frames) == 0)), "| skipped", int(np.sum(np.clip(np.diff(frames) - 1, 0, None))))
