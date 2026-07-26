"use client";

// /my 콜라보 리포트 아카이브 카드.
//
// 방법론: 리포트는 자기 집(/m/{to})에서 렌더한다 — 카드는 딥링크(`?report={fromSlug}`)일 뿐.
// /my에 리포트 렌더러를 복제하지 않으므로 시트·제안 CTA·계측이 전부 기존 경로를 그대로 탄다.
// 캐시가 살아 있으면 즉시(0콜) 뜨고, 소개서가 그새 바뀌었으면 자연스럽게 새 리포트가 생성된다.
//
// 위계(리포트 시트의 3층 패턴 재사용): 쌍 캡션(13 mute) → oneLiner(15 semibold ink, 주인공)
// → 아이디어 칩(12 mute pill). 날짜는 우상단 faint.
import Link from "next/link";
import { track } from "@/lib/track";
import type { CollabReportListItem } from "@/lib/types";

/** KST 기준 "7월 26일" — 연도는 해가 바뀐 리포트에만(가까운 날짜의 노이즈 제거) */
function kstDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameYear =
    new Intl.DateTimeFormat("ko-KR", { year: "numeric", timeZone: "Asia/Seoul" }).format(d) ===
    new Intl.DateTimeFormat("ko-KR", { year: "numeric", timeZone: "Asia/Seoul" }).format(now);
  return new Intl.DateTimeFormat("ko-KR", {
    ...(sameYear ? {} : { year: "numeric" }),
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(d);
}

export function ReportArchiveCard({ item }: { item: CollabReportListItem }) {
  return (
    <Link
      href={`/m/${item.toSlug}?report=${encodeURIComponent(item.fromSlug)}`}
      onClick={() => track("report_archive_open")}
      className="block rounded-md border border-hairline bg-surface p-4 transition-colors hover:border-border-strong"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-mute">
          {item.fromName} × {item.toName}
        </p>
        <p className="shrink-0 text-[12px] text-faint">{kstDateLabel(item.createdAt)}</p>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug break-keep text-ink">
        {item.oneLiner}
      </p>
      {item.ideaTitles.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {item.ideaTitles.map((t) => (
            <span key={t} className="rounded-pill bg-surface-soft px-2.5 py-1 text-[12px] text-body">
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
