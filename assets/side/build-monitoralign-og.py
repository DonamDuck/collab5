# MonitorAlign 공유 카드(OG) 1200x630 두 장(ko/en)을 굽는다.
# 실행: python3 assets/side/build-monitoralign-og.py  (레포 루트에서)
# 폰트 = 사이트와 같은 Pretendard(~/Library/Fonts). 없으면 AppleSDGothicNeo로 대체.
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public/side/monitoralign")
W, H = 1200, 630

def font(weight, size):
    p = os.path.expanduser(f"~/Library/Fonts/Pretendard-{weight}.otf")
    if os.path.exists(p):
        return ImageFont.truetype(p, size)
    return ImageFont.truetype("/System/Library/Fonts/AppleSDGothicNeo.ttc", size, index=6 if weight == "Bold" else 0)

def build(lang, lines, meta):
    # 배경: 아이콘 면(#1a223d)보다 한 단 어두운 남색 세로 그라데이션 → 아이콘 테두리가 읽힌다.
    bg = Image.new("RGB", (W, H))
    top, bot = (16, 21, 40), (8, 11, 22)
    d = ImageDraw.Draw(bg)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    canvas = bg.convert("RGBA")

    icon = Image.open(os.path.join(OUT, "icon.png")).convert("RGBA")
    icon = icon.crop(icon.getbbox())          # 투명 여백 제거(825x825)
    size = 340
    icon = icon.resize((size, size), Image.LANCZOS)
    ix, iy = 96, (H - size) // 2
    # 아이콘 뒤 은은한 빛
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([ix - 40, iy - 40, ix + size + 40, iy + size + 40], fill=(90, 120, 255, 70))
    canvas = Image.alpha_composite(canvas, glow.filter(ImageFilter.GaussianBlur(60)))
    canvas.alpha_composite(icon, (ix, iy))

    d = ImageDraw.Draw(canvas)
    tx = ix + size + 72
    y = 168
    d.text((tx, y), "MonitorAlign", font=font("Bold", 74), fill=(255, 255, 255))
    y += 112
    f = font("Medium", 40)
    for ln in lines:
        d.text((tx, y), ln, font=f, fill=(206, 214, 236))
        y += 56
    y += 22
    d.text((tx, y), meta, font=font("Regular", 28), fill=(140, 151, 184))
    canvas.convert("RGB").save(os.path.join(OUT, f"og-{lang}.png"), optimize=True)

build("ko", ["듀얼 모니터 위치를", "클릭 두 번으로 맞춰요"], "macOS · Windows · 무료")
build("en", ["Fix your dual-monitor", "layout in two clicks"], "Free for macOS & Windows")
print("ok")
