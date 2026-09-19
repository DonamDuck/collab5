import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관 — collab5",
  description: "collab5 서비스 이용약관",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 **자식 페이지에 그대로 상속된다.**
  //   안 덮으면 구글은 이 페이지를 "홈의 사본"으로 보고 색인에서 뺀다(08-07 발견).
  alternates: { canonical: "/terms" },
};

// 이용약관 — 기본 템플릿 초안. collab5(브랜드 소개서·콜라보 연결 서비스) 기준.
// ⚠️ 법적 효력을 위해 배포 후 대표/법률 검토 권장.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[26px] leading-[1.25] tracking-[-0.025em]">이용약관</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        본 약관은 collab5(이하 &lsquo;회사&rsquo;)가 제공하는 브랜드 소개서 및 콜라보 연결 서비스(이하 &lsquo;서비스&rsquo;)의 이용과
        관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정합니다.
      </p>
      {/* 🏠하루 가게에 공간을 올리는 분께는 약관이 하나 더 있다(2026-09-16).
          호스트 약관 머리말이 「이용약관과 함께 적용된다」고 말하는데, 정작 이쪽에서 그리로 가는 길이 없었다.
          한 문서가 다른 문서를 전제하면 양쪽에서 서로 찾아갈 수 있어야 한다. */}
      <p className="mt-2 text-[15px] leading-relaxed text-mute">
        하루 가게에 공간을 올리시는 분께는{" "}
        <Link href="/terms/host" className="underline underline-offset-4">
          공간 제공자 약관
        </Link>
        도 함께 적용돼요.
      </p>

      <div className="mt-10 space-y-9">
        <Article title="제1조 (목적)">
          <p>
            본 약관은 이용자가 서비스를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항, 서비스 이용 조건과 절차 등
            기본적인 사항을 규정함을 목적으로 합니다.
          </p>
        </Article>

        <Article title="제2조 (정의)">
          <ul className="list-disc space-y-1 pl-5">
            <li>&lsquo;서비스&rsquo;란 회사가 제공하는 브랜드 소개서 작성·공유 및 브랜드 간 콜라보 연결 기능 일체를 말합니다.</li>
            <li>&lsquo;이용자&rsquo;란 본 약관에 동의하고 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
            <li>&lsquo;회원&rsquo;이란 회사에 개인정보를 제공하여 회원등록을 한 자로, 서비스를 계속 이용할 수 있는 자를 말합니다.</li>
            <li>&lsquo;게시물&rsquo;이란 이용자가 서비스에 게시한 브랜드 소개, 사진, 링크 등 일체의 콘텐츠를 말합니다.</li>
          </ul>
        </Article>

        <Article title="제3조 (약관의 효력 및 변경)">
          <ul className="list-disc space-y-1 pl-5">
            <li>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다.</li>
            <li>
              회사는 관련 법령을 위배하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일자 및 사유를 명시하여 사전에
              공지합니다.
            </li>
          </ul>
        </Article>

        <Article title="제4조 (회원가입)">
          <ul className="list-disc space-y-1 pl-5">
            <li>이용자는 회사가 정한 절차에 따라 회원정보를 기입하고 본 약관 및 개인정보처리방침에 동의함으로써 회원가입을 신청합니다.</li>
            <li>회사는 신청 내용에 허위·기재누락·오기가 있거나 타인의 정보를 도용한 경우 가입을 거절하거나 사후에 이용을 제한할 수 있습니다.</li>
          </ul>
        </Article>

        <Article title="제5조 (서비스의 제공 및 변경)">
          <ul className="list-disc space-y-1 pl-5">
            <li>회사는 브랜드 소개서 작성·공유, 브랜드 검색 및 콜라보 연결 등의 서비스를 제공합니다.</li>
            <li>회사는 서비스의 내용을 변경하거나, 운영상·기술상의 필요에 따라 서비스의 전부 또는 일부를 중단할 수 있으며 이 경우 사전에 공지합니다.</li>
            <li>서비스는 무료로 제공되는 것을 원칙으로 하며, 유료 서비스가 추가될 경우 별도로 고지합니다.</li>
          </ul>
        </Article>

        <Article title="제6조 (회원의 의무)">
          <p>이용자는 다음 행위를 하여서는 안 됩니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>타인의 정보 도용 또는 허위 정보 등록</li>
            <li>회사 또는 제3자의 지식재산권·명예 등 권리를 침해하는 행위</li>
            <li>서비스의 정상적인 운영을 방해하는 행위</li>
            <li>법령 또는 공서양속에 위반되는 콘텐츠를 게시하는 행위</li>
          </ul>
        </Article>

        <Article title="제7조 (게시물의 관리 및 저작권)">
          <ul className="list-disc space-y-1 pl-5">
            <li>이용자가 작성한 게시물의 저작권은 해당 이용자에게 귀속됩니다.</li>
            <li>
              회사는 서비스의 운영·홍보·개선을 위해 필요한 범위에서 게시물을 노출·표시할 수 있으며, 이용자는 자신이 공개를
              선택한 게시물이 서비스를 통해 열람될 수 있음에 동의합니다.
            </li>
            <li>회사는 법령 또는 본 약관에 위반되는 게시물에 대해 사전 통지 없이 삭제·비공개 조치할 수 있습니다.</li>
          </ul>
        </Article>

        <Article title="제8조 (이용제한 및 계약 해지)">
          <ul className="list-disc space-y-1 pl-5">
            <li>이용자는 언제든지 서비스 내 절차 또는 문의처를 통해 회원 탈퇴(이용계약 해지)를 요청할 수 있습니다.</li>
            <li>회사는 이용자가 본 약관을 위반한 경우 서비스 이용을 제한하거나 이용계약을 해지할 수 있습니다.</li>
          </ul>
        </Article>

        <Article title="제9조 (면책조항)">
          <ul className="list-disc space-y-1 pl-5">
            <li>회사는 천재지변, 불가항력 또는 이용자의 귀책사유로 인한 서비스 장애에 대하여 책임을 지지 않습니다.</li>
            <li>회사는 이용자가 게시한 정보의 신뢰도·정확성 및 이용자 간 콜라보(거래·협업)의 결과에 대하여 책임을 지지 않습니다.</li>
          </ul>
        </Article>

        {/* 🏠09-17 — 하루 가게 손님 조항. QA에서 «손님 약관에 환불 규정이 0건»이 나왔다(규정은 호스트 약관 제8조에만 있었다).
            손님이 돈을 내는 흐름인데 손님이 동의한 우리 규정이 없으면 분쟁 때 근거가 약하다.
            ⚠️환불표는 `src/lib/rent-payment.ts` `guestCancelRefundRate`와 호스트 약관 제8조와 «셋이 같아야» 한다. 하나를 고치면 셋 다.
            `id="rent"` — 공간 상세·결제 화면이 `/terms#rent`로 바로 건다. */}
        <Article id="rent" title="제10조 (하루 가게 이용)">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              하루 가게는 공간을 올린 호스트와 공간을 빌리는 이용자를 이어 주는 서비스입니다. 회사는 통신판매중개자로서
              거래 당사자가 아니며, 공간과 그 이용에 대한 책임은 호스트에게 있습니다. 다만 회사는 결제·환불을 대행하고 분쟁
              해결을 돕습니다.
            </li>
            {/* ⚖️09-19 대표 [J] — 판매자 정보는 공간 화면 안쪽 «판매자 정보»(`/rent/[slug]/seller`)에서 결제 전에 본다.
                가게 전화는 결제 뒤 예약 화면(`ContactBlock`)에도 있다. 호스트 약관 제6조와 같은 사실이다. */}
            <li>
              호스트의 상호·대표자 이름·사업자등록번호·사업장 주소·전화번호 등 판매자 정보는 결제하기 전에 공간 화면의
              판매자 정보에서 볼 수 있습니다. 가게 전화번호는 결제를 마친 이용자에게 예약 화면에서도 보여 드립니다.
            </li>
            {/* 🪪09-18 대표 — 「실명 확인 당일날도 필요하고. 이거 신청할 때 약관 동의 같은 데 넣어야 할 수도 있겠다.」
                신청 폼의 성함(실명) 필수 칸과 결제 직전 확인 팝업의 한 줄이 이 조항을 따른다. */}
            <li>
              이용자는 신청할 때 실명과 연락처를 정확히 적어야 하며, 호스트는 이용 당일 이용자의 신분을 확인할 수
              있습니다.
            </li>
            {/* 🪪09-19 대표 — 「결제하면 서로의 연락처 공개」는 실제 동작과 달랐다. 손님은 결제 뒤 사장님 연락처를 보고(`guestSeesHost`),
                사장님은 «수락한 뒤»에 손님 연락처를 본다(`isRevealed`). 두 문을 따로 적는다. 호스트 약관 제6조·제7조와 같은 사실이다. */}
            <li>
              이용자가 결제를 마치면 예약이 완료되고, 이용자에게 호스트의 연락처가 공개됩니다. 이용자의 연락처는 호스트가
              예약을 수락한 뒤에 호스트에게 공개됩니다.
            </li>
            <li>
              호스트는 예약을 수락한 날부터 2일 안에, 이용일이 그보다 가까우면 이용 전까지 이용자에게 문자나 전화로 이용
              안내를 전달합니다. 연락이 없으면 회사 고객센터로 알려 주세요.
            </li>
            <li>
              호스트는 이용 시작 전까지 예약을 거절할 수 있으며, 이 경우 결제 금액 전액이 환불됩니다. 호스트가 수락한 뒤
              호스트 사정으로 이용이 어려워지면 회사가 양쪽에 사정을 확인한 뒤 전액 환불합니다.
            </li>
            <li>이용자는 이용 시작 전까지 예약을 취소할 수 있으며, 환불 금액은 아래 기준을 따릅니다.</li>
          </ul>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {/* 🔁09-19 대표 — 「결제 후 1시간」을 없애고 «호스트 수락 뒤 1시간»으로 옮겼다(`GRACE_MINUTES`). 수락 전 취소는 아래 표대로다. */}
            <li>호스트가 예약을 수락한 때부터 1시간 이내 취소: 이용일과 관계없이 전액 환불</li>
            <li>이용일 7일 전까지: 전액 환불</li>
            <li>이용일 3일 전까지: 70% 환불</li>
            <li>이용일 1일 전까지: 50% 환불</li>
            <li>이용 당일: 환불 없음</li>
          </ul>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>남은 날짜는 이용일을 기준으로 한국 시간 날짜로 셉니다.</li>
            <li>환불은 결제한 수단으로 돌아가며, 결제 수단에 따라 3~5영업일이 걸릴 수 있습니다.</li>
            <li>
              출입 비밀번호 등 공간 이용 안내는 호스트가 이용자에게 직접 전달하며, 회사는 그 내용을 보관하지 않습니다.
            </li>
            <li>이용자는 호스트가 공간 상세에 적은 사용 유의 사항을 지켜야 하며, 이용 중 생긴 손해는 관련 법령에 따라 책임집니다.</li>
          </ul>
          <p className="mt-2 text-mute">
            이 조항은 회사가 하루 가게의 결제를 여는 날부터 적용됩니다. 호스트에게는{" "}
            <Link href="/terms/host" className="underline underline-offset-2">
              공간 제공자 약관
            </Link>
            이 함께 적용됩니다.
          </p>
        </Article>

        <Article title="제11조 (분쟁의 해결 및 준거법)">
          <p>
            본 약관은 대한민국 법령에 따라 해석되며, 서비스 이용과 관련하여 회사와 이용자 간 분쟁이 발생한 경우 성실히 협의하여
            해결하되, 협의가 이루어지지 않을 경우 관할 법원은 민사소송법에 따릅니다.
          </p>
        </Article>
      </div>

      <p className="mt-12 border-t border-hairline pt-6 text-[14px] text-faint">시행일자: 2026년 7월 24일</p>
    </main>
  );
}

function Article({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    // scroll-mt — `/terms#rent`로 들어오면 제목이 고정 헤더 밑에 숨지 않게.
    <section id={id} className="scroll-mt-24">
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-body">{children}</div>
    </section>
  );
}
