"""탭 아이콘 3종을 로고 마크에서 다시 만든다.  `python3 assets/build-icons.py`

  src/app/icon.png      512  원판 (탭·북마크)
  src/app/favicon.ico   16/32/48 원판 (구형 브라우저·윈도우 작업표시줄이 각각 다른 크기를 집는다)
  src/app/apple-icon.png 180 정사각 (iOS 홈 화면)

⚠️왜 배경을 까는가 — 마크를 투명 배경 그대로 두면 **어두운 탭바에서 먹색 궤도가 배경에 묻힌다.**
  흰 판이 배경 대신 대비를 만들어 라이트·다크 양쪽에서 같은 세기로 읽힌다. (대표 지시 08-16)

⚠️판은 흰색이다. 키위 원판도 만들어 봤지만 대표가 흰색을 골랐다(08-16).
  ⭐흰 판이라 **마크를 한 픽셀도 안 고친다** — 초록 점이 그대로 살아 로고와 같은 그림이 된다.
    키위 판이었다면 키위 점이 안 보여 점을 먹색으로 눌러야 했다.
  🎨#FFFFFF 다 — 크림빛(#FBFAF6)은 07-31에 사이트 배경에서 걷어낸 색이라 여기서도 안 쓴다.

⚠️애플 아이콘만 원판이 아니다 — iOS는 투명한 자리를 검게 칠하고 모서리는 제 손으로 깎는다.
  원판을 주면 검은 사각형 위에 뜬 원이 된다.
"""
from PIL import Image, ImageDraw

PAPER = (0xFF, 0xFF, 0xFF)
SRC = "public/logo-mark.png"
PAD = 0.68          # 판 지름 대비 마크 폭. 더 키우면 궤도 끝이 테두리에 붙어 답답해진다


def place(mark, size, pad):
    w = int(size * pad)
    h = round(w * mark.height / mark.width)
    return mark.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2)


mark = Image.open(SRC).convert("RGBA")
mark = mark.crop(mark.getchannel("A").getbbox())   # 여백을 걷어내야 판 안에서 중심이 맞는다

# ── 원판 (탭)
disc = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
ImageDraw.Draw(disc).ellipse([0, 0, 511, 511], fill=(*PAPER, 255))
disc.alpha_composite(*place(mark, 512, PAD))
disc.save("src/app/icon.png")
# ⚠️ICO는 `sizes`에 준 크기들을 **원본에서 각각 줄여** 담는다. 미리 16으로 줄여 넘기면
#   그걸 32·48로 되키운 뭉갠 프레임이 들어간다 — 반드시 512짜리를 그대로 넘길 것.
disc.save("src/app/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# ── 정사각 (iOS)
sq = Image.new("RGBA", (180, 180), (*PAPER, 255))
sq.alpha_composite(*place(mark, 180, 0.62))
sq.save("src/app/apple-icon.png")

print("icon.png 512 · favicon.ico 16/32/48 · apple-icon.png 180")
