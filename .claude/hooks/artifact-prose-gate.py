#!/usr/bin/env python3
"""아티팩트를 발행하기 «전»에 글의 AI 티를 센다 (LLM 콜 0회).

왜 훅인가 — 대표가 2026-09-07에 「아티팩트 글이 AI 티 난다」고 했다.
규칙을 CLAUDE.md에 적어도 프롬프트는 확률적이라 샌다(humanize-korean 설계 노트도
같은 말을 한다). 그래서 «발행 직전»에 기계가 한 번 센다.

계약: PreToolUse 훅. stdin으로 {tool_name, tool_input} JSON을 받는다.
  exit 0 → 통과 (조용히)
  exit 2 → 막고 stderr를 Claude에게 돌려준다 → 고쳐서 다시 발행하면 된다

⛔판정이 아니라 계기판이다. 기준은 `scripts/prose/count-tells.py`의 표본 검증에서 나왔고,
   대표 확정본 소개서 46,234자가 통과하는 선이다.
"""
import json, sys, pathlib, subprocess

def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0                                   # 입력을 못 읽으면 막지 않는다
    if payload.get("tool_name") != "Artifact":
        return 0
    ti = payload.get("tool_input") or {}
    if ti.get("action") not in (None, "", "publish"):
        return 0                                   # 읽기·목록 등은 대상 아님
    fp = ti.get("file_path")
    if not fp or not str(fp).endswith((".html", ".htm", ".md")):
        return 0

    root = pathlib.Path(__file__).resolve().parents[2]
    counter = root / "scripts" / "prose" / "count-tells.py"
    if not counter.exists() or not pathlib.Path(fp).exists():
        return 0                                   # 도구가 없다고 발행을 막지 않는다

    try:
        r = subprocess.run([sys.executable, str(counter), "--json", fp],
                           capture_output=True, text=True, timeout=20)
        line = next((l for l in r.stdout.splitlines() if l.strip().startswith("{")), None)
        res = json.loads(line) if line else None
    except Exception:
        return 0
    if not res or not res.get("flags"):
        return 0

    print(
        "발행 전 글 검사 — 아래가 걸렸습니다. 고치고 다시 발행하세요.\n\n"
        + "\n".join(f"  · {f}" for f in res["flags"])
        + f"\n\n  (본문 {res['chars']}자 · 부호 {res['quote_pairs']}쌍 · 대시 {res['dashes']} · 대구 {res['contrast']})\n"
          "  기준은 대표 확정본 소개서 46,234자가 통과하는 선입니다.\n"
          "  직접 세보려면: python3 scripts/prose/count-tells.py " + fp + "\n"
          "  고칠 게 없다고 판단하면 대표에게 숫자를 보이고 그대로 갈지 물어보세요.",
        file=sys.stderr)
    return 2

if __name__ == "__main__":
    sys.exit(main())
