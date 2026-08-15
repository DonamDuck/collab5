"""collab5 새 로고 자산 생성기.
원본은 젠스파크 AI 래스터(획 굵기 들쭉날쭉·끊긴 데 있음) — 형상만 수치 피팅으로 가져오고
실제 파일은 이상적인 대칭 도형으로 새로 그린다. IoU 0.938로 맞춘 값:
  rx=70.78 ry=23.97 θ=35.25° 획=8.45 초록r=14.27  (잉크 높이 100 기준)
"""
import math
from fontTools.ttLib import TTFont, TTCollection
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen

RX, RY, TH, SW, GR = 70.78, 23.97, 35.25, 8.45, 14.27
PAD = 0.5
INK   = "#111111"
GREEN = "#98FF5C"        # 사이트 브랜드 토큰(--primary). 원본 AI 이미지는 #69D743이었다.

def mark_box():
    t = math.radians(TH)
    hw = math.hypot(RX*math.cos(t), RY*math.sin(t)) + SW/2
    hh = math.hypot(RX*math.sin(t), RY*math.cos(t)) + SW/2
    return hw*2, hh*2

def mark_body(cx, cy, ink=INK, green=GREEN, k=1.0):
    """중심 (cx,cy), 배율 k 로 마크를 그린다."""
    rx, ry, sw, gr = RX*k, RY*k, SW*k, GR*k
    return (
f'  <g fill="none" stroke="{ink}" stroke-width="{sw:.2f}">\n'
f'    <ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" transform="rotate({TH} {cx:.2f} {cy:.2f})"/>\n'
f'    <ellipse cx="{cx:.2f}" cy="{cy:.2f}" rx="{rx:.2f}" ry="{ry:.2f}" transform="rotate({-TH} {cx:.2f} {cy:.2f})"/>\n'
f'  </g>\n'
f'  <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{gr:.2f}" fill="{green}"/>')

def mark_svg(ink=INK, green=GREEN):
    w, h = mark_box()
    W, H = w+2*PAD, h+2*PAD
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" '
            f'width="{W:.2f}" height="{H:.2f}" role="img" aria-label="collab5">\n'
            + mark_body(W/2, H/2, ink, green) + '\n</svg>\n')

def square_icon(ink=INK, green=GREEN, side=100, inset=0.80, bg=None):
    """정사각(파비콘·앱아이콘). 마크 폭이 side*inset이 되게 맞춘다."""
    w, h = mark_box()
    k = side*inset/w
    body = mark_body(side/2, side/2, ink, green, k)
    rect = f'  <rect width="{side}" height="{side}" fill="{bg}"/>\n' if bg else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {side} {side}" '
            f'width="{side}" height="{side}" role="img" aria-label="collab5">\n{rect}{body}\n</svg>\n')

# ---------- 워드마크 ----------
def glyphs(fontpath, idx=0, size=100.0, track=0.0, text="collab5"):
    f = TTCollection(fontpath).fonts[idx] if fontpath.endswith(".ttc") else TTFont(fontpath)
    upm = f["head"].unitsPerEm; gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f["hmtx"]
    s = size/upm
    out=[]; x=0.0; X0=X1=Y0=Y1=None
    for ch in text:
        g = cmap[ord(ch)]
        p = SVGPathPen(gs, ntos=lambda v: f"{v:.1f}"); gs[g].draw(p); d = p.getCommands()
        bp = BoundsPen(gs); gs[g].draw(bp)
        if bp.bounds:
            bx0,by0,bx1,by1 = [v*s for v in bp.bounds]
            X0 = bx0+x if X0 is None else min(X0,bx0+x); X1 = bx1+x if X1 is None else max(X1,bx1+x)
            Y0 = by0    if Y0 is None else min(Y0,by0);   Y1 = by1    if Y1 is None else max(Y1,by1)
        if d: out.append((d,x))
        x += hmtx[g][0]*s + track
    return out, X0, X1, Y0, Y1, s

