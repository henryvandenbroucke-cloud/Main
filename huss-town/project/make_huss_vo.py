"""Voice-over for Huss Town: Kokoro TTS per shot -> joined with short gaps -> raw wav.

usage: python3 make_huss_vo.py <kokoro_model_dir> <out_wav> [voice] [speed]
Pitch/speed shaping is done afterwards with ffmpeg rubberband.
"""
import sys
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

MODEL, OUT = sys.argv[1], sys.argv[2]
VOICE = sys.argv[3] if len(sys.argv) > 3 else "am_puck"
SPEED = float(sys.argv[4]) if len(sys.argv) > 4 else 1.1

# (text spoken, gap after in seconds) — one entry per shot, words match story.json lines exactly
SHOTS = [
    ("In this town, everybody goes out partying...", 0.10),
    ("except me.", 0.22),
    (["Hhuss!", "Hhuss!", "Hhuss!"], 0.25),
    ("Friday night? Pizza party.", 0.18),
    (["Me?", "Hhuss!", "Hhuss!", "Hhuss!"], 0.25),
    ("Monday? School disco.", 0.18),
    (["Me?", "Hhuss!"], 0.25),
    ("They have no talents.", 0.25),
    ("So the mayor said: everybody must party.", 0.25),
    ("The whole town cheered...", 0.08),
    ("except me.", 0.22),
    (["Hhuss!", "Hhuss!", "Hhuss!", "HHUSS!"], 0.5),
]

k = Kokoro(f"{MODEL}/kokoro-v1.0.onnx", f"{MODEL}/voices-v1.0.bin")
parts, sr = [], 24000
def say(text):
    a, sr_ = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
    nz = np.where(np.abs(a) > 0.01)[0]  # trim near-silence so gaps are exactly what we set
    if len(nz):
        a = a[max(0, nz[0] - int(.02 * sr_)): nz[-1] + int(.04 * sr_)]
    return a, sr_

HUSS_GAP = 0.30  # breathing rhythm between separate huss chants
LOG = []  # (piece text, start s, end s) in raw time
def cur(): return sum(len(p) for p in parts) / 24000
for text, gap in SHOTS:
    if isinstance(text, list):  # chant: each piece voiced on its own, spaced out
        for i, piece in enumerate(text):
            a, sr = say(piece)
            LOG.append((piece, cur(), cur() + len(a) / sr))
            if piece == "HHUSS!":
                a = np.clip(a * 1.35, -1, 1)
            parts.append(a)
            if i < len(text) - 1:
                parts.append(np.zeros(int((0.18 if piece == "Me?" else HUSS_GAP) * sr), dtype=a.dtype))
    else:
        a, sr = say(text)
        LOG.append((text, cur(), cur() + len(a) / sr))
        parts.append(a)
    parts.append(np.zeros(int(gap * sr), dtype=parts[-1].dtype))
sf.write(OUT, np.concatenate(parts), sr)
import json; json.dump(LOG, open(OUT + ".pieces.json", "w"), indent=0)
print(f"{sum(len(p) for p in parts) / sr:.2f}s raw")
