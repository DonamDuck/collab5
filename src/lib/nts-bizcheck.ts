// 국세청 사업자등록정보 진위확인 — 서버 전용 (2026-09-18 대표: 공간 등록에 사업자 확인 필수)
//
// 📚출처(기억으로 쓰지 않았다. 09-18에 공식 명세를 받아 읽었다)
//   · 공공데이터포털 「국세청_사업자등록정보 진위확인 및 상태조회 서비스」 https://www.data.go.kr/data/15081808/openapi.do
//   · 그 페이지가 싣는 Swagger 명세 https://infuser.odcloud.kr/api/stages/28493/api-docs
//     host `api.odcloud.kr` · basePath `/api/nts-businessman/v1` · `POST /validate`
//     인증 = 쿼리 `serviceKey`(또는 헤더 `Authorization`)
//     요청 `{ businesses: [{ b_no, start_dt(YYYYMMDD), p_nm, … }] }` — 필수는 b_no·start_dt·p_nm, 한 번에 100건까지(413)
//     응답 `data[].valid` "01" Valid / "02" Invalid(`valid_msg` "확인할 수 없습니다")
//          `data[].status.b_stt_cd` "01" 계속사업자 / "02" 휴업자 / "03" 폐업자, `end_dt` 폐업일
//     오류 400 BAD_JSON_REQUEST · 411 REQUEST_DATA_MALFORMED · 413 TOO_LARGE_REQUEST · 500 INTERNAL_ERROR
//
// 🔑키 = `NTS_API_KEY`(대표가 신청 중). ⛔키를 코드에 적지 않는다.
//   공공데이터포털은 «인코딩 키»(이미 %가 섞인 것)와 «디코딩 키» 둘을 준다. 어느 쪽을 넣어도 되게 %가 있으면 그대로 쓴다.
//
// 🚨**조회 결과가 저장을 막는 건 `closed` 하나뿐이다**(호출부 `saveSpaceAction`). 키가 없거나 국세청이 안 받아도
//   사장님은 올릴 수 있고, 관리자가 등록증을 눈으로 보고 판단한다. 국세청 장애가 우리 등록을 멈추면 안 된다.
// 🧪목 모드에선 절대 부르지 않는다. 호출부(서버 액션)가 첫 줄에서 막고, 여기서 한 번 더 막는다.
import { rentMockOn } from "./rent-mock";
import { bizDigits } from "./bizcheck";
import type { BizCheckDetail, BizCheckStatus } from "./types";

const ENDPOINT = "https://api.odcloud.kr/api/nts-businessman/v1/validate";
const TIMEOUT_MS = 8000;

export interface BizCheckResult {
  status: BizCheckStatus;
  detail: BizCheckDetail;
}

type NtsValidateResponse = {
  status_code?: string;
  data?: {
    b_no?: string;
    valid?: string;
    valid_msg?: string;
    status?: { b_stt?: string; b_stt_cd?: string; end_dt?: string; tax_type?: string };
  }[];
};

/** 번호·대표자·개업일이 국세청 기록과 맞는지, 지금 영업 중인지. 던지지 않는다(실패는 `error`로 돌려준다). */
export async function checkBusiness(input: { number: string; ownerName: string; openDate: string }): Promise<BizCheckResult> {
  if (await rentMockOn()) return { status: "none", detail: { reason: "mock" } };
  const raw = process.env.NTS_API_KEY?.trim();
  // ⭐키가 없으면 «실패»가 아니라 «아직 못 물어봄»이다(대표 설계). 관리자 화면엔 「국세청 조회 전」으로 보인다.
  if (!raw) return { status: "none", detail: { reason: "no-key" } };
  const key = raw.includes("%") ? raw : encodeURIComponent(raw);

  let body: NtsValidateResponse;
  try {
    const res = await fetch(`${ENDPOINT}?serviceKey=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        businesses: [{ b_no: bizDigits(input.number), start_dt: input.openDate, p_nm: input.ownerName.trim() }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      // 🔒응답 본문엔 키가 안 실리지만 URL엔 실린다. 로그에 URL을 찍지 않는다.
      console.warn(`[nts-bizcheck] http ${res.status}`);
      return { status: "error", detail: { reason: `http-${res.status}` } };
    }
    body = (await res.json()) as NtsValidateResponse;
  } catch (e) {
    console.warn("[nts-bizcheck] request failed", e instanceof Error ? e.name : e);
    return { status: "error", detail: { reason: "network" } };
  }

  const row = body.data?.[0];
  if (!row || (row.valid !== "01" && row.valid !== "02")) {
    return { status: "error", detail: { reason: "bad-response" } };
  }
  if (row.valid === "02") {
    return { status: "mismatch", detail: { valid: "02", validMsg: row.valid_msg ?? "" } };
  }
  const code = row.status?.b_stt_cd ?? "";
  const detail: BizCheckDetail = {
    valid: "01",
    bSttCd: code,
    bStt: row.status?.b_stt ?? "",
    ...(row.status?.end_dt ? { endDt: row.status.end_dt } : {}),
    ...(row.status?.tax_type ? { taxType: row.status.tax_type } : {}),
  };
  if (code === "01") return { status: "valid", detail };
  if (code === "02" || code === "03") return { status: "closed", detail };
  // 일치는 했는데 상태 코드를 못 읽었다. 계속사업자라고 단정하지 않는다.
  return { status: "error", detail: { ...detail, reason: "unknown-status" } };
}
