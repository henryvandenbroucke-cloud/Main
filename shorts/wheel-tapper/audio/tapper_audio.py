# Soundtrack of "The Man Who Hit Trains With a Hammer" (51.4 s): a light, quiet pizzicato/glockenspiel caper in G that
# drops out for the suspense beats, tuned steel "tings" on every hammer hit (each one a note of the key), the dull
# THUNK, steam, the explainer's bell / glass / shatter, and the robot; mixed under the voice (-14 LUFS, TP <= -1).
# usage: python tapper_audio.py voice.wav out_dir
import os, sys
import numpy as np
from dsp import SR, ns, tt, rng, lp, hp, bp, fades, st, pan, place, widen, colored, dbg, read_wav, write_wav, integrated, true_peak, modal, phase
from instruments import m2f, brass, glock, vibes, pluck, snare, snare_roll, cymbal, timpani, brush, pad, triangle
from sfx_gen import clink, whoosh, vox, vowel_track, _track, hurrah, wood_crack

DUR = 1541 / 30
N = ns(DUR)
R = rng(7)
BEAT = 0.5  # 120 bpm

# ---------------------------------------------------------------- music
C = {"Dm7": [38, 57, 60, 65], "Gm": [43, 58, 62, 67], "A7": [45, 55, 61, 64], "Bb7": [46, 56, 62, 65], "D": [38, 54, 57, 62], "C": [48, 60, 64, 67], "Am": [45, 57, 60, 64], "F": [41, 57, 60, 65], "G": [43, 55, 59, 62], "Dm": [38, 57, 62, 65],
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

# the score (2 s bars), muted in the two suspense gaps
plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1
G4 = ["G", "Em", "C", "D"]
section(0.0, 6.6, G4, "caper", 0.7)
section(6.6, 10.6, ["C", "G", "Am", "D"], "warm", 0.75)
section(10.6, 16.6, G4, "caper", 0.7)
section(18.2, 20.6, ["Em", "D"], "minor", 0.6)
section(22.8, 29.0, ["Em", "C", "Am", "D"], "night", 0.75)
section(29.0, 32.8, G4, "caper", 0.65)
section(32.8, 36.4, ["Em", "D"], "minor", 0.75)
section(36.4, 42.0, G4, "caper", 0.7)
section(42.0, 51.2, ["C", "G", "Am", "D", "C", "G"], "warm", 0.75)
for t0, ch, sty, vel in plan:
    if t0 < DUR: bar_band(t0, ch, sty, vel)
mute = np.ones(N)
for a, b in [(16.48, 17.62), (20.5, 22.75)]:
    i0, i1, fd = ns(a), ns(b), ns(0.04)
    mute[i0:i1] = 0; mute[i0 - fd:i0] = np.linspace(1, 0, fd); mute[i1:i1 + fd] = np.linspace(0, 1, fd)
mus *= mute[None, :]
put(cymbal(0.5, R, 1.8), 22.75, 0.25)
for k, m in enumerate([67, 71, 74, 79]): put(pluck(m2f(m), 0.7, R, 0.5, 0.7), 51.0 - 0.3 + k * 0.07, 0.35, 0.2)

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


def clang(t, g=0.6, f0=420, dur=1.2):
    y = modal(dur, [(f0, 1.0, 0.5), (f0 * 2.43, 0.6, 0.3), (f0 * 4.1, 0.4, 0.18), (f0 * 6.3, 0.25, 0.1)], R)
    tt_ = tt(dur); y += hp(R.standard_normal(len(tt_)), 2000) * np.exp(-tt_ / 0.01) * 0.5
    sfx(fades(y, 0.0005, 0.1), t, g)
def owl(t, g=0.18):
    for k, (d, f) in enumerate([(0.35, 410), (0.6, 390)]):
        tt_ = tt(d); y = np.sin(phase(f * (1 + 0.04 * np.sin(np.pi * tt_ / d)))) * np.sin(np.pi * tt_ / d) ** 2
        sfx(lp(y + 0.05 * R.standard_normal(len(tt_)), 1200), t + k * 0.5, g, -0.4)
def scrape(t, g=0.3):
    tt_ = tt(0.3); y = bp(R.standard_normal(len(tt_)), 500, 3000) * np.sin(np.pi * tt_ / 0.3) ** 0.7
    sfx(fades(y, 0.005, 0.03), t, g, -0.2)
def slide_down(t, g=0.3, f0=900, f1=300, dur=0.5):
    tt_ = tt(dur); y = np.sin(phase(f0 * (f1 / f0) ** (tt_ / dur))) * (1 - tt_ / dur) ** 0.5
    sfx(fades(y, 0.005, 0.05), t, g)
def click(t, g=0.4):
    for k in range(2):
        tt_ = tt(0.04); y = hp(R.standard_normal(len(tt_)), 3000) * np.exp(-tt_ / 0.004)
        sfx(y, t + k * 0.055, g)
def gasp(t, base=180, g=0.15, p=0.0):
    d = 0.35; nn = ns(d); tt_ = np.arange(nn) / SR
    forms = vowel_track(nn, [(0, "o"), (d, "o")]); amp = np.clip(tt_ / 0.05, 0, 1) * np.clip((d - tt_) / 0.15, 0, 1)
    sfx(vox(base * (1.3 - 0.2 * tt_ / d) * np.ones(nn), forms, amp, R, 1.0, breath=0.6), t, g, p)


# ---------------------------------------------------------------- the hammer sounds
NOTES = [79, 83, 86, 91, 88, 84]
def ting(t, m=79, g=0.55, long=1.0, p=0.15):
    """a struck steel wheel, made pleasant: a soft mallet onset, mostly the fundamental and one shimmering partial
    (beating pair), gentle lowpass; tuned to a note of the key so a run of hits plays a little melody"""
    f0 = m2f(m) / 2
    d = 1.8 * long; tt_ = tt(d)
    y = (np.sin(2 * np.pi * f0 * tt_) * np.exp(-tt_ / (0.9 * long))
         + 0.35 * np.sin(2 * np.pi * f0 * 2.0 * tt_) * np.exp(-tt_ / (0.45 * long))
         + 0.18 * np.sin(2 * np.pi * f0 * 2.76 * tt_) * np.exp(-tt_ / 0.25)
         + 0.12 * np.sin(2 * np.pi * (f0 * 2.0 + 3.0) * tt_) * np.exp(-tt_ / (0.6 * long)))
    y *= np.minimum(1, tt_ / 0.0025)
    y += lp(R.standard_normal(len(tt_)), 2500) * np.exp(-tt_ / 0.003) * 0.12
    sfx(fades(lp(y, 6000), 0.0003, 0.15), t, g * 0.8, p); sfx(glock(m2f(m), 0.45, R, 1.4), t + 0.004, g * 0.3, -p)
def thunk(t, g=0.9):
    thud(t, g * 0.8); sfx(lp(wood_crack(R), 2500) * 0.25, t, g * 0.3)
    tt_ = tt(0.6); y = np.sin(phase(70 * np.exp(-tt_ / 0.2) + 35)) * np.exp(-tt_ / 0.18); sfx(fades(y, 0.001, 0.05), t, g * 0.8)
def glass(t, g=0.45):
    tt_ = tt(2.2); y = sum(a * np.sin(2 * np.pi * f * tt_) * np.exp(-tt_ / d) for f, a, d in [(1760, 1, 1.2), (1760 * 2.32, 0.4, 0.6), (1760 * 3.9, 0.2, 0.3)])
    y *= 1 + 0.15 * np.sin(2 * np.pi * 5 * tt_); sfx(fades(y, 0.0005, 0.2), t, g, 0.2)
def steam(t, dur=1.0, g=0.3):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 1500, 8000) * np.minimum(1, tt_ / 0.08) * np.clip((dur - tt_) / 0.4, 0, 1)
    sfx(widen(y, R) if False else y, t, g)
