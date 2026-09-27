import type { Metadata } from "next";
import Link from "next/link";
import {
  PAY_CHECKING_BODY, PAY_CHECKING_CODES, PAY_CHECKING_LINE, PAY_CHECKING_TITLE, PAY_FAIL_METHOD_UNSUPPORTED, PAY_FAIL_NOT_AVAILABLE, PAY_FAIL_SLOT_TAKEN,
  PAY_FAIL_SLOT_TAKEN_REFUNDED, PAY_FAIL_SLOT_TAKEN_REFUND_PENDING,
  PAY_FAIL_USE_STARTED, PAY_FAIL_WINDOW_OVER,
} from "@/lib/rent-payment";
import { KAKAO_CHAT_URL } from "@/lib/site";
import { getBookingByOrderId, getSpacePublic, listSpacesByIds } from "@/lib/spaces";
import { spaceListed } from "@/lib/bizcheck";
import { primaryBtnCls, secondaryBtnCls } from "../../ui";

// 하루 팝업 — 결제가 안 끝났을 때 (2026-09-13)
//
// ⭐말투를 「실패」로 쓰지 않는다. 여기 닿는 사람의 대부분은 고장이 아니라 **마음이 바뀐 쪽**이고,
//   카드가 안 됐더라도 그건 본인 잘못이 아니다. 다시 돌아갈 길만 분명히 보이면 된다.
//
// 🎨09-13 재작업 — 크기만 사다리에 맞췄다(제목 22 · 본문 17 · 사유 15). 사유의 회색 상자는 인용선으로.
//   🔁09-27(fix-six) 버튼은 전부 보조였는데(돌아가는 길이 여럿이라) 이제 «새로 신청하기»가 주 버튼이다(아래 머리말).
//
// 🔁09-27(fix-six) 대표 — **같은 주문으로 다시 결제하는 버튼(「다시 결제하기」)을 모든 갈래에서 뺐다.**
//   대표 원문: 「결제 실패 시에 마이로 들어와서 다시 결제하는 것보다 신규로 시작하는 경우가 대부분일 거야. 그냥 내 의견대로 제거하자.」
//   대신 그 공간 신청 자리(`/rent/<slug>#apply`)로 가는 「다시 신청하기」가 주 버튼이다. 공간을 모르거나 손님 앞에 안 서는 공간이면
//   목록(`/rent`)으로 가는 「다른 공간 보기」가 주 버튼이 된다. 결제 전 신청은 자리를 잡지 않아서 같은 시간을 새로 골라도 된다.
//   🚫«확인 중» 갈래엔 새로 신청하는 길도 두지 않는다(09-27 그대로) — 돈이 나갔을 수 있는데 한 번 더 결제하게 된다. 내 예약·문의만.
//
// 🔒09-18 밤 QA(SEC-06) — **주소의 `message`를 화면에 쓰지 않는다.** 전엔 그 글을 그대로 보여 줬는데,
//   이 주소는 누구나 만들 수 있다. 「결제 점검 중이라 010-…로 계좌이체해 주세요」 같은 글을 우리 화면에 띄운 링크를
//   돌리면 손님은 우리 말로 읽는다. 이제 `code`만 보고 우리가 쓴 문장을 고른다. 모르는 코드는 기본 문장 하나.
//   코드는 둘에서 온다. ① 토스 결제창이 실패 주소로 보낼 때 붙이는 코드 ② 결제 승인 라우트(`pay/success`)가 붙이는 우리 코드.
export const metadata: Metadata = {
  title: "결제가 끝나지 않았어요 — collab5",
  robots: { index: false },
};

/** 코드별 사유 한 줄. ⚠️돈이 «안 나갔다»는 말은 결제창 단계에서 멈춘 코드에만 쓴다(승인 전이라 확실하다).
 *  승인 단계의 알 수 없는 실패는 확인할 수 없어서 기본 문장에 그 말을 넣지 않는다. */
