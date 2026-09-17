import { MOCK_IDS } from "@/lib/rent-mock-data";
import type { Group, Popup } from "./types";

// 🗺하루 가게 묶음 (2026-09-17 `/dev/rent-map`에서 옮겨 옴 → 09-18 사이트 지도 `/dev/map#rent`의 한 묶음)
// ⭐이 목록은 코드의 실제 분기를 읽고 만들었다. 화면에 갈래가 늘면 여기에도 줄을 더한다.

const S = MOCK_IDS.space;
const B = MOCK_IDS.booking;
const M = MOCK_IDS.maker;

export const RENT_GROUPS: Group[] = [
  {
    id: "rent-guest",
    title: "손님",
    screens: [
      {
        title: "목록",
        path: "/rent",
        rows: [
          { desc: "공간 여럿 (공개 중인 곳만 카드로)", c: "guest-full", to: "/rent" },
          { desc: "업종으로 거른 결과", c: "guest-full", to: "/rent?category=cafe" },
          { desc: "거르기 결과 0건", c: "guest-full", to: "/rent?area=제주" },
          { desc: "설비 낱말로 찾기 (와이파이)", c: "guest-full", to: "/rent?area=와이파이" },
          { desc: "공간이 한 곳도 없을 때", c: "guest-empty", to: "/rent" },
          { desc: "긴 이름 카드", c: "stress-guest", to: "/rent" },
          { desc: "사진·업종 없는 카드", c: "minimal-guest", to: "/rent" },
        ],
      },
      {
        title: "공간 상세와 신청 폼",
        path: "/rent/[slug]",
        note: "신청 폼은 상세 맨 아래에 있어요. 상품을 두 개 파는 공간은 맨 위에서 「대관만·공간 전체」 중 하나를 골라야 금액이 떠요. 고른 뒤 시간을 정하고 상품을 바꾸면 아래 바 금액이 같이 바뀌어요. 상품을 안 고르고 「신청하기」를 누르면 오류 줄이, 전화번호를 지우고 누르면 번호 오류 줄이 떠요.",
        rows: [
          { desc: "모든 칸이 찬 공간 · 상품 둘(대관만·공간 전체, 값과 설명이 다름) · 신청 폼 상품 고르기 · 커피챗 · 소개서 카드 · 내리면 뜨는 알약 줄", c: "guest-full", to: `/rent/${S.full}` },
          { desc: "같은 공간을 로그인 안 하고 볼 때", c: "anon", to: `/rent/${S.full}` },
          { desc: "열린 시간이 없는 공간 · 공간 전체 하나만 팜", c: "guest-full", to: `/rent/${S.noSlots}` },
          { desc: "커피챗·소개서 없는 공간 · 대관만 하나만 팜 (신청 폼에 고르기 없이 한 줄)", c: "guest-full", to: `/rent/${S.other}` },
          { desc: "긴 글 (사진 12장, 유의 사항 12줄, 주제 8줄)", c: "stress-guest", to: `/rent/${S.stress}` },
          { desc: "최소 입력 (사진·소개·설비·전화 없음), 번호 없는 손님", c: "minimal-guest", to: `/rent/${S.minimal}` },
          { desc: "검토 대기 공간을 남이 열면 404", c: "guest-full", to: `/rent/${S.pending}` },
        ],
      },
      {
        title: "결제",
        path: "/rent/pay/[orderId]",
        note: "결제창은 이 컴퓨터에 넣어 둔 토스 키로 떠요. 끝까지 눌러도 돈을 확정하는 단계(승인)를 막아 두어서 실패 화면으로 가요.",
        rows: [
          { desc: "결제 전 신청 (대관만, 커피챗 담음, 취소 규정 한 줄)", c: "guest-full", to: `/rent/pay/mock-order-${B.pending}` },
          { desc: "긴 글 · 큰 금액", c: "stress-guest", to: `/rent/pay/mock-order-${B.stressPending}` },
          { desc: "결제 실패 화면", c: "guest-full", to: "/rent/pay/fail?message=사용자가 결제를 취소했어요" },
        ],
      },
      {
        title: "예약 한 건",
        path: "/rent/done/[bookingId]",
        rows: [
          { desc: "결제 완료, 공간 전체, 이용일 전, 커피챗 담음, 사장님 연락처 열림", c: "guest-full", to: `/rent/done/${B.paid}` },
          { desc: "확정된 예약, 이용일 전, 사장님 말씀 있음", c: "guest-full", to: `/rent/done/${B.confirmed}` },
          { desc: "확정된 예약, 커피챗·소개서 없는 공간", c: "guest-full", to: `/rent/done/${B.confirmedOther}` },
          { desc: "다녀온 예약 (연락처 가림)", c: "guest-full", to: `/rent/done/${B.done}` },
          { desc: "사장님 거절, 환불이 아직 안 끝남", c: "guest-full", to: `/rent/done/${B.rejected}` },
          { desc: "사장님 거절 뒤 환불 완료", c: "guest-full", to: `/rent/done/${B.refunded}` },
          { desc: "손님 취소, 일부 돌려받음", c: "guest-full", to: `/rent/done/${B.cancelledFuture}` },
          { desc: "손님 취소, 이용일 지남", c: "guest-full", to: `/rent/done/${B.cancelledPast}` },
          { desc: "결제 시간이 지난 신청", c: "guest-full", to: `/rent/done/${B.expired}` },
          { desc: "결제 전 신청을 열면 신청 목록으로 넘어가요", c: "guest-full", to: `/rent/done/${B.pending}` },
          { desc: "남의 예약이나 없는 번호 (404)", c: "guest-full", to: `/rent/done/${B.refundReq}` },
          { desc: "긴 글 · 확정", c: "stress-guest", to: `/rent/done/${B.stressConfirmed}` },
          { desc: "최소 입력 · 결제 완료 (사장님 이름·번호 없음)", c: "minimal-guest", to: `/rent/done/${B.minimalPaid}` },
        ],
      },
      {
        title: "내가 보낸 신청",
        path: "/rent/requests",
        note: "결제 안 한 신청 세 건은 맨 아래에 접혀 있어요. 날짜가 지난 결제 전 신청도 한 줄 있어요.",
        rows: [
          { desc: "앞으로 갈 곳, 지난 신청, 접힌 결제 안 한 신청", c: "guest-full", to: "/rent/requests" },
          { desc: "빈 목록", c: "guest-empty", to: "/rent/requests" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/requests" },
          { desc: "긴 글", c: "stress-guest", to: "/rent/requests" },
          { desc: "최소 입력", c: "minimal-guest", to: "/rent/requests" },
        ],
      },
    ],
  },
  {
    id: "rent-host",
    title: "사장님",
    screens: [
      {
        title: "내 하루 가게",
        path: "/rent/my",
        note: "공간 넷은 공개 중·검토 대기·쉬는 중·초안이에요. 들어온 요청은 새 요청(수락 전 손님 정보), 이용 시간이 시작된 결제 완료, 확정(연락처 열림), 환불 신청 중, 다녀감(가림), 거절, 환불, 손님 취소 둘이에요. 맨 아래 「내가 빌린 공간」도 한 건 있어요. 「알림」 줄은 맨 위에 한 번 뜨고 주소에서 지워져요. 다시 보려면 링크를 한 번 더 누르면 돼요.",
        rows: [
          { desc: "모든 상태, 정산 계좌 있음 (요청 줄 첫머리에 대관만·공간 전체)", c: "host-full", to: "/rent/my" },
          { desc: "같은 화면, 정산 계좌 없음 (확정 줄마다 계좌 등록 한 줄)", c: "host-noaccount", to: "/rent/my" },
          { desc: "관리자이기도 한 사장님 (정산하기 링크, 검토 대기 공간에 공개하기 버튼)", c: "host-admin", to: "/rent/my" },
          { desc: "올린 공간이 없을 때", c: "host-empty", to: "/rent/my" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/my" },
          { desc: "알림 · 처음 올린 뒤", c: "host-full", to: "/rent/my?saved=new" },
          { desc: "알림 · 이름이나 주소를 바꿔 검토로 다시 갈 때", c: "host-full", to: "/rent/my?saved=review" },
          { desc: "알림 · 검토 중에 고침", c: "host-full", to: "/rent/my?saved=pending" },
          { desc: "알림 · 공개 중에 고침", c: "host-full", to: "/rent/my?saved=ok" },
          { desc: "알림 · 쉬는 동안 고친 경우", c: "host-full", to: "/rent/my?saved=kept" },
          { desc: "알림 · 수락 직후", c: "host-full", to: `/rent/my?did=accept&b=${B.confirmed}` },
          { desc: "알림 · 거절하고 환불까지 끝남", c: "host-full", to: `/rent/my?did=reject&b=${B.refunded}` },
          { desc: "알림 · 거절했는데 환불이 늦어질 때", c: "host-full", to: `/rent/my?did=reject&b=${B.rejected}` },
          { desc: "긴 글", c: "stress-host", to: "/rent/my" },
          { desc: "최소 입력 (손님 이름·번호 없음)", c: "minimal-host", to: "/rent/my" },
        ],
      },
      {
        title: "사장님이 보는 내 공간 상세",
        path: "/rent/[slug]",
        rows: [
          { desc: "공개 중인 내 공간 (신청 대신 안내 한 줄)", c: "host-full", to: `/rent/${S.full}` },
          { desc: "검토 대기 중인 내 공간", c: "host-full", to: `/rent/${S.pending}` },
          { desc: "쉬는 중인 내 공간", c: "host-full", to: `/rent/${S.paused}` },
        ],
      },
      {
        title: "공간 올리기",
        path: "/rent/new",
        note: "임시 저장 복원은 링크로 못 열어요. 폼에 몇 칸 적고 새로고침하면 복원 안내가 떠요. 저장은 계정마다 따로 브라우저에 남아요. 「무엇을 파실까요」에서 상품을 하나도 안 켜고 「등록하기」를 누르면 상품 오류가, 켜고 값·설명을 비우면 그 칸 오류가 떠요.",
        rows: [
          { desc: "빈 폼 (가입 때 적은 이름·번호, 첫 소개서가 미리 채워짐)", c: "host-full", to: "/rent/new" },
          { desc: "이름·번호·소개서가 없는 사장님의 빈 폼", c: "minimal-host", to: "/rent/new" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/new" },
        ],
      },
      {
        title: "공간 고치기",
        path: "/rent/[slug]/edit",
        rows: [
          { desc: "공개 중인 공간 · 상품 셋 다 켬", c: "host-full", to: `/rent/${S.full}/edit` },
          { desc: "검토 중인 공간 · 공간 전체만 켬", c: "host-full", to: `/rent/${S.pending}/edit` },
          { desc: "쉬는 중인 공간 · 대관만 켬", c: "host-full", to: `/rent/${S.paused}/edit` },
          { desc: "초안", c: "host-full", to: `/rent/${S.draft}/edit` },
          { desc: "긴 글", c: "stress-host", to: `/rent/${S.stress}/edit` },
          { desc: "최소 입력", c: "minimal-host", to: `/rent/${S.minimal}/edit` },
        ],
      },
    ],
  },
  {
    id: "rent-admin",
    title: "관리자",
    screens: [
      {
        title: "정산",
        path: "/rent/payouts",
        note: "보낼 돈은 계좌가 있는 사장님과 없는 사장님 두 묶음이에요. 보내는 중(요청함·실패), 손이 필요한 예약 둘, 보낸 돈까지 한 화면에 있어요.",
        rows: [
          { desc: "환불 신청, 보낼 돈, 보내는 중, 손이 필요한 예약, 보낸 돈", c: "admin-full", to: "/rent/payouts" },
          { desc: "처리할 것이 없을 때", c: "admin-empty", to: "/rent/payouts" },
          { desc: "긴 글 (긴 사유, 긴 예금주)", c: "stress-admin", to: "/rent/payouts" },
          { desc: "관리자가 아닌 사람이 열면 404", c: "host-full", to: "/rent/payouts" },
        ],
      },
    ],
  },
  {
    id: "rent-common",
    title: "공통",
    screens: [
      {
        title: "하루 가게에서 이어지는 다른 화면",
        path: "",
        rows: [
          { desc: "홈 (오른쪽 아래 카카오톡 버튼)", c: "guest-full", to: "/" },
          { desc: "고객센터", c: "guest-full", to: "/help" },
          { desc: "이용약관 · 하루 가게 조항", c: "guest-full", to: "/terms#rent" },
          { desc: "호스트 약관", c: "guest-full", to: "/terms/host" },
          { desc: "개인정보처리방침", c: "guest-full", to: "/privacy" },
          { desc: "사장님 소개서 (하루 가게로 돌아가기 버튼)", c: "guest-full", to: `/m/${M.host}?back=/rent/${S.full}` },
          { desc: "긴 이름 소개서 (돌아가기 버튼)", c: "stress-guest", to: `/m/${M.stress}?back=/rent/${S.stress}` },
          { desc: "없는 예약 번호 (하루 가게 404)", c: "guest-full", to: "/rent/done/99999999" },
        ],
      },
    ],
  },
];

export const RENT_POPUPS: Popup[] = [
  { where: { desc: "공간 상세", c: "guest-full", to: `/rent/${S.full}` }, button: "상품·날짜·시간을 고르고 「신청하기」", title: "이대로 신청할까요?" },
  { where: { desc: "예약 한 건", c: "guest-full", to: `/rent/done/${B.confirmed}` }, button: "「예약 취소하기」", title: "예약을 취소할까요?" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "새 요청 줄의 「거절」", title: "이 요청을 거절할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "이용 시간이 시작된 줄의 「관리자에게 환불 신청하기」", title: "관리자에게 환불을 신청할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "공개 중인 공간 줄의 「잠시 쉬기」", title: "잠시 쉴까요?" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「승인하고 환불」", title: "환불을 승인할까요" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「신청 닫기」", title: "환불 신청을 닫을까요" },
];

