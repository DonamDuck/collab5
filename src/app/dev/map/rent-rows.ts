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
          { desc: "공간 여럿 (공개 중이고 사업자등록번호가 있는 곳만 카드로. 번호가 빈 「느린오후 뒷마당」은 안 보여요) · 로그인해서 위 메뉴 바에 「내 예약」 칸이 있어요", c: "guest-full", to: "/rent" },
          { desc: "로그인 안 한 사람 · 메뉴 바가 두 칸(하루 빌리기 · 내 공간 등록)", c: "anon", to: "/rent" },
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
          // 🔑09-19 대표 [G] — 로그인 전에도 폼과 결제 바가 떠요. 바 버튼은 「로그인하고 신청하기」.
          { desc: "같은 공간을 로그인 안 하고 볼 때 · 폼을 고를 수 있고 바 버튼은 「로그인하고 신청하기」", c: "anon", to: `/rent/${S.full}` },
          { desc: "로그인하고 돌아온 자리(`?resume=1`) · 같은 탭에서 위 줄로 고르고 바를 누른 다음 이 줄을 열면 고른 값이 되살아나고 확인 팝업이 떠요. 맡긴 값이 없으면 빈 폼이에요", c: "guest-full", to: `/rent/${S.full}?resume=1` },
          { desc: "30분 단위 공간 · 최소 1시간 30분 · 모레는 09:30~12:00 자투리, 사흘 뒤는 13:00~15:30과 16:30~18:00이 찼어요 (시작을 누르면 끝으로 고를 수 있는 칸만 켜져요)", c: "guest-full", to: `/rent/${S.halfHour}` },
          { desc: "열린 시간이 없는 공간 · 공간 전체 하나만 팜", c: "guest-full", to: `/rent/${S.noSlots}` },
          { desc: "커피챗·소개서 없는 공간 · 대관만 하나만 팜 (신청 폼에 고르기 없이 한 줄)", c: "guest-full", to: `/rent/${S.other}` },
          { desc: "긴 글 (사진 10장 · 폼 최대, 유의 사항 12줄, 주제 8줄)", c: "stress-guest", to: `/rent/${S.stress}` },
          { desc: "최소 입력 (사진·소개·설비·전화 없음), 번호 없는 손님", c: "minimal-guest", to: `/rent/${S.minimal}` },
          { desc: "검토 대기 공간을 남이 열면 404", c: "guest-full", to: `/rent/${S.pending}` },
          { desc: "쉬는 중인 공간을 남이 열면 404", c: "guest-full", to: `/rent/${S.paused}` },
          // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간은 공개 중이어도 손님 앞에서 빠져요. 예약을 잡아 둔 손님과 주인·관리자만 봐요.
          { desc: "사업자등록번호가 빈 공개 공간을 남이 열면 404", c: "anon", to: `/rent/${S.noBiz}` },
          { desc: "같은 공간을 예약해 둔 손님이 열면 보여요 (신청 자리에 「새 신청을 받지 않는 공간」)", c: "guest-full", to: `/rent/${S.noBiz}` },
          { desc: "없는 공간 주소 (404)", c: "guest-full", to: "/rent/mock-no-such-space" },
        ],
      },
      {
        // 🧾🏪09-18 대표 — 사업자 확인 · 네이버 상호 매칭. 폰은 제목 바로 밑, 1440은 오른쪽 요약 카드에 같은 줄이 서요.
        title: "공간 상세 · 믿을 근거 줄과 위치 지도",
        path: "/rent/[slug]",
        note: "「사업자 확인된 가게」는 관리자 승인과 국세청 일치가 둘 다 있을 때만, 「네이버 지도에 등록된 가게」는 네이버 가게와 이름·건물이 맞았을 때만 떠요. 네이버가 맞은 공간은 「위치」 지도 핀 위에 상호 라벨이 붙고 「네이버 지도에서 보기」가 상호로 검색해요.",
        rows: [
          { desc: "둘 다 (사업자 확인 · 네이버 지도) · 지도에 상호 라벨", c: "guest-full", to: `/rent/${S.full}` },
          { desc: "사업자 확인만 · 지도는 주소 핀만", c: "guest-full", to: `/rent/${S.noSlots}` },
          { desc: "네이버 지도만 (사업자 정보는 있고 관리자 승인 전) · 지도에 상호 라벨", c: "guest-full", to: `/rent/${S.other}` },
          { desc: "둘 다 없음 · 줄이 안 그려져요", c: "minimal-guest", to: `/rent/${S.minimal}` },
          { desc: "긴 상호 · 라벨 말줄임과 줄 접힘", c: "stress-guest", to: `/rent/${S.stress}` },
        ],
      },
      {
        // 🎫09-19 대표 [H] — 공간을 빌려주는 브랜드의 소개서 끝에 공개 중인 공간 카드. 공간이 없으면 절이 안 그려져요.
        title: "소개서 · 이 브랜드가 빌려주는 공간",
        path: "/m/[slug]",
        rows: [
          { desc: "공개 공간 둘 (검토 대기·쉬는 중인 공간은 안 붙어요)", c: "guest-full", to: `/m/${M.host}` },
          { desc: "빌려주는 공간이 없는 소개서 (절 없음)", c: "guest-full", to: `/m/${M.guest}` },
          { desc: "긴 이름 소개서 · 긴 공간 이름 카드", c: "stress-guest", to: `/m/${M.stress}` },
        ],
      },
      {
        // ⚖️09-19 대표 [J] — 가게 전화를 공간 상세에서 빼고 판매자 정보 화면으로. 공간 상세 「환불 규정」 끝 작은 링크와
        //   결제 직전 확인 팝업의 「판매자 정보 보기」(새 탭)로 들어가요. 검색엔 안 올라가요.
        title: "판매자 정보",
        path: "/rent/[slug]/seller",
        rows: [
          { desc: "상호·대표자·사업자번호·주소·가게 전화가 다 있는 공간", c: "guest-full", to: `/rent/${S.full}/seller` },
          { desc: "상호 칸이 생기기 전에 올린 공간 · 상호 자리에 「공간 이름 (공간 이름)」", c: "guest-full", to: `/rent/${S.noSlots}/seller` },
          { desc: "사업자등록번호가 빈 공간은 404 (예약해 둔 손님에게도)", c: "guest-full", to: `/rent/${S.noBiz}/seller` },
          { desc: "긴 상호 · 메모가 섞인 가게 전화", c: "stress-guest", to: `/rent/${S.stress}/seller` },
          { desc: "로그인 안 한 사람도 볼 수 있어요", c: "anon", to: `/rent/${S.full}/seller` },
          { desc: "검토 대기 공간은 404", c: "guest-full", to: `/rent/${S.pending}/seller` },
        ],
      },
      {
        title: "결제",
        path: "/rent/pay/[orderId]",
        note: "결제창은 이 컴퓨터에 넣어 둔 토스 키로 떠요. 끝까지 눌러도 돈을 확정하는 단계(승인)를 막아 두어서 실패 화면으로 가요.",
        rows: [
          { desc: "결제 전 신청 (대관만, 커피챗 담음, 취소 규정 한 줄)", c: "guest-full", to: `/rent/pay/mock-order-${B.pending}` },
          { desc: "긴 글 · 큰 금액", c: "stress-guest", to: `/rent/pay/mock-order-${B.stressPending}` },
          // 🔒09-18 밤 — 실패 화면은 주소의 글(`message`)을 안 쓰고 코드로 우리 문장을 고른다. 갈래마다 한 줄.
          { desc: "결제 실패 · 결제 창을 닫음 (다시 결제하기 버튼)", c: "guest-full", to: `/rent/pay/fail?code=PAY_PROCESS_CANCELED&orderId=mock-order-${B.pending}` },
          { desc: "결제 실패 · 카드사 거절", c: "guest-full", to: `/rent/pay/fail?code=REJECT_CARD_COMPANY&orderId=mock-order-${B.pending}` },
          { desc: "결제 실패 · 그 사이 시간이 차서 자동 취소 (다시 결제하기 없음)", c: "guest-full", to: `/rent/pay/fail?code=RENT_SLOT_TAKEN_REFUNDED&orderId=mock-order-${B.pending}` },
          { desc: "결제 실패 · 자동 환불도 실패해서 연락드림", c: "guest-full", to: `/rent/pay/fail?code=RENT_SLOT_TAKEN_REFUND_PENDING&orderId=mock-order-${B.pending}` },
          { desc: "결제 실패 · 모르는 코드나 주소에 글을 붙인 경우 (기본 문장)", c: "guest-full", to: "/rent/pay/fail?message=아무 글이나&code=SOMETHING_ELSE" },
          { desc: "결제 시간이 지난 주문을 열면 내 예약으로 넘어가요", c: "guest-full", to: `/rent/pay/mock-order-${B.expired}` },
          { desc: "이미 끝난 주문(다녀온 예약)을 열면 예약 한 건 화면으로 넘어가요", c: "guest-full", to: `/rent/pay/mock-order-${B.done}` },
          { desc: "남의 주문 (404)", c: "guest-full", to: `/rent/pay/mock-order-${B.refundReq}` },
        ],
      },
      {
        title: "예약 한 건",
        path: "/rent/done/[bookingId]",
        rows: [
          { desc: "결제 완료, 공간 전체, 이용일 전, 커피챗 담음, 사장님 연락처 열림", c: "guest-full", to: `/rent/done/${B.paid}` },
          { desc: "확정된 예약, 이용일 전, 사장님 말씀 있음", c: "guest-full", to: `/rent/done/${B.confirmed}` },
          { desc: "확정된 예약, 커피챗·소개서 없는 공간", c: "guest-full", to: `/rent/done/${B.confirmedOther}` },
          { desc: "30분 단위 · 결제 완료 13:00~15:30 (2시간 30분)", c: "guest-full", to: `/rent/done/${B.halfPaid}` },
          { desc: "다녀온 예약 (연락처 가림)", c: "guest-full", to: `/rent/done/${B.done}` },
          { desc: "사장님 거절, 환불이 아직 안 끝남", c: "guest-full", to: `/rent/done/${B.rejected}` },
          { desc: "사장님 거절 뒤 환불 완료", c: "guest-full", to: `/rent/done/${B.refunded}` },
          { desc: "손님 취소, 일부 돌려받음", c: "guest-full", to: `/rent/done/${B.cancelledFuture}` },
          { desc: "손님 취소, 이용일 지남", c: "guest-full", to: `/rent/done/${B.cancelledPast}` },
          { desc: "결제 시간이 지난 신청", c: "guest-full", to: `/rent/done/${B.expired}` },
          { desc: "결제 전 신청을 열면 내 예약으로 넘어가요", c: "guest-full", to: `/rent/done/${B.pending}` },
          { desc: "결제는 마쳤는데 사장님이 수락하지 않은 채 이용 시간이 시작됨", c: "guest-full", to: `/rent/done/${B.paidStarted}` },
          { desc: "로그인 안 하고 열면 로그인 화면으로 (돌아올 주소가 붙어요)", c: "anon", to: `/rent/done/${B.paid}` },
          { desc: "남의 예약이나 없는 번호 (404)", c: "guest-full", to: `/rent/done/${B.refundReq}` },
          { desc: "긴 글 · 확정", c: "stress-guest", to: `/rent/done/${B.stressConfirmed}` },
          { desc: "최소 입력 · 결제 완료 (사장님 이름·번호 없음)", c: "minimal-guest", to: `/rent/done/${B.minimalPaid}` },
        ],
      },
      {
        title: "내 예약",
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
        // 🔁09-18 밤 QA SC-15 — 이 화면은 위에 칸이 둘이다(「빌린 공간」 기본 · 「빌려준 공간」). 전엔 줄에 `tab=host`가 없어서
        //   사장님 줄 열다섯이 전부 빌린 공간 칸으로 열렸다. 사장님 줄은 `tab=host`, 빌린 공간은 아래 따로.
        title: "내 하루 가게 · 빌려준 공간 칸",
        path: "/rent/my?tab=host",
        note: "위 칸 둘 중 「빌려준 공간」으로 열려요. 공간은 공개 중 둘·검토 대기·쉬는 중·초안, 그리고 사업자등록번호가 빈 공간(「사업자 정보 필요」와 「고치러 가기」 줄)이에요. 들어온 요청은 새 요청(수락 전 손님 정보), 이용 시간이 시작된 결제 완료, 확정(연락처 열림), 환불 신청 중, 다녀감(가림), 거절, 환불, 손님 취소 둘이에요. 「알림」 줄은 맨 위에 한 번 뜨고 주소에서 지워지는데 칸은 그대로 남아요. 다시 보려면 링크를 한 번 더 누르면 돼요.",
        rows: [
          { desc: "모든 상태, 정산 계좌 있음 (요청 줄 첫머리에 대관만·공간 전체 · 검토 대기 공간에 국세청 기록과 다르다는 줄)", c: "host-full", to: "/rent/my?tab=host" },
          { desc: "같은 화면, 정산 계좌 없음 (확정 줄마다 계좌 등록 한 줄)", c: "host-noaccount", to: "/rent/my?tab=host" },
          { desc: "관리자이기도 한 사장님 (정산하기·검토하기 링크, 검토 대기 공간에 공개하기 버튼)", c: "host-admin", to: "/rent/my?tab=host" },
          { desc: "올린 공간이 없을 때", c: "host-empty", to: "/rent/my?tab=host" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/my?tab=host" },
          { desc: "알림 · 처음 올린 뒤", c: "host-full", to: "/rent/my?tab=host&saved=new" },
          { desc: "알림 · 이름이나 주소를 바꿔 검토로 다시 갈 때", c: "host-full", to: "/rent/my?tab=host&saved=review" },
          { desc: "알림 · 사업자 정보를 처음 채워 검토로 갈 때", c: "host-full", to: "/rent/my?tab=host&saved=biz" },
          { desc: "알림 · 검토 중에 고침", c: "host-full", to: "/rent/my?tab=host&saved=pending" },
          { desc: "알림 · 공개 중에 고침", c: "host-full", to: "/rent/my?tab=host&saved=ok" },
          { desc: "알림 · 쉬는 동안 고친 경우", c: "host-full", to: "/rent/my?tab=host&saved=kept" },
          { desc: "알림 · 수락 직후", c: "host-full", to: `/rent/my?tab=host&did=accept&b=${B.confirmed}` },
          { desc: "알림 · 거절하고 환불까지 끝남", c: "host-full", to: `/rent/my?tab=host&did=reject&b=${B.refunded}` },
          { desc: "알림 · 거절했는데 환불이 늦어질 때", c: "host-full", to: `/rent/my?tab=host&did=reject&b=${B.rejected}` },
          { desc: "긴 글", c: "stress-host", to: "/rent/my?tab=host" },
          { desc: "최소 입력 (손님 이름·번호 없음)", c: "minimal-host", to: "/rent/my?tab=host" },
        ],
      },
      {
        title: "내 하루 가게 · 빌린 공간 칸",
        path: "/rent/my?tab=guest",
        note: "위 칸 둘 중 「빌린 공간」(기본 칸)이에요. 모든 상태의 신청이 있는 손님 계정으로 열어요. 칩 셋이 예약 완료·지난 예약·취소·환불로 나눠요.",
        rows: [
          { desc: "예약 완료 (결제 완료·확정, 이어서 결제할 수 있는 신청)", c: "guest-full", to: "/rent/my?tab=guest" },
          { desc: "지난 예약 (다녀옴, 이용이 끝난 결제 완료·확정)", c: "guest-full", to: "/rent/my?tab=guest&g=past" },
          { desc: "취소·환불 (손님 취소, 사장님 거절·환불, 결제 안 한 채 끝난 신청)", c: "guest-full", to: "/rent/my?tab=guest&g=cancel" },
        ],
      },
      {
        title: "사장님이 보는 내 공간 상세",
        path: "/rent/[slug]",
        rows: [
          { desc: "공개 중인 내 공간 (신청 대신 안내 한 줄)", c: "host-full", to: `/rent/${S.full}` },
          { desc: "검토 대기 중인 내 공간", c: "host-full", to: `/rent/${S.pending}` },
          { desc: "쉬는 중인 내 공간", c: "host-full", to: `/rent/${S.paused}` },
          { desc: "작성 중(초안)인 내 공간", c: "host-full", to: `/rent/${S.draft}` },
          { desc: "사업자등록번호가 빈 내 공간 (주인은 볼 수 있어요)", c: "host-full", to: `/rent/${S.noBiz}` },
        ],
      },
      {
        title: "공간 올리기",
        path: "/rent/new",
        note: "임시 저장 복원은 링크로 못 열어요. 폼에 몇 칸 적고 새로고침하면 복원 안내가 떠요. 저장은 계정마다 따로 브라우저에 남아요. 「무엇을 파실까요」에서 상품을 하나도 안 켜고 「등록하기」를 누르면 상품 오류가, 켜고 값·설명을 비우면 그 칸 오류가 떠요. 「사업자 정보」 칸의 오류는 아래 「공간 고치기」에서 보는 게 빨라요(다른 칸이 이미 차 있어서). 여기선 파일 고르기를 누르면 목 모드라 「저장하지 않았어요」 줄이 떠요.",
        rows: [
          { desc: "빈 폼 (가입 때 적은 이름·번호, 첫 소개서가 미리 채워짐)", c: "host-full", to: "/rent/new" },
          { desc: "이름·번호·소개서가 없는 사장님의 빈 폼", c: "minimal-host", to: "/rent/new" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/new" },
          { desc: "고칠 공간 주소를 달고 온 올리기(?slug=)는 공간 고치기로 넘어가요", c: "host-full", to: `/rent/new?slug=${S.full}` },
        ],
      },
      {
        title: "공간 고치기",
        path: "/rent/[slug]/edit",
        note: "사업자 칸 오류 보는 법 · 공개 중인 공간을 열고 「사업자 정보」에서 번호를 1234567890으로 바꿔 「고친 내용 올리기」를 누르면 번호 오류가, 대표자 이름을 지우면 빈칸 오류가, 개업일을 지우면 날짜 오류가 그 칸 밑에 떠요. 국세청 기록과 다를 때의 빨간 줄은 검토 중인 공간을 열면 처음부터 서 있고, 번호·이름·개업일 중 하나를 고치면 내려가요. 🏠주소를 바꾸면 주소 칸 밑에 「새 주소가 적힌 사업자등록증을 다시 올려 주세요 · 등록증 올리러 가기」가 뜨고, 등록증을 안 바꾸고 누르면 등록증 칸 밑에 같은 말이 빨갛게 떠요(목 모드라 파일은 못 올려요). 상호만 바꾸면 검토로 안 내려가고 확인 표시도 그대로예요.",
        rows: [
          { desc: "공개 중인 공간 · 상품 셋 다 켬 · 사업자 확인 승인됨 (바꾸면 표시가 내려간다는 안내)", c: "host-full", to: `/rent/${S.full}/edit` },
          { desc: "30분 단위 공간 · 최소 1시간 30분 · 09:30~12:00 자투리 날 · 매주 목요일 11:30~20:30", c: "host-full", to: `/rent/${S.halfHour}/edit` },
          { desc: "검토 중인 공간 · 공간 전체만 켬 · 국세청 기록과 달라 사업자 칸 밑에 빨간 줄", c: "host-full", to: `/rent/${S.pending}/edit` },
          { desc: "쉬는 중인 공간 · 대관만 켬 · 사업자 정보 채움, 확인 전 · 상호가 빈 옛 공간이라 「비워 두시면 공간 이름이 대신 나가요」 안내", c: "host-full", to: `/rent/${S.paused}/edit` },
          { desc: "초안 · 사업자 정보가 비어 있어 넷 다 채워야 올릴 수 있다는 안내", c: "host-full", to: `/rent/${S.draft}/edit` },
          { desc: "사업자등록번호가 빈 공개 공간 · 머리에 「사업자 정보를 채워 주셔야 다시 열 수 있어요 · 고치러 가기」", c: "host-full", to: `/rent/${S.noBiz}/edit` },
          { desc: "긴 글", c: "stress-host", to: `/rent/${S.stress}/edit` },
          { desc: "최소 입력", c: "minimal-host", to: `/rent/${S.minimal}/edit` },
          { desc: "남의 공간 고치기 주소를 열면 그 공간 화면으로 넘어가요", c: "host-full", to: `/rent/${S.other}/edit` },
          { desc: "로그인 안 하고 열면 로그인 화면으로 (돌아올 주소가 붙어요)", c: "anon", to: `/rent/${S.full}/edit` },
        ],
      },
    ],
  },
  {
    id: "rent-admin",
    title: "관리자",
    screens: [
      {
        // 🧾09-18 대표 — 공간 등록에 사업자 확인 필수. 관리자가 남이 올린 공간을 공개하는 유일한 화면.
        title: "공간 검토",
        path: "/rent/review",
        note: "검토 대기 둘은 국세청 기록과 다름(공개 버튼 대신 빨간 이유 줄)과 국세청 조회 전(공개하기 버튼)이에요. 아래 「열려 있는 공간 · 확인 표시 전」엔 조회가 실패한 쉬는 중 공간이 있어요. 목 모드라 버튼을 누르면 「저장하지 않았어요」가, 「등록증 보기」는 새 탭에 안내 문구가 떠요.",
        rows: [
          { desc: "검토 대기 셋 · 확인 표시 전 하나 · 네이버 일치와 못 찾음 · 계좌 예금주가 대표자와 다른 곳 하나", c: "admin-full", to: "/rent/review" },
          { desc: "검토할 것이 없을 때", c: "admin-empty", to: "/rent/review" },
          { desc: "등록증 보기 (목 모드 안내 문구)", c: "admin-full", to: `/rent/review/cert/${S.pendingNoKey}` },
          { desc: "검토 대기 공간을 관리자가 열면 보여요", c: "admin-full", to: `/rent/${S.pendingNoKey}` },
          { desc: "관리자가 아닌 사람이 열면 404", c: "host-full", to: "/rent/review" },
        ],
      },
      {
        title: "정산",
        path: "/rent/payouts",
        note: "보낼 돈은 계좌가 있는 사장님과 없는 사장님 두 묶음이에요. 보내는 중(요청함·실패), 손이 필요한 예약 둘, 보낸 돈까지 한 화면에 있어요.",
        rows: [
          { desc: "환불 신청, 보낼 돈, 보내는 중, 손이 필요한 예약, 보낸 돈 (머리에 검토하기 링크)", c: "admin-full", to: "/rent/payouts" },
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
          // 🔙09-18 밤 QA SC-05·SC-15 — 하루 가게에서 넘어온 로그인·가입. 가입 링크와 가입 뒤 로그인이 돌아올 주소를 들고 가고, 가입 부제가 바뀐다.
          { desc: "로그인 · 공간에서 「로그인하고 신청하기」로 넘어옴 (회원가입 링크에도 돌아올 주소)", c: "anon", to: `/login?redirect=${encodeURIComponent(`/rent/${S.full}`)}` },
          { desc: "회원가입 · 공간에서 넘어온 손님 (부제 「가입하면 바로 공간을 신청할 수 있어요」)", c: "anon", to: `/signup?redirect=${encodeURIComponent(`/rent/${S.full}`)}` },
          { desc: "회원가입 · 공간 올리기에서 넘어온 사장님 (부제 「가입하면 바로 공간을 올릴 수 있어요」)", c: "anon", to: `/signup?redirect=${encodeURIComponent("/rent/new")}` },
        ],
      },
    ],
  },
];