const REASONS = new Map<string, string>([
  // 토스 결제창 — 손님이 창을 닫았다.
  ["PAY_PROCESS_CANCELED", "결제 창을 닫으셔서 결제는 되지 않았어요."],
  // 토스 결제창 — 인증이나 승인 요청 중에 멈췄다.
  ["PAY_PROCESS_ABORTED", "결제가 중간에 멈춰서 결제는 되지 않았어요."],
  // 카드사가 거절했다(결제창 단계 · 승인 단계). 한도·잔액이 가장 흔한 이유라 할 일을 같이 말한다.
  ["REJECT_CARD_COMPANY", "카드사에서 결제를 받지 않았어요. 한도나 잔액을 확인하시거나 다른 카드로 해 주세요."],
  ["REJECT_CARD_PAYMENT", "카드사에서 결제를 받지 않았어요. 한도나 잔액을 확인하시거나 다른 카드로 해 주세요."],
  // 우리 승인 라우트 — 돈은 승인됐는데 그 사이 시간이 찼다(`confirmBookingAction`).
  [PAY_FAIL_SLOT_TAKEN_REFUNDED, "그 사이 그 시간이 찼어요. 결제는 바로 취소해 드렸어요."],
  [PAY_FAIL_SLOT_TAKEN_REFUND_PENDING, "그 사이 그 시간이 찼어요. 환불을 처리하고 있으니 곧 연락드릴게요."],
  // 🛑승인 «전»에 우리가 막은 갈래 — 돈은 한 번도 움직이지 않았다(09-18 밤 QA).
  [PAY_FAIL_WINDOW_OVER, "결제 시간 30분이 지나서 이 신청은 닫혔어요. 공간에서 다시 골라 주세요."],
  [PAY_FAIL_USE_STARTED, "신청하신 시간이 이미 시작돼서 결제할 수 없어요."],
  [PAY_FAIL_SLOT_TAKEN, "그 사이 다른 분이 그 시간을 먼저 예약했어요. 돈은 움직이지 않았어요."],
  [PAY_FAIL_NOT_AVAILABLE, "그 사이 사장님이 이 시간이나 상품을 바꾸셨어요. 돈은 움직이지 않았어요."],
  [PAY_FAIL_METHOD_UNSUPPORTED, "이 결제 수단은 아직 받지 않아요. 카드나 간편결제로 다시 결제해 주세요."],
  // 🔁확인 중 — 겹쳐 들어온 승인(토스 「이 결제는 지금 처리 중」)과 결과를 모르는 승인(`PAY_FAIL_UNKNOWN`, 09-27).
  //   🩸09-23 QA: 처리 중 코드가 표에 없어서 기본 문장으로 떨어졌고, 화면 첫 줄은 「신청은 아직 접수되지 않았어요」였다.
  //     먼저 들어온 요청이 곧 돈을 받고 예약을 올리는 상태라 그 말이 거짓이 된다. 손님이 한 번 더 결제하게 만든다.
  //   🆕09-27 대표 「제안대로 고고」 — 결과를 모르는 승인도 같은 갈래로. 사실 한 줄은 승인 액션의 말과 같은 상수다.
  ...PAY_CHECKING_CODES.map((code) => [code, PAY_CHECKING_LINE] as [string, string]),
]);
const DEFAULT_REASON = "결제를 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/** «확인 중»인 결제 — 처리 중이거나 결과를 모른다. 이 화면의 첫 줄이 「안 됐어요」라고 말하면 안 되는 갈래다.
 *  🚫[다시 결제하기]도 새로 신청하는 길도 세우지 않는다(09-27). 이미 돈이 나갔을 수 있는데 한 번 더 결제하게 된다. */
const CHECKING = new Set<string>(PAY_CHECKING_CODES);

// 🔻09-27(fix-six) `CLOSED`(같은 주문으로 다시 결제할 수 없는 사유 모음)를 지웠다. 이제 어느 갈래도 같은 주문으로 다시 결제하지 않는다.

/** 우리 주문번호 모양(`startBookingAction`: `rent-{공간}-{YYYYMMDD}-{난수}`)과 목 데이터 모양만 받는다. */
const ORDER_ID_RE = /^(rent-\d+-\d{8}-[a-z0-9]{1,16}|mock-order-\d+)$/;

