# MonitorAlign 공유 카드(OG) 1200x630 — 언어마다 한 장(og-<언어>.png, 아홉 장)을 굽는다.
# 실행: python3 assets/sideproject/build-monitoralign-og.py          (레포 루트에서, 전부)
#       python3 assets/sideproject/build-monitoralign-og.py ja de    (고른 언어만)
# 언어 목록은 src/app/sideproject/monitoralign/langs.ts와 같아야 한다(페이지 메타데이터가 og-<언어>.png를 찾는다).
#
# 글꼴 — 글자마다 그 문자를 그리는 글꼴이 따로 필요하다(없으면 두부 □로 나온다).
#   한글·라틴 = 사이트와 같은 Pretendard(~/Library/Fonts). 없으면 AppleSDGothicNeo로 대체.
#   일본어 = ヒラギノ角ゴシック(macOS 기본) · 간체 = PingFang SC · 번체 = PingFang TC.
#   PingFang.ttc는 macOS 버전마다 안의 순서가 달라서 번호가 아니라 이름으로 찾는다.
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "public/sideproject/monitoralign")
W, H = 1200, 630
SYS = "/System/Library/Fonts"


def pretendard(weight, size):
    p = os.path.expanduser(f"~/Library/Fonts/Pretendard-{weight}.otf")
    if os.path.exists(p):
        return ImageFont.truetype(p, size)
    return ImageFont.truetype(f"{SYS}/AppleSDGothicNeo.ttc", size, index=6 if weight == "Bold" else 0)


def hiragino(weight, size):
    w = {"Bold": 6, "Medium": 5, "Regular": 4}[weight]
    return ImageFont.truetype(f"{SYS}/ヒラギノ角ゴシック W{w}.ttc", size)


def pingfang(family, weight, size):
    style = {"Bold": "Semibold", "Medium": "Medium", "Regular": "Regular"}[weight]
    path = f"{SYS}/PingFang.ttc"
    for i in range(40):
        try:
            f = ImageFont.truetype(path, size, index=i)
        except OSError:
            break
        if f.getname() == (family, style):
            return f
    raise SystemExit(f"PingFang {family} {style} 글꼴을 찾지 못했다")


FONTS = {
    "latin": pretendard,
    "ja": hiragino,
    "zh-Hans": lambda w, s: pingfang("PingFang SC", w, s),
    "zh-Hant": lambda w, s: pingfang("PingFang TC", w, s),
}

# 언어 → (글꼴 계열, 두 줄 한마디, 아래 작은 줄). 한·영은 10-07에 대표가 본 그대로 둔다.
CARDS = {
    "ko": ("latin", ["듀얼 모니터 위치를", "클릭 두 번으로 맞춰요"], "macOS · Windows · 무료"),
    "en": ("latin", ["Fix your dual-monitor", "layout in two clicks"], "Free for macOS & Windows"),
    "ja": ("ja", ["デュアルモニターの配置を", "クリック2回で合わせる"], "macOS · Windows · 無料"),
    "zh-cn": ("zh-Hans", ["双显示器的排列", "点两下就对齐"], "macOS · Windows · 免费"),
    "zh-tw": ("zh-Hant", ["雙螢幕的排列", "點兩下就對齊"], "macOS · Windows · 免費"),
    "es": ("latin", ["Alinea tus dos monitores", "en dos clics"], "Gratis para macOS y Windows"),
    "de": ("latin", ["Zwei Monitore mit", "zwei Klicks anordnen"], "Kostenlos für macOS & Windows"),
    "fr": ("latin", ["Alignez vos deux écrans", "en deux clics"], "Gratuit pour macOS et Windows"),
    "pt-br": ("latin", ["Organize seus dois monitores", "em dois cliques"], "Grátis para macOS e Windows"),
}


def build(lang, family, lines, meta):
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
    max_w = W - tx - 48                       # 오른쪽 여백 48px 안에 들어와야 한다
    y = 168
    d.text((tx, y), "MonitorAlign", font=pretendard("Bold", 74), fill=(255, 255, 255))
    y += 112
    pick = FONTS[family]
    # 긴 언어(포르투갈어 등)가 넘치면 넘치지 않을 때까지 한마디 글자만 줄인다.
    fs = 40
    while max(d.textlength(ln, font=pick("Medium", fs)) for ln in lines) > max_w:
        fs -= 1
    f = pick("Medium", fs)
    for ln in lines:
        d.text((tx, y), ln, font=f, fill=(206, 214, 236))
        y += round(fs * 1.4)
    y += 22
    mf = pick("Regular", 28)
    assert d.textlength(meta, font=mf) <= max_w, f"{lang}: 아래 줄이 넘친다"
    d.text((tx, y), meta, font=mf, fill=(140, 151, 184))
    canvas.convert("RGB").save(os.path.join(OUT, f"og-{lang}.png"), optimize=True)
    return fs


targets = sys.argv[1:] or list(CARDS)
for lang in targets:
    family, lines, meta = CARDS[lang]
    fs = build(lang, family, lines, meta)
    print(f"og-{lang}.png  (한마디 {fs}px)")
