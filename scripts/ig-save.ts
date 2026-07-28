// 인스타 사진 저장기 — 클립보드의 이미지 URL들을 "폴더만 고르면" 한 번에 내려받는다.
//
//   npm run ig                              # 폴더 선택 → 이름 입력 → 저장
//   npm run ig -- 두더지요가원 "토우 워크숍"      # 둘 다 알면 바로
//   npm run ig:setup                        # 북마클릿 한 줄 출력(최초 1회 설치)
//
// 흐름: [인스타 게시물에서 북마클릿 → [복사하기]] → [이 스크립트 → 폴더·이름 → 저장]
// 파일명 = `{입력한 이름} 1.jpg, {이름} 2.jpg…` — **한 배치는 항상 1번부터**.
// 배치마다 이름을 새로 받으므로 과거 저장분과 번호를 이어붙이지 않는다(대표 07-26).
// 단, 같은 폴더에 같은 이름이 이미 있으면 덮어쓰지 않고 뒤 번호로 피한다(사고 방지).
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

/** 클립보드(macOS pbpaste)에서 인스타 CDN URL만 추출 + 리사이즈 중복 제거.
 *  ⚠️ 못 찾았을 때 "왜"를 말해줘야 한다 — 조용히 빈손이면 클립보드가 빈 건지,
 *     엉뚱한 게 들어있는 건지, URL 형식이 안 맞는 건지 구분이 안 된다. */
function readUrls(): { urls: string[]; raw: string; clipboardError?: string } {
  let raw = "";
  let clipboardError: string | undefined;
  try {
    raw = execFileSync("pbpaste", { encoding: "utf8" });
  } catch (e) {
    clipboardError = (e as Error).message;
  }
  const seen = new Set<string>();
  const urls = raw
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
  return { urls, raw, clipboardError };
}

/** 폴더 선택 화면 — 기존 폴더를 번호로 고르거나 새로 만든다(숫자 하나면 끝) */
async function pickFolder(rl: ReturnType<typeof createInterface>): Promise<string> {
  const dirs = existsSync(ROOT)
    ? (await readdir(ROOT, { withFileTypes: true }))
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => d.name)
        .sort()
    : [];

  console.log("\n어느 업체 폴더에 저장할까요?\n");
  for (const [i, name] of dirs.entries()) console.log(`  ${i + 1}. ${name}`);
  console.log(`  ${dirs.length + 1}. + 새 폴더 만들기\n`);

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
}

/** 이 배치는 1번부터 시작한다. 단 같은 이름이 이미 있으면 **덮어쓰지 않고** 뒤 번호로 피한다.
 *  (이름을 매번 새로 받으니 충돌은 드물지만, 실수로 같은 이름을 쳤을 때 기존 사진이 날아가면 안 된다) */
async function startIndex(dir: string, label: string): Promise<{ from: number; collided: boolean }> {
  if (!existsSync(dir)) return { from: 1, collided: false };
  const files = await readdir(dir);
  // 라벨이 비면 `1.jpg` 형태, 있으면 `이름 1.jpg` 형태를 찾는다
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${esc ? esc + " " : ""}(\\d+)\\.[a-z]+$`, "i");
  const max = files.reduce((m, f) => {
    const hit = f.match(re);
    return hit ? Math.max(m, Number(hit[1])) : m;
  }, 0);
  return max === 0 ? { from: 1, collided: false } : { from: max + 1, collided: true };
}

/** 확장자는 **서버가 준 Content-Type을 그대로** 따른다 — 우리가 포맷을 고르는 게 아니다.
 *  인스타 CDN은 URL에 포맷이 박혀 나오므로(`dst-jpg` vs `dst-webp`) 배치마다 .jpg/.webp가 갈린다.
 *  둘 다 정상이다: 폼이 `image/*`를 받고 `lib/image.ts`가 올리기 전에 jpeg로 재인코딩한다. */
const extOf = (ct: string): string =>
  ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";

async function main() {
  if (process.argv.includes("--bookmarklet")) return printBookmarklet();

  const { urls, raw, clipboardError } = readUrls();
  if (urls.length === 0) {
    console.error("\n클립보드에서 사진 URL을 못 찾았어요.\n");
    if (clipboardError) {
      console.error(`  원인: 클립보드를 읽지 못했어요 — ${clipboardError}`);
    } else if (!raw.trim()) {
      console.error("  원인: 클립보드가 비어 있어요.");
      console.error("  → 북마클릿 패널의 [복사하기] 버튼을 눌렀는지 확인해주세요(자동 복사 아님).");
    } else {
      // 뭐가 들어있는지 보여줘야 원인이 잡힌다(URL이 잘렸는지, 엉뚱한 텍스트인지)
      const preview = raw.trim().replace(/\s+/g, " ").slice(0, 120);
      console.error(`  클립보드에 ${raw.trim().length}자가 있는데 사진 URL 형식이 아니에요:`);
      console.error(`    "${preview}${raw.trim().length > 120 ? "…" : ""}"`);
      console.error("  → 인스타 사진 URL은 https://…cdninstagram.com/… 형태여야 해요.");
    }
    console.error("\n  설치 안 했으면: npm run ig:setup\n");
    process.exit(1);
  }
  console.log(`\n클립보드에서 사진 ${urls.length}장 찾았어요.`);

  const argBrand = process.argv[2];
  const argLabel = process.argv[3];
  let brand = argBrand;
  let label = argLabel ?? "";
  if (!argBrand || argLabel === undefined) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    try {
      brand = argBrand || (await pickFolder(rl));
      if (argLabel === undefined) {
        label = (await rl.question("\n사진 이름 (그냥 엔터 = 숫자만): ")).trim();
      }
    } finally {
      rl.close();
    }
  }
  // 파일명에 못 쓰는 문자만 정리(/ 는 경로가 되고 : 는 Finder에서 깨진다)
  label = label.replace(/[/:\\]/g, "-").trim();

  const dir = path.join(ROOT, brand!);
  await mkdir(dir, { recursive: true });
  const { from, collided } = await startIndex(dir, label);
  let n = from;

  const sample = label ? `${label} ${n}.jpg` : `${n}.jpg`;
  console.log(`\n→ 업체사진정리/${brand}/${sample} 부터 저장합니다`);
  if (collided) {
    console.log(`   (같은 이름이 이미 있어서 ${from}번부터 — 기존 사진은 덮어쓰지 않아요)`);
  }
  console.log("");
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
      const ext = extOf(res.headers.get("content-type") ?? "");
      const name = label ? `${label} ${n}.${ext}` : `${n}.${ext}`;
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
