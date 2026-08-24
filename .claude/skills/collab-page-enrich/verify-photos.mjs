// 사진 폴더링 검증 — 대표 지시 08-24
// 🪤과거에 「잘못 들어가기도, 안 들어가기도」 했다. 받았다고 끝이 아니다.
import fs from 'fs'; import path from 'path';
const BASE = '/Users/youngduck/Desktop/collab5/업체사진정리/나를위한커리어-방혜리';
const { map } = JSON.parse(fs.readFileSync('사진-폴더맵.json', 'utf8'));
const rows = fs.readFileSync('사진-urls.tsv', 'utf8').trim().split('\n').map(l => l.split('\t'));

const walk = d => fs.readdirSync(d, { withFileTypes: true })
  .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(BASE).filter(f => f.endsWith('.jpg'));

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
  else if (!path.dirname(f).includes('_기타')) wrong.push(`${path.basename(f)} → ${folder} (항목 배정 없음인데 항목 폴더에 있음)`);
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
