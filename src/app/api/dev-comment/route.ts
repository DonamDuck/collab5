import { NextResponse, type NextRequest } from "next/server";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// 🗒 로컬 코멘트 받는 곳 (2026-09-14)
//
// 대표 09-14: *「스샷 찍고 번호로 일일이 설명하지 말고, 보면서 바로바로 코멘트 남기게 하고 싶다」*(오카 같은 것).
// 화면 위젯(`components/DevComments.tsx`)이 여기로 한 건씩 보내고, 나는 파일을 읽어 고친다.
//
// 🚨**개발 빌드에서만 산다.** 운영에선 아래 게이트가 404를 내고, 위젯 자체도 붙지 않는다.
//   ⛔인증이 없는 쓰기 경로라 이 게이트를 풀면 아무나 서버 디스크에 글을 쓴다. 조건을 손대지 말 것.
const DEV = process.env.NODE_ENV === "development";

/** 저장 위치 = 작업 트리 뿌리. `.gitignore`에 올려 뒀다 — 코멘트는 우리 둘 사이의 메모지 코드가 아니다. */
const FILE = path.join(process.cwd(), ".dev-comments.jsonl");
/** 「작업 시작」 깃발. 세션이 이 파일을 지켜보다가 생기면 깨어나 코멘트를 읽는다(읽고 나면 지운다).
 *  ⭐신호를 «파일»로 둔 이유 — 브라우저가 내 세션에 직접 말을 걸 길이 없다. 서버 디스크가 둘의 접점이다. */
const FLAG = path.join(process.cwd(), ".dev-comments.go");

export async function POST(req: NextRequest) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");

  // 「다 남겼어요, 작업 시작」 — 깃발만 세우고 끝낸다.
  if (b.action === "go") {
    const raw = await readFile(FILE, "utf8").catch(() => "");
    // 🔢09-18 대표 — 처리 끝난 코멘트까지 세서 「25건 보내고 작업 시작」이 떴다(24건은 이미 반영). 남은 것만 센다.
    const n = raw.split("\n").filter(Boolean).filter((l) => (JSON.parse(l) as { done?: boolean }).done !== true).length;
    await writeFile(FLAG, `${n}건 · 마지막 화면 ${s(b.url, 200)}\n`, "utf8");
    return NextResponse.json({ ok: true, count: n });
  }
  // ⚠️받은 값을 그대로 믿지 않고 길이를 자른다. 한 줄이 길어지면 내가 읽을 때 그 줄만으로 화면이 찬다.
  const row = {
    at: new Date().toISOString(),
    url: s(b.url, 200),
    note: s(b.note, 1000),
    selector: s(b.selector, 300),
    text: s(b.text, 200),
    /** 누른 요소의 잰 값 — 「작다」는 말을 숫자로 받는다(디자인팀 제안 09-14). 터치 타깃 44px·글자 16px 하한 대조용. */
    box: s(b.box, 40),
    font: s(b.font, 20),
    /** 글자색 + 실제로 깔린 배경색. 「안 보여」는 대비 문제라 이 짝이 없으면 사후에 못 되살린다. */
    color: s(b.color, 60),
    viewport: s(b.viewport, 20),
    done: false,
  };
  if (!row.note.trim()) return NextResponse.json({ ok: false, message: "내용이 비었어요." }, { status: 400 });
  await appendFile(FILE, JSON.stringify(row) + "\n", "utf8");
  return NextResponse.json({ ok: true });
}

/** 위젯이 부른다 — 「지금까지 몇 건」, 그리고 `selector`를 주면 **그 자리에 이미 달린 코멘트**.
 *
 *  ⭐대표 09-14: *「코멘트 남기고 또 남길려고 했더니 기존 코멘트가 안 나오거든? 하나의 컴포넌트당
 *    코멘트는 하나의 저장소를 쓰도록 하자, 누적으로. (1)로 남겼다가 다시 그거 클릭하고 코멘트하면
 *    (2)로 또 쓸 수 있게. 아이디어는 계속 생길 수 있으니깐」*
 *  👉같은 자리를 다시 누르면 앞서 쓴 말이 보인다. 그래야 **고쳐 쓰거나 덧붙일 수** 있다. */
export async function GET(req: NextRequest) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const raw = await readFile(FILE, "utf8").catch(() => "");
  const rows = raw.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, string>);

  // 🔢버튼의 「N건」은 아직 처리 안 한 것만. 처리한 코멘트(`done: true`)는 같은 자리를 다시 누를 때 보이는 이력으로만 남는다.
  const open = rows.filter((r) => (r as { done?: unknown }).done !== true);
  const sel = req.nextUrl.searchParams.get("selector");
  if (sel) {
    // ⚠️화면 주소까지 맞춘다 — 같은 생김새의 요소가 다른 페이지에도 있다(버튼·입력칸이 그렇다).
    const url = req.nextUrl.searchParams.get("url") ?? "";
    const mine = rows.filter((r) => r.selector === sel && r.url === url).map((r) => r.note);
    return NextResponse.json({ count: open.length, mine });
  }
  return NextResponse.json({ count: open.length });
}
