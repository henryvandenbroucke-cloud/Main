# Synthesized sound effects for the water short, mixed quietly under the voice.
# usage: python3 sfx.py   (run inside chatgpt-water-short/audio; reads voice.wav, writes sfx.wav and mix.wav)
# Every effect is made here with numpy/scipy: nothing is downloaded. Effects sit far under the voice:
# single hits peak around -24 dBFS, beds (hum, crickets, rain) around -40 dBFS.
import wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
TOTAL = 71.0
rng = np.random.default_rng(7)


def t_(d):
    return np.arange(int(d * SR)) / SR


def env(n, a=0.005, r=0.1):
    e = np.ones(n)
    na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return e


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, hi], btype="band", fs=SR, output="sos"), x)


def hp(x, f):
    return sosfilt(butter(2, f, btype="high", fs=SR, output="sos"), x)


def lp(x, f):
    return sosfilt(butter(2, f, btype="low", fs=SR, output="sos"), x)


def sweep(f0, f1, d, curve=1.0):
    t = t_(d)
    f = f0 + (f1 - f0) * (t / d) ** curve
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def pop(f=520.0, d=0.09):
    return sweep(f, f * 0.4, d, 0.6) * np.exp(-t_(d) * 38)


def drip(f=900.0):
    d = 0.11
    return sweep(f, f * 1.9, d, 0.5) * np.exp(-t_(d) * 30)


def ting(f=1900.0, d=0.5):
    t = t_(d)
    return (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 1.5 * t)) * np.exp(-t * 9) * env(len(t), 0.002, 0.05)


def ding(f=880.0, d=0.9):
    t = t_(d)
    return sum(a * np.sin(2 * np.pi * f * k * t) for k, a in ((1, 1), (2.0, 0.5), (3.0, 0.25), (4.2, 0.12))) * np.exp(-t * 5) * env(len(t), 0.002, 0.1)


def coin():
    d = 0.35
    t = t_(d)
    a = np.sin(2 * np.pi * 1318 * t) * (t < 0.07) + np.sin(2 * np.pi * 1976 * t) * (t >= 0.07)
    return a * np.exp(-np.maximum(0, t - 0.07) * 14) * env(len(t), 0.002, 0.05)


def thud(d=0.3):
    t = t_(d)
    return sweep(95, 38, d, 0.5) * np.exp(-t * 14) + 0.25 * lp(rng.standard_normal(len(t)), 900) * np.exp(-t * 60)


def whoosh(d=0.45, lo=300.0, hi=3200.0, up=True):
    n = int(d * SR)
    x = rng.standard_normal(n)
    out = np.zeros(n)
    steps = 12
    for i in range(steps):  # sweeping band
        a, b = i * n // steps, (i + 1) * n // steps
        k = i / (steps - 1)
        c = lo * (hi / lo) ** (k if up else 1 - k)
        out[a:b] = bp(x, c * 0.7, c * 1.4)[a:b]
    return out * np.hanning(n)


def slurp(d=0.7):
    t = t_(d)
    n = bp(rng.standard_normal(len(t)), 500, 2200) * (0.6 + 0.4 * np.sin(2 * np.pi * 24 * t))
    tone = 0.5 * sweep(260, 520, d, 1.4) * (0.5 + 0.5 * np.sin(2 * np.pi * 31 * t))
    return (n + tone) * env(len(t), 0.06, 0.12)


def sizzle(d=0.8):
    t = t_(d)
    x = hp(rng.standard_normal(len(t)), 3500)
    crackle = (rng.random(len(t)) > 0.9985).astype(float)
    crackle = np.convolve(crackle, np.exp(-np.arange(200) / 30), mode="same")
    return (x * 0.5 + hp(crackle * rng.standard_normal(len(t)), 2000) * 3) * env(len(t), 0.05, 0.25)


def hiss(d=2.0):
    t = t_(d)
    return hp(rng.standard_normal(len(t)), 2500) * env(len(t), 0.25, d * 0.6)