/** 🆕09-27(fix-six) 「다시 신청하기」가 갈 곳 — 그 공간의 신청 자리. 공간을 모르거나 손님 앞에 안 서면(쉬는 중·사업자 번호 없음) 빈 값.
 *  공간 번호는 주문번호 안에 이미 있다(`rent-{공간}-…`). 그걸 먼저 쓴다 — 누가 넣은 주문번호로 예약 행을 읽지 않는다
 *  (주문이 «있는지»를 이 화면으로 가려낼 수 없게. 결제 화면의 `backToSpace`와 같은 규율). 목 주문번호만 예약 행으로 공간을 찾는다.
 *  ⚠️이 화면은 로그인 없이 열린다. 공개 투영(`getSpacePublic`)만 읽고, 손님 목록과 같은 판정(`spaceListed`)으로 가른다. */
async function applyHrefOf(orderId: string): Promise<string> {
  if (!orderId) return "";
  const m = /^rent-(\d+)-\d{8}-/.exec(orderId);
  const spaceId = m ? Number(m[1]) : (await getBookingByOrderId(orderId))?.spaceId ?? null;
  if (!spaceId) return "";
  const brief = (await listSpacesByIds([spaceId])).get(spaceId);
  const space = brief ? await getSpacePublic(brief.slug) : null;
  return space && spaceListed(space) ? `/rent/${space.slug}#apply` : "";
}

export default async function RentPayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; orderId?: string | string[] }>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  const reason = REASONS.get(code) ?? DEFAULT_REASON;
  const orderId = typeof sp.orderId === "string" && ORDER_ID_RE.test(sp.orderId) ? sp.orderId : "";
  const checking = CHECKING.has(code);
  // 🔁09-27(fix-six) 새로 시작하는 길 — 그 공간 신청 자리. 확인 중 갈래엔 안 읽는다(버튼 자체가 없다).
  const applyHref = checking ? "" : await applyHrefOf(orderId);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">
        {checking ? PAY_CHECKING_TITLE : "결제가 끝나지 않았어요"}
      </h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">
        {checking
          ? PAY_CHECKING_BODY
          : "신청은 아직 접수되지 않았어요. 사장님께도 아무 연락이 가지 않았어요."}
      </p>
      <p className="mt-5 border-l-2 border-hairline pl-4 text-[15px] leading-relaxed break-keep text-mute">{reason}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        {/* 🔁09-27(fix-six) 주 버튼 = 그 공간에서 새로 신청. 공간을 모르면 목록이 주 버튼이다.
            높이는 옆 보조 버튼과 같은 44px(한 줄에서 높이가 다르면 어긋나 보인다). */}
        {applyHref && (
          <Link href={applyHref} className={`${primaryBtnCls} h-[44px] px-5`}>
            다시 신청하기
          </Link>
        )}
        {/* 확인 중엔 내 예약이 할 일이라 앞에 둔다. 다른 공간으로 보내는 버튼은 세우지 않는다(새로 신청해 한 번 더 결제하게 된다). */}
        {!checking && (
          <Link href="/rent" className={applyHref ? secondaryBtnCls : `${primaryBtnCls} h-[44px] px-5`}>
            다른 공간 보기
          </Link>
        )}
        {/* 09-16 손님 전용 목록으로(B81). `/rent/my`는 사장님 화면이다. */}
        <Link href="/rent/requests" className={secondaryBtnCls}>
          내 예약 보기
        </Link>
      </div>
      {/* 💬막혔을 때 갈 곳. 버튼 무게를 늘리지 않으려고 글자 링크로 둔다(`/rent/done`과 같은 자리). */}
      <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
        {checking ? "확인이 오래 걸리면" : "계속 안 되면"}{" "}
        <a href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer" className="text-body underline underline-offset-2">
          카카오톡으로 알려 주세요
        </a>
        .
      </p>
    </main>
  );
}
