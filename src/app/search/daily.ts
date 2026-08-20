// 「오늘의 순서」 — /search 목록 정렬과 키워드 레일이 **같은 날짜 씨앗**을 공유한다(08-20 대표 승인 ①②③).
//
// ⭐왜 최신순을 버렸나 — 소개서가 10곳뿐인데 순서를 고정하면 **맨 끝 브랜드는 영원히 맨 끝**이다.
//   실측(08-20): 10곳 중 8곳이 첫 줄을 한 번도 못 가진다. 목록이 짧을 땐 정렬이 '찾기'를 돕는 게 아니라
//   **노출을 나눠 주는 일**에 가깝다. 그래서 날마다 순서를 돌린다.
// ⚠️`listHomeMakers`(홈 캐러셀)는 **최신순 그대로 둔다** — 방금 소개서를 만든 사장님이 자기 브랜드를
//   못 찾는 문제(07-31)를 막는 건 홈의 몫이다. 여기는 10곳이 한 화면에 다 나오므로 그 보호가 필요 없다.
//
// 🚨무작위가 아니라 **날짜로 재현되는 순서**여야 한다. `Math.random()`을 쓰면 서버가 그릴 때와
//   사용자가 새로고침할 때가 달라져 "방금 봤던 곳이 사라졌다"가 된다. 같은 날 = 항상 같은 화면.

import type { Maker } from "@/lib/types";
import { kstDateKey } from "@/lib/time";

/** 문자열 → 32비트 정수(FNV-1a). 날짜·slug를 난수 씨앗으로 바꾸는 용도. */
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — 씨앗 하나로 재현되는 난수열. 짧고 분포가 고르다. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 오늘의 씨앗. KST 기준 날짜라 **한국 자정에 바뀐다**(UTC로 자르면 오전 9시에 바뀐다). */
export function todaySeed(): string {
  return kstDateKey();
}

