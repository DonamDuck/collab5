"use client";

// /my 콜라보 리포트 아카이브 카드.
//
// 방법론: 리포트는 자기 집(/m/{to})에서 렌더한다 — 카드는 딥링크(`?report={fromSlug}`)일 뿐.
// /my에 리포트 렌더러를 복제하지 않으므로 시트·제안 CTA·계측이 전부 기존 경로를 그대로 탄다.
// 캐시가 살아 있으면 즉시(0콜) 뜨고, 소개서가 그새 바뀌었으면 자연스럽게 새 리포트가 생성된다.
//
// 카드 구성(2026-08-01 개편): 쌍 캡션+지역 → 리포트 3축 미리보기.
// ⭐한줄 요약(17 bold) 줄은 폐지했다 — ideas[0]의 축약이라 정보 0인 중복(대표 확정).
//    대신 "추천 콜라보" 칩을 체급 승격(13 medium → 14 semibold)해 스캔성을 대신 받는다.
//    구조를 바꾸지 않고 체급만 올린 이유: 목록에서 2~3개를 열거하는 게 목적이라 pill이 맞는 형태다.
// ⚠️ 칩은 **라벨 아래에서만** 쓴다. 라벨 없이 카드에 흩뿌리면 "이게 뭐지"가 되고,
//    제목이 15자 문장이라 pill 경계만 어지러웠다(대표 07-26 1차 지적).
//    "추천 콜라보" 라벨이 맥락을 주면 칩은 제 역할(여러 개 열거)을 한다 → 이 축만 칩 3개.
// ⚠️ 구 캐시 리포트엔 oneLiner가 남아 있지만 이 카드는 읽지 않는다(ideaTitles가 비면 라벨째 숨김).
import Link from "next/link";
import { track } from "@/lib/track";
import type { CollabReportListItem } from "@/lib/types";

/** 리포트 축 미리보기 한 행 — 라벨(13 bold ink) 위, 내용(14 body) 아래.
 *  라벨을 미니 섹션 헤더로 세운다(대표 07-26). 본문이 한 단계 크므로 위계는 크기로 유지. */
function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] font-bold text-ink">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ReportArchiveCard({ item }: { item: CollabReportListItem }) {
  const hasDetail = !!item.matchPoint || item.ideaTitles.length > 0 || !!item.effect;

  return (
    <Link
      href={`/m/${item.toSlug}?report=${encodeURIComponent(item.fromSlug)}`}
      onClick={() => track("report_archive_open")}
      className="block rounded-md border border-hairline bg-surface p-4 transition-colors hover:bg-surface-soft"
    >
      {/* 쌍 캡션(칩) + 상대 지역 — 날짜보다 "어디 브랜드였지"가 재인식에 쓸모 있다(대표 07-26).
          ⚠️ 비비드 Kiwi(bg-primary) 대신 **primary-pale**: Kiwi를 면으로 쓰는 곳은 primary CTA 하나뿐이고
          (design.md 희소 원칙), 목록 카드마다 형광이 깔리면 CTA에서 힘을 잃는다.
          라이트 배경에 Kiwi를 '텍스트'로 쓰는 것도 대비 부족으로 금지 → 글자는 primary-on(진초록). */}
      <div className="flex items-center justify-between gap-2">
        {/* 굵기 없음(대표 지시 07-31) — 이 칩은 '어느 쌍인지' 알려주는 메타지 주인공이 아니다.
            카드의 주인공은 아래 "추천 콜라보" 칩들이고, 이 칩까지 굵으면 시선이 둘로 갈린다.
            면색(primary-pale)만으로도 충분히 구분된다. */}
        <span className="min-w-0 truncate rounded-pill bg-primary-pale px-2.5 py-1 text-[13px] text-primary-on">
          {item.fromName} × {item.toName}
        </span>
        {/* 지역도 같이 굵기 제거 — 칩과 한 줄에 나란한 짝이라 혼자 semibold면 어긋나 보인다 */}
        {item.toRegion && <span className="shrink-0 text-[13px] text-mute">{item.toRegion}</span>}
      </div>

      {hasDetail && (
        <div className="mt-3 space-y-2.5 border-t border-hairline pt-3">
          {item.matchPoint && (
            <PreviewRow label="잘 어울리는 점">
              <p className="line-clamp-2 text-[14px] leading-relaxed break-keep text-body">
                {item.matchPoint}
              </p>
            </PreviewRow>
          )}
          {item.ideaTitles.length > 0 && (
            <PreviewRow label="추천 콜라보">
              {/* 이 축만 칩 — 여러 개를 나란히 보여주는 게 목적이라 열거형이 맞다.
                  면은 surface-soft(뉴트럴) — 위 쌍 캡션이 primary-pale이라 여기까지 색을 쓰면
                  한 카드에 색 면이 둘이 되어 시선이 갈린다. 대비는 글자 ink로.
                  ⭐체급 승격(08-01): 13 medium·px-2.5 py-1 → 14 semibold·px-3 py-1.5.
                  한줄요약(17 bold)이 빠진 자리를 크기가 아니라 **칩의 체급**으로 받는다. */}
              <div className="flex flex-wrap gap-1.5">
                {item.ideaTitles.map((t) => (
                  <span
                    key={t}
                    className="rounded-pill bg-surface-soft px-3 py-1.5 text-[14px] font-semibold break-keep text-ink"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </PreviewRow>
          )}
          {item.effect && (
            <PreviewRow label="기대 효과">
              <p className="line-clamp-2 text-[14px] leading-relaxed break-keep text-body">
                {item.effect}
              </p>
            </PreviewRow>
          )}
        </div>
      )}
    </Link>
  );
}
