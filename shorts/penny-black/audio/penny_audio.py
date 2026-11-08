# Soundtrack of "Why Stamps Exist": the brick-tax caper band (oompah tuba, pizzicato, glockenspiel, brushes, brass
# stabs) kept chill and well under the voice, following the story beats; soft purpose-built foley on every gag: the
# frame-1 paper flick + zoom whoosh, knocks, coin flicks and spins, seal cracks and paper unfolds, calendar flips,
# rubber-stamp thumps, a galloping mail coach with its horn, a moth, the "idea" ding, a lick and a stamp slap,
# cheering, raining letters. Timed from the voice's words.
# usage: python penny_audio.py voice.wav words.json out_dir
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
tRefused = A("refused"); tExactly = A("exactly"); tRead = A("read", tExactly); tBack = A("back"); tSend = A("send"); tReceive = A("receive")
tSometimes = A("sometimes"); tShilling = A("shilling", tSometimes); tWhole = A("whole"); tWages = A("wages"); tSo = A("so", tWages)
tColeridge = A("coleridge"); tCottage = A("cottage"); tPostman = A("postman", tCottage); tHands = A("hands", tPostman)
tShe = A("she", tHands); tTurns = A("turns"); tHands2 = A("hands", tTurns); tBack2 = A("back", tHands2); tColeridge2 = A("coleridge", tBack2)
tPays = A("pays"); tBut = A("but", tPays); tLeaves = A("leaves"); tOpens = A("opens"); tBlank = A("blank"); tHer = A("her", tBlank)
tBrother = A("brother", tHer); tEmpty = A("empty"); tEvery = A("every", tEmpty); tIf = A("if", tEvery); tArrives = A("arrives"); tMessage = A("message"); tFree = A("free")
tAnd2 = A("and", tFree); tPeople = A("people", tAnd2); tMarks = A("marks"); tRead2 = A("read", tMarks); tDoor = A("door", tRead2); tSaid = A("said"); tNo = A("no", tSaid)
tSo2 = A("so", tNo); tDragging = A("dragging"); tGetting = A("getting"); tNothing = A("nothing"); tUntil = A("until", tNothing); tHill = A("hill"); tIdea = A("idea")
tWhat = A("what", tIdea); tSender = A("sender"); tInstead = A("instead"); tOne = A("one", tInstead); tPenny = A("penny", tOne); tAnywhere = A("anywhere")
tProve = A("prove"); tStick = A("stick"); tQueen = A("queen"); tCorner = A("corner"); tIn = A("in", tCorner); t1840 = A("1840"); tPennyB = A("penny", t1840); tBorn = A("born"); tFirst = A("first", tBorn)
tAnd3 = A("and", tFirst); tYear = A("year"); tNumber = A("number"); tDoubled = A("doubled"); tSo3 = A("so", tDoubled); tLicked = A("licked"); tBasically = A("basically"); tKept = A("kept"); tNo2 = A("no", tKept)
F = lambda t: (round(t * 30) - 2) / 30.0
Fr = lambda fr: fr / 30.0

plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1

# the score (bars of 2 s; the brick-tax band, quieter and lighter)
section(0.0, F(tBack) - 0.05, ["C", "Am", "F", "G"], "caper", 0.75)
section(F(tBack) - 0.05, F(tSo) - 0.1, ["F", "C", "G", "C"], "caper", 0.7)
section(F(tSo) - 0.1, F(tBut) - 0.05, ["C", "F", "Am", "G"], "warm", 0.7)
section(F(tBut) - 0.05, tBlank - 0.02, ["Am", "F"], "night", 0.6)
section(F(tHer) - 0.05, F(tAnd2) - 0.1, ["F", "C", "Dm", "G"], "warm", 0.7)
section(F(tAnd2) - 0.1, F(tSo2) - 0.1, ["C", "Am", "F", "G7"], "caper", 0.8)
section(F(tSo2) - 0.1, tNothing - 0.05, ["C", "G", "F", "G"], "pomp", 0.65)
section(F(tUntil) - 0.1, tIdea - 0.02, ["Am", "F"], "night", 0.55)
section(tIdea - 0.02, F(tIn) - 0.1, ["C", "Am", "F", "G"], "caper", 0.8)
section(F(tIn) - 0.1, F(tSo3) - 0.1, ["C", "F", "G", "C"], "pomp", 0.75)
section(F(tSo3) - 0.1, DUR - 0.45, ["F", "C", "G", "C"], "warm", 0.7)
for t0, ch, sty, vel in plan:
    if t0 < DUR: bar_band(t0, ch, sty, vel)
