#!/usr/bin/env python3
"""글의 「AI 티」를 «센다». 읽지 않고 세기만 하므로 LLM 콜 0회·즉시.

## 왜 세는가
2026-09-07에 대표가 아티팩트를 보고 「글이 AI 티 난다」고 했는데,
humanize-korean의 정량 계측기는 `route_hint=light`(어휘 티 0건)를 냈다.
우리 글엔 번역투·피동이 애초에 없어서다. **우리 티는 어휘가 아니라
«강조하려고 넣는 장치»에서 난다** — 부호로 감싸고, 대시로 잇고, 대구로 닫는 것.
그건 기계가 셀 수 있다.

## 무엇을 세나 (셋만 남았다)
  1. 강조부호 밀도  «» 「」 ‘’ “”  — 쌍 수 / 1,000자
  2. 대시           —  –          — 개수 / 1,000자
  3. 대구           ~가 아니라 ~   — 개수 / 1,000자

## 🚨 버린 지표 둘 — «대표 확정본이 걸려서» 죽었다 (다시 넣지 말 것)
표본: v1(내 초안·걸려야) · v2(스킬 거친 것) · **prod 소개서 확정본 23곳 46,234자**(통과해야).

  ❌ 연결어미 뒤 쉼표(~고, ~면,)  확정본 4.4/1k · v1 4.5/1k — **거의 같다. 판별력 0.**
     humanize-korean 진단은 이걸 z=+3.72로 잡았지만 그건 «블로그» 기준선과 비교한 값이고,
     우리 문체에선 4.4가 정상이었다. 남의 기준선을 우리 글에 대면 멀쩡한 걸 고치게 된다.
  ❌ 같은 종결어미 연속           확정본 13연속 · v1 4연속 — **확정본이 3배 더 걸린다.**
     「문형이 단조롭다」는 «의미» 판단이지 «형식»이 아니다. 코드로 옮기니 정반대를 가리켰다.

⭐교훈 = 새 규칙은 **대표 확정본에 먼저 돌린다. 확정본이 걸리면 규칙이 틀린 것이다.**

## 정답 문형 vs 나쁜 예 (CLAUDE.md가 여기를 가리킨다)
  ⭕ 광고는 보는 사람이 있어야 팔려요. 우리는 사장님 풀은 만들 수 있어도 방문자 풀이 없어요.
  ⛔ 광고는 «보는 사람»이 있어야 팔려요 — 우리가 가진 건 사장님 풀이지 «방문자 풀»이 아니에요.
  같은 뜻인데 아래는 한 문장에 부호 두 쌍 + 대시 + 대구가 겹쳐 있다.

## 쓰는 법
    python3 scripts/prose/count-tells.py <파일…> [--quiet] [--json]
아티팩트 발행 전 자동 실행 = `.claude/settings.json`의 PreToolUse 훅.
⛔이건 «판정»이 아니라 «계기판»이다. 숫자를 보고 고칠지는 사람이 정한다.
"""
import re, sys, html, json, argparse, pathlib

PAIRS = [("«", "»"), ("「", "」"), ("‘", "’"), ("“", "”")]

# 🚦막는 것은 «하나»다. 나머지는 숫자만 보이고 판단은 사람이 한다.
#
# 표본 6종을 라벨 제외 후 다시 재니 이렇게 갈렸다(09-07, 2팀 반증 반영):
#           소개서확정본 46k   파랑브리프확정본   도바생브리프초안   내초안v1   스킬거친v2
#   부호      0.8              2.7               6.1              13.6      3.6
#   대시      0.2              2.1               1.9               2.0      0.0
#   대구      0.3              2.1               0.2               2.5      1.0
#
# ⭕부호만 갈라낸다 — 내 초안이 나머지 전부의 «두 배»다.
# ❌대시·대구는 못 가른다 — 라벨을 빼고 나니 **확정본과 내 초안이 0.1~0.4 차이**다.
#   특히 파랑 브리프 확정본이 대구 2.1로 내 초안(2.5)에 붙는다. 그 글이 파랑님의
#   「A가 아니라 B」 습관을 «다루는» 글이라 예시를 넷 인용해서다. 인용과 장식을
#   기계가 못 가른다 → 그 둘을 막는 자리에 두면 브리프가 통째로 거짓양성이 난다.
# 🚨0.4 차이를 규칙으로 굳히는 건 표본 하나에 임계를 맞추는 것이다. 안 한다.
BLOCKING = {
    "quote_per_1k": (7.0, "강조부호가 잦다. 남의 말 인용과 그 문단의 결론 하나만 남기고 벗겨라"),
}
# 숫자만 보인다. 넘어도 막지 않는다.
REPORT_ONLY = ("dash_per_1k", "contrast_per_1k")