def flow(d=2.4):
    t = t_(d)
    return bp(rng.standard_normal(len(t)), 250, 1800) * (0.7 + 0.3 * np.sin(2 * np.pi * 1.3 * t)) * env(len(t), 0.3, 0.5)


def hum(d=3.3):
    t = t_(d)
    return (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 110 * t) + 0.2 * np.sin(2 * np.pi * 165 * t)) * env(len(t), 0.3, 0.4)


def crickets(d=3.4):
    t = t_(d)
    chirp = (np.sin(2 * np.pi * 4300 * t) * (np.sin(2 * np.pi * 38 * t) > 0.2)) * (np.sin(2 * np.pi * 1.6 * t) > 0.1)
    return chirp * env(len(t), 0.4, 0.5)


def beep(f0=880.0, f1=660.0):
    d = 0.11
    t = t_(d)
    a = np.sign(np.sin(2 * np.pi * f0 * t)) * env(len(t), 0.004, 0.02)
    b = np.sign(np.sin(2 * np.pi * f1 * t)) * env(len(t), 0.004, 0.02)
    return lp(np.concatenate([a, np.zeros(int(0.03 * SR)), b]), 3000)


def drone(d=2.2):
    t = t_(d)
    x = np.sin(2 * np.pi * 49 * t) + 0.6 * np.sin(2 * np.pi * 51.5 * t) + 0.3 * np.sin(2 * np.pi * 98 * t)
    return x * (t / d) ** 1.5 * env(len(t), 0.2, 0.25)


def sting(d=1.2):
    t = t_(d)
    return (np.sin(2 * np.pi * 61 * t) + 0.5 * np.sin(2 * np.pi * 92 * t) + 0.3 * lp(rng.standard_normal(len(t)), 300)) * np.exp(-t * 3) * env(len(t), 0.004, 0.2)


def patter(d, rate, f=1400.0):
    """many tiny drips or pops per second"""
    out = np.zeros(int(d * SR))
    for _ in range(int(d * rate)):
        s = pop(f * (0.7 + 0.8 * rng.random()), 0.05) * (0.4 + 0.6 * rng.random())
        i = rng.integers(0, len(out) - len(s))
        out[i:i + len(s)] += s
    return out * env(len(out), 0.15, 0.3)


def db(x):
    return 10 ** (x / 20)


bus = np.zeros(int(TOTAL * SR))
cues = []


def put(at, sound, level_db, name):
    s = sound / (np.max(np.abs(sound)) + 1e-9) * db(level_db)
    i = int(at * SR)
    j = min(len(bus), i + len(s))
    bus[i:j] += s[: j - i]
    cues.append((at, name, level_db))


HIT, SOFT, BED = -24, -28, -40
put(0.0, whoosh(0.5), SOFT, "open whoosh")
put(1.13, pop(620), HIT, "heart bubble arrives")
put(2.42, pop(480), SOFT, "bubble pops")
put(2.6, slurp(0.85), HIT, "robot sips")
put(3.5, whoosh(0.3, 600, 5000), SOFT, "cut whoosh")
put(4.5, thud(0.2), HIT, "freeze")
put(5.3, crickets(3.4), BED, "night crickets")
put(7.4, pop(700), HIT, "hot dog bubble"); put(8.06, pop(560), HIT, "sandwich bubble")
put(8.7, whoosh(2.4, 250, 2600), SOFT, "question flies")
put(11.2, ting(2400, 0.4), HIT, "lands in the building")
put(11.75, hum(3.3), BED + 4, "server hum")
put(12.75, whoosh(0.5, 300, 1800), SOFT, "heat rises")
put(14.36, pop(300, 0.12), HIT, "egg lands"); put(14.4, sizzle(0.7), HIT - 2, "egg sizzles")
put(15.1, whoosh(0.4), SOFT, "cut whoosh")
for k, tt in enumerate((17.05, 17.3, 17.55)):
    put(tt, drip(850 + 120 * k), HIT, "sweat drip")
