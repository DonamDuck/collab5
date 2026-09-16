// 하루 가게 — 목 데이터 스위치 (2026-09-17 대표: 디자인팀과 대표가 모든 화면 × 모든 상태를 URL 하나로)
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
// 🚨쓰기는 막는다. 목 쿠키가 있는 동안 하루 가게 서버 액션은 DB·토스를 안 건드리고 `RENT_MOCK_BLOCKED`를 돌려준다.
import { cookies } from "next/headers";
import { buildWorld, MOCK_CASES, type MockCaseDef, type MockWorld } from "./rent-mock-data";

export const RENT_MOCK_COOKIE = "rent_mock";

export type MockCase = MockCaseDef & { data: MockWorld };

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
  return { ...def, data: buildWorld(def.world) };
}

/** 목 모드인가 — 쓰기 함수 첫 줄에서 쓴다. */
export async function rentMockOn(): Promise<boolean> {
  return (await getRentMock()) !== null;
}

/** 목 모드에서 쓰기 액션이 돌려주는 답. 화면이 보통 에러 줄로 그대로 띄운다. */
export const RENT_MOCK_BLOCKED = { ok: false, message: "목 데이터 보기 중이라 저장하지 않았어요" } as const;
