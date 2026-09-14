import { NextResponse, type NextRequest } from "next/server";
import { appendFile, readFile } from "node:fs/promises";
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

export async function POST(req: NextRequest) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (v: unknown, n = 300) => (typeof v === "string" ? v.slice(0, n) : "");
  // ⚠️받은 값을 그대로 믿지 않고 길이를 자른다. 한 줄이 길어지면 내가 읽을 때 그 줄만으로 화면이 찬다.
  const row = {
    at: new Date().toISOString(),
    url: s(b.url, 200),
    note: s(b.note, 1000),
    selector: s(b.selector, 300),
    text: s(b.text, 200),
    viewport: s(b.viewport, 20),
    done: false,
  };
  if (!row.note.trim()) return NextResponse.json({ ok: false, message: "내용이 비었어요." }, { status: 400 });
  await appendFile(FILE, JSON.stringify(row) + "\n", "utf8");
  return NextResponse.json({ ok: true });
}

/** 위젯이 「지금까지 몇 건」을 보여주려고 부른다. 내용 확인은 내가 파일을 직접 읽는 게 빠르다. */
export async function GET() {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const raw = await readFile(FILE, "utf8").catch(() => "");
  const rows = raw.split("\n").filter(Boolean);
  return NextResponse.json({ count: rows.length, recent: rows.slice(-3).map((l) => JSON.parse(l)) });
}
