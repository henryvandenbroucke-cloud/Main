"""Original audio for Huss Town: a basketball bounce SFX and a light bouncy beat.

usage: python3 huss_audio.py <project_dir> <seconds>
writes <project>/sfx/dribble_1..3.wav and <project>/audio/music.wav
"""
import sys
import numpy as np
import soundfile as sf

PROJ, SECS = sys.argv[1], float(sys.argv[2])
SR = 44100
rng = np.random.default_rng(7)


def env(n, attack, decay):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(attack, 1e-4)) * np.exp(-t / decay)


def bounce(pitch=1.0):
    n = int(.32 * SR); t = np.arange(n) / SR
    f = 95 * pitch * (1 + 1.2 * np.exp(-t / .012))                        # pitch-dropping thump
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, .001, .07)
    ring = (np.sin(2 * np.pi * 410 * pitch * t) * .35 + np.sin(2 * np.pi * 690 * pitch * t) * .18) * env(n, .001, .045)
    slap = rng.standard_normal(n) * env(n, .0005, .006) * .5            # floor contact
    x = thump + ring + slap
    return .85 * x / np.max(np.abs(x))


for i, p in enumerate((1.0, .94, 1.06), 1):
    sf.write(f"{PROJ}/sfx/dribble_{i}.wav", bounce(p), SR)

# ---- beat: 100 BPM, kick / clap / hats / plucky bass, original pattern
BPM = 100; beat = 60 / BPM; n = int(SECS * SR); out = np.zeros(n)


def place(x, t, g=1.0):
    i = int(t * SR)
    if i >= n: return
    m = min(len(x), n - i); out[i:i + m] += g * x[:m]


def kick():
    k = int(.35 * SR); t = np.arange(k) / SR
    f = 50 * (1 + 2.5 * np.exp(-t / .03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(k, .001, .16)


def clap():
    k = int(.22 * SR); x = rng.standard_normal(k)
    e = sum(env(k, .0005, .01) * (np.arange(k) >= int(d * SR)) for d in (0, .01, .02)) + env(k, .001, .08) * .6
    x = x * e
    return np.convolve(x, [1, -0.9], 'same') * .45  # brighten


def hat():
    k = int(.05 * SR); x = rng.standard_normal(k) * env(k, .0005, .012)
    return np.convolve(x, [1, -1], 'same') * .25


def pluck(freq):
    k = int(.4 * SR); t = np.arange(k) / SR
    x = np.sign(np.sin(2 * np.pi * freq * t)) * .5 + np.sin(2 * np.pi * freq * t) * .5
    return x * env(k, .003, .11) * .35


bass = [55.0, 55.0, 65.41, 49.0]   # A1 A1 C2 G1 — one note per bar
bar = 0; t = 0.0
while t < SECS:
    for b in range(4):
        tb = t + b * beat
        if b in (0, 2): place(kick(), tb, .9)
        if b == 2: place(kick(), tb + beat * .75, .55)
        if b in (1, 3): place(clap(), tb, .7)
        for h in range(2): place(hat(), tb + h * beat / 2, .8 if h else .5)
        place(pluck(bass[bar % 4] * 2), tb + beat * .5, .6)
    place(pluck(bass[bar % 4]), t, .9)
    t += 4 * beat; bar += 1
fade = int(.8 * SR); out[-fade:] *= np.linspace(1, 0, fade)
out = .7 * out / np.max(np.abs(out))
sf.write(f"{PROJ}/audio/music.wav", np.stack([out, out], 1), SR)
print("sfx + music written")
