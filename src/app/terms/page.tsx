import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관 — collab5",
  description: "collab5 서비스 이용약관",
};

// 이용약관 — 기본 템플릿 초안. collab5(브랜드 소개서·콜라보 연결 서비스) 기준.
// ⚠️ 법적 효력을 위해 배포 후 대표/법률 검토 권장.
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">이용약관</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        본 약관은 collab5(이하 &lsquo;회사&rsquo;)가 제공하는 브랜드 소개서 및 콜라보 연결 서비스(이하 &lsquo;서비스&rsquo;)의 이용과
        관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정합니다.
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

        <Article title="제10조 (분쟁의 해결 및 준거법)">
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

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[17px] font-bold text-ink">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-body">{children}</div>
    </section>
  );
}
