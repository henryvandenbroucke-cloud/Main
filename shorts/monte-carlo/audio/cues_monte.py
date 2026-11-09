# "The Man Who Beat Monte Carlo With a Notebook" (Joseph Jagger): anchors, score, real recorded SFX on satisfying beats
tBroke = A("broke"); tBank = A("bank"); tMonte = A("monte"); tAnd0 = A("and", tMonte); tMonth = A("month"); tSingle = A("single"); tCoin = A("coin")
tInstead = A("instead"); tSix = A("six"); tWrote = A("wrote"); tEvery = A("every", tWrote); tAll = A("all", tEvery); tBecause = A("because"); tJoseph = A("joseph"); tMill = A("mill"); tMachines = A("machines")
tNothing = A("nothing"); tSpins = A("spins"); tNot = A("not", tSpins); tMill2 = A("mill", tNot); tNot2 = A("not", tMill2); tRoulette2 = A("roulette", tNot2); tHe = A("he", tRoulette2)
tRandom = A("random"); tSixth = A("sixth"); tNine = A("nine", tSixth); tOften = A("often"); tSo = A("so", tOften); tBetting = A("betting"); tWheel3 = A("wheel", tBetting); tNine2 = A("nine", tWheel3)
tDay = A("day", tNine2); tWinning = A("winning"); tStory = A("story"); tTwo = A("two", tStory); tFrancs = A("francs"); tCasino = A("casino", tFrancs); tPanicked = A("panicked")
tSo2 = A("so", tPanicked); tNight = A("night", tSo2); tSecretly = A("secretly"); tSwapped = A("swapped"); tNext = A("next", tSwapped); tLosing = A("losing"); tNoticed = A("noticed")
tHis = A("his", tNoticed); tLucky = A("lucky"); tScratch = A("scratch"); tFound = A("found"); tAnother = A("another"); tWinning2 = A("winning", tAnother); tIn = A("in", tWinning2)
tRebuilt = A("rebuilt"); tLopsided = A("lopsided"); tAgain = A("again", tLopsided); tAnd2 = A("and", tAgain); tQuit = A("quit"); tHome = A("home"); tBought = A("bought"); tHouses = A("houses")
tHe3 = A("he", tHouses); tLuck = A("luck", tHe3); tHe4 = A("he", tLuck); tNotebook = A("notebook")

# score: the brick-tax caper band; a hushed night bar for the panic and the secret swap; warm for Yorkshire
section(0.0, F(tCasino) - 0.05, ["F", "C", "Dm", "Bb"], "caper", 0.6)
section(F(tCasino) - 0.05, F(tNext) - 0.05, ["Dm", "Bb", "Gm", "A7"], "night", 0.55)
section(F(tNext) - 0.05, F(tAnd2) - 0.05, ["F", "Dm", "Bb", "C"], "caper", 0.6)
section(F(tAnd2) - 0.05, DUR - 0.45, ["F", "C", "Bb", "F"], "warm", 0.6)

def rattle(t0, t1, g=0.05):
    """the ball rattling round the frets: soft recorded ticks that slow to a stop"""
    t, gap, k = t0, 0.06, 0
    while t < t1:
        S(U_ + "tick_00%d.ogg" % (1 + k % 2), t, g * (0.7 + 0.3 * (k % 2)), 0.25 * (1 if k % 2 else -1)); t += gap; gap *= 1.07; k += 1

# 1 hook: the ball runs round the wheel and drops; the camera snaps back
rattle(0.0, F(tBank) - 0.05, 0.06); swish(0.2, 0.14); S(K_ + "chip-lay-1.ogg", F(tBank), 0.1); pop(F(tMonte), 0.07)
# 2 the coin he doesn't bet: flipped and pocketed
S("rpg80/item_coins_01.ogg", F(tSingle) + 0.05, 0.1); cloth(F(tCoin) + 0.3, 0.08, 0)
# 3 six clerks pop in; pages fill; the calendar races
for k in range(6): pop(F(tSix) - 0.2 + k * 0.1, 0.05)
for k, w in enumerate((tWrote, tEvery, tAll)): page(w, 0.09, k)
# 4 Yorkshire mill: the cogs clank into place
S(I_ + "impactMetal_light_001.ogg", F(tMachines) - 0.1, 0.1); S(I_ + "impactMetal_light_002.ogg", F(tMachines) + 0.1, 0.08)
# 5 the lopsided flywheel and the wobbling roulette wheel
swish(F(tNothing), 0.1); rattle(F(tRoulette2) - 0.3, F(tHe) - 0.1, 0.04)
# 6 six notebooks pop up; the sixth lights up
for k in range(6): pop(F(tHe) + 0.05 + k * 0.1, 0.05)
ding(F(tNine) - 0.05, 0.08, 0); pop(F(tOften), 0.06)
# 7 nine chips drop on nine numbers; the ball lands
for k in range(9): chiplay(F(tNine2) - 0.3 + k * 0.067, 0.07, k)
rattle(F(tBetting) - 0.2, F(tDay) - 0.15, 0.04); S(K_ + "chip-lay-2.ogg", F(tDay) - 0.1, 0.08)
# 7b-8 day after day the pile grows; two million francs; the room gasps
for k in range(5): chips(F(tDay) + 0.15 + k * 0.3, 0.08, k, "stack")
for k in range(3): chips(F(tTwo) + k * 0.2, 0.09, k, "collide")
S(O_ + "applause-in-a-large-hall-or-church/applause-clapping-church-crowd-immersive.wav", F(tFrancs), 0.05, 0.0, cut=1.6)
# 9 the director panics
pop(F(tPanicked), 0.07); cloth(F(tPanicked) + 0.25, 0.07, 2)
# 10 one night: porters tiptoe across with the wheels
steps(F(tSecretly) - 0.2, 7, 0.3, 0.05, "carpet"); swish(F(tSwapped), 0.08)
# 11 losing: the pile shrinks; then he notices
for k in range(3): chips(F(tLosing) + k * 0.25, 0.06, k + 3, "handle")
pop(F(tNoticed), 0.07)
# 12 the magnifier finds the scratch; another table; winning again
swish(F(tLucky), 0.1); ding(F(tScratch), 0.08, 1); ding(F(tAnother) - 0.05, 0.07, 2)
for k in range(3): chips(F(tWinning2) - 0.1 + k * 0.2, 0.08, k, "stack")
# 13 the casino rebuilds the wheels: the screwdriver turns; the wheel runs true
for k in range(8): S(U_ + "tick_002.ogg", F(tRebuilt) + k * 0.09, 0.05, 0.2)
ding(F(tAgain), 0.08, 3)
# 14 home to Yorkshire; SOLD boards on the row of houses
swish(F(tHome) - 0.1, 0.08)
for k in range(3): S(I_ + "impactWood_light_00%d.ogg" % (k % 3), F(tHouses) - 0.05 + k * 0.3, 0.12)
# 15 the clover pops; the notebook snaps up; end chime
pop(F(tLuck) - 0.12, 0.07); S(A_ + "bookClose.ogg", F(tHe4) + 0.05, 0.12); ding(F(tNotebook) + 0.2, 0.1, 0)
for w in (tAnd0, tInstead, tBecause, tSo, tStory, tNext, tIn): swish(F(w) - 0.1, 0.07)
