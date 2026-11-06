# Soundtrack of "The Man Who Made Bricks Too Big" (67.0 s): an original comedic caper score (oompah tuba, pizzicato,
# glockenspiel, brass stabs, brushes) that follows the story beats, synthesized SFX on every gag, and the mix under
# the ElevenLabs voice (music ducked by the voice, -14 LUFS integrated, true peak <= -1 dBTP).
# usage: python brick_audio.py voice.wav out_dir
import os, sys
import numpy as np
from dsp import SR, ns, tt, rng, lp, hp, bp, fades, st, pan, place, widen, colored, dbg, read_wav, write_wav, integrated, true_peak, modal, phase
from instruments import m2f, brass, glock, vibes, pluck, snare, snare_roll, cymbal, timpani, brush, pad, triangle
from sfx_gen import clink, whoosh, vox, vowel_track, _track, hurrah, wood_crack

DUR = 67.0
N = ns(DUR)
R = rng(7)
BEAT = 0.5  # 120 bpm

# ---------------------------------------------------------------- music
C = {"C": [48, 60, 64, 67], "Am": [45, 57, 60, 64], "F": [41, 57, 60, 65], "G": [43, 55, 59, 62], "Dm": [38, 57, 62, 65],
     "E": [40, 56, 59, 64], "Em": [40, 55, 59, 64], "G7": [43, 53, 59, 62], "Bb": [46, 58, 62, 65], "Ab": [44, 56, 60, 63]}
mus = np.zeros((2, N))

def put(x, t, g=1.0, p=0.0):
    if t >= DUR: return
    x = np.asarray(x, float)
    place(mus, pan(x, p) if x.ndim == 1 else x, t, g)

def bar_band(t0, chord, style, vel=1.0, melody=True):
    """one 2-second bar of the band in a style: 'caper' (oompah + pizz + glock), 'pomp' (brass + snare),
    'night' (vibes + pad), 'minor' (low brass + timpani), 'sad' (slow tuba + vibes), 'warm' (pad + glock + pizz)"""
    root, a, b, c = C[chord]
    if style in ("caper", "pomp", "warm", "minor"):
        for k in range(4):
            tb = t0 + k * BEAT
            if k % 2 == 0:
                put(brass(m2f(root - (12 if root > 45 else 0) + (7 if k == 2 and style != "minor" else 0)), 0.32, 0.75 * vel, R, "tuba"), tb, 0.55, -0.1)
            else:
                for m in (a, b, c):
                    put(pluck(m2f(m), 0.45 * vel, R, 0.35, 0.55), tb + R.uniform(0, 0.006), 0.32, 0.25)
                put(brush(0.5 * vel, R, 0.25), tb, 0.35, 0.3)
    if style == "caper" and melody:
        pat = [(0.0, c + 12), (0.75, b + 12), (1.0, a + 12), (1.5, b + 12), (1.75, c + 12)]
        for dt, m in pat: put(glock(m2f(m), 0.42 * vel, R, 0.9), t0 + dt, 0.3, 0.35)
    if style == "warm" and melody:
        pat = [(0.0, c + 12), (0.5, a + 12), (1.0, b + 12), (1.5, c + 14 if c + 14 < 90 else c + 12)]
        for dt, m in pat: put(glock(m2f(m), 0.4 * vel, R, 1.2), t0 + dt, 0.3, 0.35)
        put(pad([m2f(a), m2f(b), m2f(c)], 2.0, 0.35 * vel, R, 0.3, 0.6), t0, 0.5)
    if style == "pomp":
        for dt in (0.0, 1.0):
            for m in (a, b, c): put(brass(m2f(m), 0.28, 0.7 * vel, R, "stab"), t0 + dt, 0.22, -0.2)
        put(snare(0.55 * vel, R), t0 + 0.75, 0.35, 0.1); put(snare(0.4 * vel, R), t0 + 1.25, 0.3, 0.1); put(snare(0.6 * vel, R), t0 + 1.5, 0.35, 0.1)
    if style == "minor":
        put(timpani(m2f(root), 0.7 * vel, R, 1.6), t0, 0.5)
        for m in (a, b): put(brass(m2f(m), 0.9, 0.5 * vel, R, "horn"), t0, 0.22, -0.25)
    if style == "night":
        put(pad([m2f(a), m2f(b), m2f(c)], 2.1, 0.45 * vel, R, 0.5, 0.8), t0, 0.55)
        for k, m in enumerate([a + 12, b + 12, c + 12, b + 12]):
            put(vibes(m2f(m), 0.45 * vel, R, 1.4), t0 + k * BEAT, 0.35, 0.3 * (1 if k % 2 else -1))
        put(brass(m2f(root - 12 if root > 40 else root), 1.8, 0.35 * vel, R, "soft"), t0, 0.35)
    if style == "sad":
        put(brass(m2f(root - 12 if root > 40 else root), 1.7, 0.55 * vel, R, "soft"), t0, 0.5)
        for k, m in enumerate([c + 12, b + 12]): put(vibes(m2f(m), 0.35 * vel, R, 1.6), t0 + k, 0.3, 0.2)

