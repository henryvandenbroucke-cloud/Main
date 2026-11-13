# Soundtrack of "Why the Ace of Spades Is So Fancy": a chill, quiet caper bed under the voice (muted for "Wait..." and
# for the dark November beat), and purpose-built foley: the press thunk + paper peel + whoosh on frame 1, the gavel
# boom, card flicks and deals, a run of 51 flicks, coins, a scratching quill, the badge "ting", a candle snuff, an
# odometer of years, a real riffle-shuffle burr and bridge, and the final stamp. Timed from the voice's words.
# usage: python ace_audio.py voice.wav words.json out_dir
import os, sys
import numpy as np
from dsp import SR, ns, tt, rng, lp, hp, bp, fades, st, pan, place, widen, colored, dbg, read_wav, write_wav, integrated, true_peak, modal, phase
from instruments import m2f, brass, glock, vibes, pluck, snare, snare_roll, cymbal, timpani, brush, pad, triangle
from sfx_gen import clink, whoosh, vox, vowel_track, _track, hurrah, wood_crack

import json, re
WORDS = json.load(open(sys.argv[2]))
DUR = WORDS[-1]['e'] + 0.55
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

_n = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
def A(ws, after=0.0):
    ws = [ws] if isinstance(ws, str) else ws
    for w in WORDS:
        if _n(w["w"]) in [_n(x) for x in ws] and w["s"] >= after - 1e-6: return w["s"]
    raise SystemExit("word " + str(ws))
tHanged = A("hanged"); tPrinting = A("printing"); tAce1 = A("ace", tPrinting); tReason = A("reason"); tDeck1 = A("deck"); tFancy = A("fancy")
tIts = A("it's", tFancy); tEveryone = A("everyone's"); tGov = A("government"); tCut = A("cut"); tEvery = A("every", tCut)
tProve = A("prove"); tTaxed2 = A("taxed", tProve); tEasy = A("easy"); tPrints = A("prints"); tItself = A("itself"); tAce2 = A("ace", tItself)
tMakers = A("makers"); tPrint = A("print", tMakers); t51 = A(["51", "fifty-one"]); tBuy = A("buy"); tCovered = A("covered"); tSwirls = A("swirls"); tMeans = A("means", tSwirls)
tFakes = A("fakes"); tSkips = A("skips"); tMeet = A("meet"); tRichard = A("richard", tMeet); tStarts = A("starts"); tOwn = A("own", tStarts); tCheaper = A("cheaper"); tBigger = A("bigger")
tUntil = A("until"); tBuys = A("buys"); tTurns = A("turns"); tWork = A("work")
tWait = A("wait"); tHang = A("hang"); tYup = A(["yup", "yep"]); tForgery = A("forgery"); tDeath = A("death"); tNovember = A("november"); tHanged2 = A("hanged", tNovember)
tCardTax = A("card", tHanged2); t1960 = A(["1960", "1960,"]); tKept = A("kept"); tShuffle = A("shuffle"); tHolding = A("holding"); tReceipt = A("receipt")
F = lambda t: (round(t * 30) - 2) / 30.0
Fr = lambda fr: fr / 30.0

plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1
section(0.0, F(tIts) - 0.1, ["Dm", "Bb", "Gm", "A7"], "night", 0.5)
section(F(tIts) - 0.1, tWait - 0.05, ["Dm", "Gm", "C", "F", "Bb", "A7"], "caper", 0.5)
section(tYup + 0.1, tNovember - 0.05, ["Dm", "A7"], "minor", 0.45)
section(tCardTax - 0.1, DUR - 0.4, ["F", "C", "Dm", "Bb"], "warm", 0.6)
for t0, ch, sty, vel in plan:
    if t0 < DUR: bar_band(t0, ch, sty, vel)
mute = np.ones(N)
for a, b in [(tWait - 0.05, tYup + 0.1), (tNovember - 0.05, tCardTax - 0.1)]:
    i0, i1, fd = ns(a), ns(b), ns(0.04)
    mute[i0:i1] = 0; mute[i0 - fd:i0] = np.linspace(1, 0, fd); mute[i1:i1 + fd] = np.linspace(0, 1, fd)
