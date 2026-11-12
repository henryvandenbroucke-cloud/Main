"""Draws blocking.json (from blocking.mjs) as a contact sheet: one 270x480 thumbnail per camera key.
Grey-box blocking only (body capsule, head, cream job icon, set outlines), NOT the look of the film.
Colours: hero orange, Kevin green, reflection light orange, icons cream; light preset tints the background."""
import json
import os
from PIL import Image, ImageDraw, ImageFont

here = os.path.dirname(os.path.abspath(__file__))
frames = json.load(open(os.path.join(here, "blocking.json")))
TW, TH, PAD, COLS = 270, 480, 8, 8
BG = {"day": (198, 214, 232), "lamp": (92, 66, 58), "golden": (236, 176, 120), "nightblue": (46, 52, 96)}
LINE = {"day": (120, 128, 150), "lamp": (200, 160, 120), "golden": (150, 90, 80), "nightblue": (130, 140, 210)}
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 13)
small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
rows = (len(frames) + COLS - 1) // COLS
sheet = Image.new("RGB", (COLS * (TW + PAD) + PAD, rows * (TH + 44 + PAD) + PAD), (24, 24, 28))
for n, fr in enumerate(frames):
    im = Image.new("RGB", (TW, TH), BG[fr["light"]])
    d = ImageDraw.Draw(im)
    for p in fr["prims"]:
        if p["t"] == "line":
            d.line([tuple(p["a"]), tuple(p["b"])], fill=LINE[fr["light"]], width=1)
        elif p["t"] == "body":
            (ax, ay), (bx, by), w = p["a"], p["b"], max(1.5, p["w"])
            d.line([(ax, ay), (bx, by)], fill=p["col"], width=int(2 * w))
            hx, hy = p["head"]
            r = p["hr"]
            d.ellipse([hx - r, hy - r * 0.94, hx + r, hy + r * 0.94], fill=p["col"], outline=(36, 23, 38), width=2)
            if r > 6:
                d.text((hx - 4, hy - 7), p["lbl"], fill=(20, 20, 20), font=small)
        elif p["t"] == "disc":
            (cx, cy), r = p["c"], max(2, p["r"])
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=p["col"], outline=(36, 23, 38), width=2)
        elif p["t"] == "fg":
            (ax, ay), (bx, by) = p["a"], p["b"]
            d.line([(ax, ay), (bx, by)], fill=(70, 60, 60), width=int(max(3, 2 * p["w"])))
    x0, y0 = PAD + (n % COLS) * (TW + PAD), PAD + (n // COLS) * (TH + 44 + PAD)
    sheet.paste(im, (x0, y0))
    dd = ImageDraw.Draw(sheet)
    kind = "cut" if fr["cut"] else (f"glide {fr['glide']}" if fr["glide"] else "start")
    dd.text((x0, y0 + TH + 2), f"{fr['id']}  f{fr['f']} ({kind} {fr['key']})  {fr['light']}  dof {fr['dof']:.0f}", fill=(230, 230, 230), font=font)
    dd.text((x0, y0 + TH + 20), fr["said"][:44], fill=(170, 170, 180), font=small)
out = os.path.join(here, "blocking_sheet.jpg")
sheet.save(out, quality=82)
print(out, sheet.size)