def lockup_svg(fontpath, idx=0, track=0.0, ink=INK, green=GREEN,
               mark_ratio=1.082, gap_ratio=0.43):
    """원본 가로형 비례: 마크 높이 = 워드마크 어센더 높이 × 1.082, 간격 = 마크 높이 × 0.43"""
    gl, X0, X1, Y0, Y1, s = glyphs(fontpath, idx, 100.0, track)
    wW, wH = X1-X0, Y1-Y0                       # 워드마크 잉크
    mw, mh = mark_box()
    k = (wH*mark_ratio)/mh                      # 마크 배율
    MW, MH = mw*k, mh*k
    gap = MH*gap_ratio
    H = max(MH, wH) + 2*PAD
    cy = H/2
    mcx = PAD + MW/2
    wx0 = PAD + MW + gap
    base = cy + wH/2 - Y1*1.0 + Y1  # 아래에서 다시 계산
    # 워드마크 잉크의 세로 중앙을 cy에 맞춘다 → 베이스라인 y
    baseline = cy + (Y1-Y0)/2 - (0 - Y0)        # y축 뒤집힘 고려: 잉크 top=Y1, bottom=Y0(폰트좌표)
    baseline = cy + wH/2 + Y0                   # Y0는 보통 음수(오버슛)
    W = wx0 + wW + PAD
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.2f} {H:.2f}" '
             f'width="{W:.2f}" height="{H:.2f}" role="img" aria-label="collab5">',
             mark_body(mcx, cy, ink, green, k), f'  <g fill="{ink}">']
    for d,gx in gl:
        parts.append(f'    <path transform="translate({wx0-X0+gx:.2f} {baseline:.2f}) '
                     f'scale({s:.6f} {-s:.6f})" d="{d}"/>')
    parts += ['  </g>', '</svg>', '']
    return "\n".join(parts), dict(W=W,H=H,markW=MW,markH=MH,wordW=wW,wordH=wH,gap=gap)

# ─────────────────────────────────────────────────────────────────────────────
# 사용법 (2026-08-16 로고 교체 때 만든 정본 생성기)
#
#   python3 assets/build-logo.py            # 아래 main()이 자산 전체를 다시 굽는다
#
# 이 파일이 로고의 **정본**이다. SVG를 손으로 고치지 말고 위쪽 상수를 고친 뒤 다시 돌릴 것.
#   RX/RY/TH/SW/GR : 마크 형상. 대표 지정 시안(젠스파크 AI 래스터)에 IoU 0.938로 피팅한 값.
#                    원본은 획이 들쭉날쭉하고 끊긴 데가 있어 형상만 가져오고 대칭·균일획으로 새로 그렸다.
#   GREEN          : 사이트 브랜드 토큰(--primary)과 같은 값을 쓴다. 원본 이미지는 #69D743이었지만
#                    로고만 다른 초록을 쓰면 버튼·칩과 어긋나므로 토큰에 맞췄다.
#
# 🚨 앱 안에 **인라인으로 박힌 아톰이 4곳** 있다(EmptyState · ReportSheet · EnrichWizard ·
#    c/[slug] 풋터). 여기 상수를 바꾸면 그 4곳의 좌표도 같이 고쳐야 한다 —
#    정본 좌표는 `viewBox="0 0 128.32 100.05"` / cx=64.16 cy=50.03 / rx=70.78 ry=23.97 /
#    strokeWidth=8.45 / 초록 r=14.27 / rotate(±35.25).
#
# 🪤 favicon.ico는 ICO 안의 PNG가 **RGBA여야** 한다. RGB로 넣으면 Next(Rust 디코더)가
#    "The PNG is not in RGBA format!"로 죽고 **전 페이지가 500**이 난다(08-16에 실제로 겪음).
#    PIL로 직접 패킹하지 말고 `magick a.png b.png ... favicon.ico`를 쓸 것.
