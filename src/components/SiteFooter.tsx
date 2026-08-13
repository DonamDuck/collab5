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
          <Link href="/" className="inline-flex">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-lockup.svg" alt="collab5" className="h-6 w-auto" />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px]">
            <Link href="/search" className="hover:text-ink">
              콜라보 찾기
            </Link>
            <Link href="/register" className="hover:text-ink">
              브랜드 소개서
            </Link>
            <Link href="/magazine" className="hover:text-ink">
              매거진
            </Link>
            <Link href="/terms" className="hover:text-ink">
              이용약관
            </Link>
            <Link href="/privacy" className="font-medium hover:text-ink">
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
