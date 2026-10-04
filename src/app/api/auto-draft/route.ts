// POST /api/auto-draft — 소개서 자동 만들기 신청을 대기열에 쌓는다 (2026-10-03, 로컬 시험판)
// GET  /api/auto-draft — 지금 대기 중인 신청 수(화면의 「대기 N번째 · 약 D일」 안내용)
//
// ⚠️**로컬 전용이다.** 대기열이 이 컴퓨터의 파일(`_workspace/auto-draft-queue/`)이라 Vercel에선 쓸 곳이 없다.
//   운영에 올릴 땐 DB 표로 옮기고, 대표 컴퓨터가 그 표를 밤마다 꺼내 가게 한다(사이트가 집 컴퓨터로 직접
//   신호를 쏘면 집 컴퓨터에 문을 열어야 해서 그렇게 하지 않는다).
// 🔔신청이 들어오면 맥 알림을 띄운다 — 「버튼 → 내 컴퓨터로 푸시」를 로컬에서 흉내 낸 것.
//   이 세션의 Claude는 같은 폴더를 지켜보다가 새 파일이 생기면 스킬을 시작한다.
import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONSENT_TEXT,
  EMAIL_RE,
  etaDays,
  parseChannel,
  type AutoDraftChannel,
  type AutoDraftRequest,
} from "@/lib/autoDraft";
import { kstIso } from "@/lib/time";
import { getSessionUser } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/profiles";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");
const LOCAL_ONLY = process.env.NODE_ENV === "production";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function queued(): Promise<AutoDraftRequest[]> {
  let names: string[] = [];
  try {
    names = (await readdir(QUEUE_DIR)).filter((n) => n.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const out: AutoDraftRequest[] = [];
  for (const n of names) {
    try {
      const r = JSON.parse(await readFile(path.join(QUEUE_DIR, n), "utf8")) as AutoDraftRequest;
      if (r.status === "queued" || r.status === "working") out.push(r);
    } catch {
      // 깨진 파일 하나 때문에 대기열 전체가 멈추면 안 된다 — 건너뛴다
    }
  }
  return out;
}

function notifyMac(title: string, body: string) {
  if (process.platform !== "darwin") return;
  // AppleScript 문자열은 큰따옴표 안에서 \" 이스케이프를 받는다 — JSON.stringify가 그 모양을 만든다
  const script = `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)} sound name "Glass"`;
  execFile("osascript", ["-e", script], () => {});
}

export async function GET() {
  if (LOCAL_ONLY) return NextResponse.json({ waiting: 0, available: false, loggedIn: false });
  const [q, user] = await Promise.all([queued(), getSessionUser()]);
  // 이메일은 «본인에게만» 돌려준다 — 신청 창의 안내 이메일 칸을 미리 채우는 용도
  return NextResponse.json({ waiting: q.length, available: true, loggedIn: !!user, email: user?.email ?? "" });
}

export async function POST(req: Request) {
  if (LOCAL_ONLY) {
    return NextResponse.json({ error: "아직 준비 중인 기능이에요." }, { status: 503 });
  }
  // 🔑로그인한 사람만(대표 10-04). 화면이 막아도 주소로 바로 부르는 길이 남으니 여기서 다시 막는다.
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  const brandName = str(body.brandName, 60);
  const email = str(body.email, 120);
  if (!brandName) return NextResponse.json({ error: "브랜드 이름을 적어 주세요." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "알림 받을 이메일을 확인해 주세요." }, { status: 400 });
  if (body.consent !== true) return NextResponse.json({ error: "동의가 필요해요." }, { status: 400 });

  // 채널은 서버에서 다시 판별한다 — 화면이 붙인 종류 라벨을 믿지 않는다
  const rawChannels = Array.isArray(body.channels) ? body.channels.slice(0, 10) : [];
  const seen = new Set<string>();
  const channels: AutoDraftChannel[] = [];
  for (const c of rawChannels) {
    const parsed = parseChannel(str(c, 300));
    if (parsed && !seen.has(parsed.url.toLowerCase())) {
      seen.add(parsed.url.toLowerCase());
      channels.push(parsed);
    }
  }
  if (channels.length === 0) {
    return NextResponse.json({ error: "인스타그램이나 블로그 주소를 하나 이상 알려 주세요." }, { status: 400 });
  }

  const now = new Date();
  const at = kstIso(now);
  const id = `${at.slice(0, 19).replace(/[-:T]/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const request: AutoDraftRequest = {
    id,
    createdAt: at,
    status: "queued",
    brandName,
    region: str(body.region, 40),
    businessType: str(body.businessType, 40),
    channels,
    email,
    note: str(body.note, 1000),
    concern: str(body.concern, 2000),
    consent: { text: CONSENT_TEXT, at },
    account: { authId: user.id, email: user.email ?? "", userId: (await getSessionUserId()) ?? null },
  };

  await mkdir(QUEUE_DIR, { recursive: true });
  await writeFile(path.join(QUEUE_DIR, `${id}.json`), JSON.stringify(request, null, 2), "utf8");

  const position = (await queued()).length;
  notifyMac("collab5 자동 만들기 신청", `${brandName} · 채널 ${channels.length}개 · 대기 ${position}번째`);
  console.log(`[auto-draft] queued ${id} ${brandName} (${channels.map((c) => c.kind).join(",")})`);

  return NextResponse.json({ id, position, etaDays: etaDays(position) });
}
