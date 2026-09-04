"""링크 미리보기 썸네일을 워드마크에서 다시 만든다.  `python3 assets/build-og.py`

  public/og-image.png   1200×630  흰 바탕 + 워드마크만

⚠️**여기서 쓰는 그림은 홈 헤더와 «같은 파일»이다**(`public/logo-wordmark.png`).
  09-04에 갈아 끼운 이유가 그거다 — 그 전 og는 옛 아톰 로고(마크+글자)라
  카톡에서 홈 헤더와 다른 로고가 떴다(대표 발견).

⚠️크기를 620px로 잡은 이유 — 워드마크만 놓으면 마크가 없어 가로가 짧다.
  560은 허전하고 700은 좌우 여백이 답답하다. 세 후보를 구워 대표가 620을 골랐다.

🚨**줄이든 키우든 브랜드색은 밀린다.** 581→620은 6.7% 확대뿐인데도 먹색이
  #111111 → #131313 으로 굳었다. 눈엔 안 보이고 **스포이드에는 찍힌다.**
  → `snap()`으로 되돌린다(`build-icons.py`와 같은 처방).

📌그림을 갈면 **`src/lib/site.ts`의 `OG_IMAGE` 뒤 `?v=`도 같이 올려라.**
  카톡·페북은 이미지를 URL 단위로 캐시해서 파일만 갈면 옛 그림이 계속 나간다.
"""
from PIL import Image

PAPER = (0xFF, 0xFF, 0xFF)
INK = (0x11, 0x11, 0x11)
KIWI = (0x98, 0xFF, 0x5C)
SRC = "public/logo-wordmark.png"
OUT = "public/og-image.png"
W, H = 1200, 630
MARK_W = 620        # 워드마크 가로. 대표 선택(09-04) — 후보는 560·620·700


def snap(img, to, tol=6):
    """1~2씩 밀린 브랜드색을 정확값으로 되돌린다.

    ⚠️가장자리 그라데이션은 tol 밖이라 안 건드린다(건드리면 계단이 생긴다).
    """
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if max(abs(a - b) for a, b in zip(c[:3], to)) <= tol:
                px[x, y] = (*to, *c[3:])


mark = Image.open(SRC).convert("RGBA")
mark_h = round(MARK_W * mark.height / mark.width)
mark = mark.resize((MARK_W, mark_h), Image.LANCZOS)

canvas = Image.new("RGB", (W, H), PAPER)
canvas.paste(mark, ((W - MARK_W) // 2, (H - mark_h) // 2), mark)
snap(canvas, INK)
snap(canvas, KIWI)
canvas.save(OUT)

print(f"{OUT} {W}×{H} · 워드마크 {MARK_W}×{mark_h} · 먹색·키위 스냅 완료")
