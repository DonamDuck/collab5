// 하루 가게 — 공간 검토의 «순수» 규칙 (2026-09-19 저녁)
//
// 🚨훅도 DB도 fetch도 없다. 등록 폼(클라이언트)·서버 액션·검토 화면이 «같은 함수»로 판정한다(`bizcheck.ts`와 같은 규율).
//   저장하면 어느 상태로 가나, 왜 검토로 가나를 화면과 서버가 따로 적으면 화면은 「바로 보여요」, 서버는 「검토 대기」인 날이 온다.
import { addressMoved, bizOnFile, isTestBizNumber } from "./bizcheck";
import type { BizCheckStatus, SpaceStatus } from "./types";

/** 이번 저장이 검토 대기로 가는 이유. `none`이면 상태가 그대로다.
 *  `resubmit` = 보완 요청을 받은 공간을 사장님이 고쳐 다시 보냄(09-19 저녁). */
export type ReviewWhy = "new" | "draft" | "resubmit" | "renamed" | "moved" | "biz-first" | "none";

type ReviewPrev = { status: SpaceStatus; name: string; address: string; bizNumber: string; reviewRejectedAt?: string };
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
  // 🔁보완 요청을 받은 공간은 무엇을 고쳤든(아무것도 안 고쳤어도) 저장하면 «다시 보낸 것»이다. 반려 표시는 호출부가 지운다.
  if (needsFix(prev)) return { status: "pending", why: "resubmit", renamed, moved };
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

// ─── 🔁보완 요청(반려) — 대표 09-19 저녁 ───
// 대표 원문: 「주소 비교는 어드민에서 확인하고 사업자 거절(사람이 하되 너랑 같이 할 거야)되면 반려 처리되고,
//   보완해 달라는 이메일과, 사장님 입장에서 보완해서 재제출할 수 있는 환경을 만들어 주자!」
// «보완 필요» = `pending` + `reviewRejectedAt`(SQL `2026-09-19-rent-review-reject.sql` 머리말). 상태 칸엔 값을 더하지 않았다.

/** 보완을 기다리는 공간인가. 목록엔 안 나오고(검토 대기라서), 사장님 화면엔 사유와 [고치고 다시 보내기]가 선다. */
export function needsFix(sp: { status: string; reviewRejectedAt?: string }): boolean {
  return sp.status === "pending" && !!sp.reviewRejectedAt;
}

/** 보완 요청을 받았다가 고쳐 다시 보낸 공간인가 — 사유(`reviewNote`)는 남고 반려 시각만 지워진 모양. 검토 화면이 「지난 요청」을 띄운다. */
export function resubmitted(sp: { status: string; reviewRejectedAt?: string; reviewNote?: string }): boolean {
  return sp.status === "pending" && !sp.reviewRejectedAt && !!sp.reviewNote?.trim();
}

/** 보완 사유 글자 수 상한. 메일·화면에 그대로 나가는 말이라 짧게 받는다. */
export const REVIEW_NOTE_MAX = 500;

/** 팝업의 칩 — 누르면 사유 칸에 한 줄씩 붙는다. 대표가 짚은 넷(사업자 거절의 흔한 이유)이다. 사장님께 그대로 가는 말이라 해요체로 적는다. */
export const FIX_REASON_CHIPS = [
  "사업자등록증의 주소와 공간 주소가 달라요.",
  "사업자등록증이 잘 안 보여요.",
  "대표자 이름이 등록증과 달라요.",
  "휴업·폐업 상태로 조회돼요.",
] as const;

/** 사유 칸의 문제 한 줄. 문제가 없으면 빈 문자열. 팝업과 서버 액션이 같은 함수로 본다. */
export function fixNoteProblem(note: string): string {
  const t = (note ?? "").trim();
  if (!t) return "무엇을 고쳐 주시면 될지 골라 주시거나 적어 주세요.";
  if (t.length > REVIEW_NOTE_MAX) return `사유가 길어요. ${REVIEW_NOTE_MAX}자 안으로 줄여 주세요.`;
  return "";
}

/** SQL 전 DB에서 [보완 요청]이 잠긴 이유 — 관리자 화면에만 선다. */
export const REVIEW_SQL_LINE = "보완 요청을 저장할 칸이 아직 없어요. SQL(2026-09-19-rent-review-reject.sql)을 먼저 돌려 주세요.";

