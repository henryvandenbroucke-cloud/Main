"""Word-by-word highlighted captions (ASS) from faster-whisper word timings.

usage: python3 captions.py words.json out.ass
"""
import json, re, sys

words = json.load(open(sys.argv[1]))
FIX = {"VI": "6", "VI.": "6."}
for w in words:
    w["w"] = FIX.get(w["w"], w["w"])

MAX_WORDS, MAX_CHARS = 3, 16
chunks, cur = [], []
for w in words:
    cur.append(w)
    text = " ".join(x["w"] for x in cur)
    ends_phrase = re.search(r"[.,?!]$", w["w"])
    if ends_phrase or len(cur) >= MAX_WORDS or len(text) >= MAX_CHARS:
        chunks.append(cur)
        cur = []
if cur:
    chunks.append(cur)


def clean(t):
    return re.sub(r"[.,!]", "", t).upper()


def ts(t):
    t = max(0, t)
    h, rem = divmod(t, 3600)
    m, s = divmod(rem, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


YELLOW, WHITE = r"{\c&H00E5FF&}", r"{\c&HFFFFFF&}"
head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Inter Display Black,108,&H00FFFFFF,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,1,0,1,8,4,5,50,50,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
lines = []
for ci, ch in enumerate(chunks):
    nxt = chunks[ci + 1][0]["s"] if ci + 1 < len(chunks) else ch[-1]["e"] + 0.6
    chunk_end = min(nxt, ch[-1]["e"] + 0.35)
    for wi, w in enumerate(ch):
        s = ch[0]["s"] if wi == 0 else w["s"]
        e = ch[wi + 1]["s"] if wi + 1 < len(ch) else chunk_end
        parts = [(YELLOW if j == wi else WHITE) + clean(x["w"]) for j, x in enumerate(ch)]
        pop = r"{\fscx82\fscy82\t(0,90,\fscx100\fscy100)}" if wi == 0 else ""
        lines.append(f"Dialogue: 0,{ts(s)},{ts(e)},Cap,,0,0,0,,{{\\pos(540,1290)}}{pop}{' '.join(parts)}")

open(sys.argv[2], "w").write(head + "\n".join(lines) + "\n")
print(f"{len(chunks)} caption chunks, {len(lines)} events")
for ch in chunks[:6]:
    print("  ", " ".join(clean(x['w']) for x in ch))