# the score, bar by bar (bar = 2 s from t0); sections follow the voice
plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1
section(0.0, 7.5, ["C", "Am", "F", "G"], "caper", 1.0)
section(7.5, 14.2, ["F", "C", "G", "C"], "pomp", 0.95)
section(14.2, 36.0, ["C", "Am", "F", "G", "C", "Em", "F", "G7"], "caper", 1.0)
section(37.7, 42.2, ["Am", "F", "C", "G"], "night", 0.9)
section(42.2, 46.9, ["C", "F", "G", "C"], "caper", 1.1)
section(46.9, 53.5, ["Am", "Dm", "E", "Am"], "minor", 1.0)
section(53.5, 60.1, ["Am", "F", "Dm", "E"], "sad", 0.9)
section(60.1, 66.4, ["C", "F", "G", "C"], "warm", 1.0)
for t0, ch, sty, vel in plan:
    end = 36.0 if t0 < 36.0 else DUR
    seg = np.zeros((2, N)); mus_backup = mus.copy()
    bar_band(t0, ch, sty, vel)
    if t0 + 2.0 > end:  # the "Wait!" stop: cut everything after the stop point inside this bar
        cut = ns(end); fade = ns(0.03)
        delta = mus - mus_backup
        delta[:, cut:] = 0; delta[:, cut - fade:cut] *= np.linspace(1, 0, fade)[None, :]
        mus[:] = mus_backup + delta
# stingers / punctuation
put(cymbal(0.7, R, 2.0), 7.5, 0.35)                       # hook flash
for tm, f in [(48.92, "A"), (49.76, "D"), (50.72, "E")]:  # 10 / 5 / 3 inches
    put(timpani(m2f({"A": 45, "D": 50, "E": 52}[f]), 0.9, R, 1.4), tm - 0.02, 0.6)
for m in (57, 60, 64, 69): put(brass(m2f(m), 0.45, 0.95, R, "stab"), 52.30, 0.32)   # DOUBLE TAX stab
for (t, v) in snare_roll(58.6, 59.58, 0.25, 0.8, R): put(snare(v, R, 0.2, buzz=True), t, 0.3, 0.1)
put(cymbal(0.8, R, 1.6), 59.6, 0.3)
# final button at "dodge"
for m in (48, 60, 64, 67, 72): put(brass(m2f(m), 0.5, 0.9, R, "stab" if m > 50 else "tuba"), 66.42, 0.32)
put(glock(m2f(84), 0.6, R, 1.5), 66.42, 0.3); put(cymbal(0.5, R, 1.2, 0.8), 66.42, 0.18)

# ---------------------------------------------------------------- SFX
fx = np.zeros((2, N))
def sfx(x, t, g=1.0, p=0.0):
    x = np.asarray(x, float)
    place(fx, pan(x, p) if x.ndim == 1 else x, t, g)

def boing(t, f0=180, f1=520, dur=0.55, g=0.5):
    tt_ = tt(dur); f = f0 + (f1 - f0) * (1 - np.exp(-tt_ / 0.08)) + 30 * np.sin(2 * np.pi * 14 * tt_) * np.exp(-tt_ / 0.25)
    y = np.sin(phase(f)) * np.exp(-tt_ / 0.22) + 0.3 * np.sin(2 * phase(f)) * np.exp(-tt_ / 0.12)
    sfx(fades(y, 0.002, 0.05), t, g)
def pop(t, g=0.4, f=900):
    tt_ = tt(0.12); y = np.sin(phase(f * np.exp(-tt_ / 0.03) + 200)) * np.exp(-tt_ / 0.025)
    sfx(fades(y, 0.0005, 0.02), t, g)
def thud(t, g=0.8):
    tt_ = tt(0.5); y = np.sin(phase(110 * np.exp(-tt_ / 0.08) + 45)) * np.exp(-tt_ / 0.09)
    y += lp(R.standard_normal(len(tt_)), 1500) * np.exp(-tt_ / 0.012) * 0.6
    sfx(fades(y, 0.0005, 0.05), t, g)
def plop(t, g=0.7):
    tt_ = tt(0.35); y = np.sin(phase(300 * np.exp(-tt_ / 0.05) + 70)) * np.exp(-tt_ / 0.07)
    y += bp(R.standard_normal(len(tt_)), 200, 1500) * np.exp(-tt_ / 0.03) * 0.5
    sfx(fades(y, 0.0005, 0.05), t, g)
