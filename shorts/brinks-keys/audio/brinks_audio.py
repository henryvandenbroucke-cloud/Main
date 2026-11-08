# Soundtrack of "The Robbers Who Never Broke a Lock" (the Brink's job): the brick-tax caper band in a night-jazz
# minor mood under the voice, and REAL recorded sound effects only (CC0: Kenney RPG / Impact / Interface packs and
# OpenGameArt CC0 packs: locks, keys, footsteps, cloth, coins, page flips, a typewriter, a camera shutter, a
# heartbeat, a muffled shot, recorded swishes), placed only on satisfying beats, soft and in the background.
# usage: python brinks_audio.py voice.wav words.json out_dir
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

tEleven = A("11"); tSingle = A("single"); tLock = A("lock", tSingle); tMonths = A("months"); tSneak = A("sneak"); tUnscrew = A("unscrew"); tLocksmith = A("locksmith")
tCut = A("cut"); tKey = A("key", tCut); tMorning = A("morning"); tBack = A("back", tMorning); tNoticed = A("noticed"); tDoor = A("door", tNoticed); tKey2 = A("key", tDoor); tAfter2 = A("after", tKey2)
tThen = A("then", tAfter2); tJanuary = A("january"); tSeven = A("seven"); tMasks = A("masks"); tWalked = A("walked"); tClick = A("click", tWalked)
t20 = A("20"); tWalked2 = A("walked", t20); tMillion = A("million"); tNo1 = A("no", tMillion); tShots = A("shots"); tBroken = A("broken"); tPolice = A("police"); tNothing = A("nothing")
tRule = A("rule"); tNobody2 = A("nobody", tRule); tSix = A("six"); tLaw = A("law"); tCharged = A("charged"); tYear1 = A("year", tCharged); tThree = A("three", tYear1); tFive = A("five", tThree); tFree = A("free")
tSpecs = A("specs"); tArrested = A("arrested"); tVanished = A("vanished"); tFurious = A("furious"); tHit = A("hit"); tShot = A("shot"); tSurvived = A("survived")
tFBI = A("fbi"); tTalked = A("talked"); tArrested2 = A("arrested", tTalked); tFive2 = A("five", tArrested2); tClock = A("clock"); tKey3 = A("key", tClock); tEvery = A("every", tKey3); tMouth = A("mouth"); tShut = A("shut")
F = lambda t: (round(t * 30) - 2) / 30.0
Fr = lambda fr: fr / 30.0

plan = []
def section(t0, t1, chords, style, vel=1.0):
    t, i = t0, 0
    while t < t1 - 0.25:
        plan.append((t, chords[i % len(chords)], style, vel)); t += 2.0; i += 1


# the score: the brick-tax band in a night-jazz minor mood, light and well under the voice
section(0.0, F(tThen) - 0.05, ["Dm", "Bb", "Gm", "A7"], "caper", 0.6)
section(F(tThen) - 0.05, F(tRule) - 0.1, ["Dm", "Gm", "C", "A7"], "caper", 0.7)
section(F(tRule) - 0.1, F(tSpecs) - 0.1, ["Dm", "Bb", "Gm", "A7"], "night", 0.6)
section(F(tSpecs) - 0.1, F(tFBI) - 0.1, ["Dm", "A7"], "minor", 0.55)
section(F(tFBI) - 0.1, DUR - 0.45, ["F", "C", "Dm", "Bb"], "caper", 0.65)
for t0, ch, sty, vel in plan:
    if t0 < DUR: bar_band(t0, ch, sty, vel)
mute = np.ones(N)
for a, b in [(tShot - 0.05, tSurvived + 0.3)]:
    i0, i1, fd = ns(a), ns(b), ns(0.04)
    mute[i0:i1] = 0; mute[i0 - fd:i0] = np.linspace(1, 0, fd); mute[i1:i1 + fd] = np.linspace(0, 1, fd)
mus *= mute[None, :]
for k, m in enumerate([62, 65, 69, 74]): put(pluck(m2f(m), 0.7, R, 0.5, 0.7), DUR - 0.5 + k * 0.07, 0.35, 0.2)

# ---------------------------------------------------------------- real recorded SFX (CC0: Kenney, OpenGameArt)
fx = np.zeros((2, N))
LIB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sfxlib")
_cache = {}
def load(rel):
    if rel not in _cache:
        import subprocess
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(LIB, rel), "-ac", "2", "-ar", str(SR), "-f", "f32le", "-"], capture_output=True).stdout
        x = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(float)
        nz = np.where(np.abs(x).max(0) > 1e-3)[0]
        if len(nz): x = x[:, max(0, nz[0] - ns(0.002)):nz[-1] + ns(0.02)]
        x = x / max(1e-9, np.abs(x).max())
        _cache[rel] = x
    return _cache[rel]