/** 씨앗 고정 셔플(Fisher–Yates). 원본 배열은 건드리지 않는다. */
export function dailyOrder<T>(items: readonly T[], seed: string): T[] {
  const out = items.slice();
  const rand = rng(hash32(seed));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 키워드 레일 한 칸. 누르면 그 브랜드 소개서로 간다(필터가 아니라 **입구**다). */
export interface Spotlight {
  text: string;
  slug: string;
  name: string;
}

/** 레일에 그릴 최대 개수. **브랜드당 딱 하나씩**이 원칙이라 사실상 「최대 10곳」이라는 뜻.
 *  ⭐이 숫자의 근거(대표 지시 "적당한 갯수로", 08-20):
 *    - 실측상 키워드는 10곳이 92개를 썼는데 **고유값이 91개** — 겹치는 게 「큐레이션」 하나뿐이다.
 *      그래서 이건 목록을 좁히는 필터가 될 수 없고, 누르면 대개 한 곳으로 곧장 간다.
 *    - 92개를 다 깔면 칩 밭이 된다. 한 곳당 하나면 **모든 브랜드가 정확히 한 번씩** 노출되고,
 *      날짜 씨앗이 매일 다른 키워드를 뽑아 주므로 골라 둔 말들이 돌아가며 나온다.
 *    - 브랜드가 10곳을 넘으면 여기서 끊긴다. 그때도 씨앗이 매일 다른 10곳을 고른다. */
export const SPOTLIGHT_MAX = 10;

/** 🖐**대표가 직접 고른 레일 후보**(08-20). 소개서 키워드 전량(92개)에서 추린 것이다.
 *  왜 손으로 고르나 — 전량에서 무작위로 뽑으니 「우정」·「편안함」처럼 어느 브랜드에나 붙는 말이
 *  대표 얼굴로 나왔다. 궁금하게 만드는 건 「수선조형」·「계단정복지도」 쪽이고, 그 판별은
 *  **업체를 아는 사람만** 할 수 있다(대표 원문: "내가 다 아는 업체다보니").
 *
 *  `star` = 그 브랜드의 대표 키워드, `rest` = 가끔 섞여 나올 후보(대표 확정 「별표 먼저」).
 *  ⚠️`rest`를 없애고 star만 쓰면 브랜드마다 **매일 같은 말**이 뜬다 — 그래서 둘로 나눴다.
 *
 *  🔗표기는 **소개서 키워드 칩과 글자까지 같아야 한다** — 목록 카드에 뜨는 초록 칩과 같은 말로
 *    보여야 연결되기 때문이다(대표 메모의 「동네모임」·「진로 전환」은 소개서 표기인
 *    「동네 모임」·「진로 전환기」로 맞췄다).
 *  ※대표가 고른 목록엔 로컬페이지 「보홀 자유여행」도 있었는데 **소개서 키워드에 없어** 뺐다
 *    (08-20 대표 확정 "보홀은 그럼 그냥 빼자"). 나중에 소개서에 넣으면 여기 되살리면 된다.
 *
 *  🆕여기 없는 slug(새로 등록된 브랜드)는 **그 브랜드 키워드 전량에서 자동으로 뽑는다** —
 *    목록에 손을 안 대도 신규 브랜드가 레일에서 빠지지 않게. 아래 `dailySpotlights` 참조. */
export const CURATED_PICKS: Record<string, { star: readonly string[]; rest: readonly string[] }> = {
  "m-7lefr9": { star: ["사진 촬영"], rest: ["아카이브 북", "산책과 잡담"] },                      // 전종원 작가
  "m-vzrlhz": { star: ["세부 자유여행"], rest: ["발리 자유여행"] },                // 로컬페이지
  "m-8r5gep": { star: ["취향 수집", "계절 기록"], rest: ["동네 모임", "성북천"] },                  // 콜렉트마이페이보릿
  "m-x3djf8": { star: ["LP 카페"], rest: ["수달", "아지트"] },                                    // 레이지오터
  "m-oblejt": { star: ["휠체어 지도", "계단뿌셔클럽"], rest: ["이동약자", "계단정복지도"] },         // 계단뿌셔클럽
  "m-u8y5i3": { star: ["와인"], rest: ["보틀숍", "캔 통조림", "혼술아지트"] },                      // 캔앤코르크
  "m-uako9s": { star: ["러닝크루"], rest: ["취향 커뮤니티", "독서", "커뮤니티", "슬로 러닝"] },      // 아그레아블
  "m-irywef": { star: ["자기탐색"], rest: ["마음공부", "개인레슨", "요가"] },                       // 두더지요가원
  "m-ofjghi": { star: ["수선조형", "직물워크숍", "수선", "자기표현"], rest: ["헌옷의 재발견"] },     // 캔가
  "m-vs9xzg": {                                                                                  // 호락호락도서관
    star: ["누구나에게 열려있는 공간"],
    rest: ["사회적 고립 문제 해결", "자립 회복 프로그램 연구", "세운상가", "진로 전환기"],
  },
};

/** `star`가 뽑힐 확률. 「평소엔 대표 키워드, 가끔 나머지」(대표 확정 08-20) = 열흘에 이레.
 *  ⭐브랜드별 후보 수와 **무관하게** 같은 비율이라 결과가 예측된다 — 가중치를 개수로 주면
 *   별표 4개인 캔가와 1개인 두더지요가원의 체감이 완전히 달라진다. */
const STAR_RATE = 0.7;

/** 오늘의 키워드 — 브랜드마다 **대표가 골라 둔 말 중 하나**를 날짜에 따라 내놓는다.
 *  씨앗에 slug를 섞는 이유: 브랜드마다 **따로** 돌아야 한다(같은 씨앗이면 전부 같은 인덱스가 뽑힌다). */
export function dailySpotlights(brands: readonly Maker[], seed: string, max = SPOTLIGHT_MAX): Spotlight[] {
  const out: Spotlight[] = [];
  for (const m of brands) {
    if (out.length >= max) break;
    const rand = rng(hash32(`${seed}:${m.slug}`));
    const curated = CURATED_PICKS[m.slug];
    // 🔒**그 브랜드 소개서에 실제로 있는 키워드만 통과시킨다.**
    //   칩을 누르면 목록이 `keywords` 일치로 좁혀지므로(대표 지시 08-20 — 이동이 아니라 정렬),
    //   소개서에 없는 말이 칩으로 뜨면 **눌렀을 때 0건**이 된다. 여기서 걸러 그 화면을 원천 차단한다.
    //   ⭐부수 효과: 나중에 소개서 키워드가 바뀌어 아래 목록과 어긋나도 조용히 자정된다
    //   (지금 걸리는 건 로컬페이지 「보홀 자유여행」 하나 — 소개서에 넣으면 저절로 다시 뜬다).
    const has = (w: string) => m.keywords.includes(w);
    const star = curated ? curated.star.filter(has) : [];
    const rest = (curated ? curated.rest : m.keywords).filter(has);
    const pool = star.length && (!rest.length || rand() < STAR_RATE) ? star : rest;
    const words = pool.filter((k) => k.trim());
    if (!words.length) continue;
    out.push({ text: words[Math.floor(rand() * words.length)], slug: m.slug, name: m.name });
  }
  return out;
}
