// POST /api/auto-draft — 소개서 자동 만들기 신청을 쌓는다 (2026-10-03 로컬 시험판 · 10-07 운영 신청 열기)
// GET  /api/auto-draft — 로그인 여부·계정 이메일, 그리고 로컬이면 대기 중인 신청 수(「대기 N번째」 안내용)
//
// 🗂**쌓는 곳이 둘이다.**
//   · 로컬(개발 서버) = 이 컴퓨터의 폴더 `_workspace/auto-draft-queue/` — 밤 작업이 바로 읽는다.
//   · 운영(Vercel) = `auto_draft_requests` 표 — Vercel엔 그 폴더가 없다. 밤 작업이 `queue pull`로 표를 «읽어»
//     로컬 폴더로 가져간다(사이트가 집 컴퓨터로 신호를 쏘면 집 컴퓨터에 문을 열어야 해서 그렇게 하지 않는다).
//   ⚠️운영에선 «대기 N번째»를 안 보여 준다. 표에 진행 상태가 없어서다(밤 작업은 운영 DB에 쓰지 않는다 — 10-05 규칙).
// 🔔로컬에선 신청이 들어오면 맥 알림을 띄운다. 운영에선 접수 메일의 숨은 참조(대표)가 그 일을 한다.
import { after, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CHANNEL_LABEL,
  CONSENT_TEXT,
  DAILY_CAP,
  EMAIL_RE,
  etaDays,
  parseChannel,
  type AutoDraftChannel,
  type AutoDraftRequest,
} from "@/lib/autoDraft";
import { kstIso } from "@/lib/time";
import { getSessionUser } from "@/lib/supabase/server";
import { getSessionUserId } from "@/lib/profiles";
import { notifyDraftRequested } from "@/lib/notify";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");
const PROD = process.env.NODE_ENV === "production";

/** 운영 표 클라이언트(서비스 롤). 키가 없으면 null — 그땐 운영에서도 신청을 받지 않는다(조용히 버리지 않는다). */
function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

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
  const [q, user] = await Promise.all([PROD ? Promise.resolve(null) : queued(), getSessionUser()]);
  // 이메일은 «본인에게만» 돌려준다 — 신청 창의 안내 이메일 칸을 미리 채우는 용도
  return NextResponse.json({ waiting: q ? q.length : null, available: true, loggedIn: !!user, email: user?.email ?? "" });
}

export async function POST(req: Request) {
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
    consent: { text: CONSENT_TEXT, at },
    account: { authId: user.id, email: user.email ?? "", userId: (await getSessionUserId()) ?? null },
  };

  if (PROD) return await saveToTable(request);

  const file = path.join(QUEUE_DIR, `${id}.json`);
  await mkdir(QUEUE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(request, null, 2), "utf8");

  const position = (await queued()).length;
  const eta = etaDays(position);
  notifyMac("collab5 자동 만들기 신청", `${brandName} · 채널 ${channels.length}개 · 대기 ${position}번째`);
  console.log(`[auto-draft] queued ${id} ${brandName} (${channels.map((c) => c.kind).join(",")})`);

  // ✉️접수 메일(대표 10-07) — 응답을 붙잡지 않게 응답 «뒤에» 보낸다. 신청 한 건에 한 번만 불린다
  //   (요청 버튼은 누르는 동안 잠기고, 같은 신청 파일로 다시 부르는 길이 없다).
  //   못 보내도 신청은 그대로 접수다 — 결과만 대기열 파일에 남겨 신청함에서 보이게 한다.
  after(async () => {
    const r = await notifyDraftRequested({
      to: email,
      brandName,
      position,
      etaDays: eta,
      dailyCap: DAILY_CAP,
      channels: channelLines(channels),
    });
    try {
      const cur = JSON.parse(await readFile(file, "utf8")) as AutoDraftRequest;
      if (r.ok) cur.receiptAt = kstIso(new Date());
      else cur.receiptError = r.why;
      await writeFile(file, JSON.stringify(cur, null, 2), "utf8");
    } catch {
      // 그 사이 파일이 옮겨졌으면(테스트 보관 등) 남길 곳이 없다 — 신청 자체엔 영향 없음
    }
  });

  return NextResponse.json({ id, position, etaDays: eta });
}

const channelLines = (channels: AutoDraftChannel[]) =>
  channels.map((c) => `${CHANNEL_LABEL[c.kind]} ${c.url.replace(/^https:\/\//, "")}`);

/** 운영 — 표에 한 줄 쌓고, 응답 뒤에 접수 메일을 보낸 다음 그 결과를 같은 줄에 적는다. */
async function saveToTable(r: AutoDraftRequest) {
  const client = db();
  if (!client) {
    console.error("[auto-draft] 운영 DB 키가 없어 신청을 받지 못함");
    return NextResponse.json({ error: "지금은 신청을 받지 못했어요. 잠시 뒤 다시 눌러 주세요." }, { status: 503 });
  }
  const { error } = await client.from("auto_draft_requests").insert({
    id: r.id,
    created_at: new Date().toISOString(),
    brand_name: r.brandName,
    region: r.region,
    business_type: r.businessType,
    channels: r.channels,
    email: r.email,
    note: r.note,
    consent: r.consent,
    auth_id: r.account?.authId ?? null,
    user_id: r.account?.userId ?? null,
    account_email: r.account?.email ?? "",
  });
  if (error) {
    // 표가 없거나(배포가 DB보다 먼저 나간 경우) 권한 문제 — 「접수됐어요」를 띄우면 신청이 조용히 사라진다
    console.error("[auto-draft] 신청 저장 실패", error.code, error.message);
    return NextResponse.json({ error: "지금은 신청을 받지 못했어요. 잠시 뒤 다시 눌러 주세요." }, { status: 503 });
  }
  console.log(`[auto-draft] saved ${r.id} ${r.brandName} (${r.channels.map((c) => c.kind).join(",")})`);

  after(async () => {
    const m = await notifyDraftRequested({
      to: r.email,
      brandName: r.brandName,
      position: null,
      etaDays: 1,
      dailyCap: DAILY_CAP,
      channels: channelLines(r.channels),
    });
    await client
      .from("auto_draft_requests")
      .update(m.ok ? { receipt_at: new Date().toISOString() } : { receipt_error: m.why })
      .eq("id", r.id);
  });

  return NextResponse.json({ id: r.id, position: null, etaDays: 1 });
}
