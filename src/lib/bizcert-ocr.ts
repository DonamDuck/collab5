import "server-only"; // 🔒Gemini 키를 쓰는 파일이다. 클라이언트 컴포넌트가 import하면 빌드가 멈춘다.
// 하루 팝업 — 사업자등록증 글자 읽기 (2026-09-20 대표: 「OCR 가로 고고 1원도 안 들면 당연히!」) · 서버 전용
//
// 흐름: 사장님이 등록 폼 사업자 절에서 등록증을 올린다(`host-docs` 비공개 버킷) → `readBizCertAction`이 주인을 확인하고
//   서비스 롤로 파일을 받아 여기로 넘긴다 → Gemini가 다섯 칸을 JSON으로 돌려준다 → **이 파일의 파서가 모양을 보장한다**
//   (번호 검증번호·날짜·길이). 프롬프트는 요청일 뿐이라 모양이 틀린 칸은 버리고 빈칸으로 돌려준다.
// ⭐결과는 저장하지 않는다. 폼의 «빈 칸만» 채우고(`SpaceForm`의 `fillEmptyBiz`), 사장님이 보고 고친 값이 저장된다.
// 🔒로그에 등록증 내용을 남기지 않는다. 남기는 건 원가 계량(`[cost] bizcert …`)과 몇 칸을 읽었는지뿐이다.
// 💸모델 = 가벼운 모델(`gemini-2.5-flash-lite`, 입력 $0.10·출력 $0.40 / 1M 토큰). 한 장 1원 아래가 목표다(대표 조건).
//   09-20 실측(가짜 등록증 PNG·사진 JPEG·PDF 세 장): 세 장 다 입력 486·출력 96 토큰 = 장당 약 0.1원, 다섯 칸 다 읽음(시간은 사진 3.5초·PDF 5.1초).
//   enrich의 폴백 사슬에 이미 있는 모델이고 이미지·PDF를 받는다. 바꿀 땐 `BIZCERT_OCR_MODEL` env로(배포 없이 되돌릴 수 있다).
// 🧪목 모드면 Gemini를 부르지 않는다. 액션이 먼저 `mockBizCertRead`로 돌려보내고, 여기서도 한 번 더 막는다(`throwIfMock`).
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { meter, logMeter, type GeminiUsage } from "./ai-cost";
import { bizDigits, bizNumberProblem, openDateProblem } from "./bizcheck";
import { throwIfMock } from "./rent-mock";
import { todayKst } from "./rent-time";
import type { BizCertFields, BizCertRead } from "./types";

export const BIZCERT_MODEL = () => process.env.BIZCERT_OCR_MODEL || "gemini-2.5-flash-lite";
/** Gemini를 기다리는 한도. 넘기면 사장님은 「직접 적어 주세요」 한 줄을 본다. */
export const BIZCERT_TIMEOUT_MS = 20_000;
/** 사람당 짧은 시간 한도 — 1분에 세 번. 서버 인스턴스 메모리에 센다(인스턴스가 여럿이면 각자 센다. 원가 울타리로는 이걸로 된다). */
export const BIZCERT_RATE = { max: 3, windowMs: 60_000 };

// 답의 모양(`BizCertRead`·`BizCertFields`)은 화면도 쓰니 `lib/types.ts`에 있다.

// ── Gemini 요청 ──────────────────────────────────────────────

/** ⚠️Gemini responseSchema는 additionalProperties를 못 쓴다(`collab-report.ts`와 같은 제약). 칸은 전부 required로 받고 빈 글자를 허용한다. */
export const BIZCERT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    isBizCert: { type: Type.BOOLEAN, description: "이 이미지가 한국 국세청 사업자등록증인가" },
    bizNumber: { type: Type.STRING, description: "「등록번호」 칸의 숫자 열 자리. 안 보이면 빈 문자열" },
    bizName: { type: Type.STRING, description: "「상호」 또는 「법인명(단체명)」 칸 그대로. 안 보이면 빈 문자열" },
    ownerName: { type: Type.STRING, description: "「성명」 또는 「대표자」 칸의 이름 그대로. 안 보이면 빈 문자열" },
    openDate: { type: Type.STRING, description: "「개업연월일」을 YYYYMMDD 여덟 자리 숫자로. 안 보이면 빈 문자열" },
    address: { type: Type.STRING, description: "「사업장 소재지」 칸 전체 그대로. 안 보이면 빈 문자열" },
  },
  required: ["isBizCert", "bizNumber", "bizName", "ownerName", "openDate", "address"],
};