def S(rel, t, g=0.5, p=0.0, rate=1.0, cut=None):
    x = load(rel)
    if rate != 1.0:
        idx = np.arange(0, x.shape[1] - 1, rate); x = np.stack([np.interp(idx, np.arange(x.shape[1]), c) for c in x])
    if cut: x = x[:, :ns(cut)]; x = x * np.concatenate([np.ones(max(1, x.shape[1] - ns(0.03))), np.linspace(1, 0, min(x.shape[1], ns(0.03)))])[None, :x.shape[1]]
    if p: x = np.stack([x[0] * (1 - max(0, p)), x[1] * (1 + min(0, p))])
    place(fx, x, max(0.0, t), g)
A_ = "rpg-audio/Audio/"; I_ = "impact-sounds/Audio/"; U_ = "interface-sounds/Audio/"; O_ = "oga/"
SW = ["swishes/swishes/swish-%d.wav" % i for i in (1, 2, 3, 4, 6, 7, 9, 11, 13)]
_sw = [0]
def swish(t, g=0.18, rate=1.0):
    S(SW[_sw[0] % len(SW)], t - 0.12, g, 0.0, rate); _sw[0] += 1
def steps(t0, n, gap=0.32, g=0.12, kind="concrete"):
    for k in range(n): S(I_ + "footstep_%s_%03d.ogg" % (kind, k % 5), t0 + k * gap, g, -0.3 + 0.6 * (k % 2))
def lockclick(t, g=0.3, i=1): S("rpg80/lock_0%d.ogg" % (1 + (i % 3)), t, g, 0.1)
def keys(t, g=0.18, i=1): S(O_ + "58-random-sound-effects/Keys_0%d.wav" % (1 + (i % 4)), t, g, 0.15)
def ding(t, g=0.16, i=0):
    files = sorted([l.strip() for l in open(os.path.join(LIB, "index.txt")) if "bell-dingschimes" in l])
    S(files[i % len(files)], t, g, 0.2)
def tick(t, g=0.1): S(O_ + "clock-tick-0/" + sorted(os.listdir(os.path.join(LIB, O_, "clock-tick-0")))[0], t, g) if False else S(U_ + "tick_001.ogg", t, g, 0.2)
def page(t, g=0.14, i=0):
    files = sorted([l.strip() for l in open(os.path.join(LIB, "index.txt")) if "10-book-page-flips" in l])
    S(files[i % len(files)], t, g, -0.1)
def thud(t, g=0.3): S(I_ + "impactSoft_heavy_001.ogg", t, g)
def knock(t, g=0.25):
    for k in range(2): S(I_ + "impactWood_light_00%d.ogg" % k, t + k * 0.17, g, 0.2)
def cuff(t, g=0.25, i=0): S(A_ + ("metalLatch.ogg" if i % 2 else "metalClick.ogg"), t, g, 0.1)
def coins(t, g=0.15, i=0): S(A_ + "handleCoins%s.ogg" % ("" if i % 2 == 0 else "2"), t, g, 0.2)
def cloth(t, g=0.12, i=0): S(A_ + "cloth%d.ogg" % (1 + i % 4), t, g, -0.2)

