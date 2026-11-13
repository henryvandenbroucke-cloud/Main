# "The GTA 6 Leak That Came From a Hotel TV": an 80s synthwave groove (our own: detuned saw pads, an octave-pumping saw bass,
# a plucked arpeggio, soft gated drums) kept chill under the voice, and only ~8 soft real recorded effects.
tLeak = A("leak"); tComputer = A("computer"); tTV = A("tv"); tIn = A("in", tTV); tBail = A("bail"); tLaptop = A("laptop"); tPut = A("put"); tHotel2 = A("hotel", tPut)
tTV2 = A("tv", A("so", tHotel2)); tStreaming = A("streaming"); tBrand = A("brand"); tBroke = A("broke"); tChat = A("chat"); t90 = A("90"); tGTA = A("gta"); tPosted = A("posted")
tMessaged = A("messaged"); tPay = A("pay"); tCode = A("code"); tFar = A("far"); tStill = A("still"); tHotel3 = A("hotel", tStill); tJudge = A("judge"); tOrdered = A("ordered")
tYear = A("year"); tTrailer = A("trailer"); tWorld = A("world"); tMonth = A("month"); tFirst = A("first", tMonth); tTV4 = A("tv", A("hotel", tFirst))

CH = {"Am": [45, 57, 60, 64], "F": [41, 57, 60, 65], "C": [48, 55, 60, 64], "G": [43, 55, 59, 62], "Dm": [38, 57, 62, 65], "Em": [40, 55, 59, 64]}
def saw_bass(f, dur, vel):
    n = ns(dur); t = np.arange(n) / SR
    x = sum(((t * f * d) % 1.0) * 2 - 1 for d in (1.0, 1.004)) * 0.5
    env = np.minimum(1, t / 0.004) * np.exp(-t / (dur * 0.9))
    return lp(x * env, 650) * vel
def kick(vel):
    n = ns(0.35); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(48 + 110 * np.exp(-t / 0.035)) / SR
    return np.sin(ph) * np.exp(-t / 0.12) * vel
def hat(vel):
    n = ns(0.06); x = R.standard_normal(n) * np.exp(-np.arange(n) / SR / 0.015)
    return hp(x, 7000) * vel
def wave_bar(t0, chord, vel=1.0, drums=True, arp=True, bass=True):
    root, a, b, c = CH[chord]
    put(pad([m2f(a), m2f(b), m2f(c)], 2.0, 0.42 * vel, R, 0.25, 0.7, 1400.0, 9.0), t0, 0.55)
    if bass:
        for k in range(8): put(saw_bass(m2f(root - 12 + (12 if k % 2 else 0)), 0.22, 0.5 * vel), t0 + k * 0.25, 0.5, -0.05)
    if arp:
        seq = [a, b, c, b + 12, c, b, a + 12, c]
        for k, m in enumerate(seq): put(pluck(m2f(m + 12), 0.32 * vel, R, 0.35, 0.75), t0 + k * 0.25, 0.22, 0.35 * (1 if k % 2 else -1))
    if drums:
        for k in range(4):
            if k % 2 == 0: put(kick(0.7 * vel), t0 + k * 0.5, 0.5)
            else: put(snare(0.32 * vel, R, 0.22), t0 + k * 0.5, 0.22, 0.1)
        for k in range(8): put(hat(0.18 * vel), t0 + k * 0.25 + 0.125, 0.25, 0.25)

prog = ["Am", "F", "C", "G"]
def wave(t0, t1, vel, **kw):
    t, i = t0, 0
    while t < t1 - 0.25: wave_bar(t, prog[i % 4], vel, **kw); t += 2.0; i += 1
# the hook and the hack: full groove; the set-up: pad + bass only; BUSTED: a hard stop; the court: a hushed minor pad;
# the trailer and Leonida: the full groove again; the TV clicks off: silence
wave(0.0, F(tIn), 0.75)
wave(F(tIn), F(tBroke) - 0.05, 0.6, drums=False, arp=False)
wave(F(tBroke) - 0.05, F(tHotel3) - 0.02, 0.72)
t = F(tHotel3) + 0.9
while t < F(tYear) - 0.2: put(pad([m2f(57), m2f(60), m2f(64)] if int((t - F(tHotel3)) / 2) % 2 == 0 else [m2f(57), m2f(62), m2f(65)], 2.0, 0.35, R, 0.6, 0.8), t, 0.5); t += 2.0
wave(F(tYear) - 0.2, F(tTV4) + 0.15, 0.78)
mutes.append((F(tHotel3) - 0.02, F(tHotel3) + 0.9))
mutes.append((F(tTV4) + 0.2, DUR - 0.1))

# ---- ~8 soft real recorded effects, only on the satisfying beats
S(U_ + "click_002.ogg", 0.0, 0.16)                                   # the TV remote, frame 1
swish(0.2, 0.1)                                                      # the camera pulls back
S(A_ + "bookClose.ogg", F(tComputer) + 0.05, 0.13)                   # the laptop slams shut
S(U_ + "confirmation_002.ogg", F(tHotel2) + 0.1, 0.07)               # the key card beeps
S(A_ + "metalClick.ogg", F(tStreaming) + 0.15, 0.12)                 # the streaming stick clicks in
knock(F(tFar) - 0.05, 0.16)                                          # police at the door
S(I_ + "impactWood_heavy_001.ogg", F(tOrdered) + 0.12, 0.18)         # the gavel
S(U_ + "switch_002.ogg", F(tTV4) + 0.03, 0.16)                       # the TV clicks off
