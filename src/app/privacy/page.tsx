import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 — collab5",
  description: "collab5 개인정보처리방침",
  // ⚠️루트 `canonical: "/"` 상속 차단 — 안 덮으면 홈의 사본으로 취급된다(terms 주석 참조).
  alternates: { canonical: "/privacy" },
};

// 개인정보처리방침 — 서비스 실제 수집 항목(회원가입·소개서) 기준.
// ⚠️ 법적 효력을 위해 대표/법률 검토 권장.
//
// 📌**이 문서를 고쳐야 하는 신호 셋** (08-26 신설):
//   ① **새 외부 서비스를 붙일 때** — §5 위탁 목록과 §5-1 국외이전에 «배포 전에» 추가한다.
//      🚨코드가 먼저 나가면 그 사이 수집분이 문제가 된다. 실제로 Gemini가 그렇게 누락돼 있었다.
//   ② **새로 수집하는 항목이 생길 때** — §1. ⛔주민등록번호는 어떤 경우에도 수집하지 않는다(사업자번호까지만).
//   ③ **AI 학습·통계에 이용자 데이터를 쓰려 할 때** — 이용 동의와 **별도 체크박스**여야 유효하다
//      (개인정보보호법 §22 — 묶음 동의는 무효). 그건 이 문서만으로는 부족하고 가입·작성 UI에 동의 절차가 필요하다.
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

        {/* 🚨08-26 정비 — 이 절에 **Gemini(Google)가 빠져 있었다.** 소개서 생성·콜라보 리포트가 이미
            Gemini를 타는데 위탁 목록엔 Supabase·Vercel뿐이었고, 국외이전 고지 조항 자체가 없었다.
            ⭐**이런 종류는 소급이 안 된다** — 나중에 붙이면 그전에 수집한 것이 통째로 위법 수집이 된다.
            그래서 새 기능(지원사업 도구)을 만들기 «전»에 먼저 고쳤다. 정본 = 볼트 [[BM-전략]] §v0.6 · 백로그 B69.
            ⚠️여기 목록은 **실제로 데이터가 지나가는 곳과 1:1로 맞춰야 한다.** 새 외부 서비스를 붙이면
              배포 전에 이 목록부터 고쳐라 — 코드가 먼저 나가면 그 사이 수집분이 문제가 된다. */}
        <Article title="5. 개인정보 처리의 위탁">
          <p>
            회사는 서비스 운영을 위해 아래와 같이 개인정보 처리 업무를 위탁하고 있으며, 위탁 시 관련 법령에 따라 개인정보가
            안전하게 관리되도록 합니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Supabase — 회원 인증 및 데이터 저장·관리</li>
            <li>Vercel — 서비스 호스팅 및 인프라 운영</li>
            <li>Google LLC — 생성형 AI(Gemini) 처리. 브랜드 소개서 초안 생성 및 콜라보 분석 리포트 작성</li>
          </ul>
        </Article>

        <Article title="5-1. 개인정보의 국외 이전">
          <p>
            회사는 서비스 제공을 위해 아래와 같이 개인정보를 국외로 이전합니다. 이용자는 국외 이전을 거부할 수 있으며, 이 경우
            해당 기능(소개서 자동 생성·콜라보 분석 등)의 이용이 제한될 수 있습니다.
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <b>이전받는 자</b>: Supabase Inc., Vercel Inc., Google LLC
            </li>
            <li>
              <b>이전 국가·시점·방법</b>: 미국 등 각 사업자의 서비스 리전. 서비스 이용 시점에 네트워크를 통해 전송
            </li>
            <li>
              <b>이전 항목</b>: 회원 식별 정보, 브랜드 소개서 작성 내용(상호·주소·채널·소개 문구·사진), 서비스 이용 기록
            </li>
            <li>
              <b>이전받는 자의 이용 목적·보유 기간</b>: 위 위탁 업무 수행 목적. 위탁 계약 종료 또는 이용자 삭제 요청 시까지
            </li>
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
