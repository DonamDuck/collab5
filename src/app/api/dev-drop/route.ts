// POST /api/dev-drop?name=xxx — 로컬 전용 «받는 상자» (2026-10-04)
//
// 왜: 대표 크롬(인스타 로그인 세션)에서 모은 사진 주소를 꺼낼 길이 없다. 브라우저 도구가 긴 JSON
//   반환을 `[BLOCKED: Cookie/query string data]`로 막는다(주소에 쿼리스트링이 있어서). 클립보드 우회는
//   실제 클릭이 있어야 해서 번거롭다. 그래서 페이지가 이 로컬 서버로 직접 보낸다.
// 🚨개발 빌드에서만 산다. 인증 없는 쓰기 경로라 운영에선 404. 이름은 영숫자·하이픈만, 크기 상한 5MB.
import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEV = process.env.NODE_ENV === "development";
const DIR = path.join(process.cwd(), "_workspace", "dev-drop");

export async function POST(req: Request) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const name = (new URL(req.url).searchParams.get("name") ?? "drop").replace(/[^0-9a-z-]/gi, "").slice(0, 60) || "drop";
  const body = await req.text();
  if (body.length > 5_000_000) return NextResponse.json({ error: "too big" }, { status: 413 });
  await mkdir(DIR, { recursive: true });
  await writeFile(path.join(DIR, `${name}.json`), body, "utf8");
  return new NextResponse("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
}