mus *= mute[None, :]
for k, m in enumerate([65, 69, 72, 77]): put(pluck(m2f(m), 0.7, R, 0.5, 0.7), DUR - 0.5 + k * 0.07, 0.35, 0.2)

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


def chuff(t, g=0.12):
    tt_ = tt(0.18); y = bp(R.standard_normal(len(tt_)), 300, 2500) * np.exp(-tt_ / 0.05); sfx(lp(y, 3000), t, g, -0.2)
def putt(t, g=0.07):
    tt_ = tt(0.06); y = np.sin(phase(np.full(len(tt_), 70.0))) * np.exp(-tt_ / 0.02) + 0.3 * bp(R.standard_normal(len(tt_)), 200, 1200) * np.exp(-tt_ / 0.01); sfx(y, t, g, 0.2)
def clop(t, g=0.12, f0=900):
    tt_ = tt(0.07); y = np.sin(phase(f0 * np.exp(-tt_ / 0.02) + 300)) * np.exp(-tt_ / 0.012); sfx(y, t, g, 0.3)
def honk(t, g=0.28):
    tt_ = tt(0.32); f = 420 * (1 + 0.04 * np.sin(2 * np.pi * 30 * tt_)); y = np.tanh(3 * np.sin(phase(f))) * np.sin(np.pi * tt_ / 0.32) ** 0.5
    sfx(lp(bp(y, 300, 3000), 2500), t, g, 0.3); sfx(lp(bp(np.tanh(3 * np.sin(phase(f * 1.26))) * np.sin(np.pi * tt_ / 0.32) ** 0.5, 300, 3000), 2500), t + 0.36, g * 0.9, 0.3)
def soft_stamp(t, g=0.4):
    tt_ = tt(0.3); y = np.sin(phase(140 * np.exp(-tt_ / 0.05) + 60)) * np.exp(-tt_ / 0.07) + lp(R.standard_normal(len(tt_)), 900) * np.exp(-tt_ / 0.015) * 0.4
    sfx(fades(y, 0.001, 0.05), t, g)
def soft_pop(t, g=0.18, f=700):
    tt_ = tt(0.15); y = np.sin(phase(f * (1 + 0.6 * np.exp(-tt_ / 0.02)))) * np.exp(-tt_ / 0.04); sfx(fades(y, 0.001, 0.03), t, g, R.uniform(-0.3, 0.3))
def paper(t, dur=0.5, g=0.18):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 1500, 7000) * (0.4 + 0.6 * (R.random(len(tt_)) < 0.08)) * np.sin(np.pi * tt_ / dur); sfx(lp(y, 6000), t, g)
def tick(t, g=0.07):
    tt_ = tt(0.02); sfx(hp(R.standard_normal(len(tt_)), 2500) * np.exp(-tt_ / 0.003), t, g, 0.25)
def spring(t, f0=250, f1=600, g=0.15):
    tt_ = tt(0.5); f = f0 + (f1 - f0) * (1 - np.exp(-tt_ / 0.06)) + 25 * np.sin(2 * np.pi * 12 * tt_) * np.exp(-tt_ / 0.2)
    sfx(fades(np.sin(phase(f)) * np.exp(-tt_ / 0.18), 0.002, 0.05), t, g)
def flutter(t, dur=0.8, g=0.12):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 400, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * 16 * tt_)) * np.sin(np.pi * tt_ / dur); sfx(y, t, g, 0.4)
def whistle_blow(t, g=0.18):
    tt_ = tt(0.45); f = 2600 * (1 + 0.05 * np.sign(np.sin(2 * np.pi * 22 * tt_))); y = np.sin(phase(f)) * np.sin(np.pi * tt_ / 0.45) ** 0.4 + 0.2 * bp(R.standard_normal(len(tt_)), 2000, 5000)
    sfx(lp(y, 5000), t, g, -0.3)
def cheer(t, g=0.12):
    for k in range(6): sfx(hurrah(R, 130 + 25 * k, 1.0), t + 0.05 * k, g, -0.6 + 0.24 * k)