def whistle(t, g=0.25):
    tt_ = tt(1.1); env = np.minimum(1, tt_ / 0.08) * np.clip((1.1 - tt_) / 0.3, 0, 1)
    y = sum(np.sin(2 * np.pi * f * tt_ * (1 + 0.003 * np.sin(2 * np.pi * 5 * tt_))) for f in (740, 880, 1110)) / 3
    y = y * env + bp(R.standard_normal(len(tt_)), 600, 3000) * env * 0.2; sfx(y, t, g, -0.3)
def crash(t, g=0.6):
    tt_ = tt(1.0); y = bp(R.standard_normal(len(tt_)), 1500, 9000) * np.exp(-tt_ / 0.25)
    sfx(lp(y, 5000), t, g * 0.6); thud(t, g * 0.6)
    for k in range(10): sfx(clink(R, R.uniform(2500, 5000), 0.2, 1.0), t + 0.03 + k * 0.05 + R.uniform(0, 0.03), g * 0.4, R.uniform(-0.6, 0.6))
def clack(t, g=0.25):
    tt_ = tt(0.08); y = bp(R.standard_normal(len(tt_)), 400, 2500) * np.exp(-tt_ / 0.015); sfx(y, t, g)
def beep(t, f=1320, d=0.08, g=0.18):
    tt_ = tt(d); y = np.sign(np.sin(2 * np.pi * f * tt_)) * 0.4 * np.clip((d - tt_) / 0.01, 0, 1); sfx(lp(y, 5000), t, g, 0.3)