def ding(t, f=1568, g=0.35):
    sfx(glock(f, 0.8, R, 1.2), t, g, 0.2); sfx(glock(f * 1.5, 0.5, R, 1.0), t + 0.06, g * 0.7, -0.2)
def sparkle_s(t, g=0.25):
    for k, m in enumerate([84, 88, 91, 96]): sfx(glock(m2f(m), 0.6, R, 0.8), t + k * 0.045, g, 0.5 - 0.3 * k)
def coins(t, n=6, g=0.35):
    for k in range(n): sfx(clink(R, R.uniform(2600, 4200), 0.2, 1.2), t + k * 0.07 + R.uniform(0, 0.02), g, R.uniform(-0.5, 0.5))
def swoosh(t, dur=0.35, g=0.35):
    sfx(widen(whoosh(dur, R, peak=dur * 0.45, f_lo=400, f_hi=2600, tail=0.1), R), t - dur * 0.45, g)
def scratch(t, g=0.6):
    tt_ = tt(0.45); f = 900 + 700 * np.sin(2 * np.pi * 4.5 * tt_) * np.exp(-tt_ / 0.3)
    nz = R.standard_normal(len(tt_)); y = np.zeros_like(tt_)
    for fc in (f,): y += np.sin(phase(fc)) * 0.4
    y = (y + bp(nz, 600, 3500) * 0.8) * np.exp(-tt_ / 0.18)
    sfx(fades(y, 0.001, 0.05), t, g)
def rustle(t, dur=0.5, g=0.3):
    tt_ = tt(dur); e = np.abs(np.convolve(R.standard_normal(len(tt_)), np.ones(400) / 400, "same")) * 8
    y = hp(R.standard_normal(len(tt_)), 2500) * np.clip(e, 0, 1) * np.sin(np.pi * tt_ / dur)
    sfx(fades(y, 0.005, 0.05), t, g)
def tear(t, g=0.5):
    tt_ = tt(0.45); y = hp(R.standard_normal(len(tt_)), 1500)
    crack = (R.random(len(tt_)) < 0.004).astype(float) * R.uniform(0.5, 1.5, len(tt_))
    y = y * 0.5 * (0.3 + 0.7 * np.sin(np.pi * tt_ / 0.45)) + np.convolve(crack, np.exp(-np.arange(200) / 30.0), "same") * hp(R.standard_normal(len(tt_)), 2000)
    sfx(fades(y, 0.002, 0.05), t, g)
def hiss(t, dur=0.9, g=0.35):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 3000, 9000) * np.minimum(1, tt_ / 0.05) * np.exp(-tt_ / 0.5)
    y += 0.25 * np.sin(phase(np.full(len(tt_), 2200.0))) * np.minimum(1, tt_ / 0.05) * np.exp(-tt_ / 0.4)
    sfx(fades(y, 0.002, 0.08), t, g)
def wahwah(t, g=0.5):
    for k, (m, d) in enumerate([(55, 0.32), (54, 0.32), (53, 0.32), (52, 0.9)]):
        sfx(brass(m2f(m), d, 0.7, R, "horn", fall=-0.8 if k == 3 else 0.0), t + k * 0.36, g)
def laugh(t, base=150, g=0.3, p=0.0, n=4):
    d = 0.16 * n + 0.1; nn = ns(d); tt_ = np.arange(nn) / SR
    f0 = base * (1.25 - 0.25 * tt_ / d) * (1 + 0.04 * np.sin(2 * np.pi * 6 * tt_))
    forms = vowel_track(nn, [(0, "a"), (d, "A")])
    amp = np.clip(np.sin(np.pi * ((tt_ / 0.16) % 1)) ** 1.5, 0, 1) * np.clip((d - tt_) / 0.1, 0, 1)
    sfx(vox(f0, forms, amp, R, 1.0, breath=0.35), t, g, p)
def flap(t, dur=0.8, g=0.2):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 300, 2000) * (np.sin(2 * np.pi * 9 * tt_) > 0.3) * np.exp(-tt_ / 0.6)
    sfx(fades(y, 0.002, 0.05), t, g, 0.3)
def tick(t, f=1800, g=0.2):
    sfx(pluck(f, 0.7, R, 0.25, 0.9), t, g, R.uniform(-0.3, 0.3))
def bell_stamp(t, g=0.8):
    thud(t, g); sfx(wood_crack(R) * 0.25, t, g * 0.35)

