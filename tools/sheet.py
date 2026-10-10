import sys, json, os
from PIL import Image, ImageDraw, ImageFont
d, out, cols, every = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
idx = json.load(open(os.path.join(d, 'index.json')))
idx = idx[::every]
tw, th = 320, 200; rows = (len(idx) + cols - 1) // cols
W = Image.new('RGB', (cols * tw, rows * th), (0, 0, 0)); f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial Bold.ttf', 14)
for k, (n, z) in enumerate(idx):
    im = Image.open(os.path.join(d, f'{n:04d}.jpg')).convert('RGB').resize((tw, th)); dr = ImageDraw.Draw(im); dr.rectangle([0, 0, 110, 18], fill=(0, 0, 0)); dr.text((3, 1), f'#{n} z{z}', fill=(255, 255, 0), font=f)
    W.paste(im, ((k % cols) * tw, (k // cols) * th))
W.save(out, quality=85); print(out, len(idx))