def whinny(t, g=0.12):
    d = 0.9; tt_ = tt(d); f = 900 + 500 * np.sin(np.pi * tt_ / d) + 120 * np.sin(2 * np.pi * 14 * tt_) * (tt_ / d)
    y = np.tanh(2 * np.sin(phase(f))) * np.sin(np.pi * tt_ / d) ** 0.6; sfx(lp(bp(y, 500, 4000), 3500), t, g, 0.3)


def tiptoe(t, g=0.07, f=1400):
    sfx(pluck(f, 0.5, R, 0.12, 0.9), t, g, R.uniform(-0.3, 0.3))
def zip_(t, g=0.08, f0=900, f1=2400, dur=0.18):
    tt_ = tt(dur); y = np.sin(phase(f0 * (f1 / f0) ** (tt_ / dur))) * np.sin(np.pi * tt_ / dur) * 0.6 + hp(R.standard_normal(len(tt_)), 3000) * 0.15 * np.sin(np.pi * tt_ / dur); sfx(y, t, g, 0.2)
def knock(t, g=0.35):
    tt_ = tt(0.25); y = np.sin(phase(np.full(len(tt_), 180.0))) * np.exp(-tt_ / 0.04) + bp(R.standard_normal(len(tt_)), 300, 2500) * np.exp(-tt_ / 0.015) * 0.6; sfx(fades(lp(y, 3000), 0.0005, 0.05), t, g)
def bars(t, g=0.3):
    for k in range(3): clang(t + k * 0.05, g * (1 - 0.25 * k), 220 + 40 * k, 0.9)
def projector(t0, t1, g=0.035):
    t = t0
    while t < t1: tick(t, g); t += 1 / 18.0
def crumple(t, dur=0.45, g=0.16):
    tt_ = tt(dur); y = hp(R.standard_normal(len(tt_)), 1500) * (R.random(len(tt_)) < 0.05) * 3 * np.sin(np.pi * tt_ / dur); sfx(lp(y, 7000), t, g)
def gasps(t, g=0.07):
    for k in range(5): gasp(t + 0.04 * k, 170 + 25 * k, g, -0.6 + 0.3 * k)


# ---------------------------------------------------------------- purpose-built foley
def grains(t, dur, rate, g, lo=2500, hi=9000, decay=0.004, p=0.0):
    """many tiny crisp transients (dry leaves, sand, pouring grains)"""
    n = ns(dur); y = np.zeros(n); k = int(rate * dur)
    for _ in range(k):
        i = int(R.uniform(0, n - 400)); L = 300; e = np.exp(-np.arange(L) / (SR * decay)); y[i:i + L] += R.standard_normal(L) * e * R.uniform(0.3, 1.0)
    sfx(bp(y, lo, hi) * np.sin(np.pi * np.arange(n) / n) ** 0.3, t, g, p)
def leaf_burst(t, g=0.18): grains(t, 0.45, 160, g, 2200, 9000, 0.003)
def leaf_pour(t, dur, g=0.12): grains(t, dur, 220, g, 1800, 8000, 0.004)
def wood_clack(t, g=0.4, f0=520):
    y = modal(0.25, [(f0, 1.0, 0.05), (f0 * 2.6, 0.5, 0.03), (f0 * 4.1, 0.25, 0.02)], R); tt_ = tt(0.25); y += bp(R.standard_normal(len(tt_)), 800, 5000) * np.exp(-tt_ / 0.006) * 0.8
    sfx(fades(y, 0.0003, 0.05), t, g)
def lid_slam(t, g=0.45):
    wood_clack(t, g, 420); wood_clack(t + 0.07, g * 0.35, 470); wood_clack(t + 0.12, g * 0.15, 500)
def lock_click(t, g=0.35):
    for k, f0 in enumerate([3200, 2400]):
        y = modal(0.12, [(f0, 1.0, 0.02), (f0 * 1.7, 0.5, 0.012)], R); tt_ = tt(0.12); y += hp(R.standard_normal(len(tt_)), 4000) * np.exp(-tt_ / 0.002)
        sfx(fades(y, 0.0002, 0.03), t + k * 0.09, g * (1 - 0.3 * k), 0.2)
