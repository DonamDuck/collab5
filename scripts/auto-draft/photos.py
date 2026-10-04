#!/usr/bin/env python3
"""자동 초안 사진 준비 (10-04, 캔가·돌돌성 시험에서 일반화).

  photos.py prep  <작업폴더> <draft.json> <media.json>   # 항목별 게시물 사진 받기 → OCR → 항목별 시트 + 프로필 후보 풀 시트
  photos.py build <작업폴더> <draft.json> <slug>          # picks.json + profile-picks.json → public/_auto-draft/<slug>/ + photos-local.json

media.json = {code: {owner?, imgs:[{v, u}], ...}} (인스타 media info 또는 그리드 수확).
규칙(대표 10-04 확정 후보): 항목 4~5장(포스터 → 현장 → 사람 → 재미) · 프로필 = 로고 1 + 항목 사진 중 6(콜라보 단체 사진 1~2) + 항목 밖 3.
"""
import json, os, re, sys, subprocess, shutil, urllib.request, concurrent.futures as cf
from PIL import Image, ImageDraw, ImageFont

OCR = '/Users/youngduck/Desktop/collab5-team2/scripts/ocr/ocr-text'
FONT = ImageFont.truetype('/System/Library/Fonts/AppleSDGothicNeo.ttc', 18)

def dl(job):
    f, u = job
    if os.path.exists(f) or not u: return
    try:
        raw = urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30).read()
        tmp = f + '.tmp'; open(tmp, 'wb').write(raw)
        im = Image.open(tmp).convert('RGB'); im.thumbnail((1000, 1000)); im.save(f, 'JPEG', quality=78); os.remove(tmp)
    except Exception as e:
        print('fail', f, e)

def sheet(path, files, labels, P):
    if not files: return
    S, C = 170, 10; rows = (len(files) + C - 1) // C
    im = Image.new('RGB', (C * S, rows * (S + 44)), 'white'); d = ImageDraw.Draw(im)
    for k, (f, lab) in enumerate(zip(files, labels)):
        x, y = (k % C) * S, (k // C) * (S + 44)
        try:
            t = Image.open(P + 'img/' + f); t.thumbnail((S - 6, S - 6)); im.paste(t, (x + 3, y + 3))
        except Exception: pass
        d.text((x + 4, y + S - 2), lab[0], fill='red' if lab[1] else 'black', font=FONT)
        if len(lab) > 2: d.text((x + 4, y + S + 18), lab[2][:9], fill='gray', font=FONT)
    im.save(path, quality=80)

def prep(W, draft, media):
    P = W.rstrip('/') + '/photos/'; os.makedirs(P + 'img', exist_ok=True); os.makedirs(P + 'sheets', exist_ok=True); os.makedirs(P + 'pool', exist_ok=True)
    d = json.load(open(draft)); m = json.load(open(media))
    items = [('A', a['title'], a) for a in d['activities']] + [('C', c['partner'], c) for c in d['collab_history']]
    per = d.get('photo_posts', {}).get('per_item', {})
    plan = []
    for k, t, it in items:
        cs = list(per.get(t, []))
        mm = re.search(r'/p/([^/]+)/', it.get('link', '') or '')
        if mm and mm.group(1) not in cs: cs.insert(0, mm.group(1))
        plan.append((k, t, [c for c in cs if c in m]))
    jobs = []
    allcodes = set(c for _, _, cs in plan for c in cs) | set(d.get('photo_posts', {}).get('profile', []))
    # 프로필 «항목 밖» 풀 = 최근 120개 게시물(본인 것) — 전량은 너무 크다
    recent = sorted((v for v in m.values() if v.get('owner', 'self') in ('self',) or True), key=lambda v: -v.get('t', 0))[:120]
    extra = [v['c'] if 'c' in v else None for v in recent]
    codes = allcodes | set(c for c in extra if c)
    for c in codes:
        for i, im in enumerate(m[c]['imgs']):
            if not im.get('v'): jobs.append((f"{P}img/{c}_{i:02d}.jpg", im.get('u')))
    with cf.ThreadPoolExecutor(8) as ex: list(ex.map(dl, jobs))
    have = sorted(f for f in os.listdir(P + 'img') if f.endswith('.jpg'))
    ocr = json.load(open(P + 'ocr.json')) if os.path.exists(P + 'ocr.json') else {}
    for f in have:
        if f in ocr: continue
        try: ocr[f] = len(re.findall(r'[가-힣]', subprocess.run([OCR, P + 'img/' + f], capture_output=True, text=True, timeout=30).stdout))
        except Exception: ocr[f] = 0
    json.dump(ocr, open(P + 'ocr.json', 'w'))
    index = {}
    for n, (k, t, cs) in enumerate(plan, 1):
        fl = [f for c in cs for f in have if f.rsplit('_', 1)[0] == c]
        key = f"{n:02d}-{k}"; index[key] = {'title': t, 'files': fl}
        sheet(f"{P}sheets/{key}.jpg", fl, [(f"{i+1} h{ocr.get(f,0)}", ocr.get(f, 0) >= 40) for i, f in enumerate(fl)], P)
    json.dump(index, open(P + 'sheets/index.json', 'w'), ensure_ascii=False, indent=1)
    used = set(f for v in index.values() for f in v['files'])
    rest = [f for f in have if f not in used]
    json.dump(rest, open(P + 'pool/rest.json', 'w'))
    for s in range(0, len(rest), 90):
        sheet(f"{P}pool/rest-{s//90+1}.jpg", rest[s:s+90], [(str(s + i + 1), False) for i in range(len(rest[s:s+90]))], P)
    print('items', len(index), 'imgs', len(have), 'rest', len(rest))

def build(W, draft, slug):
    P = W.rstrip('/') + '/photos/'; PUB = f'/Users/youngduck/Desktop/collab5-team2/public/_auto-draft/{slug}/'; os.makedirs(PUB, exist_ok=True)
    idx = json.load(open(P + 'sheets/index.json')); picks = json.load(open(P + 'picks.json'))
    def urls(key):
        out = []
        for n in picks.get(key, []):
            f = idx[key]['files'][n - 1]; shutil.copy(P + 'img/' + f, PUB + f); out.append(f'/_auto-draft/{slug}/' + f)
        return out
    acts, cols = [], []
    for k in sorted(idx): (acts if k.endswith('-A') else cols).append(urls(k))
    prof = []
    if os.path.exists(P + 'profile.json'):
        for f in json.load(open(P + 'profile.json')):
            shutil.copy(P + 'img/' + f, PUB + f); prof.append(f'/_auto-draft/{slug}/' + f)
    json.dump({'profile': prof, 'activities': acts, 'collabs': cols}, open(P + 'photos-local.json', 'w'), ensure_ascii=False, indent=1)
    print('profile', len(prof), 'acts', sum(map(len, acts)), 'cols', sum(map(len, cols)))

if __name__ == '__main__':
    a = sys.argv[1:]
    if a and a[0] == 'prep': prep(a[1], a[2], a[3])
    elif a and a[0] == 'build': build(a[1], a[2], a[3])
    else: sys.exit(__doc__)