export const RENT_POPUPS: Popup[] = [
  { where: { desc: "공간 상세", c: "guest-full", to: `/rent/${S.full}` }, button: "상품·날짜·시간을 고르고 「신청하기」", title: "이대로 신청할까요? (맨 아래 「판매자 정보 보기」는 새 탭)" },
  // 🔑09-19 [G] 로그인 안 한 사람은 바 버튼이 「로그인하고 신청하기」라 팝업 대신 로그인 화면으로 가요. 돌아오면 이 팝업이 떠요.
  { where: { desc: "예약 한 건", c: "guest-full", to: `/rent/done/${B.confirmed}` }, button: "「예약 취소하기」", title: "예약을 취소할까요?" },
  // 사장님 버튼은 「빌려준 공간」 칸에 있다. `tab=host` 없이 열면 빌린 공간 칸이 떠서 누를 버튼이 안 보인다(09-18 밤 QA SC-15).
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my?tab=host" }, button: "새 요청 줄의 「거절」", title: "이 요청을 거절할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my?tab=host" }, button: "이용 시간이 시작된 줄의 「관리자에게 환불 신청하기」", title: "관리자에게 환불을 신청할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my?tab=host" }, button: "공개 중인 공간 줄의 「잠시 쉬기」", title: "잠시 쉴까요?" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「승인하고 환불」", title: "환불을 승인할까요" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「신청 닫기」", title: "환불 신청을 닫을까요" },
];

