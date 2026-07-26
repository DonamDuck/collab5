"use client";

// /my 콜라보 리포트 아카이브 카드.
//
// 방법론: 리포트는 자기 집(/m/{to})에서 렌더한다 — 카드는 딥링크(`?report={fromSlug}`)일 뿐.
// /my에 리포트 렌더러를 복제하지 않으므로 시트·제안 CTA·계측이 전부 기존 경로를 그대로 탄다.
// 캐시가 살아 있으면 즉시(0콜) 뜨고, 소개서가 그새 바뀌었으면 자연스럽게 새 리포트가 생성된다.
//
// 카드 구성(대표 07-26): 쌍 캡션+지역 → oneLiner(주인공) → 리포트 3축 요약 1개씩.
// ⚠️ 아이디어 제목을 칩으로 두지 않는다 — 칩은 "짧은 라벨"용인데 제목은 15자 문장이라
//    줄바꿈·가시성이 무너졌다(대표 지적). 라벨+본문 행 구조가 길이에 관계없이 안정적이다.
import Link from "next/link";
import { track } from "@/lib/track";
import type { CollabReportListItem } from "@/lib/types";

/** 리포트 3축 미리보기 한 행 — 라벨(작게 mute) 위, 본문 아래. 제목축만 ink로 올려 눈이 걸리게. */
function PreviewRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-medium tracking-wide text-faint">{label}</p>
      <p
        className={`mt-0.5 line-clamp-2 text-[13px] leading-relaxed break-keep ${
          strong ? "font-semibold text-ink" : "text-body"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export function ReportArchiveCard({ item }: { item: CollabReportListItem }) {
  const rows = [
    { label: "잘 어울리는 점", value: item.matchPoint, strong: false },
    { label: "추천 콜라보", value: item.ideaTitle, strong: true },
    { label: "기대 효과", value: item.effect, strong: false },
  ].filter((r): r is { label: string; value: string; strong: boolean } => !!r.value);

  return (
    <Link
      href={`/m/${item.toSlug}?report=${encodeURIComponent(item.fromSlug)}`}
      onClick={() => track("report_archive_open")}
      className="block rounded-md border border-hairline bg-surface p-4 transition-colors hover:border-border-strong"
    >
      {/* 쌍 캡션 + 상대 지역 — 날짜보다 "어디 브랜드였지"가 재인식에 쓸모 있다(대표 07-26) */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-medium text-mute">
          {item.fromName} × {item.toName}
        </p>
        {item.toRegion && <p className="shrink-0 text-[12px] text-faint">{item.toRegion}</p>}
      </div>

      {/* 주인공 — 무엇을 상상했는지 */}
      <p className="mt-1.5 line-clamp-2 text-[15px] font-semibold leading-snug break-keep text-ink">
        {item.oneLiner}
      </p>

      {rows.length > 0 && (
        <div className="mt-3 space-y-2.5 border-t border-hairline pt-3">
          {rows.map((r) => (
            <PreviewRow key={r.label} label={r.label} value={r.value} strong={r.strong} />
          ))}
        </div>
      )}
    </Link>
  );
}
