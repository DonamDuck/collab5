// 하루 가게 — 공간 검토의 «순수» 규칙 (2026-09-19 저녁)
//
// 🚨훅도 DB도 fetch도 없다. 등록 폼(클라이언트)·서버 액션·검토 화면이 «같은 함수»로 판정한다(`bizcheck.ts`와 같은 규율).
//   저장하면 어느 상태로 가나, 왜 검토로 가나를 화면과 서버가 따로 적으면 화면은 「바로 보여요」, 서버는 「검토 대기」인 날이 온다.
import { addressMoved, bizOnFile } from "./bizcheck";
import type { SpaceStatus } from "./types";

/** 이번 저장이 검토 대기로 가는 이유. `none`이면 상태가 그대로다. */
export type ReviewWhy = "new" | "draft" | "renamed" | "moved" | "biz-first" | "none";

type ReviewPrev = { status: SpaceStatus; name: string; address: string; bizNumber: string };
type ReviewNext = { name: string; address: string; bizNumber: string };

/** 🧾저장하면 어느 상태가 되나 — `saveSpaceAction`이 정본으로 쓰고, 등록 폼이 저장 뒤 한 줄(`?saved=`)을 고를 때 같은 함수를 부른다.
 *  검토 대기로 가는 경우
 *   · 새 공간 · 초안(09-18 밤 QA H-10: 초안은 저장하면 검토로 올라간다)
 *   · 매장 이름이나 주소가 바뀜(대표 09-16: 「가게가 바뀌는」 둘만 다시 본다)
 *   · 🆕사업자등록번호가 비어 있던 공간이 «처음» 채움(대표 09-19 저녁). 전엔 공개 중인 옛 공간이 번호를 채우면
 *     검토 없이 곧장 목록에 섰다(`spaceListed` = 공개 + 번호). 번호가 곧 손님 앞에 서는 조건이라, 처음 채울 때 한 번은 사람이 본다.
 *  ⚠️쉬는 중(`paused`)인 공간은 이름·주소를 못 바꾸고 번호도 처음 채우지 못한다(`pausedChangeProblem`). 여기 오기 전에 막힌다. */
export function spaceSaveReview(
  prev: ReviewPrev | null,
  next: ReviewNext,
): { status: SpaceStatus; why: ReviewWhy; renamed: boolean; moved: boolean } {
  if (!prev) return { status: "pending", why: "new", renamed: false, moved: false };
  const renamed = prev.name.trim() !== next.name.trim();
  const moved = addressMoved(prev, next.address);
  if (prev.status === "draft") return { status: "pending", why: "draft", renamed, moved };
  if (renamed) return { status: "pending", why: "renamed", renamed, moved };
  if (moved) return { status: "pending", why: "moved", renamed, moved };
  if (!bizOnFile(prev) && bizOnFile(next)) return { status: "pending", why: "biz-first", renamed, moved };
  return { status: prev.status, why: "none", renamed, moved };
}

/** ⏸쉬는 중엔 못 하는 저장 — 이름·주소 바꾸기(09-18 밤 QA H-02·SC-04)와 사업자등록번호 처음 채우기(09-19 저녁).
 *  둘 다 검토 대기로 내려가는 저장인데, 관리자가 검토를 통과시키는 순간 «쉬는 중»이던 공간이 그대로 목록에 열린다.
 *  @returns 막는 말과 그 칸. 문제가 없으면 null. */
export function pausedChangeProblem(
  prev: ReviewPrev | null,
  next: ReviewNext,
): { field: "name" | "address" | "biz"; message: string } | null {
  if (prev?.status !== "paused") return null;
  if (prev.name.trim() !== next.name.trim()) return { field: "name", message: "쉬는 동안엔 이름과 주소를 못 바꿔요. 다시 여신 뒤에 바꿔 주세요." };
  if (addressMoved(prev, next.address)) return { field: "address", message: "쉬는 동안엔 이름과 주소를 못 바꿔요. 다시 여신 뒤에 바꿔 주세요." };
  if (!bizOnFile(prev) && bizOnFile(next)) {
    return { field: "biz", message: "쉬는 동안엔 사업자 정보를 처음 채울 수 없어요. 다시 여신 뒤에 채워 주세요. 저희가 한 번 읽어 보고 목록에 열어 드려요." };
  }
  return null;
}
