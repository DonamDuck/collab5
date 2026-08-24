// 사진 폴더링 검증 — 대표 지시 08-24
// 🪤과거에 「잘못 들어가기도, 안 들어가기도」 했다. 받았다고 끝이 아니다.
// 쓰는 법: node verify-photos.mjs "<브랜드 폴더 경로>" [urls.tsv] [폴더맵.json]
import fs from 'fs'; import path from 'path';
const BASE = process.argv[2] || (() => { throw new Error('브랜드 폴더 경로를 인자로 주세요'); })();
const { map } = JSON.parse(fs.readFileSync(process.argv[4] || '사진-폴더맵.json', 'utf8'));
// ⚠️수확을 여러 번 나눠 했으면 tsv를 «합쳐서» 넘겨라 — 한 파일만 대면 개수가 틀리게 나온다
// 🪤`cat a b > c`는 a의 마지막 줄에 개행이 없으면 «두 줄을 한 줄로 붙인다». `{ cat a; echo; cat b; }`로 합칠 것
// 🪤같은 게시물이 두 계정에 걸린 콜라보 글은 양쪽 tsv에 다 들어온다 → «코드+장번호»로 중복을 지운다
const raw = fs.readFileSync(process.argv[3] || '사진-urls-전체.tsv', 'utf8').trim().split('\n')
  .map(l => l.split('\t'));
const 깨진줄 = raw.filter(r => r.length !== 4).length;
if (깨진줄) console.log(`🚨 tsv에 칸이 4개가 아닌 줄이 ${깨진줄}개 — 이어붙일 때 개행이 빠졌을 수 있다`);
const seenRow = new Set();
const rows = raw.filter(r => r.length === 4).filter(r => {
  const k = r[0] + '_' + r[1]; if (seenRow.has(k)) return false; seenRow.add(k); return true;
});
if (seenRow.size !== raw.filter(r => r.length === 4).length)
  console.log(`ℹ️ 두 계정에 걸린 중복 ${raw.filter(r => r.length === 4).length - seenRow.size}줄은 한 번만 셈`);

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
// 수확본만 센다 — 대표가 직접 넣은 브랜드 사진은 대상이 아니다(파일명이 {날짜}_{코드}_{NN} 꼴이 아님)
const files = walk(BASE).filter(f => /\d{4}-\d{2}-\d{2}_.+_\d{2}\.jpg$/.test(path.basename(f)));
const 직접넣은 = walk(BASE).filter(f => f.endsWith('.jpg')).length - files.length;
if (직접넣은) console.log(`ℹ️ 대표가 직접 넣은 사진 ${직접넣은}장은 검증에서 제외`);

let bad = 0;
const say = (t, m) => { console.log(`${t} ${m}`); if (t === '🚨') bad++; };

// ① 개수
say(files.length === rows.length ? '✅' : '🚨',
    `개수  받아야 할 ${rows.length}장 / 실제 ${files.length}장`);

// ② 진짜 JPEG인가 (에러 페이지가 .jpg로 저장되는 일이 있다)
const notJpg = [], tiny = [];
for (const f of files) {
  const b = Buffer.alloc(3);
  const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 3, 0); fs.closeSync(fd);
  if (!(b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF)) notJpg.push(f);
  if (fs.statSync(f).size < 5000) tiny.push(f);
}
say(notJpg.length ? '🚨' : '✅', `형식  JPEG 아님 ${notJpg.length}장`);
say(tiny.length ? '🚨' : '✅', `크기  5KB 미만(깨졌을 가능성) ${tiny.length}장`);

// ③ 폴더가 맞나 — 파일명의 shortcode가 그 폴더에 배정된 코드인가
const wrong = [];
for (const f of files) {
  const folder = path.basename(path.dirname(f));
  // 🪤인스타 shortcode엔 «_»가 들어간다(DCyFLXip_jG). split('_')[1]로 자르면 코드가 깨진다.
  //    파일명 = {YYYY-MM-DD}_{code}_{NN}.jpg → 앞 11자와 뒤 7자를 떼어낸다.
  const base = path.basename(f, '.jpg');
  const code = base.slice(11, base.length - 3);
  const want = map[code] || null;
  if (want) { if (folder !== want) wrong.push(`${path.basename(f)} → ${folder} (맞는 곳: ${want})`); }
  // _로 시작하는 칸(_기타·_브랜드사진 후보)과 그 «하위 폴더», 브랜드 폴더 바로 아래는 항목 폴더가 아니다
  // 🪤_기타/{날짜}_{코드}/ 처럼 한 겹 더 들어가므로 «잎 이름」만 보면 안 되고 BASE 아래 «경로 전체»를 봐야 한다
  else if (!path.relative(BASE, path.dirname(f)).split(path.sep).some(seg => seg.startsWith('_'))
           && path.dirname(f) !== BASE) wrong.push(`${path.basename(f)} → ${folder} (항목 배정 없음인데 항목 폴더에 있음)`);
}
say(wrong.length ? '🚨' : '✅', `배치  잘못 들어간 파일 ${wrong.length}장`);
wrong.slice(0, 8).forEach(w => console.log('     ' + w));

// ④ 누락 — TSV에 있는데 파일이 없는 것
const have = new Set(files.map(f => path.basename(f)));
const missing = rows.filter(([c, i, d]) => !have.has(`${d}_${c}_${i}.jpg`));
say(missing.length ? '🚨' : '✅', `누락  안 받아진 것 ${missing.length}장`);
missing.slice(0, 8).forEach(m => console.log(`     ${m[2]}_${m[0]}_${m[1]}`));

// ⑤ 항목 폴더가 비어 있지 않나
const empty = Object.values(map).filter(v => {
  const d = path.join(BASE, v);
  return !fs.existsSync(d) || fs.readdirSync(d).filter(x => x.endsWith('.jpg')).length === 0;
});
say(empty.length ? '⚠️' : '✅', `빈 폴더  ${empty.length}개`);
empty.forEach(e => console.log('     ' + e));

console.log(`\n${bad ? '🚨 실패 ' + bad + '건 — 고치기 전엔 끝난 게 아니다' : '✅ 전부 통과'}`);