// ⚠️예시 값을 넣지 않는다. 흐린 사진에서 모델이 예시를 그대로 베껴 내면 그럴듯한 가짜 칸이 채워진다(볼트 «프롬프트 예시 오염»).
export const BIZCERT_SYSTEM = [
  "너는 한국 사업자등록증 이미지에서 글자를 그대로 옮겨 적는 도구다.",
  "이미지에 실제로 적힌 글자만 옮긴다. 추측하거나 고쳐 적지 않는다. 흐리거나 가려져 확실하지 않은 칸은 빈 문자열로 둔다.",
  "국세청이 발급한 사업자등록증이 아니면 isBizCert를 false로 하고 나머지 칸은 모두 빈 문자열로 둔다.",
  "bizNumber는 「등록번호」 칸이다. 법인등록번호·주민등록번호와 헷갈리지 않는다.",
  "openDate는 「개업연월일」을 연도 네 자리, 월 두 자리, 일 두 자리를 붙인 여덟 자리 숫자로 적는다.",
  "생년월일·주민등록번호·본점 소재지·업태·종목·발급일 같은 다른 칸은 옮기지 않는다.",
].join("\n");

const BIZCERT_USER = "이 사업자등록증에서 등록번호·상호·대표자 성명·개업연월일·사업장 소재지를 읽어 JSON으로 돌려줘.";

/** Gemini 한 번. 하네스가 가짜로 갈아 끼울 수 있게 모양만 정해 둔다. */
export type BizCertGenerate = (req: {
  model: string;
  mime: string;
  base64: string;
  signal: AbortSignal;
}) => Promise<{ text: string; usage?: GeminiUsage }>;

/** 실제 Gemini 호출. 내보내는 건 하네스가 원문을 같이 보려고(실측 3회) — 화면 경로는 `readBizCertFile`만 부른다. */
export const geminiGenerate: BizCertGenerate = async ({ model, mime, base64, signal }) => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const is3x = model.startsWith("gemini-3");
  // 사고는 끈다. 글자 옮기기라 생각할 거리가 없고, 사고 토큰은 출력 단가로 과금된다(`ai-cost.ts`).
  //   2.5는 thinkingBudget 0, 3.x는 0을 400으로 거부해서 thinkingLevel MINIMAL(`collab-report.ts` DNA와 같은 판단).
  const call = (withThinking: boolean) =>
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: base64 } }, { text: BIZCERT_USER }] }],
      config: {
        systemInstruction: BIZCERT_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: BIZCERT_SCHEMA,
        temperature: 0,
        maxOutputTokens: 600,
        abortSignal: signal,
        ...(withThinking
          ? { thinkingConfig: is3x ? { thinkingLevel: ThinkingLevel.MINIMAL } : { thinkingBudget: 0 } }
          : {}),
      },
    });
  let res;
  try {
    res = await call(true);
  } catch (e) {
    const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
    if (status !== 400 || signal.aborted) throw e;
    console.warn(`[bizcert] ${model} 사고 설정 거부(400) → 옵션 없이 재시도`);
    res = await call(false);
  }
  return { text: res.text ?? "", usage: res.usageMetadata };
};

// ── 파서 — 모양은 여기서 보장한다 ─────────────────────────────

const oneLine = (v: unknown, max: number): string => {
  if (typeof v !== "string") return "";
  const s = v.replace(/\s+/g, " ").trim().replace(/^["'「『]+|["'」』]+$/g, "").trim();
  return s.length > 0 && s.length <= max ? s : "";
};

/** 개업일을 `YYYYMMDD`로. 모델이 시킨 모양을 안 지켜도(「2021년 3월 5일」·「2021.03.05」) 숫자 세 덩이면 읽는다. */
export function normalizeOpenDate(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.trim();
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(t) ?? /^(\d{4})\D{1,3}(\d{1,2})\D{1,3}(\d{1,2})\D{0,2}$/.exec(t);
  if (!m) return "";
  return `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}`;
}

/** Gemini가 돌려준 글 → 화면에 넘길 칸. **형식이 틀린 칸은 버린다**(빈칸이 틀린 값보다 낫다 — 틀린 번호는 국세청 조회까지 간다).
 *  `today`는 KST `YYYY-MM-DD`(개업일이 오늘보다 뒤면 버린다). */
export function parseBizCertJson(raw: string, today: string): BizCertRead {
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "unreadable" };
  }
  if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, reason: "unreadable" };
  const r = o as Record<string, unknown>;
  if (r.isBizCert !== true) return { ok: false, reason: "unreadable" };

  const fields: BizCertFields = {};
  // 번호 — 숫자 열 자리 + 검증번호. 등록 폼과 서버가 쓰는 «같은 함수»(`bizNumberProblem`)로 본다.
  //   🧪로컬 테스트 번호(`000-00-00000`)는 개발 서버에서만 통과한다(그 함수가 가른다).
  const num = typeof r.bizNumber === "string" ? bizDigits(r.bizNumber) : "";
  if (num.length === 10 && bizNumberProblem(num) === "") fields.bizNumber = num;
  const name = oneLine(r.bizName, 100); // 폼의 상호 칸 maxLength와 같다
  if (name) fields.bizName = name;
  const owner = oneLine(r.ownerName, 50);
  if (owner) fields.bizOwnerName = owner;
  const open = normalizeOpenDate(r.openDate);
  if (open && openDateProblem(open, today) === "") fields.bizOpenDate = open;
  const addr = oneLine(r.address, 200);
  // 주소는 한글이 한 글자라도 있어야 주소로 본다. 「N/A」·「-」 같은 자리 채움 글자는 여기서 걸러진다.
  if (addr && /[가-힣]/.test(addr) && addr.length >= 5) fields.bizAddress = addr;

  return Object.keys(fields).length > 0 ? { ok: true, fields } : { ok: false, reason: "unreadable" };
}

