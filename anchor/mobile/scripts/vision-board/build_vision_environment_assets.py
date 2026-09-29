"""
Builds the runtime Vision environmental illustration assets from the approved reference direction.
Extracts transparent, restrained, modular WebP layers for the surrounding screen atmosphere:
1. Header Compass (Upper-Left)
2. Header Botanical (Upper-Right)
3. Left Environment (Mountains, botanical leaves, contours)
4. Right Environment (Contours, celestial stars, route dots, botanical sprig)
5. Bottom Contours (Faint transition linework into cream)

Usage: python scripts/vision-board/build_vision_environment_assets.py
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.abspath(os.path.join(HERE, '..', '..'))
REPO = os.path.abspath(os.path.join(MOBILE, '..', '..'))
SRC_IMG = os.path.join(REPO, 'design', 'vision-board', 'source', 'vision-environment-reference.webp')
# Fallback to local user reference if not yet in design source
if not os.path.exists(SRC_IMG):
    # Check alternate location
    alt = os.path.expanduser(r'~\.gemini\antigravity\brain\e5753515-4494-439f-8915-2caa833cb321\.user_uploaded\media_1790652154149.jpg')
    if os.path.exists(alt):
        SRC_IMG = alt

OUT_DIR = os.path.join(MOBILE, 'src', 'assets', 'vision', 'environment')
os.makedirs(OUT_DIR, exist_ok=True)

im = Image.open(SRC_IMG)
arr = np.array(im).astype(float)
W, H = im.size

INTENSITY_SCALE = 0.72  # 28% quieter than reference mockup for restraint

# 1. Header Compass (Top-Left)
crop_c = arr[15:175, 0:135].copy()
ch, cw = crop_c.shape[:2]
for y in range(min(45, ch)):
    for x in range(105, cw):
        crop_c[y, x] = [17.0, 26.0, 35.0]
for y in range(115, ch):
    for x in range(112, cw):
        crop_c[y, x] = [17.0, 26.0, 35.0]

diff_c = np.maximum(0, crop_c - np.array([17.0, 26.0, 35.0]))
lum_c = 0.299 * diff_c[..., 0] + 0.587 * diff_c[..., 1] + 0.114 * diff_c[..., 2]
alpha_c = np.clip((lum_c - 5.0) / 75.0 * 255.0 * INTENSITY_SCALE, 0, 255).astype(np.uint8)

compass_rgba = np.zeros((ch, cw, 4), dtype=np.uint8)
compass_rgba[..., 0] = 216
compass_rgba[..., 1] = 198
compass_rgba[..., 2] = 168
compass_rgba[..., 3] = alpha_c

compass_im = Image.fromarray(compass_rgba).resize((cw * 2, ch * 2), Image.Resampling.LANCZOS)
compass_im.save(os.path.join(OUT_DIR, 'desire-header-compass.webp'), 'WEBP', quality=90)

# 2. Header Botanical (Top-Right)
crop_b = arr[35:280, 480:682].copy()
bh, bw = crop_b.shape[:2]
for y in range(min(18, bh)):
    for x in range(95, min(160, bw)):
        crop_b[y, x] = [17.0, 26.0, 35.0]

for y in range(bh):
    gy = 35 + y
    for x in range(bw):
        gx = 480 + x
        if gx < 564 and gy > 136:
            crop_b[y, x] = [17.0, 26.0, 35.0]

diff_b = np.maximum(0, crop_b - np.array([17.0, 26.0, 35.0]))
lum_b = 0.299 * diff_b[..., 0] + 0.587 * diff_b[..., 1] + 0.114 * diff_b[..., 2]
alpha_b = np.clip((lum_b - 5.0) / 75.0 * 255.0 * INTENSITY_SCALE, 0, 255).astype(np.uint8)

botanical_rgba = np.zeros((bh, bw, 4), dtype=np.uint8)
botanical_rgba[..., 0] = 218
botanical_rgba[..., 1] = 202
botanical_rgba[..., 2] = 172
botanical_rgba[..., 3] = alpha_b

botanical_im = Image.fromarray(botanical_rgba).resize((bw * 2, bh * 2), Image.Resampling.LANCZOS)
botanical_im.save(os.path.join(OUT_DIR, 'desire-header-botanical.webp'), 'WEBP', quality=90)

# 3. Left Environment (Mountains + Leaves + Contours)
crop_l = arr[135:615, 0:135].copy()
lh, lw = crop_l.shape[:2]
row_bg_l = np.mean(arr[135:615, 2:6], axis=1)

left_rgba = np.zeros((lh, lw, 4), dtype=np.uint8)
for y in range(lh):
    gy = 135 + y
    bg = row_bg_l[y]
    for x in range(lw):
        gx = x
        p = crop_l[y, x]
        
        if gx >= 119:
            if gy < 240 or gy > 440:
                continue
            is_leaf = (p[1] >= p[0] - 8) and (p[1] >= p[2] - 5) and (p[1] > 25)
            if not is_leaf:
                continue
            tuck_factor = max(0.0, 1.0 - (gx - 119) / 16.0)
        else:
            tuck_factor = 1.0
            
        if gy < 270:
            d = np.maximum(0, p - bg)
            lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
            if lum > 6.0:
                a = int(np.clip((lum - 6.0) / 70.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                left_rgba[y, x] = [215, 198, 168, a]
        elif gy < 450:
            color_dist = np.linalg.norm(p - bg)
            if color_dist > 18.0:
                a = int(np.clip((color_dist - 18.0) / 50.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                left_rgba[y, x] = [int(p[0]), int(p[1]), int(p[2]), a]
        else:
            if gx > 115:
                continue
            d = np.maximum(0, bg - p)
            lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
            if lum > 5.0:
                a = int(np.clip((lum - 5.0) / 40.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                left_rgba[y, x] = [85, 78, 68, a]

left_im = Image.fromarray(left_rgba).resize((lw * 2, lh * 2), Image.Resampling.LANCZOS)
left_im.save(os.path.join(OUT_DIR, 'desire-left-environment.webp'), 'WEBP', quality=90)

# 4. Right Environment (Contours + Stars + Route + Leaves)
crop_r = arr[175:645, 545:682].copy()
rh, rw = crop_r.shape[:2]
row_bg_r = np.mean(arr[175:645, 676:680], axis=1)

right_rgba = np.zeros((rh, rw, 4), dtype=np.uint8)
for y in range(rh):
    gy = 175 + y
    bg = row_bg_r[y]
    for x in range(rw):
        gx = 545 + x
        p = crop_r[y, x]
        
        if gx <= 564:
            if gy < 390 or gy > 530:
                continue
            is_leaf = (p[1] >= p[0] - 8) and (p[1] >= p[2] - 5) and (p[1] > 25)
            if not is_leaf:
                continue
            tuck_factor = max(0.0, 1.0 - (564 - gx) / 16.0)
        else:
            tuck_factor = 1.0
            
        if gy < 320:
            d = np.maximum(0, p - bg)
            lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
            if lum > 5.0:
                a = int(np.clip((lum - 5.0) / 65.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                right_rgba[y, x] = [215, 198, 168, a]
        elif 390 <= gy <= 530 and gx < 635:
            color_dist = np.linalg.norm(p - bg)
            if color_dist > 16.0:
                a = int(np.clip((color_dist - 16.0) / 50.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                right_rgba[y, x] = [int(p[0]), int(p[1]), int(p[2]), a]
        else:
            if gy < 390:
                d = np.maximum(0, p - bg)
                lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
                if lum > 5.0:
                    a = int(np.clip((lum - 5.0) / 60.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                    right_rgba[y, x] = [215, 198, 168, a]
            else:
                if gx < 566 and gy > 580:
                    continue
                d = np.maximum(0, bg - p)
                lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
                if lum > 4.0:
                    a = int(np.clip((lum - 4.0) / 45.0 * 255.0 * INTENSITY_SCALE * tuck_factor, 0, 255))
                    right_rgba[y, x] = [85, 78, 68, a]

right_im = Image.fromarray(right_rgba).resize((rw * 2, rh * 2), Image.Resampling.LANCZOS)
right_im.save(os.path.join(OUT_DIR, 'desire-right-environment.webp'), 'WEBP', quality=90)

# 5. Bottom Contours
crop_bt = arr[550:680, :].copy()
bth, btw = crop_bt.shape[:2]
bg_cream = np.array([250.0, 247.0, 240.0])

bottom_rgba = np.zeros((bth, btw, 4), dtype=np.uint8)
for y in range(bth):
    gy = 550 + y
    fade = max(0.0, 1.0 - (gy - 550) / 115.0)
    for x in range(btw):
        gx = x
        if 130 < gx < 550 and gy < 615:
            continue
        p = crop_bt[y, x]
        d = np.maximum(0, bg_cream - p)
        lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]
        if lum > 4.0:
            a = int(np.clip((lum - 4.0) / 40.0 * 255.0 * INTENSITY_SCALE * fade * 0.7, 0, 255))
            bottom_rgba[y, x] = [85, 78, 68, a]

bottom_im = Image.fromarray(bottom_rgba).resize((btw * 2, bth * 2), Image.Resampling.LANCZOS)
bottom_im.save(os.path.join(OUT_DIR, 'desire-bottom-contours.webp'), 'WEBP', quality=90)
print('All 5 environmental illustration assets built successfully!')
