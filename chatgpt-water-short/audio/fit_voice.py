# Fits a new voice take to the existing picture without re-rendering it.
# usage: python3 fit_voice.py <new48k.wav> <new_words.json> <old_words.json> <out.wav> [--dry]
#   new_words.json: word timings of the new take; old_words.json: word timings on the video's timeline.
# The take is cut into phrases at its pauses. Each phrase is placed so its first word starts where the
# same word starts in the video. A phrase is only sped up (Rubber Band R3) when it would run into the next
# one, and only by the amount needed; everything else plays exactly as recorded.
import sys, json, re, wave, subprocess, tempfile, os, difflib
import numpy as np

src, new_j, old_j, out = sys.argv[1:5]
dry = "--dry" in sys.argv
SR = 48000
TOTAL = 71.0
GAP = 0.08      # shortest silence kept between two phrases
SIL = 0.14      # a pause at least this long splits two phrases

w = wave.open(src); assert w.getframerate() == SR
a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
nw, ow = json.load(open(new_j)), json.load(open(old_j))
norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())

# word-to-word alignment between the two takes
sm = difflib.SequenceMatcher(a=[norm(x["w"]) for x in nw], b=[norm(x["w"]) for x in ow], autojunk=False)
n2o = {}
for blk in sm.get_matching_blocks():
    for k in range(blk.size): n2o[blk.a + k] = blk.b + k

# speech regions from the signal (10 ms frames, 40 dB under the loudest frame)
hop = SR // 100; n = len(a) // hop
db = 20 * np.log10(np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-12)
on = db > db.max() - 40
regions = []; i = 0
while i < n:
    if on[i]:
        j = i
        while j < n and on[j]: j += 1
        regions.append([i / 100, j / 100]); i = j
    else: i += 1
phr = [regions[0]]
for r in regions[1:]:
    if r[0] - phr[-1][1] < SIL: phr[-1][1] = r[1]
    else: phr.append(r)
phr = [[max(0, s - 0.02), e + 0.04] for s, e in phr]

# target start of each phrase = video time of its first matched word, minus the same lead-in
plan = []
for s, e in phr:
    idx = [k for k, x in enumerate(nw) if s - 0.1 <= x["s"] < e]
    m = [k for k in idx if k in n2o]
    if m:
        k = m[0]; t = ow[n2o[k]]["s"] - (nw[k]["s"] - s)
    else:
        t = None
    plan.append({"s": s, "e": e, "t": t, "words": " ".join(nw[k]["w"] for k in idx)})
# phrases with no matched word sit right after the previous one
for p_, p in zip([None] + plan[:-1], plan):
    if p["t"] is None: p["t"] = (p_["t"] + (p_["e"] - p_["s"]) + 0.15) if p_ else 0.0
plan[0]["t"] = max(0.0, plan[0]["t"])

# speed-up needed so a phrase ends before the next one starts
for k, p in enumerate(plan):
    room = (plan[k + 1]["t"] - GAP if k + 1 < len(plan) else TOTAL - 0.05) - p["t"]
    p["r"] = max(1.0, (p["e"] - p["s"]) / room) if room > 0 else 9.0

for p in plan:
    flag = "  <-- sped up" if p["r"] > 1.001 else ""
    print(f"{p['t']:6.2f}s  len {p['e'] - p['s']:5.2f}  x{p['r']:.3f}{flag}  {p['words'][:70]}")
rs = [p["r"] for p in plan]
print(f"phrases {len(plan)} | sped up {sum(r > 1.001 for r in rs)} | max x{max(rs):.3f} | "
      f"speech-weighted mean x{sum((p['e'] - p['s']) * p['r'] for p in plan) / sum(p['e'] - p['s'] for p in plan):.3f}")
if dry: sys.exit()

outbuf = np.zeros(int(TOTAL * SR))
tmp = tempfile.mkdtemp()
for k, p in enumerate(plan):
    seg = a[int(p["s"] * SR): int(p["e"] * SR)].copy()
    if p["r"] > 1.001:
        fi, fo = os.path.join(tmp, "i.wav"), os.path.join(tmp, "o.wav")
        with wave.open(fi, "w") as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((np.clip(seg, -1, 1) * 32767).astype(np.int16).tobytes())
        subprocess.run(["rubberband", "-q", "-3", "-F", f"-T{p['r']:.5f}", fi, fo], check=True)
        with wave.open(fo) as f: seg = np.frombuffer(f.readframes(f.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    f = min(len(seg) // 4, int(0.006 * SR))
    seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
    at = int(p["t"] * SR); seg = seg[: max(0, len(outbuf) - at)]
    outbuf[at: at + len(seg)] += seg
with wave.open(out, "w") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR); f.writeframes((np.clip(outbuf, -1, 1) * 32767).astype(np.int16).tobytes())
print("wrote", out)