// ── 한도 ─────────────────────────────────────────────────────

const hits = new Map<number, number[]>();

/** 이번 호출을 세고, 한도 안이면 true. 1분 넘은 기록은 그때 버린다. */
export function bizCertRateOk(userId: number, now = Date.now(), store = hits): boolean {
  const recent = (store.get(userId) ?? []).filter((t) => now - t < BIZCERT_RATE.windowMs);
  if (recent.length >= BIZCERT_RATE.max) {
    store.set(userId, recent);
    return false;
  }
  recent.push(now);
  store.set(userId, recent);
  return true;
}

// ── 읽기 ─────────────────────────────────────────────────────

/** 등록증 한 장을 읽는다. 주인 확인·한도는 호출부(`readBizCertAction`)가 먼저 했다.
 *  ⏱`timeoutMs` 안에 답이 없으면 요청을 끊고 `timeout`. 어떤 실패도 던지지 않는다(폼은 조용히 「직접 적어 주세요」). */
export async function readBizCertFile(
  file: { data: Uint8Array; mime: string },
  opts: { generate?: BizCertGenerate; timeoutMs?: number; today?: string } = {},
): Promise<BizCertRead> {
  await throwIfMock("readBizCert");
  const generate = opts.generate ?? geminiGenerate;
  if (!opts.generate && !process.env.GEMINI_API_KEY) return { ok: false, reason: "off" };
  const model = BIZCERT_MODEL();
  const ctl = new AbortController();
  const timeoutMs = opts.timeoutMs ?? BIZCERT_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const t0 = Date.now();
  try {
    const out = await Promise.race([
      generate({ model, mime: file.mime, base64: Buffer.from(file.data).toString("base64"), signal: ctl.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctl.abort();
          reject(new Error("bizcert-timeout"));
        }, timeoutMs);
      }),
    ]);
    logMeter(meter("bizcert", model, Date.now() - t0, out.usage));
    const read = parseBizCertJson(out.text, opts.today ?? todayKst());
    // 🔒내용은 안 남긴다. 몇 칸을 읽었는지만.
    console.log(`[bizcert] ${read.ok ? `read ${Object.keys(read.fields).length} fields` : `not read (${read.reason})`}`);
    return read;
  } catch (e) {
    const timeout = ctl.signal.aborted;
    const status = (e as { status?: number })?.status;
    console.warn(`[bizcert] ${timeout ? "timeout" : `failed${status ? ` status=${status}` : ""}`} after ${Date.now() - t0}ms`);
    return { ok: false, reason: timeout ? "timeout" : "error" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** 🧪목 모드의 정해 둔 결과(Gemini 0회). 최소 입력 세계는 「못 읽음」을 보여 준다(지도에서 두 갈래를 다 보게).
 *  값은 목 세계의 느린오후 사장님과 같다(`rent-mock-data.ts`). 번호는 «000»으로 시작하는 가짜다. */
export function mockBizCertRead(world: string): BizCertRead {
  if (world === "minimal") return { ok: false, reason: "unreadable" };
  return {
    ok: true,
    fields: {
      bizName: "느린오후 로스터리",
      bizNumber: "0000112347",
      bizOwnerName: "김느린",
      bizOpenDate: "20210315",
      bizAddress: "서울특별시 성동구 연무장길 00, 2층 (성수동2가)",
    },
  };
}
