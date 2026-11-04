// POST /api/sideproject/event — 딴짓 페이지 열림 · 내려받기 한 줄 (설계 = src/lib/sideprojectEvents.ts 머리말)
// 브라우저 비컨이 보내니 답은 늘 204다. 잘못된 값·로봇·표 오류 어느 쪽이든 화면에 알릴 데가 없다.
// ⚠️운영(Vercel)에서만 표에 쓴다. 로컬 .env.local 에도 운영 키가 있어서 그냥 두면 개발 중 방문이 운영 표에 쌓인다.
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { kstDateKey } from "@/lib/time";
import { SIDE_EVENT_PROJECTS } from "@/lib/sideprojectEvents";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|python|curl|wget/i;
const done = () => new NextResponse(null, { status: 204 });
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** https://www.google.com/search?q=… → google.com. 주소가 아니면 빈칸 */
function refHost(v: unknown): string {
  try {
    return new URL(str(v, 500)).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return done();

  let b: Record<string, unknown>;
  try {
    b = await req.json();
  } catch {
    return done();
  }
  const kind = b.kind === "view" || b.kind === "download" ? b.kind : null;
  const project = (SIDE_EVENT_PROJECTS as readonly unknown[]).includes(b.project) ? (b.project as string) : null;
  if (!kind || !project) return done();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  // 서버 비밀값을 소금으로 섞는다 — 소금 없이 IP 범위를 다 돌려 보면 거꾸로 찾아낼 수 있어서
  const visitor = createHash("sha256").update(`${key ?? ""}|${kstDateKey()}|${ip}|${ua}`).digest("hex").slice(0, 16);
  const row = {
    kind,
    project,
    path: str(b.path, 200),
    os: b.os === "mac" || b.os === "windows" ? b.os : "",
    version: str(b.version, 20),
    country: str(req.headers.get("x-vercel-ip-country"), 2),
    referrer: refHost(b.ref),
    visitor,
    mine: b.mine === true,
  };

  if (process.env.VERCEL !== "1" || !url || !key) {
    console.log("[sideproject-event] (로컬이라 표에 안 씀)", row);
    return done();
  }
  const { error } = await createClient(url, key, { auth: { persistSession: false } }).from("sideproject_events").insert(row);
  if (error) console.error("[sideproject-event] insert", error.message);
  return done();
}
