#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""브리프·소개서 초안 안의 «인용»이 원자료에 «축자»로 있는지 센다. LLM 콜 0회.

## 왜 만들었나 (09-13 라파의숲 브리프)
초안에 「숲과 마음을 잇는 안내자 리라 — 상담심리 석사」를 따옴표에 넣어 썼는데,
원문은 「숲과 마음을 잇는 안내자 리라 / -Assumption Uni, Thailand, 상담심리 석사 졸업」이었다.
중간을 빼고 대시로 이어 붙인 것을 «인용»이라고 냈다. 레드팀이 잡았지만, 이건 기계가 먼저 잡을 일이다.
⭐인용은 「출처가 있다」가 아니라 「그 글자 그대로 있다」여야 인용이다.

## 무엇을 하나
  1. 초안(md)에서 인용을 뽑는다 — `> ` 블록, "…" “…” 「…」 '…' 안의 8자 이상.
  2. 원자료(json/jsonl/txt/md/js)의 모든 문자열을 한 덩이로 모은다.
  3. 공백·구두점·따옴표를 지운 뒤 «그대로» 들어 있는지 본다.
     - ✅ 축자   : 통째로 있음
     - 🟡 부분   : 12자 조각의 70% 이상이 있음 → 붙여 쓰거나 잘라 쓴 것. 눈으로 본다
     - ❌ 없음   : 조각도 안 나옴 → 지어냈거나 출처를 안 줬다

## 쓰는 법
  python3 scripts/prose/check-quotes.py <초안.md> <원자료 파일·폴더 ...>
  예) python3 scripts/prose/check-quotes.py _workspace/rapha/brief/04-노션본문.md \
        ~/Desktop/collab5-백업/라파의숲-리서치-0911 _workspace/rapha/items.js

## 실측 (09-13)
  걸려야 하는 표본 02-초안.md → ❌ 1건(지어낸 인용) · 🟡 2건(다른 게시물 두 개를 한 줄로 붙인 것)
  통과해야 하는 표본 04-노션본문.md → ❌ 0건
  ⭐두 표본에 다 돌려서 판별력을 확인했다. 한쪽만 돌린 검사기는 검사기가 아니다.

## 한계
  - 「그 자리에서도 참인가」(맥락)는 못 본다. 축자여도 다른 항목 문장을 옮기면 틀린다(브리프 스킬 §⑥-④).
  - 우리가 쓴 문장(소개서 첫 줄 등)도 인용 꼴이면 잡히니, 그건 items.js 같은 우리 파일을 원자료에 같이 준다.
  - 판정 문형(「저는 ○○님을 "…"으로 보게 됐어요」)은 우리 말이라 그 줄은 건너뛴다.
  - 🟡 100%인데 축자가 아니면 대개 OCR 오독을 내가 고쳐 쓴 것이다(「되되어」→「되뇌어」). 원본 이미지를 열어 확인한다.
"""
import sys, os, re, json

def norm(s):
    s = re.sub(r'[\s​]+', '', s)
    s = re.sub(r'[\"\'“”‘’「」『』«»·•\-–—~/\\|:：,，.。!?！？()\[\]（）…^*_`]', '', s)
    return s

def strings_of(obj, out):
    if isinstance(obj, str): out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values(): strings_of(v, out)
    elif isinstance(obj, list):
        for v in obj: strings_of(v, out)

def load_source(path):
    buf = []
    if os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in files:
                if f.endswith(('.json', '.jsonl', '.txt', '.md', '.js', '.html', '.xml')):
                    buf.append(load_source(os.path.join(root, f)))
        return '\n'.join(buf)
    try:
        raw = open(path, encoding='utf-8', errors='replace').read()
    except Exception:
        return ''
    if path.endswith('.json'):
        try:
            strings_of(json.loads(raw), buf); return '\n'.join(buf)
        except Exception:
            return raw
    if path.endswith('.jsonl'):
        for line in raw.splitlines():
            try: strings_of(json.loads(line), buf)
            except Exception: buf.append(line)
        return '\n'.join(buf)
    return raw

OURS = re.compile(r'보게 됐어요|보게 되었어요|으로 보게|로 읽었어요')   # 판정 문형은 우리 말이다 — 인용이 아니다

def extract_quotes(md):
    q = []
    md = '\n'.join(l for l in md.splitlines() if not OURS.search(l))
    for line in md.splitlines():
        if line.startswith('>'):
            body = line.lstrip('> ').strip()
            body = re.sub(r'^\*\*|\*\*$', '', body)
            if len(norm(body)) >= 8 and not body.startswith('—'):
                q.append(('블록', body))
    for m in re.finditer(r'[“"]([^”"\n]{8,})[”"]', md): q.append(('따옴표', m.group(1)))
    for m in re.finditer(r'「([^」\n]{8,})」', md): q.append(('「」', m.group(1)))
    for m in re.finditer(r"(?<![가-힣A-Za-z])'([^'\n]{8,})'(?![가-힣A-Za-z])", md): q.append(("'", m.group(1)))
    seen = set(); out = []
    for k, t in q:
        n = norm(t)
        if n and n not in seen:
            seen.add(n); out.append((k, t, n))
    return out

def shingle_hit(nq, src, k=12):
    if len(nq) <= k: return 1.0 if nq in src else 0.0
    pieces = [nq[i:i+k] for i in range(0, len(nq)-k+1, max(1, k//2))]
    return sum(1 for p in pieces if p in src) / len(pieces)

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    draft = open(sys.argv[1], encoding='utf-8').read()
    src = norm('\n'.join(load_source(p) for p in sys.argv[2:]))
    quotes = extract_quotes(draft)
    ok = part = miss = 0
    print(f'▌{os.path.basename(sys.argv[1])} — 인용 {len(quotes)}개 · 원자료 {len(src):,}자(정규화)')
    for kind, text, nq in quotes:
        if nq in src:
            ok += 1; continue
        r = shingle_hit(nq, src)
        if r >= 0.7:
            part += 1; print(f'  🟡 부분({r:.0%})  {text[:70]}')
        else:
            miss += 1; print(f'  ❌ 없음({r:.0%})  {text[:70]}')
    print(f'  ✅ 축자 {ok} · 🟡 부분 {part} · ❌ 없음 {miss}')
    sys.exit(1 if miss else 0)

if __name__ == '__main__':
    main()
