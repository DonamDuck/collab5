// 한국어 줄바꿈 다듬기 — 사적인 프로젝트 상세(MonitorAlign·LimitGlance)가 화면에 그릴 때만 쓴다.
// 구조화 데이터·메타 설명에는 원문을 그대로 넣는다(여기 거친 문자열을 넣지 말 것).
//
// break-keep은 띄어쓰기마다 줄을 바꿀 수 있어서 「기억하고 / 있어서」「클릭 두 / 번」처럼 한 덩어리가 갈라진다(10-14 대표).
// 의존 명사·보조 용언·수량 단위 앞의 띄어쓰기를 줄바꿈 없는 공백(U+00A0)으로 바꿔 앞말에 붙인다.
// 붙이는 덩어리는 두세 어절이라 좁은 폰에서도 넘치지 않는다.
const NB = "\u00a0";
const BOUND = "수|것|거|데|때|줄|뿐|만큼|대로|듯|중|걸|건"; // 의존 명사
const AUX = "있|없|주|줘|드|봐|보|두|놓|버리|싶|않|못|돼|되"; // 보조 용언의 첫 글자
const UNIT = "번|개|명|시간|분|일|초|대"; // 수량 단위

const RE_UNIT = new RegExp(`(\\d|한|두|세|네|몇|여러) (${UNIT})`, "g");
const RE_BOUND = new RegExp(` (${BOUND})(?=[\\s,.?!)]|[이을를은는가에도만요로서]|$)`, "g");
const RE_AUX = new RegExp(`([아어워와고게해서려쳐켜겨져]) (${AUX})`, "g");
const RE_CAN = / (있|없)/g;
// 한 낱말처럼 읽히는 묶음(화면 이름·자주 쓰는 이음말)은 통째로 붙인다.
const PHRASES = ["메뉴 막대", "작업 표시줄", "그러다 보니", "Claude Code", "언제 리셋"];

export function koWrap(s: string): string {
  return PHRASES.reduce((acc, p) => acc.replaceAll(p, p.replaceAll(" ", NB)), s)
    .replace(RE_UNIT, `$1${NB}$2`) // 「두 번」「여러 개」
    .replace(RE_BOUND, `${NB}$1`) // 「쓸 수」「만든 거예요」
    .replace(RE_AUX, `$1${NB}$2`) // 「기억하고 있어서」「띄워 두고」「알려 주고」
    .replace(new RegExp(`${NB}(수)${RE_CAN.source}`, "g"), `${NB}$1${NB}$2`); // 「쓸 수 있게」
}

/** 문안 묶음 안의 모든 문자열에 koWrap을 건다(배열·객체를 따라 내려간다). */
export function koWrapDeep<T>(x: T): T {
  if (typeof x === "string") return koWrap(x) as T;
  if (Array.isArray(x)) return x.map(koWrapDeep) as T;
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, koWrapDeep(v)])) as T;
  }
  return x;
}