def whir(t, dur=0.4, g=0.15):
    tt_ = tt(dur); f = 300 + 500 * tt_ / dur; y = (np.sign(np.sin(phase(f))) * 0.3 + 0.2 * R.standard_normal(len(tt_))) * np.sin(np.pi * tt_ / dur)
    sfx(lp(y, 3000), t, g)
def chalk(t, g=0.25):
    for k in range(2):
        tt_ = tt(0.18); y = bp(R.standard_normal(len(tt_)), 2500, 7000) * np.sin(np.pi * tt_ / 0.18) * (1 + 0.5 * np.sin(2 * np.pi * 40 * tt_)); sfx(y, t + k * 0.2, g)
def sizzle(t, dur=1.0, g=0.2):
    tt_ = tt(dur); y = hp(R.standard_normal(len(tt_)), 4000) * (R.random(len(tt_)) < 0.3) * np.minimum(1, tt_ / 0.2) * np.clip((dur - tt_) / 0.2, 0, 1); sfx(y, t, g)

T = lambda f: f / 30.0
F = lambda s: round(s * 30) - 2
# hook
for k, f in enumerate([3, F(1.72), F(2.04), F(2.86)]): ting(T(f), NOTES[k], 0.5 if k < 3 else 0.65)
swoosh(T(97), 0.3, 0.15)
ting(T(F(3.94)), 86, 0.5); thunk(T(F(4.56)), 0.7)
clang(T(F(5.92) + 6), 0.4, 260, 0.6); click(T(F(5.92) + 6), 0.4)
# station
steam(T(199), 1.1, 0.35); whistle(7.0, 0.22); bell_stamp(T(F(7.62)), 0.5); swoosh(T(F(8.64)), 0.4, 0.2); steam(T(F(9.7)) - 0.1, 1.4, 0.35); steam(T(305), 1.1, 0.35)
for k in range(10): clack(7.6 + k * 0.32, 0.12)
# ting ting ting, laughs, the kid
for k, f in enumerate([F(11.74), F(11.92), F(12.38)]): ting(T(f), [79, 83, 86][k], 0.5)
laugh(T(F(13.5)), 220, 0.18, -0.3, 5); laugh(T(F(13.5)) + 0.2, 140, 0.18, 0.3, 4)
slide_down(T(F(14.5)), 0.12, 600, 1200, 0.5)
for f in (F(15.74), F(16.1)): sfx(glock(m2f(96), 0.5, R, 0.4), T(f), 0.22, 0.4); ding(T(f) + 0.01, 2349, 0.1)
# THUNK, chalk, the carriage out
swoosh(T(F(16.95)), 0.3, 0.15); thunk(T(F(17.54)), 1.0)
for k in range(5): gasp(T(F(17.54)) + 0.12 + 0.04 * k, 170 + 25 * k, 0.08, -0.6 + 0.3 * k)
chalk(T(F(18.3)), 0.22); swoosh(T(F(18.75)), 0.35, 0.25)
for k in range(6): click(T(F(19.16)) + k * 0.09, 0.12)
slide_down(T(F(19.16)) + 0.3, 0.2, 500, 1100, 0.5); pop(T(F(19.16)) + 0.8, 0.2)
scratch(T(F(20.58)) - 0.05, 0.3); pop(T(F(21.04)), 0.2, 1100); pop(T(F(22.2)), 0.2, 1300)
swoosh(T(F(22.78)), 0.6, 0.3)
# explainer
ting(T(F(24.54)), 79, 0.6, 1.8); ting(T(F(25.22)), 67, 0.55, 2.0); sfx(glock(m2f(67), 0.6, R, 2.0), T(F(25.22)), 0.2)
sfx(wood_crack(R) * 0.5, T(F(26.08)), 0.35); tear(T(F(26.08)), 0.2)
thunk(T(F(28.06)), 0.7)
pop(T(F(29.22)), 0.25, 1000); glass(T(F(30.45)), 0.5)
sfx(wood_crack(R) * 0.3, T(F(31.1)), 0.25); thud(T(F(32.2)), 0.6)
pop(T(F(32.84)), 0.25, 900)
tt_ = tt(2.3); rumble = lp(R.standard_normal(len(tt_)), 300) * np.minimum(1, tt_ / 1.5)
sfx(rumble, T(F(33.0)), 0.5)
for k in range(10): clack(T(F(33.2)) + k * 0.15 * (1 - k * 0.04), 0.2)
crash(T(F(34.66)), 0.75)
swoosh(T(F(35.05)), 0.3, 0.2)
for k in range(3): thud(T(F(35.4)) + 0.15 + k * 0.18, 0.45); 
crash(T(F(35.4)) + 0.3, 0.35)
swoosh(T(F(36.55)), 0.5, 0.3)
# listening, the hot box
for k, f in enumerate([F(37.12), F(37.64), F(38.46)]): ting(T(f), [83, 86, 91][k], 0.5)
pop(T(F(39.06)), 0.15, 500); sizzle(T(F(40.58)), 1.0, 0.25)
boing(T(F(41.44)), 300, 900, 0.4, 0.35); steam(T(F(41.44)) + 0.05, 0.5, 0.25)
# today, the robot
sparkle_s(T(F(43.18)), 0.2)
pop(T(F(43.78)), 0.3, 700); whir(T(F(43.78)) + 0.05, 0.4, 0.18)
for k, f in enumerate([F(44.76), F(46.42), F(46.75), F(47.08), F(47.42), F(47.76), F(48.1)]):
    ting(T(f), NOTES[k % 4], 0.38, 0.8); beep(T(f) + 0.02, 1760, 0.05, 0.08)