put(17.85, flow(2.4), BED + 6, "water in the pipes")
put(20.3, hiss(2.0), BED + 6, "steam drifts off")
for k, tt in enumerate((23.7, 24.45, 25.2)):
    put(tt, slurp(0.6), HIT - 1, "building gulps")
put(26.4, pop(640), SOFT, "finger up"); put(27.3, pop(760), HIT, "one bubble")
put(29.85, ting(2100, 0.5), HIT, "teaspoon"); put(30.95, drip(1200), HIT, "tiny drop")
put(34.6, beep(), SOFT, "old robot beeps")
put(35.5, ting(1700, 0.4), SOFT, "bottle")
for k in range(14):
    put(37.05 + k * 3.1 / 30, pop(520 + 30 * k, 0.07), SOFT, "answer bubble")
put(39.35, sweep(300, 1500, 1.2, 1.6) * np.sin(2 * np.pi * 22 * t_(1.2)).clip(0) * env(len(t_(1.2)), 0.02, 0.1), SOFT - 2, "spoon stack rises")
put(40.55, ding(1046), HIT, "stack tops out")
put(42.1, drip(900), HIT, "one drop")
put(43.3, whoosh(0.7, 200, 2000), SOFT, "reveal the power plant")
for k in range(8):
    put(43.97 + k * 0.1, drip(800 + 70 * k), SOFT, "more drops")
put(45.57, patter(2.2, 22, 700), SOFT, "questions rain down")
put(47.87, whoosh(0.35, 500, 4000), SOFT, "cut whoosh")
put(48.62, thud(0.35), HIT + 2, "burger lands")
put(50.3, patter(1.9, 26, 1500), SOFT - 2, "water rains on the burger")
put(53.75, slurp(0.5), HIT - 1, "cow drinks")
put(54.3, patter(2.6, 16, 650), SOFT - 2, "bubbles pile up")
put(56.9, ding(880), HIT, "scale levels")
put(59.3, beep(740, 980), SOFT, "robot: not me"); put(59.62, beep(740, 980), SOFT, "robot: not me")
put(60.45, thud(0.22), HIT, "it's your lunch")
for k in range(7):
    put(62.3 + k * 13 / 30, coin(), HIT - 1, "coins")
for k, tt in enumerate((65.87, 66.07, 66.27)):
    put(tt, pop(600 + 90 * k), SOFT, "comment bubbles")
put(68.55, drone(1.2), SOFT, "lights dim")
put(69.66, sting(1.2), HIT + 2, "red eyes")
put(70.3, slurp(0.68), HIT, "last sip")

# gentle limiter on the effects bus, then the mix
bus = np.tanh(bus * 4) / 4

w = wave.open("voice.wav")
assert w.getframerate() == SR and w.getnchannels() == 1
voice = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
v = np.zeros(len(bus)); v[: len(voice)] = voice[: len(bus)]
# duck the effects a little more while the voice is speaking
e = np.abs(v)
k = int(0.05 * SR)
e = np.convolve(e, np.ones(k) / k, mode="same")
duck = 1 - 0.35 * np.clip(e / 0.08, 0, 1)
mix = v + bus * duck


def save(name, x):
    o = wave.open(name, "w"); o.setnchannels(1); o.setsampwidth(2); o.setframerate(SR)
    o.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes()); o.close()


save("sfx.wav", bus); save("mix_raw.wav", mix)
with open("cues.md", "w") as f:
    f.write("# Sound effect cues (seconds, name, level in dBFS peak)\n\n| time | effect | level |\n|---|---|---|\n")
    for at, name, lv in sorted(cues):
        f.write(f"| {at:.2f} | {name} | {lv} |\n")
rms = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)
print("cues", len(cues), "| voice rms", round(rms(v), 1), "dB | sfx rms", round(rms(bus), 1), "dB | sfx peak", round(20 * np.log10(np.max(np.abs(bus))), 1), "dB")
