# Soundtrack of "Why People Locked Their Dead in Cages" (74.9 s): an original comedic caper score (oompah tuba, pizzicato,
# glockenspiel, brass stabs, brushes) that follows the story beats, synthesized SFX on every gag, and the mix under
# the ElevenLabs voice (music ducked by the voice, -14 LUFS integrated, true peak <= -1 dBTP).
# usage: python brick_audio.py voice.wav out_dir
import os, sys
import numpy as np
from dsp import SR, ns, tt, rng, lp, hp, bp, fades, st, pan, place, widen, colored, dbg, read_wav, write_wav, integrated, true_peak, modal, phase
from instruments import m2f, brass, glock, vibes, pluck, snare, snare_roll, cymbal, timpani, brush, pad, triangle
from sfx_gen import clink, whoosh, vox, vowel_track, _track, hurrah, wood_crack

DUR = 74.93
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

# the score, bar by bar (2 s bars); sections follow the voice
plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1
SNEAK = ["Dm", "A7", "Dm", "Bb7"]
section(0.0, 7.4, SNEAK, "caper", 0.8)
section(7.4, 17.3, ["Dm", "Gm", "A7", "Dm"], "caper", 0.75)
section(17.3, 23.5, ["Dm7", "Bb", "Gm", "A7"], "night", 0.85)
section(23.5, 41.3, SNEAK, "caper", 0.8)
section(41.3, 45.06, ["Dm", "A7"], "minor", 0.9)
section(47.3, 50.0, ["Gm", "A7"], "night", 0.8)
section(50.0, 54.0, ["F", "C", "G", "C"], "caper", 0.9)
section(54.0, 60.5, ["Dm", "Gm", "A7", "Dm"], "minor", 0.95)
section(60.5, 66.3, ["F", "C", "G", "C"], "pomp", 0.9)
section(66.3, 68.9, ["Am", "E"], "sad", 0.85)
section(68.9, 74.0, ["F", "C", "Dm", "G"], "warm", 0.85)
STOP = 45.06
for t0, ch, sty, vel in plan:
    if t0 >= 74.0: continue
    mus_backup = mus.copy()
    bar_band(t0, ch, sty, vel)
    if t0 < STOP < t0 + 2.0:  # "Wait..." the band stops dead
        cut = ns(STOP); fade = ns(0.03)
        delta = mus - mus_backup
        delta[:, cut:] = 0; delta[:, cut - fade:cut] *= np.linspace(1, 0, fade)[None, :]
        mus[:] = mus_backup + delta
# stingers
put(cymbal(0.6, R, 2.0), 7.4, 0.3)
for m in (38, 50, 57, 62): put(brass(m2f(m), 0.6, 0.9, R, "stab" if m > 45 else "tuba"), 41.36, 0.32)
put(timpani(m2f(38), 1.0, R, 2.0), 41.36, 0.7)
for m in (38, 50, 53, 57): put(brass(m2f(m), 0.5, 0.9, R, "stab" if m > 45 else "tuba"), 57.74, 0.3)
put(timpani(m2f(38), 0.9, R, 1.6), 57.74, 0.6)
for m in (53, 57, 60, 65): put(brass(m2f(m), 0.45, 0.9, R, "stab"), 62.16, 0.28)
# the vampire button: a cheeky minor pizz + glock sting
for k, m in enumerate([62, 65, 69, 74]): put(pluck(m2f(m), 0.7, R, 0.5, 0.7), 74.05 + k * 0.07, 0.4, 0.2)
put(glock(m2f(86), 0.6, R, 1.2), 74.33, 0.3); put(brass(m2f(38), 0.5, 0.8, R, "tuba"), 74.33, 0.4)

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

W = lambda s: s - 0.03
swoosh(0.05, 0.4, 0.15); clang(W(3.84), 0.45, 380)
boing(W(6.22), 150, 520, 0.5, 0.4); slide_down(W(7.0), 0.25)
swoosh(7.42, 0.5, 0.35)
swoosh(9.25, 0.3, 0.35); pop(W(10.12), 0.3); rustle(10.86, 0.25, 0.18)
pop(W(11.96), 0.25, 600); ding(W(14.56), 1568, 0.25); ding(W(15.6), 1760, 0.25); thud(W(16.88), 0.6); boing(16.9, 140, 300, 0.4, 0.25)
swoosh(17.36, 0.3, 0.35); swoosh(W(21.12), 0.4, 0.2); thud(21.45, 0.45)
for k in range(5): gasp(W(22.36) + 0.04 * k, 170 + 25 * k, 0.1, -0.6 + 0.3 * k)
swoosh(23.3, 0.7, 0.18); owl(24.0, 0.16)
for k in range(5): scrape(25.8 + k * 0.21, 0.22)
clink(R) ; sfx(clink(R, 2400, 0.2, 1.0), W(26.94), 0.3); rustle(W(28.18), 0.6, 0.25)
swoosh(W(30.24), 0.3, 0.2); thud(30.6, 0.3); rustle(W(31.14), 0.4, 0.2); bell_stamp(W(32.18), 0.6); pop(W(33.22), 0.3, 1100)
swoosh(34.95, 0.3, 0.35); owl(38.6, 0.15)
clang(W(41.38), 0.8, 300, 1.6); thud(W(41.38), 0.7); click(W(43.76), 0.45); sfx(clink(R, 3000, 0.25, 1.2), W(43.8), 0.3)
scratch(W(45.06), 0.5); pop(45.2, 0.22, 1200); pop(45.33, 0.2, 1400)
for k in range(6): rustle(W(47.32) + k * 0.133, 0.12, 0.14)
sfx(bp(R.standard_normal(ns(0.3)), 2000, 6000) * np.exp(-tt(0.3) / 0.1), W(49.4), 0.15); slide_down(49.6, 0.2, 700, 250)
swoosh(49.97, 0.3, 0.35); for_coins = coins(W(52.74), 4, 0.3); ding(W(52.9), 2093, 0.2)
swoosh(54.05, 0.3, 0.35); swoosh(W(56.48), 0.35, 0.3); clang(57.1, 0.2, 520, 0.8)
thud(W(57.76), 0.7); rustle(W(57.76), 0.5, 0.35)
for k in range(5): gasp(W(60.82) + 0.05 * k, 160 + 30 * k, 0.12, -0.6 + 0.3 * k)
swoosh(61.88, 0.3, 0.35); bell_stamp(W(62.18), 0.6)
for k in range(5): sfx(hurrah(R, 120 + 20 * k, 1.0), W(65.08) + 0.06 * k, 0.1, -0.6 + 0.3 * k)
for k in range(3): clang(W(67.98) + k * 0.4, 0.35, 700 + 40 * k, 0.6)
swoosh(68.9, 0.6, 0.18); click(W(71.3), 0.35)
for k in range(5): pop(W(72.16) + k * 0.13, 0.2, 900 + 120 * k)
boing(W(74.06), 150, 520, 0.5, 0.4)

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
fxb = fx * dbg(-22.0 - integrated(fx))
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
