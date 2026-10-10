import sys
from PIL import Image, ImageDraw, ImageFont
out, cols, rest = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
items = [(rest[i], rest[i+1]) for i in range(0, len(rest), 2)]
w, h = 800, 500; s = 0.5
tw, th = int(w*s), int(h*s); rows = (len(items)+cols-1)//cols
W = Image.new('RGB', (cols*tw + (cols-1)*4, rows*th + (rows-1)*4), (20,20,20))
try: font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 18)
except Exception: font = ImageFont.load_default()
for k,(f,z) in enumerate(items):
    im = Image.open(f).convert('RGB').resize((tw,th), Image.LANCZOS); d = ImageDraw.Draw(im)
    d.rectangle([0,0,90,24], fill=(0,0,0)); d.text((5,2), 'z '+z, fill=(255,255,0), font=font)
    W.paste(im, ((k%cols)*(tw+4), (k//cols)*(th+4)))
W.save(out, quality=88)
