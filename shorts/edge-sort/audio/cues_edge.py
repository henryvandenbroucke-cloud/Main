# "For Luck" (Ivey edge-sorting): word anchors, score plan, and real recorded SFX on the satisfying beats only
t2012 = A("2012"); tSeven = A("seven"); tMillion = A("million"); tLondon = A("london"); tTurn = A("turn"); tHis = A("his")
tSuper = A("superstitious"); tPartner = A("partner"); tEvery = A("every", tSuper); tSeven2 = A("seven", tEvery); tEight = A("eight", tSeven2); tNine = A("nine", tEight); tTurned = A("turned", tNine); tDown = A("down", tTurned)
tFor = A("for", tDown); tAgreed = A("agreed"); tHigh = A("high"); tSame = A("same"); tAgain = A("again", tSame); tHeres = A("here's"); tFlaw = A("flaw"); tPattern = A("pattern"); tEven = A("even")
tOneEdge = A("one", tEven); tDiff = A("differently"); tSo = A("so", tDiff); tTurned2 = A("turned", tSo); tLooked = A("looked"); tThey = A("they", tLooked); tSpot = A("spot")
tS2 = A("seven", tSpot); tE2 = A("eight", tS2); tN2 = A("nine", tE2); tFlipped = A("flipped"); t77 = A("7.7"); tTwo = A("two", t77); tDays = A("days"); tBut = A("but", tDays); tPaid = A("paid")
tCourt = A("court"); t2017 = A("2017"); tSupreme = A("supreme"); tCheating = A("cheating"); tThen = A("then", tCheating); tAmerica = A("america"); tOrdered = A("ordered"); tMillion3 = A("million", tOrdered)
tTurns = A("turns"); tLuck3 = A("luck", tTurns); tLegal = A("legal"); tDefense = A(["defense", "defence"])

# score: the brick-tax caper band, light; a minor turn for the court
section(0.0, F(tBut) - 0.05, ["F", "Dm", "Bb", "C"], "caper", 0.6)
section(F(tBut) - 0.05, F(tThen) - 0.05, ["Dm", "Gm", "A7", "Dm"], "minor", 0.5)
section(F(tThen) - 0.05, DUR - 0.45, ["Dm", "Bb", "Gm", "A7"], "caper", 0.6)

# 1 hook: the dealer's hand spins the card round on the felt; the camera snaps back
cardslide(0.0, 0.2, 0); swish(0.25, 0.14); pop(F(t2012) + 0.05, 0.08)
# 2 seven million: chips stack up
for k in range(3): chips(F(tSeven) + 0.1 + k * 0.22, 0.11, k, "stack")
# 3 two cards turned around
for k in range(2): cardslide(F(tTurn) - 0.1 + k * 0.23, 0.13, k + 2)
# 4 her bubble pops
pop(F(tPartner) + 0.2, 0.08)
# 5 seven, eight, nine land face up; then each spins round
for k, w in enumerate((tSeven2, tEight, tNine)): cardplace(w - 0.08, 0.13, k)
for k in range(3): cardslide(F(tTurned) + k * 0.17, 0.1, k + 4)
# 6 "for luck" pop; the manager agrees; chips flood in
pop(F(tFor), 0.07); pop(F(tAgreed) - 0.03, 0.07)
for k in range(4): chips(F(tHigh) + k * 0.16, 0.09, k + 2, "handle")
# 7 the same cards swept back into the shoe
S(K_ + "card-shuffle.ogg", F(tSame) - 0.25, 0.12, 0.0, cut=1.1); swish(F(tAgain), 0.1)
# 8 the flaw: the magnifier glides in; the thin and thick borders glow
swish(F(tPattern) - 0.05, 0.1); ding(F(tOneEdge) + 0.05, 0.07, 0); ding(F(tDiff) - 0.1, 0.07, 1)
# 9 one card spins round and stands out
cardslide(F(tTurned2) - 0.05, 0.12, 6); ding(F(tLooked), 0.07, 2)
# 10 7-8-9 tick up; the next card slides out of the shoe and flips over: a nine
for w in (tS2, tE2, tN2): pop(w, 0.06)
cardslide(F(tN2) + 0.1, 0.12, 7); cardplace(F(tFlipped) - 0.03, 0.14, 3)
# 11 7.7 million in two days: chips cascade; the calendar page flips
for k in range(4): chips(F(t77) + k * 0.18, 0.1, k, "collide")
page(F(tDays) - 0.05, 0.12, 0)
# 12 never paid: the cheque is ripped in half
S(O_ + "58-random-sound-effects/Rip_01.wav", F(tPaid) - 0.05, 0.16, 0.0, cut=0.6)
# 13 the Supreme Court: the gavel, the CHEATING stamp
swish(F(t2017) - 0.1, 0.1)
S(I_ + "impactWood_heavy_001.ogg", F(tCheating) - 0.02, 0.24); thud(F(tCheating) + 0.03, 0.14)
# 14 America: ten million dollars flutters away
for k in range(4): paper(F(tOrdered) + 0.1 + k * 0.28, 0.07, k)
coins(F(tMillion3) + 0.05, 0.1, 0)
# 15 the shrug: a soft pop for the bubble, the end chime
pop(F(tLuck3) - 0.1, 0.07); ding(F(tDefense) + 0.25, 0.1, 3)
# soft swishes at the cuts between places
for w in (tLondon, tHis, tHeres, tThey, tBut, tTurns): swish(F(w) - 0.1, 0.08)
