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
KIWI = (0x98, 0xFF, 0x5C)
SRC = "public/logo-mark.png"
PAD = 0.68          # 판 지름 대비 마크 폭. 더 키우면 궤도 끝이 테두리에 붙어 답답해진다


def snap(img, to, tol=6):
    """1~2씩 밀린 브랜드색을 정확값으로 되돌린다.

    ⚠️눈에는 안 보이지만 **스포이드에는 찍힌다** — 초록 점이 #97FF5D 로 굳어 있었다(08-16).
      가장자리 그라데이션은 tol 밖이라 안 건드린다(건드리면 계단이 생긴다).

    🪤반드시 **합성이 끝난 뒤에** 부를 것. 두 번 밀리기 때문이다 —
      ① 마크를 판 크기에 맞춰 줄일 때 리샘플 링잉으로 한 번,
      ② 원본 마크의 초록 알파가 255가 아니라 **254**여서, 흰 판에 얹히며 흰색이 1 섞여 또 한 번.
      줄인 직후에만 맞추면 ②가 그대로 남는다.
    """
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a > 200 and sum(abs(c - t) for c, t in zip((r, g, b), to)) <= tol:
                px[x, y] = (*to, a)
    return img


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
snap(disc, KIWI)
disc.save("src/app/icon.png")
# ⚠️ICO는 `sizes`에 준 크기들을 **원본에서 각각 줄여** 담는다. 미리 16으로 줄여 넘기면
#   그걸 32·48로 되키운 뭉갠 프레임이 들어간다 — 반드시 512짜리를 그대로 넘길 것.
disc.save("src/app/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])

# ── 정사각 (iOS)
sq = Image.new("RGBA", (180, 180), (*PAPER, 255))
sq.alpha_composite(*place(mark, 180, 0.62))
snap(sq, KIWI)
sq.save("src/app/apple-icon.png")

print("icon.png 512 · favicon.ico 16/32/48 · apple-icon.png 180")