# stingers: the blank reveal, 1840, doubled, the final button
for m in (57, 60, 64, 69): put(brass(m2f(m), 0.45, 0.8, R, "stab"), tBlank - 0.02, 0.26)
put(cymbal(0.5, R, 1.6, 0.8), tBlank - 0.02, 0.2)
for m in (48, 60, 64, 67): put(brass(m2f(m), 0.5, 0.85, R, "stab" if m > 50 else "tuba"), t1840 - 0.02, 0.28)
put(timpani(m2f(48), 0.8, R, 1.4), t1840 - 0.02, 0.4)
for (t, vv) in snare_roll(tNumber, tDoubled - 0.05, 0.2, 0.7, R): put(snare(vv, R, 0.2, buzz=True), t, 0.22, 0.1)
put(cymbal(0.6, R, 1.4), tDoubled - 0.02, 0.22)
for k, m in enumerate([60, 64, 67, 72]): put(pluck(m2f(m), 0.7, R, 0.5, 0.7), DUR - 0.5 + k * 0.07, 0.35, 0.2)
put(glock(m2f(84), 0.6, R, 1.5), DUR - 0.25, 0.25)

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



# ---------------------------------------------------------------- placements
# 1 frame 1: a paper flick + the zoom-out whoosh, the push-back
paper(0.0, 0.25, 0.16); swoosh(0.05, 0.55, 0.2); soft_pop(0.08, 0.1, 900)
spring(F(tRefused), 220, 520, 0.14); soft_pop(F(tExactly) + 0.05, 0.12, 1100); sparkle_s(F(tRead), 0.12)
# 2 London: FREE / PAY labels, a coin into the palm
swoosh(F(tBack) - 0.15, 0.4, 0.15); paper(F(tSend), 0.3, 0.12); soft_pop(F(tSend) + 0.05, 0.14, 1000); ding(F(tSend) + 0.1, 1568, 0.12)
for k in range(5): tiptoe(F(tSend) + 0.35 + k * 0.2, 0.05, 1200 + 80 * (k % 2))
soft_pop(F(tReceive) + 0.05, 0.16, 800); coins(F(tReceive) + 0.1, 2, 0.15)
# 3 the shilling spins up; a day's wages trickles away
coin_spin(F(tShilling) - 0.1, 0.18); ding(F(tShilling) + 0.15, 2093, 0.1)
for k in range(8): sfx(clink(R, R.uniform(2600, 3800), 0.15, 1.0), F(tWhole) - 0.07 + k * 22 / 30 / 8 + 0.3, 0.12, 0.3)
slide_down(F(tWages) + 0.1, 0.08, 700, 350, 0.6)
# 4 the lake: birdsong, Coleridge's whistle, the knock at the door
swoosh(F(tSo) - 0.1, 0.5, 0.14)
from sfx_gen import bird_chirps, breeze
sfx(bird_chirps(F(tShe) - F(tSo) + 0.5, R, 0.5) * 0.35, F(tSo), 0.6, 0.3)
soft_pop(F(tColeridge) + 0.05, 0.12, 900)
for k in range(3): knock(F(tPostman) + k * 0.16, 0.25)
paper(F(tHands) + 0.05, 0.3, 0.12)
# 5 she looks, turns it over, hands it back; the shilling flick
paper(F(tTurns), 0.35, 0.14); spring(F(tBack2), 200, 560, 0.14); paper(F(tHands2) + 0.1, 0.25, 0.1)
gasp(F(tColeridge2) + 0.4, 160, 0.05, -0.3)
flick(F(tPays) - 0.05, 0.12, -0.3); coin_spin(F(tPays) + 0.05, 0.1); sfx(clink(R, 3400, 0.2, 1.2), F(tPays) + 0.4, 0.16, 0.2); sparkle_s(F(tPays) + 0.45, 0.1)
# 6 the postman leaves, the seal cracks, the sheet unfolds... BLANK
for k in range(6): tiptoe(F(tLeaves) - 0.1 + k * 0.17, 0.05, 1100 + 100 * (k % 2))
whistle(F(tLeaves) + 0.1, 0.06)
sfx(wood_crack(R) * 0.3, F(tOpens) - 0.05, 0.12); paper(F(tOpens) + 0.1, 0.55, 0.16)
swoosh(tBlank - 0.1, 0.35, 0.15); soft_pop(tBlank + 0.02, 0.15, 600)
# 7 the brother folds, seals; the calendar flips
soft_pop(F(tBrother) + 0.05, 0.1, 900); paper(F(tEmpty) - 0.05, 0.35, 0.14); soft_stamp(F(tEmpty) + 0.27, 0.25)
for k in range(4): paper(F(tEvery) + k * 7 / 30, 0.12, 0.1); tick(F(tEvery) + k * 7 / 30 + 0.05, 0.07)
# 8 the thought bubble, RECEIVED, free
soft_pop(F(tArrives), 0.14, 700); soft_pop(F(tArrives) + 0.08, 0.1, 900)
soft_stamp(F(tMessage) + 0.03, 0.35); ding(F(tFree), 1319, 0.1); laugh(F(tFree) + 0.2, 230, 0.06, 0.0, 3)
# 9 door to door: letters pop up, marks scribble, doors shut, NO THANKS
for t0 in (F(tPeople) - 4 / 30, F(tRead2) - 6 / 30, F(tSaid) - 8 / 30):
    soft_pop(t0 + 0.15, 0.13, 900); chalk(t0 + 0.3, 0.06)