/** 🏠이번 저장에 적을 «바뀌기 전» 이름·주소 — 관리자가 마지막으로 본 값이다. 검토 화면이 「주소 바뀜: 이전 → 새」로 보여 준다.
 *  · 기준 = 이미 적혀 있던 값(검토 대기 중에 또 바꿔도 처음 값을 지킨다). 없으면 공개·쉬는 중일 때의 지금 값.
 *    검토 대기(새 공간)나 초안은 관리자가 본 값이 없어 기준도 없다.
 *  · 새 값이 기준과 같아지면(되돌렸으면) 지운다.
 *  @returns 바꿀 게 없으면 null — 저장이 이 칸들을 아예 안 보낸다(SQL 전 DB에서 헛걸음이 없게). */
export function reviewPrevFor(
  prev: { status: SpaceStatus; name: string; address: string; reviewPrevName?: string; reviewPrevAddress?: string } | null,
  next: { name: string; address: string },
): { reviewPrevName: string; reviewPrevAddress: string } | null {
  if (!prev || prev.status === "draft") return null;
  const listedBefore = prev.status === "open" || prev.status === "paused";
  const baseName = prev.reviewPrevName?.trim() || (listedBefore ? prev.name.trim() : "");
  const baseAddress = prev.reviewPrevAddress?.trim() || (listedBefore ? prev.address.trim() : "");
  const out = {
    reviewPrevName: baseName && baseName !== next.name.trim() ? baseName : "",
    reviewPrevAddress: baseAddress && baseAddress !== next.address.trim() ? baseAddress : "",
  };
  const same = out.reviewPrevName === (prev.reviewPrevName ?? "").trim() && out.reviewPrevAddress === (prev.reviewPrevAddress ?? "").trim();
  return same ? null : out;
}

/** 검토 화면 「이 부분을 확인해 보세요」 한 줄의 재료. `warn`은 빨강(열 수 없거나 사람이 꼭 봐야 하는 것), `look`은 레몬(눈으로 한 번). */
export type ReviewSignal = { tone: "warn" | "look"; text: string };

/** 🔎자동으로 읽을 수 있는 신호를 모은다 — 판정은 사람이 한다(대표: 「사람이 하되 너랑 같이 할 거야」).
 *  국세청 결과 · 네이버 일치 · 주소·이름 바뀜 · 예금주≠대표자 · 테스트 번호. 아무것도 안 걸리면 빈 배열이다.
 *  @param holderDiffers 정산 계좌 예금주가 대표자와 다른가(`holderDiffersFromOwner`). 계좌가 없거나 견줄 수 없으면 null. */
export function reviewSignals(
  sp: {
    bizNumber: string; bizCheckStatus: BizCheckStatus; bizCheckDetail?: { reason?: string };
    placeMatchedAt?: string; placeName: string; reviewPrevName?: string; reviewPrevAddress?: string;
  },
  holderDiffers: boolean | null,
): ReviewSignal[] {
  const out: ReviewSignal[] = [];
  if (isTestBizNumber(sp.bizNumber)) {
    out.push({ tone: bizOnFile(sp) ? "look" : "warn", text: bizOnFile(sp) ? "로컬 테스트 번호예요. 운영에선 통과하지 않아요." : "로컬 테스트 번호라 운영에선 빈 번호로 봐요." });
  } else if (sp.bizCheckStatus === "mismatch") {
    out.push({ tone: "warn", text: "국세청 기록과 달라요. 번호·대표자 이름·개업일 중 무엇이 다른지 등록증과 견줘 보세요." });
  } else if (sp.bizCheckStatus === "closed") {
    out.push({ tone: "warn", text: "국세청에 휴업·폐업으로 나와요." });
  } else if (sp.bizCheckStatus === "error" || sp.bizCheckStatus === "none") {
    out.push({ tone: "look", text: `국세청 ${sp.bizCheckStatus === "error" ? "조회가 실패했어요" : "조회 전이에요"}. 등록증의 번호·대표자·개업일을 눈으로 봐 주세요.` });
  }
  if (sp.reviewPrevAddress?.trim()) out.push({ tone: "look", text: "주소가 바뀌었어요. 등록증의 사업장 주소가 새 주소와 맞는지 봐 주세요." });
  if (sp.reviewPrevName?.trim()) out.push({ tone: "look", text: "공간 이름이 바뀌었어요." });
  if (!(sp.placeMatchedAt && sp.placeName)) out.push({ tone: "look", text: "네이버에서 같은 가게를 못 찾았어요. 주소는 등록증과만 견줄 수 있어요." });
  if (holderDiffers) out.push({ tone: "look", text: "정산 계좌 예금주가 대표자와 달라요." });
  return out;
}
