// 인스타 사진 저장기 — 클립보드의 이미지 URL들을 "폴더만 고르면" 한 번에 내려받는다.
//
//   npx tsx scripts/ig-save.ts               # 폴더 선택 화면 → 저장
//   npx tsx scripts/ig-save.ts 두더지요가원     # 폴더를 알면 바로
//   npx tsx scripts/ig-save.ts --bookmarklet  # 북마클릿 한 줄 출력(최초 1회 설치)
//
// 흐름: [인스타 게시물에서 북마클릿 클릭 → URL 전부 클립보드] → [이 스크립트 → 폴더 고르면 끝]
// 파일명은 붙이지 않는다(대표가 매번 다르게 씀) — `1.jpg, 2.jpg…`로 떨어뜨리고,
// 폴더에 이미 번호가 있으면 이어서 매긴다. 이름은 Finder에서 한 번에 바꾸는 게 빠르다.
import { mkdir, readdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..", "업체사진정리");

/** 북마클릿 소스를 javascript: 한 줄로 — 주석·개행을 걷어낸 뒤 URL 인코딩 */
async function printBookmarklet(): Promise<void> {
  const src = await readFile(path.resolve(import.meta.dirname, "ig-bookmarklet.js"), "utf8");
  // ⚠️ 줄 **끝**의 주석까지 반드시 걷어내야 한다 — 한 줄로 합치는 순간 그 뒤 코드가
  //    전부 주석이 되어 북마클릿이 조용히 죽는다(따옴표 안의 //는 없다고 전제).
  const body = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .filter((l) => l.trim())
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
  // 문법이 깨지지 않았는지 확인 후에만 출력(깨진 한 줄을 붙여넣게 두지 않는다)
  new Function(body);
  console.log("\n아래 한 줄을 크롬 북마크의 URL 칸에 붙여넣으세요 (이름: 인스타 사진 긁기)\n");
  console.log("javascript:" + encodeURI(body).replace(/#/g, "%23"));
  console.log("\n설치: 북마크바 우클릭 → 페이지 추가 → 이름·URL 입력\n");
}

/** 클립보드(macOS pbpaste)에서 인스타 CDN URL만 추출 + 리사이즈 중복 제거 */
function readUrls(): string[] {
  let raw = "";
  try {
    raw = execFileSync("pbpaste", { encoding: "utf8" });
  } catch {
    /* 클립보드를 못 읽으면 빈손 — 아래에서 안내 */
  }
  const seen = new Set<string>();
  return raw
    .split(/\s+/)
    .map((s) => s.trim())
    // 인스타 CDN + 일반 이미지 URL도 허용(다른 채널 사진도 같은 흐름으로 받을 수 있게)
    .filter((s) => /^https?:\/\//.test(s) && (/cdninstagram/.test(s) || /\.(jpe?g|png|webp|heic)(\?|$)/i.test(s)))
    .filter((u) => {
      const key = u.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** 폴더 선택 화면 — 기존 폴더를 번호로 고르거나 새로 만든다(숫자 하나면 끝) */
async function pickFolder(): Promise<string> {
  const dirs = existsSync(ROOT)
    ? (await readdir(ROOT, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort()
    : [];

  console.log("\n어느 업체 폴더에 저장할까요?\n");
  for (const [i, name] of dirs.entries()) console.log(`  ${i + 1}. ${name}`);
  console.log(`  ${dirs.length + 1}. + 새 폴더 만들기\n`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question("번호 입력: ")).trim();
    const n = Number(answer);
    if (n >= 1 && n <= dirs.length) return dirs[n - 1];
    if (n === dirs.length + 1 || !answer) {
      const name = (await rl.question("새 폴더 이름: ")).trim();
      if (!name) throw new Error("폴더 이름이 비었어요");
      return name;
    }
    // 숫자가 아니면 폴더명을 직접 친 것으로 본다
    return answer;
  } finally {
    rl.close();
  }
}

/** 폴더에 있는 `N.jpg` 중 최대 N — 재실행 시 이어서 번호를 매긴다 */
async function nextIndex(dir: string): Promise<number> {
  if (!existsSync(dir)) return 1;
  const files = await readdir(dir);
  const max = files.reduce((m, f) => {
    const hit = f.match(/^(\d+)\.[a-z]+$/i);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return max + 1;
}

const extOf = (ct: string): string =>
  ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

async function main() {
  if (process.argv.includes("--bookmarklet")) return printBookmarklet();

  const urls = readUrls();
  if (urls.length === 0) {
    console.error("\n클립보드에서 사진 URL을 못 찾았어요.");
    console.error("→ 인스타 게시물 페이지에서 북마클릿을 먼저 눌러주세요.");
    console.error("   (설치 안 했으면: npx tsx scripts/ig-save.ts --bookmarklet)\n");
    process.exit(1);
  }
  console.log(`\n클립보드에서 사진 ${urls.length}장 찾았어요.`);

  const brand = process.argv[2] || (await pickFolder());
  const dir = path.join(ROOT, brand);
  await mkdir(dir, { recursive: true });
  let n = await nextIndex(dir);

  console.log(`\n→ 업체사진정리/${brand}/ 에 ${n}번부터 저장합니다\n`);
  let ok = 0;
  for (const url of urls) {
    try {
      // 서명 URL이라 Referer 없이 열린다. UA는 붙여야 일부 엣지에서 403을 안 맞는다.
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) {
        console.log(`  ✗ HTTP ${res.status} — URL이 만료됐을 수 있어요(다시 긁어주세요)`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      const name = `${n}.${extOf(res.headers.get("content-type") ?? "")}`;
      await writeFile(path.join(dir, name), buf);
      console.log(`  ✓ ${name}  (${Math.round(buf.length / 1024)}KB)`);
      n++;
      ok++;
    } catch (e) {
      console.log(`  ✗ 실패 — ${(e as Error).message}`);
    }
  }
  console.log(`\n완료: ${ok}/${urls.length}장 → 업체사진정리/${brand}/`);
  console.log(`   (Finder에서 열기: open "${dir}")\n`);
}

main().catch((e) => {
  console.error("실패:", e?.message ?? e);
  process.exit(1);
});