for t1 in (F(tMarks) + 8 / 30, F(tDoor) + 8 / 30): wood_clack(t1 - 0.25, 0.18, 300)
soft_pop(F(tNo), 0.18, 650); spring(F(tNo) + 0.15, 400, 180, 0.08)
# 10 the mail coach: galloping hooves, rumbling wheels, the horn, fluttering letters
swoosh(F(tSo2) - 0.1, 0.5, 0.14)
t = F(tSo2)
while t < F(tGetting) - 0.1:
    for d in (0.0, 0.07, 0.15, 0.21): clop(t + d, 0.1, 800 + 100 * (d > 0.1))
    t += 0.42
rum = tt(F(tGetting) - F(tSo2)); sfx(lp(R.standard_normal(len(rum)), 180) * 0.5 * np.minimum(1, rum / 0.3), F(tSo2), 0.25)
honk(F(tDragging) + 0.0, 0.14); flutter(F(tDragging) + 0.4, 1.2, 0.07)
# 11 the empty cash box + moth
creak(F(tGetting) + 0.05, 0.1, 0.4); flutter(F(tGetting) + 0.25, 0.7, 0.08); wahwah(tNothing + 0.1, 0.12)
# 12 Hill ponders... DING
soft_pop(F(tHill) + 0.05, 0.1, 900)
for k in range(3): soft_pop(F(tUntil) + 0.3 + k * 0.35, 0.05, 1200 + 150 * k)
ding(tIdea - 0.02, 2093, 0.22); sparkle_s(tIdea + 0.05, 0.16); spring(tIdea + 0.03, 300, 700, 0.1)
# 13 the coin slides on; ONE PENNY spins; letters zip off; the lick; the slap
card_slide(F(tSender) - 0.05, 0.25, 0.1); soft_pop(F(tInstead), 0.1, 900)
coin_spin(F(tPenny) - 0.1, 0.16); ding(F(tPenny) + 0.1, 1760, 0.1)
for k in range(6): zip_(F(tAnywhere) + k * 4 / 30, 0.06, 900 + 100 * k, 2400)
gasp(F(tStick) + 0.05, 260, 0.05)
soft_stamp(F(tCorner) + 0.03, 0.4); sparkle_s(F(tCorner) + 0.1, 0.12)
# 14 1840: the crowd cheers, confetti
cheer(F(tBorn) + 0.05, 0.07); sparkle_s(F(tPennyB), 0.14); soft_pop(F(tFirst), 0.14, 700)
# 15 letters rain down; the counter ticks; x2
t = F(tAnd3) + 0.1
while t < F(tSo3) - 0.2: paper(t, 0.15, 0.05); t += 0.1 + R.uniform(0, 0.05)
for k in range(14): tick(F(tNumber) + k * (tDoubled - tNumber) / 14, 0.06)
soft_stamp(tDoubled + 0.03, 0.4); ding(tDoubled + 0.12, 2093, 0.12)
# 16 today: the stamp pressed on
swoosh(F(tSo3) - 0.1, 0.5, 0.14); soft_stamp(F(tLicked) + 0.05, 0.3)
# 17 NO THANKS one last time
swoosh(F(tBasically) - 0.1, 0.4, 0.12); soft_pop(F(tNo2), 0.18, 650); paper(F(tNo2) + 0.15, 0.4, 0.1); slide_down(F(tNo2) + 0.3, 0.07, 600, 260, 0.5)


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
duck = dbg(-7.0 * sm)
musb = mus * dbg(-26.0 - integrated(mus)) * duck[None, :]
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
