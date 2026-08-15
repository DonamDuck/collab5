import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 — collab5",
  description: "collab5 개인정보처리방침",
  // ⚠️루트 `canonical: "/"` 상속 차단 — 안 덮으면 홈의 사본으로 취급된다(terms 주석 참조).
  alternates: { canonical: "/privacy" },
};

// 개인정보처리방침 — 기본 템플릿 초안. 서비스 실제 수집 항목(회원가입·소개서) 기준.
// ⚠️ 법적 효력을 위해 배포 후 대표/법률 검토 권장.
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-12 sm:px-6 sm:py-16">
      <h1 className="text-[24px] font-bold tracking-tight text-ink sm:text-[26px] leading-[1.25] tracking-[-0.025em]">개인정보처리방침</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-mute">
        collab5(이하 &lsquo;회사&rsquo;)는 이용자의 개인정보를 소중히 여기며, 「개인정보 보호법」 등 관련 법령을 준수합니다. 본
        방침은 회사가 제공하는 서비스에서 개인정보를 어떻게 수집·이용·보관·파기하는지 안내합니다.
      </p>

      <div className="mt-10 space-y-9">
        <Article title="1. 수집하는 개인정보 항목">
          <p>회사는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>회원가입 시</b>: 이메일 주소, 비밀번호, 브랜드명, 프로필 이미지(선택), 연락처(선택)
            </li>
            <li>
              <b>브랜드 소개서 작성 시</b>: 상호, 사업장 주소, 인스타그램·홈페이지 등 채널 정보, 브랜드 소개 내용, 사진
            </li>
            <li>
              <b>서비스 이용 과정에서 자동 생성</b>: 접속 로그, 쿠키, 접속 IP 정보
            </li>
          </ul>
        </Article>

        <Article title="2. 개인정보의 수집 및 이용 목적">
          <ul className="list-disc space-y-1 pl-5">
            <li>회원 식별 및 로그인, 본인 확인</li>
            <li>브랜드 소개서 생성·공유 및 브랜드 간 콜라보 연결 서비스 제공</li>
            <li>고객 문의 응대 및 공지 전달</li>
            <li>서비스 개선 및 부정 이용 방지</li>
          </ul>
        </Article>

        <Article title="3. 개인정보의 보유 및 이용 기간">
          <p>
            회사는 원칙적으로 개인정보 수집·이용 목적이 달성되면 지체 없이 파기합니다. 다만 이용자가 작성한 브랜드 소개서 및
            회원 정보는 <b>회원 탈퇴 시 또는 삭제 요청 시</b>까지 보관하며, 관련 법령에서 정한 경우 해당 기간 동안 보관합니다.
          </p>
        </Article>

        <Article title="4. 개인정보의 제3자 제공">
          <p>
            회사는 이용자의 개인정보를 본 방침에서 고지한 범위를 넘어 제3자에게 제공하지 않습니다. 다만 법령에 근거하거나
            수사기관의 적법한 요청이 있는 경우는 예외로 합니다. 브랜드 소개서 등 이용자가 <b>스스로 공개(공유)</b>를 선택한
            정보는 공개된 페이지를 통해 열람될 수 있습니다.
          </p>
        </Article>

        <Article title="5. 개인정보 처리의 위탁">
          <p>
            회사는 서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있으며, 위탁 시 관련 법령에 따라 개인정보가
            안전하게 관리되도록 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase — 회원 인증 및 데이터 저장·관리</li>
            <li>Vercel — 서비스 호스팅 및 인프라 운영</li>
          </ul>
        </Article>

        <Article title="6. 이용자의 권리와 행사 방법">
          <p>
            이용자는 언제든지 자신의 개인정보를 조회·수정할 수 있으며, 회원 탈퇴 또는 삭제를 요청할 수 있습니다. 개인정보 열람·정정·삭제·처리정지
            요청은 아래 문의처로 연락 주시면 지체 없이 처리합니다.
          </p>
        </Article>

        <Article title="7. 개인정보의 안전성 확보 조치">
          <p>
            회사는 개인정보의 안전한 처리를 위해 비밀번호 암호화, 접근 권한 관리, 전송 구간 암호화(HTTPS) 등 합리적인
            보호 조치를 취하고 있습니다.
          </p>
        </Article>

        <Article title="8. 개인정보 보호책임자 및 문의처">
          <ul className="list-disc space-y-1 pl-5">
            <li>책임자: 송영덕</li>
            <li>
              이메일:{" "}
              <a href="mailto:dudejrthd@gmail.com" className="text-ink underline underline-offset-2">
                dudejrthd@gmail.com
              </a>
            </li>
            <li>전화: 010-2060-1629</li>
          </ul>
        </Article>

        <Article title="9. 고지의 의무">
          <p>
            본 개인정보처리방침의 내용 추가·삭제 및 수정이 있을 경우, 변경 사항을 서비스 내 공지를 통해 사전에 안내합니다.
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
