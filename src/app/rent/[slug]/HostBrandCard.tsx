import Link from "next/link";
import { Avatar } from "@/components/Avatar";

// 📎공간 상세의 사장님 소개서 카드 (2026-09-18 대표 결정 A)
//
// 대표: *「여기가 소개서 UI가 좀 아쉬운데? … 뭔가 클릭해봄직이 조금 부족해 보인달까」*.
// 🔁09-17엔 흐린 글자 한 줄(`사장님 소개서 · {이름}`)이었다. 이름 글자만 밑줄이라 누를 곳이 작고, 뭐가 나오는지도 안 보였다.
// ⭐그래서 **카드 전체가 링크**다. 로고와 한 줄 소개가 「누르면 이 브랜드 이야기가 나온다」를 먼저 보여 준다.
// ⛔`/m`의 `BrandSummaryCard`는 가져오지 않았다. 그건 소개서 화면의 머리(수정 버튼·신뢰 칩·쉬는 중 배지)라
//   여기 싣기엔 무겁고, 이 자리의 일은 «들어가 보게 하기» 하나다.
// 🖼로고 = 소개서 주인 계정의 프로필 사진(`/m`의 `logoUrl`과 같은 출처). 없으면 이니셜 원.

export function HostBrandCard({
  href,
  name,
  oneLiner,
  logoUrl,
  className = "",
}: {
  href: string;
  name: string;
  oneLiner?: string;
  logoUrl?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3.5 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:border-border-strong ${className}`}
    >
      <Avatar image={logoUrl} name={name} size={48} shape={logoUrl ? "square" : "circle"} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] text-mute">사장님이 운영하는 브랜드</span>
        <span className="mt-0.5 line-clamp-2 text-[16px] font-bold leading-snug break-keep text-ink">{name}</span>
        {oneLiner && (
          <span className="mt-0.5 line-clamp-2 text-[14px] leading-snug break-keep text-body">{oneLiner}</span>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium text-ink">
          소개서 보기
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none">
            →
          </span>
        </span>
      </span>
    </Link>
  );
}
