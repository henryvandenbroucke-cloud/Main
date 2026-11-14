# usage: python3 scripts/sheet.py <out.jpg> <cols> <img> <img> ...   (contact sheet of stills, labelled by file name)
import sys
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
ims = [Image.open(f).convert("RGB") for f in files]
w, h = ims[0].size
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), (20, 20, 20))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d.rectangle([x, y, x + 110, y + 26], fill=(0, 0, 0)); d.text((x + 6, y + 6), f.split("_")[-1].split(".")[0], fill=(255, 255, 0))
sheet.save(out, quality=85)