def key_scrape(t, g=0.12):
    tt_ = tt(0.3); y = bp(R.standard_normal(len(tt_)), 2500, 7000) * (0.5 + 0.5 * np.sin(2 * np.pi * 30 * tt_)) * np.sin(np.pi * tt_ / 0.3); sfx(y, t, g, 0.2)
def chime(t, g=0.08, m=96):
    sfx(glock(m2f(m), 0.5, R, 1.4), t, g, 0.3); sfx(glock(m2f(m + 7), 0.35, R, 1.2), t + 0.05, g * 0.6, -0.3)
def porcelain(t, g=0.14, f0=None):
    f0 = f0 or R.uniform(2800, 3600); y = modal(0.6, [(f0, 1.0, 0.25), (f0 * 2.3, 0.4, 0.12), (f0 * 3.9, 0.2, 0.06)], R); sfx(fades(y, 0.0002, 0.1), t, g, R.uniform(-0.4, 0.4))
def liquid(t, dur, g=0.1):
    tt_ = tt(dur); y = lp(R.standard_normal(len(tt_)), 1800) * 0.5
    for _ in range(int(dur * 25)):
        t0 = R.uniform(0, dur - 0.06); i0 = ns(t0); L = ns(0.05); f = R.uniform(500, 1100); bb = np.sin(phase(f * (1 + 2.0 * np.arange(L) / L))) * np.exp(-np.arange(L) / (SR * 0.015)); y[i0:i0 + L] += bb * 0.6
    sfx(fades(y * np.sin(np.pi * tt_ / dur) ** 0.3, 0.02, 0.1), t, g)
def splash(t, g=0.2):
    tt_ = tt(0.5); y = bp(R.standard_normal(len(tt_)), 400, 5000) * np.exp(-tt_ / 0.12); sfx(y, t, g); liquid(t + 0.05, 0.35, g * 0.6)
def surf(t, dur, g=0.06):
    tt_ = tt(dur); env = 0.55 + 0.45 * np.sin(2 * np.pi * tt_ / 3.2 - 1.5); y = lp(R.standard_normal(len(tt_)), 900) * env + bp(R.standard_normal(len(tt_)), 1500, 5000) * env ** 3 * 0.3
    sfx(fades(y, 0.5, 0.5), t, g)
def coin_in_sack(t, g=0.12):
    for k in range(4): sfx(clink(R, R.uniform(3000, 4500), 0.18, 1.0), t + k * 0.035, g * (1 - 0.15 * k), 0.3)
    tt_ = tt(0.12); sfx(lp(R.standard_normal(len(tt_)), 600) * np.exp(-tt_ / 0.03), t + 0.02, g * 0.6)
def shink(t, g=0.3):
    y = modal(0.7, [(2900, 1.0, 0.3), (4300, 0.6, 0.2), (6100, 0.3, 0.1)], R); tt_ = tt(0.7); y = y * (1 - np.exp(-tt_ / 0.01)) + hp(R.standard_normal(len(tt_)), 5000) * np.exp(-tt_ / 0.05) * 0.4
    sfx(fades(y, 0.002, 0.15), t, g, 0.1)
def creak(t, g=0.1, dur=0.6):
    tt_ = tt(dur); f = 300 + 120 * np.sin(2 * np.pi * 1.5 * tt_); y = np.sign(np.sin(phase(f))) * (R.random(len(tt_)) < 0.25); sfx(lp(bp(y.astype(float), 300, 2500), 2500) * np.sin(np.pi * tt_ / dur), t, g, -0.4)
def coin_spin(t, g=0.2):
    """a penny dropped onto wood: bounces, spins faster, settles with a ring"""
    ts = [0.0, 0.16, 0.28, 0.37]
    for k, d in enumerate(ts): sfx(clink(R, 3600 - k * 150, 0.15, 1.0), t + d, g * (1 - 0.15 * k), 0.1)
    d = 0.42
    while d < 1.25: sfx(clink(R, 3300, 0.06, 0.6), t + d, g * 0.25 * (1.3 - d), 0.1); d += 0.09 * (1.3 - d)
    porcelain(t + 1.25, g * 0.5, 3300)


