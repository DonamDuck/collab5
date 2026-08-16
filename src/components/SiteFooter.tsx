// 전 페이지 공용 풋터 — 서버 컴포넌트(세션 불필요). 인쇄 시 숨김.
import Link from "next/link";

// 사업자 정보 한 줄 항목 — 라벨 없이 값만, 가운뎃점으로 구분
const BIZ: { label: string; value: string }[] = [
  { label: "상호", value: "collab5" },
  { label: "대표", value: "송영덕" },
  { label: "주소", value: "서울 성북구 돈암동 413-111, 402호" },
  { label: "문의", value: "dudejrthd@gmail.com" },
  { label: "전화", value: "010-2060-1629" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-hairline bg-surface-soft px-4 py-10 text-mute sm:px-6 print:hidden">
      <div className="mx-auto flex max-w-[960px] flex-col gap-6">
        {/* 상단: 워드마크 + 보조 내비 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* 로고도 홈 링크라 터치 타깃이다 — 이미지 높이는 두고 세로 패딩으로만 44px을 만든다.
              📏 헤더와 짝을 맞춘다: 모바일 20으로 **같게**, 데스크톱은 24로 헤더(28)보다 한 단 아래.
                 풋터 로고는 간판이 아니라 서명이라 위아래가 뒤집히면 안 된다 — 처음에 22로 뒀다가
                 모바일에서 헤더(20)보다 커져서 되돌렸다.
              📏 헤더와 짝: 모바일 20으로 **같게**, 데스크톱은 22로 헤더(24)보다 한 단 아래.
                 풋터 로고는 간판이 아니라 서명이라 헤더보다 커지면 안 된다.
              🪤20 + py 24 = 44. `py-[10px]`면 40이라 터치 권장치에 모자란다. */}
          <Link href="/" className="inline-flex items-center py-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-lockup.png" alt="collab5" className="h-[20px] w-auto sm:h-[22px]" />
          </Link>
          {/* 📏 링크마다 `py-[12px]` — **글자 크기는 그대로 두고 터치 영역만** 21px → 44px로 넓힌다.
              텍스트 링크는 줄간격이 곧 높이라 21px밖에 안 됐다(권장치의 절반 미만).
              세로 패딩이 늘어난 만큼 `gap-y`를 2 → 0으로 줄여 실제 줄 간격은 그대로 유지한다. */}
          <nav className="flex flex-wrap items-center gap-x-4 text-[14px]">
            <Link href="/search" className="inline-flex items-center py-[12px] hover:text-ink">
              콜라보 찾기
            </Link>
            <Link href="/register" className="inline-flex items-center py-[12px] hover:text-ink">
              브랜드 소개서
            </Link>
            {/* 「콜라보 매거진」 — 홈 메뉴바·헤더와 같은 이름(대표 08-14 통일 지시).
                풋터 내비는 `flex-wrap`이라 길어지면 줄만 늘어난다(잘리지 않는다). */}
            <Link href="/magazine" className="inline-flex items-center py-[12px] hover:text-ink">
              콜라보 매거진
            </Link>
            <Link href="/terms" className="inline-flex items-center py-[12px] hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="inline-flex items-center py-[12px] font-medium hover:text-ink">
              개인정보처리방침
            </Link>
          </nav>
        </div>

        {/* 사업자 정보 — 값만 가운뎃점 구분, 줄바꿈 허용 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-faint">
          {BIZ.map((b, i) => (
            <span key={b.label} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden="true">·</span>}
              <span>
                <span className="text-mute">{b.label}</span> {b.value}
              </span>
            </span>
          ))}
        </div>

        {/* 저작권 */}
        <p className="text-[13px] text-faint">© 2026 collab5. All rights reserved.</p>
      </div>
    </footer>
  );
}