# ⚠️규칙 4(섹션마다 같은 틀 반복)는 «세지 않는다». 내 초안의 진짜 병이 그거였는데
#   (조각 여섯이 전부 「진단 → 훔칠 것」 2단 틀) 형식이 아니라 의미라 코드로 안 옮긴다.
#   그건 눈으로 보거나 `/humanize-korean` 진단 콜이 잡는다.
LIMITS = BLOCKING

# 라벨 «구분자» 대시만 잡는다. 줄머리(- · * · >)나 표 칸(|) 뒤의 짧은 머리말 + 대시.
_LABEL_LINE = re.compile(
    r"(?m)^(\s*(?:[-*>]\s*)?(?:\*\*[^*\n]{1,40}\*\*|[^\s|—][^—\n|]{0,24})\s*)—")
_LABEL_CELL = re.compile(
    r"(\|\s*(?:\*\*[^*\n]{1,40}\*\*|[^\s|—][^—\n|]{0,24})\s*)—")

def strip_labels(text: str) -> str:
    """헤딩과 라벨은 «글»이 아니다. 세는 대상에서 뺀다 (2팀 반증 09-07).

    🩸브리프 대시 29회를 갈라 보니 **헤딩 5 + 라벨·표 16 = 21회가 라벨**이었고
      본문은 8회(1.8/1k, 통과)뿐이었다. 라벨을 세면 브리프·리서치 노트가
      **통째로 거짓양성**이 난다. 규칙 2도 「라벨엔 남긴다」로 이미 열어 둔 자리다.
    ⛔단 «따옴표 안»은 빼지 않는다. 「인용이냐 장식이냐」는 **의미** 판단이라
      코드로 옮기면 틀린다. 숫자는 그대로 보이고 사람이 판단한다.
    """
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s.*$", " ", text)   # 마크다운 헤딩 줄
    text = _LABEL_LINE.sub(r"\1", text)                      # `- **라벨** —` 의 대시
    text = _LABEL_CELL.sub(r"\1", text)                      # `| **라벨** —` 의 대시
    return text

def extract_prose(text: str, path: str = "") -> str:
    """HTML이면 본문만 — style·script·태그·속성값은 글이 아니다."""
    if path.endswith((".html", ".htm")) or re.search(r"<(style|script|div|p)\b", text[:2000]):
        text = re.sub(r"<style\b.*?</style>|<script\b.*?</script>", " ", text, flags=re.S | re.I)
        text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        text = html.unescape(text)
    text = re.sub(r"<!--\s*HUMANIZE-SUMMARY.*?-->", " ", text, flags=re.S)
    text = strip_labels(text)
    return re.sub(r"[ \t]+", " ", text).strip()

def measure(prose: str) -> dict:
    n = max(len(prose), 1)
    k = lambda c: round(c * 1000 / n, 1)
    pairs = sum(min(prose.count(a), prose.count(b)) for a, b in PAIRS)
    dashes = len(re.findall(r"—|–", prose))
    contrast = len(re.findall(r"(?:이|가|은|는|을|를|도)\s*아니라|아니라\s", prose))
    return {"chars": n, "quote_pairs": pairs, "quote_per_1k": k(pairs),
            "dashes": dashes, "dash_per_1k": k(dashes),
            "contrast": contrast, "contrast_per_1k": k(contrast)}

def flags(m: dict) -> list:
    return [f"{k} {m[k]} (기준 {lim}) — {msg}" for k, (lim, msg) in BLOCKING.items() if m[k] > lim]

def main():
    ap = argparse.ArgumentParser(description="글의 AI 티를 센다 (LLM 콜 0회)")
    ap.add_argument("paths", nargs="+")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="걸린 파일만 출력")
    a = ap.parse_args()
    hit = 0
    for p in a.paths:
        try:
            t = pathlib.Path(p).read_text(errors="replace")
        except OSError as e:
            print(f"읽지 못함: {p} ({e})", file=sys.stderr); continue
        m = measure(extract_prose(t, p)); f = flags(m); hit += len(f)
        if a.json:
            print(json.dumps({"path": p, **m, "flags": f}, ensure_ascii=False)); continue
        if a.quiet and not f: continue
        print(f"\n▌{pathlib.Path(p).name}  ({m['chars']}자)")
        print(f"  부호 {m['quote_pairs']}쌍 ({m['quote_per_1k']}/1k) · "
              f"대시 {m['dashes']} ({m['dash_per_1k']}/1k) · 대구 {m['contrast']} ({m['contrast_per_1k']}/1k)")
        for line in f: print(f"  ⚠️ {line}")
        if not f: print("  ✅ 걸린 것 없음")
    return 1 if hit else 0

if __name__ == "__main__":
    sys.exit(main())