# 1 hook: the key slides in, the lock turns, the door creaks open; the camera snaps back
S(O_ + "100-cc0-sfx/key_open_01.ogg", 0.0, 0.24); swish(0.25, 0.16); S(A_ + "creak1.ogg", 0.55, 0.12, -0.2)
S(U_ + "select_001.ogg", F(tEleven), 0.12); ding(F(tLock), 0.09, 0)
# 2 sneaking in, unscrewing, the cylinder out
steps(F(tMonths) - 0.1, 4, 0.34, 0.07, "carpet")
for k in range(6): S(U_ + "tick_002.ogg", F(tUnscrew) + k * 0.09, 0.07, 0.2)
S(I_ + "impactMetal_light_000.ogg", F(tUnscrew) + 0.62, 0.09)
# 3 the locksmith cuts a key: a filing scrape, the key held up with a chime
swish(F(tLocksmith) - 0.05, 0.12)
S(A_ + "drawKnife1.ogg", F(tCut) - 0.05, 0.16); S(A_ + "drawKnife2.ogg", F(tCut) + 0.22, 0.13)
ding(F(tKey) + 0.05, 0.08, 1)
# 4 the lock goes back; morning
S(A_ + "metalLatch.ogg", F(tBack), 0.12)
# 5 door after door, key after key: a key added to the ring on each beat
for k in range(4): keys(F(tDoor) + k * 0.36, 0.08, k)
# 6 seven masked men walk in: footsteps; Click. Click. Click.
steps(F(tSeven) - 0.1, 8, 0.27, 0.08, "concrete")
for k, w in enumerate([A("click", tWalked), A("click", A("click", tWalked) + 0.05), A("click", A("click", A("click", tWalked) + 0.05) + 0.05)]): lockclick(w, 0.18, k)
# 7 twenty minutes: the clock spins, the bags fill, the counter rolls
swish(F(t20) - 0.05, 0.14)
for k in range(10): S(U_ + "tick_001.ogg", F(t20) + k * 0.08, 0.06)
for k in range(3): cloth(F(tWalked2) + k * 0.25, 0.1, k)
for k in range(3): coins(F(tMillion) - 0.3 + k * 0.2, 0.1, k)
# 8 no alarm / no shots / no broken locks: three soft ticks for the crosses
for w in (tNo1, tShots, tBroken): S(U_ + "select_002.ogg", w, 0.1)
steps(F(tPolice) - 0.1, 3, 0.4, 0.06, "wood")
# 9 the one rule: knuckles on the table, the 6 YEARS stamp, the law book shut
S(I_ + "impactWood_light_002.ogg", F(tRule), 0.18); thud(F(tSix) + 0.02, 0.14); S(A_ + "bookClose.ogg", F(tLaw) + 0.05, 0.13)
# 10 year one / three / five: calendar pages flip, a soft chime on "free"
for k, w in enumerate((tYear1, tThree, tFive)): page(w - 0.05, 0.12, k)
ding(F(tFree), 0.12, 2)
# 11 Specs arrested: the handcuffs; his share vanished: the suitcase pops open, empty
cuff(F(tArrested) + 0.1, 0.22, 0); cuff(F(tArrested) + 0.3, 0.18, 1)
S(U_ + "open_001.ogg", F(tVanished) - 0.05, 0.15); S(A_ + "cloth3.ogg", F(tVanished) + 0.3, 0.08)
# 12 furious; the hitman; the shot (muffled, distant) and the heartbeat
S(I_ + "impactPunch_medium_000.ogg", F(tFurious), 0.16)
S(O_ + "muffled-distant-explosion/" + sorted(f for f in os.listdir(os.path.join(LIB, O_, "muffled-distant-explosion")) if not f.startswith("."))[0], tShot - 0.02, 0.22)
hb = sorted([l.strip() for l in open(os.path.join(LIB, "index.txt")) if "heartbeat-single-sound" in l])[0]
for k in range(3): S(hb, tSurvived + 0.1 + k * 0.62, 0.22 - 0.04 * k)
# 13 the FBI knock; Specs talks: a typewriter takes it down
knock(F(tFBI) - 0.1, 0.2)
tw = sorted([l.strip() for l in open(os.path.join(LIB, "index.txt")) if "typewriter-sounds" in l])
S(tw[0], F(tTalked), 0.1, 0.2, cut=1.2)
# 14 arrested five days before the clock ran out: cuffs, a camera shutter (mugshot), the stamp
for k in range(3): cuff(F(tArrested2) + 0.05 + k * 0.17, 0.12, k)
cam = sorted([l.strip() for l in open(os.path.join(LIB, "index.txt")) if "oga/camera" in l])[0]
S(cam, F(tFive2), 0.18); thud(F(tClock) + 0.05, 0.2)
# 15 the key ring fans out; the zip; the end chime
keys(F(tEvery), 0.1, 2); swish(F(tMouth) - 0.05, 0.12); S(A_ + "beltHandle1.ogg", F(tShut), 0.12); ding(F(tShut) + 0.3, 0.12, 3)
# transitions: soft swishes at the cuts the timeline makes
for w in (tThen, tRule, tSpecs, tFBI): swish(F(w) - 0.1, 0.1)

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
# even out the effects: a soft peak compressor on the SFX bus (loud hits pulled toward the typical one), then quieter overall
from scipy.ndimage import maximum_filter1d
pkenv = maximum_filter1d(np.abs(fx).max(axis=0), ns(0.01))
act = pkenv[pkenv > pkenv.max() * 1e-3]
thr = np.median(act) * dbg(2.0)                               # ~2 dB above a typical hit
grc = np.minimum(1.0, (thr / np.maximum(pkenv, 1e-9)) ** (1 - 1 / 4.0))   # ratio 4:1 above the threshold
att, rel = np.exp(-1 / (SR * 0.003)), np.exp(-1 / (SR * 0.15)); sm2 = np.empty_like(grc); cur = 1.0
for i in range(len(grc)):
    cur = grc[i] + (cur - grc[i]) * (att if grc[i] < cur else rel); sm2[i] = cur
fx = fx * sm2[None, :]
fxb = fx * dbg(-32.0 - integrated(fx))
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
print("sfx peak spread after compression (dB):", round(float(20 * np.log10(np.percentile(act, 99) / np.median(act))), 1), "->", round(float(20 * np.log10(np.percentile(maximum_filter1d(np.abs(fx).max(axis=0), ns(0.01))[pkenv > pkenv.max() * 1e-3], 99) / np.median(maximum_filter1d(np.abs(fx).max(axis=0), ns(0.01))[pkenv > pkenv.max() * 1e-3]))), 1))
print(f"mix {integrated(mix):.1f} LUFS, TP {true_peak(mix):.1f} dBTP, music {integrated(musb):.1f}, sfx {integrated(fxb):.1f}, voice {integrated(v):.1f}")