def flick(t, g=0.1, p=0.0):
    tt_ = tt(0.05); y = bp(R.standard_normal(len(tt_)), 2000, 9000) * np.exp(-tt_ / 0.008); y += np.sin(phase(np.full(len(tt_), R.uniform(900, 1300)))) * np.exp(-tt_ / 0.006) * 0.3
    sfx(fades(y, 0.0003, 0.01), t, g, p)
def card_slide(t, dur=0.25, g=0.1):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 1500, 7000) * np.sin(np.pi * tt_ / dur) ** 1.5; sfx(y, t, g, 0.2)
def press_thunk(t, g=0.45):
    tt_ = tt(0.5); y = np.sin(phase(95 * np.exp(-tt_ / 0.1) + 45)) * np.exp(-tt_ / 0.12) + bp(R.standard_normal(len(tt_)), 200, 2000) * np.exp(-tt_ / 0.02) * 0.6
    sfx(fades(y, 0.0005, 0.08), t, g); wood_clack(t + 0.01, g * 0.5, 300)
def peel(t, g=0.16):
    tt_ = tt(0.35); y = bp(R.standard_normal(len(tt_)), 2500, 9000) * (R.random(len(tt_)) < 0.12) * np.sin(np.pi * tt_ / 0.35) * 2.5; sfx(lp(y, 9000), t, g, 0.1)
def gavel(t, g=0.6):
    knock = modal(0.4, [(180, 1.0, 0.08), (420, 0.5, 0.05), (900, 0.3, 0.02)], R); tt_ = tt(0.4); knock += bp(R.standard_normal(len(tt_)), 300, 3000) * np.exp(-tt_ / 0.01)
    sfx(fades(knock, 0.0003, 0.08), t, g)
    tt2 = tt(1.6); boom = np.sin(phase(55 * np.exp(-tt2 / 0.6) + 30)) * np.exp(-tt2 / 0.5) + lp(R.standard_normal(len(tt2)), 400) * np.exp(-tt2 / 0.4) * 0.4; sfx(fades(boom, 0.001, 0.3), t, g * 0.55)
def quill(t, dur, g=0.08):
    tt_ = tt(dur); y = bp(R.standard_normal(len(tt_)), 3000, 8000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 4.5 * tt_))) * (R.random(len(tt_)) < 0.5); sfx(y, t, g, 0.2)
def snuff(t, g=0.12):
    tt_ = tt(0.3); y = lp(R.standard_normal(len(tt_)), 1200) * np.exp(-tt_ / 0.08); sfx(y, t, g)
def heartbeat(t, g=0.18):
    for d in (0.0, 0.22): tt_ = tt(0.25); y = np.sin(phase(60 * np.exp(-tt_ / 0.07) + 35)) * np.exp(-tt_ / 0.08); sfx(fades(y, 0.002, 0.05), t + d, g * (1 - 0.3 * (d > 0)))
def riffle_burr(t, dur=0.9, g=0.14):
    n = 18
    for k in range(n): flick(t + dur * 0.62 * (k / n) + R.uniform(0, 0.01), g * 0.8, -0.4 + 0.8 * (k % 2))
    for k in range(12): flick(t + dur * 0.72 + k * 0.018, g * 0.6, 0.0)

# 1 frame 1: press thunk + paper peel + the zoom-out whoosh
press_thunk(0.0, 0.45); peel(0.02, 0.16); swoosh(0.08, 0.6, 0.18)
gavel(F(tHanged), 0.6); gasp(F(tHanged) + 0.15, 200, 0.06, 0.0)
chime(F(tAce1), 0.06, 98)
# 4 the fan + the ace sliding up
for k in range(9): flick(F(tDeck1) - 0.15 + k * 0.035, 0.07, -0.4 + 0.1 * k)
card_slide(F(tFancy) - 0.15, 0.25, 0.1); chime(F(tFancy), 0.06, 101)
# 5 the tavern: deals, the taxman's steps, three stamps
for r in range(3):
    for i in range(4): flick(F(tEveryone) - 0.12 + r * 16 / 30 + i * 4 / 30, 0.08, -0.5 + 0.33 * i)
