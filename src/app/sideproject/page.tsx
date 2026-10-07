import type { Metadata } from "next";
import Link from "next/link";
import { SIDE_PROJECTS } from "./projects";

// 사적인 프로젝트 목록 (10-06 대표)
// collab5를 만드는 사람이 따로 만든 개인 도구를 모아 두는 자리다. 서비스 화면이 아니라서
// 헤더에서도 보조 링크(데스크톱만)와 풋터 링크로만 들어온다.
export const metadata: Metadata = {
  title: "콜랩5의 굉장히 사적인 프로젝트 — collab5",
  description: "콜랩5를 만드는 메이커들의 굉장히 사적인 니즈를 반영하여 구성하고 있는 개발 공간입니다.",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식 페이지에 그대로 상속된다.
  alternates: { canonical: "/sideproject" },
};

export default function SideIndexPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">콜랩5의 굉장히 사적인 프로젝트</h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
        콜랩5를 만드는 메이커들의 굉장히 사적인 니즈를 반영하여 구성하고 있는 개발 공간입니다 🤩
      </p>

      <ul className="mt-8 flex flex-col gap-3">
        {SIDE_PROJECTS.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/sideproject/${p.slug}`}
              className="flex items-center gap-4 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:bg-surface-faint"
            >
              {/* 아이콘 파일이 자체 라운드(맥 앱 아이콘 모양)와 투명 여백을 갖고 있어 여기서 더 깎지 않는다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.icon} alt="" aria-hidden="true" width={64} height={64} className="size-[64px] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold leading-snug text-ink">{p.name}</p>
                <p className="mt-1 text-[15px] leading-relaxed break-keep text-body">{p.tagline}</p>
                <p className="mt-1 text-[13px] text-mute">{p.meta}</p>
              </div>
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0 text-mute" fill="none" stroke="currentColor" strokeWidth="1.9">
                <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