for k in range(16): clack(T(F(45.5)) + k * 0.17, 0.2 * (1 - abs(k - 8) / 12))
for k in range(4): beep(T(F(48.36)) + k * 0.16, 1320 + 220 * k, 0.07, 0.14)
sparkle_s(T(F(49.54)), 0.18); swoosh(T(F(50.34)), 0.3, 0.25); pop(T(F(50.34)) + 0.25, 0.3, 1100)
for k, m in enumerate([79, 83, 86, 91]): beep(T(F(50.8)) + k * 0.07, m2f(m), 0.06, 0.12)
sparkle_s(T(F(50.8)) + 0.05, 0.22)

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
duck = dbg(-6.0 * sm)
musb = mus * dbg(-23.0 - integrated(mus)) * duck[None, :]
ir_t = tt(1.4); ir = R.standard_normal((2, len(ir_t))) * np.exp(-ir_t / 0.35)[None, :]; ir[:, :ns(0.012)] = 0
from scipy.signal import fftconvolve
wet = np.stack([fftconvolve(fx[c], lp(ir[c], 5000))[:N] for c in range(2)])
fx = fx + wet * (0.22 * np.abs(fx).max() / max(1e-9, np.abs(wet).max()))
fxb = fx * dbg(-26.5 - integrated(fx))
mix = v + musb + fxb
mix *= dbg(-14.0 - integrated(mix))
# look-ahead peak limiter to -1.2 dBFS (sample peak; true peak checked after)
ceil = dbg(-2.8)
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