W = lambda s: s - 0.03
# hook
swoosh(0.05, 0.4, 0.2); ding(W(3.68), 1568, 0.3); sparkle_s(W(3.75))
swoosh(4.2, 0.3, 0.3); boing(W(6.1), 160, 540, 0.6, 0.55); pop(6.12, 0.35)
swoosh(7.53, 0.5, 0.4)
pop(9.42, 0.25); flap(9.84, 1.2, 0.18); boing(W(9.84), 300, 120, 0.5, 0.25)        # pockets out, moth
sparkle_s(W(12.1), 0.3); swoosh(W(13.26), 0.3, 0.3)
coins(W(15.76), 7, 0.35); ding(W(15.96), 2093, 0.25)
for tm in (16.84, 18.72): bell_stamp(W(tm), 0.75)
rustle(19.4, 0.4, 0.12); swoosh(19.62, 0.4, 0.25); ding(W(20.38), 1319, 0.18)
swoosh(22.0, 0.6, 0.2)
boing(W(25.88), 200, 600, 0.6, 0.55); pop(25.9, 0.3)
plop(W(27.74), 0.8); sparkle_s(27.85, 0.18)
pop(W(29.56), 0.3, 700); pop(29.66, 0.3, 900); coins(W(30.22), 5, 0.3)
for k, tm in enumerate([31.5, 31.75, 32.0]): pass
for k in range(4): laugh(W(33.0) + 0.05 * k, 130 + 25 * k, 0.16, -0.5 + 0.33 * k, 3 + (k % 2))
for k in range(6): tick(33.75 + k * 0.2, 1600 + 90 * k, 0.12)
for k in range(6): tick(35.22 + k * 0.2, 1600 + 90 * k, 0.12)
scratch(W(36.08), 0.55); pop(36.2, 0.25, 1200); pop(36.32, 0.22, 1400)
swoosh(37.72, 0.6, 0.2); rustle(W(38.3), 0.5, 0.2)
rustle(39.9, 0.3, 0.12); boing(W(40.8), 140, 380, 0.55, 0.5)
for k in range(4): sfx(hurrah(R, 120 + 20 * k, 1.0), W(44.0) + 0.06 * k, 0.12, -0.6 + 0.4 * k)
hiss(W(46.1), 1.0, 0.3); thud(W(46.1), 0.4)
swoosh(W(48.22) - 0.1, 0.3, 0.3); sfx(wood_crack(R), W(48.22), 0.35)
for tm in (48.92, 49.76, 50.72): tick(W(tm), 2400, 0.15)
swoosh(51.3, 0.4, 0.25); bell_stamp(W(52.32), 0.85)
wahwah(W(53.62), 0.32)
bell_stamp(W(57.32), 0.5)
tear(W(59.6), 0.55); rustle(59.75, 0.6, 0.2)
swoosh(60.1, 0.6, 0.25)
sparkle_s(W(66.12), 0.3)

# ---------------------------------------------------------------- mix
voice, sr = read_wav(sys.argv[1])
assert sr == SR, sr
v = st(voice[0] if voice.shape[0] == 1 else voice)[:, :N]
if v.shape[1] < N: v = np.pad(v, ((0, 0), (0, N - v.shape[1])))
v = v * dbg(-16.0 - integrated(v))                          # voice to -16 LUFS before the bus
# duck the music while the voice speaks (envelope follower on the voice)
env = np.sqrt(np.convolve(v[0] ** 2, np.ones(ns(0.05)) / ns(0.05), "same"))
speak = np.clip((20 * np.log10(env + 1e-9) + 45) / 10, 0, 1)
k = np.exp(-1 / (SR * 0.12)); sm = np.zeros_like(speak); a = 0.0
for i in range(0, len(speak), 64):
    a = max(speak[i], a * k ** 64); sm[i:i + 64] = a
duck = dbg(-4.5 * sm)
musb = mus * dbg(-21.0 - integrated(mus)) * duck[None, :]
fxb = fx * dbg(-22.0 - integrated(fx))
mix = v + musb + fxb
mix *= dbg(-14.0 - integrated(mix))
# look-ahead peak limiter to -1.2 dBFS (sample peak; true peak checked after)
ceil = dbg(-2.2)
pk = np.abs(mix).max(axis=0)
need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
look = ns(0.004)
from scipy.ndimage import minimum_filter1d
g = minimum_filter1d(need, look * 2 + 1)
rel = np.exp(-1 / (SR * 0.08)); out = np.empty_like(g); cur = 1.0
for i in range(len(g)):
    cur = g[i] if g[i] < cur else g[i] + (cur - g[i]) * rel
    out[i] = cur
mix = mix * out[None, :]
mix *= dbg(-14.0 - integrated(mix))
mix = np.clip(mix, -dbg(-1.6), dbg(-1.6))
os.makedirs(sys.argv[2], exist_ok=True)
write_wav(os.path.join(sys.argv[2], "mix.wav"), mix)
write_wav(os.path.join(sys.argv[2], "music.wav"), musb)
write_wav(os.path.join(sys.argv[2], "sfx.wav"), fxb)
print(f"mix {integrated(mix):.1f} LUFS, TP {true_peak(mix):.1f} dBTP, music {integrated(musb):.1f}, sfx {integrated(fxb):.1f}, voice {integrated(v):.1f}")