for k in range(6): wood_clack(F(tGov) - 0.3 + k * 0.28, 0.07, 260)
for i in range(3): soft_stamp(F(tEvery) + i * 8 / 30, 0.3)
for k in range(5): porcelain(F(tIts) + 0.3 + k * 0.5, 0.05)
# 6 the puzzled flips
for k in range(4): flick(F(tProve) + k * 0.28, 0.06)
# 7 the Stamp Office press, the ace rising
press_thunk(F(tPrints), 0.4); card_slide(F(tPrints) + 0.25, 0.4, 0.1); chime(F(tAce2), 0.07, 98)
# 8 fifty-one flicks, accelerating
T0, T1 = F(tPrint) - 4 / 30, F(t51) + 6 / 30
for k in range(51): flick(T0 + (T1 - T0) * (k / 51) ** 0.85, 0.06, -0.3 + 0.6 * (k % 2))
# 9 coins over the counter, the ace whooshes up
for k in range(4): sfx(clink(R, 3200 + 200 * k, 0.15, 1.0), F(tBuy) - 0.1 + k * 4 / 30, 0.08)
swoosh(F(tCovered) - 0.1, 0.4, 0.15); chime(F(tSwirls), 0.06, 103)
# 10 the quill scratches the forgery
quill(F(tFakes) - 0.1, 1.0, 0.09); chime(F(tSkips) + 0.1, 0.05, 91)
# 11 the press runs, coins stack up
for k in range(6): press_thunk(F(tOwn) - 0.2 + k * 0.2, 0.18); flick(F(tOwn) + k * 0.2, 0.06)
for k in range(14): sfx(clink(R, 2800 + 90 * k, 0.15, 1.0), F(tCheaper) - 0.12 + k * 2 / 30, 0.07, 0.3)
# 12 the magnifier "hmm", the badge, the jaw drop
soft_pop(F(tBuys) + 0.2, 0.12, 500); chime(F(tTurns) + 0.1, 0.09, 96); gasp(F(tWork) + 0.05, 220, 0.08, -0.2)
# 13 wait: heartbeat
heartbeat(F(tWait), 0.2); heartbeat(F(tHang), 0.16)
# 14 court: murmur, the black cap, the gavel
for k in range(4): laugh(F(tYup) + 0.1 + k * 0.09, 130 + 25 * k, 0.025, -0.5 + 0.33 * k, 3)
gavel(F(tDeath) + 2 / 30, 0.45)
# 15 the falling card, the candle snuffed
for k in range(5): flutter(F(tNovember) + k * 0.3, 0.5, 0.04)
snuff(F(tHanged2) + 0.05, 0.14)
# 16 the years roll, the box, the riffle, the seal
for k in range(28): tick(F(tCardTax) + k * (F(t1960) - F(tCardTax) + 0.2) / 28 * (1 - k / 60), 0.06)
chime(F(t1960) + 0.15, 0.06, 98)
card_slide(F(tKept) - 0.15, 0.35, 0.1); chime(F(tKept) + 0.2, 0.05, 101)
riffle_burr(F(tShuffle) - 0.1, 0.9, 0.14)
soft_stamp(F(tReceipt) - 2 / 30, 0.32); sparkle_s(F(tReceipt) + 0.05, 0.08)

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
duck = dbg(-8.0 * sm)
musb = mus * dbg(-27.0 - integrated(mus)) * duck[None, :]
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
os.makedirs(sys.argv[3], exist_ok=True)
write_wav(os.path.join(sys.argv[3], "mix.wav"), mix)
write_wav(os.path.join(sys.argv[3], "music.wav"), musb)
write_wav(os.path.join(sys.argv[3], "sfx.wav"), fxb)
print(f"mix {integrated(mix):.1f} LUFS, TP {true_peak(mix):.1f} dBTP, music {integrated(musb):.1f}, sfx {integrated(fxb):.1f}, voice {integrated(v):.1f}")
