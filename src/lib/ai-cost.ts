// Gemini 콜 원가·토큰 실측 계량기.
//
// 왜 필요한가: Google 콘솔은 프로젝트 단위 합계만 준다 — "리포트 1건이 몇 원인지"는 알 수 없다.
// 콜마다 usageMetadata를 받아 여기서 환산해 로그로 남긴다. 추정이 아니라 실측이 목적.
//
// ⚠️ 단가·환율은 손으로 관리하는 값이다(2026-07 기준). 모델을 바꾸거나 구글이 단가를 조정하면
//    여기부터 고칠 것. 표에 없는 모델은 원가 0으로 찍히므로 로그에서 바로 티가 난다(무음 실패 금지).

/** USD per 1M tokens. thinking 토큰은 출력 단가로 과금된다. */
const PRICING: Record<string, { in: number; out: number }> = {
  "gemini-2.5-flash": { in: 0.3, out: 2.5 },
  "gemini-2.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3.6-flash": { in: 1.5, out: 7.5 },
  "gemini-3.5-flash-lite": { in: 0.1, out: 0.4 },
  "gemini-3.1-pro-preview": { in: 2.0, out: 12.0 },
};

/** 환율 — 정밀 회계가 아니라 자릿수 감각이 목적. env로 갱신 가능. */
const USD_KRW = Number(process.env.USD_KRW || 1390);

/** @google/genai가 돌려주는 usageMetadata의 우리가 쓰는 부분만. */
export interface GeminiUsage {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
}

export interface CallMeter {
  label: string; // "dna" | "report" 등 — 어느 단계인지
  model: string;
  ms: number;
  inTok: number;
  outTok: number; // 응답 본문
  thinkTok: number; // 사고 토큰(출력 단가로 과금·시간도 잡아먹음 → 튜닝 1순위 지표)
  krw: number;
  priced: boolean; // 단가표에 없는 모델이면 false — 로그에서 즉시 식별
}

/** 콜 1회를 계량한다. 단가표에 없는 모델이면 krw=0 + priced=false로 표시(조용히 0원 처리 금지). */
export function meter(label: string, model: string, ms: number, usage?: GeminiUsage): CallMeter {
  const inTok = usage?.promptTokenCount ?? 0;
  const outTok = usage?.candidatesTokenCount ?? 0;
  const thinkTok = usage?.thoughtsTokenCount ?? 0;
  const p = PRICING[model];
  const usd = p ? (inTok * p.in + (outTok + thinkTok) * p.out) / 1_000_000 : 0;
  return { label, model, ms, inTok, outTok, thinkTok, krw: usd * USD_KRW, priced: !!p };
}

const won = (krw: number) => `${krw.toFixed(1)}원`;
/** 사람이 읽는 단위는 초다 — ms는 자릿수를 세게 만든다(대표 지시 07-27). 측정·저장은 그대로 ms. */
export const secs = (ms: number) => `${(ms / 1000).toFixed(1)}초`;

/** 콜 1회 로그 — 콜이 끝나는 즉시 찍는다(뒤 단계가 실패해도 앞 원가는 남게). */
export function logMeter(m: CallMeter): void {
  console.log(
    `[cost] ${m.label} model=${m.model} ${secs(m.ms)} ` +
      `in=${m.inTok} out=${m.outTok} think=${m.thinkTok} ` +
      `= ${won(m.krw)}${m.priced ? "" : " ⚠️단가표에 없는 모델(0원 처리)"}`
  );
}

/** 요청 1건 합계 — "이 리포트 1건 = 몇 원, 어디서 몇 초" 한 줄 요약. */
export function logTotal(tag: string, meters: CallMeter[]): void {
  if (meters.length === 0) return;
  const krw = meters.reduce((s, m) => s + m.krw, 0);
  const think = meters.reduce((s, m) => s + m.thinkTok, 0);
  const out = meters.reduce((s, m) => s + m.outTok, 0);
  const ms = meters.reduce((s, m) => s + m.ms, 0);
  const breakdown = meters.map((m) => `${m.label}:${secs(m.ms)}/${won(m.krw)}`).join(" + ");
  console.log(
    `[cost] TOTAL ${tag} calls=${meters.length} ${breakdown} ` +
      `→ ${won(krw)} / ${secs(ms)} ` +
      `(think=${think}/out=${out}, 사고비중 ${out + think > 0 ? Math.round((think / (out + think)) * 100) : 0}%)`
  );
}
