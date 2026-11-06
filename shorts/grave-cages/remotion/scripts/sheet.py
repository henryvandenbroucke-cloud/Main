# usage: sheet.py out.jpg cols w img1 img2 ...  (labels = file stems)
import sys
from PIL import Image, ImageDraw
out, cols, w = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]); files = sys.argv[4:]
ims = [Image.open(f).convert("RGB") for f in files]
h = int(w * ims[0].height / ims[0].width); rows = (len(ims) + cols - 1) // cols
S = Image.new("RGB", (cols * (w + 6), rows * (h + 6)), "white"); d = ImageDraw.Draw(S)
for i, (im, f) in enumerate(zip(ims, files)):
    x, y = (i % cols) * (w + 6), (i // cols) * (h + 6)
    S.paste(im.resize((w, h)), (x, y)); d.rectangle([x, y, x + 150, y + 18], fill="black"); d.text((x + 3, y + 3), f.split("/")[-1][:24], fill="white")
S.save(out, quality=86)
