import Link from "next/link";
import type { BriefSample } from "@/lib/brief-samples/registry";

// /my 「요약 보고서」 카드 (2026-09-14)
//
// ⭐**이 카드가 브리프 페이지의 존재 이유다.** 지금 브리프는 DM으로 링크를 한 번 드리면 끝이라,
//   고객이 다시 읽으려면 카톡을 뒤져야 한다. 여기 붙으면 계정에 남고,
//   읽고 나서 **바로 소개서 수정으로 이어진다**(기획서 §이 기능의 존재 이유).
//
// 🎨모양은 브리프 페이지 머리의 「소개서 보러 가기」 카드와 «짝»이다 —
//   저쪽은 리포트에서 소개서로, 이쪽은 소개서 옆에서 리포트로. 같은 테두리·같은 화살표.

export function BriefCard({ brief }: { brief: BriefSample }) {
  return (
    <Link
      href={`/brief/${brief.slug}`}
      className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3.5 transition-colors hover:bg-primary-pale">
      <span className="min-w-0">
        <span className="block text-[12px] text-faint">
          {brief.publishedAt.replace(/-/g, ". ")}
        </span>
        <span className="mt-0.5 block text-[16px] font-semibold text-ink">
          {brief.brandName} 요약 리포트
        </span>
        {/* 🪤설명 한 줄을 여기 두지 않는다 — 카드마다 «같은 문장»이 되고, 바로 위 절 설명과도 겹쳐
            한 화면에 같은 말이 세 번 나온다(09-14 실측). 카드가 여럿일 때 같은 칸이 같은 금형이면
            그게 AI 티다(볼트 [[디자인-시스템]]·CLAUDE.md §📇). 다른 말이 없으면 «안 쓴다». */}
      </span>
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4 shrink-0 text-faint"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        aria-hidden="true">
        <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
