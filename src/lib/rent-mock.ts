// 하루 팝업 — 목 데이터 스위치 (2026-09-17 대표: 디자인팀과 대표가 모든 화면 × 모든 상태를 URL 하나로)
//
// ⭐**페이지는 안 고친다. 읽기 함수 첫 줄에서 값을 갈아 끼운다.** 페이지마다 목 분기를 넣으면 목 화면과
//   실제 화면이 갈라지고, 디자인팀이 본 화면이 손님이 보는 화면이 아니게 된다.
//   갈아 끼우는 자리 = `spaces.ts` 읽기 · `profiles.ts`의 `getSessionUserId`·`getProfileById` · `rent-actions.ts`의
//   `isRentAdmin` · `repo.ts`의 `getMakerBySlug`·`listMakersByOwner` · `payout-accounts.ts` 읽기.
// 🔌켜는 법 = 쿠키 `rent_mock`에 케이스 이름. `/dev/rent-mock?case=…&to=…`가 넣고 `/dev/rent-map`이 목록을 보여 준다.
//
// 🚨**운영에선 절대 안 켜진다.** 첫 줄이 `process.env.NODE_ENV !== "development"`면 null이다. Next는 빌드 때
//   이 값을 문자열 상수로 박으므로 운영 번들에선 조건이 `"production" !== "development"` → 늘 참이 되어
//   아래 쿠키 읽기까지 닿는 길이 없다. 쿠키를 손으로 넣어도 운영 서버는 이 파일에서 바로 돌아간다.
// 🚨쓰기는 막는다. 목 쿠키가 있는 동안 하루 팝업 서버 액션은 DB·토스를 안 건드리고 `RENT_MOCK_BLOCKED`를 돌려준다.
//
// 🗺09-18 사이트 전체로 넓혔다(`/dev/map`). 대표: 「map으로 만들면 디자인팀 검수 같은 것도 하기 편하고 나도 그냥 들어가서 막 볼 수 있기도 하고」.
//   목 모드면 `repo` 전체(`site-mock-repo.ts`)·세션(`supabase/server.ts`의 `getSessionUser*`)·프로필·매거진 편집 권한·
//   요약 리포트까지 목 세계를 본다. **목 모드 = DB·외부 AI·메일 0회**가 목표다. 쓰기는 두 겹(서버 액션 첫 줄 + 쓰기 함수 첫 줄).
//   쿠키 이름 `rent_mock`은 그대로 둔다. 대표·디자인팀이 이미 쓰는 링크(`/dev/rent-mock?case=…`)가 살아 있어야 해서.
import { cookies } from "next/headers";
import { MOCK_CASES, type MockCaseDef } from "./rent-mock-data";
import { buildSiteWorld, type SiteWorld } from "./site-mock-data";

export const RENT_MOCK_COOKIE = "rent_mock";

export type MockCase = MockCaseDef & { data: SiteWorld };

/** 지금 요청이 목 모드면 케이스를, 아니면 null. */
export async function getRentMock(): Promise<MockCase | null> {
  if (process.env.NODE_ENV !== "development") return null;
  let id: string | undefined;
  try {
    id = (await cookies()).get(RENT_MOCK_COOKIE)?.value;
  } catch {
    // 요청 밖(크론·스크립트·빌드)에서 불리면 쿠키가 없다. 그땐 실제 데이터로.
    return null;
  }
  if (!id) return null;
  const def = MOCK_CASES.find((c) => c.id === id);
  if (!def) return null;
  return { ...def, data: buildSiteWorld(def.world) };
}

/** 사이트 전체에서 부르는 이름. 하루 팝업 코드는 옛 이름(`getRentMock`)을 그대로 쓴다. */
export const getSiteMock = getRentMock;

/** 목 모드인가 — 쓰기 함수 첫 줄에서 쓴다. */
export async function rentMockOn(): Promise<boolean> {
  return (await getRentMock()) !== null;
}

/** 목 모드에서 쓰기 액션이 돌려주는 답. 화면이 보통 에러 줄로 그대로 띄운다. */
export const RENT_MOCK_BLOCKED = { ok: false, message: "목 데이터 보기 중이라 저장하지 않았어요" } as const;

/** 사이트 쓰기 액션이 돌려주는 에러 문장. 화면들이 `{ error }`를 그대로 띄운다. */
export const MOCK_BLOCKED_MSG = RENT_MOCK_BLOCKED.message;

/** 목 모드에서 쓰기 함수(두 번째 울타리)가 던지는 에러. 액션 첫 줄이 먼저 막으니 평소엔 닿지 않는다. */
export async function throwIfMock(what: string): Promise<void> {
  if (await rentMockOn()) throw new Error(`${MOCK_BLOCKED_MSG} (${what})`);
}
