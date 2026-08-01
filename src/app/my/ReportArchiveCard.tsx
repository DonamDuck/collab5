"use client";

// /my 콜라보 리포트 아카이브 카드.
//
// 방법론: 리포트는 자기 집(/m/{to})에서 렌더한다 — 카드는 딥링크(`?report={fromSlug}`)일 뿐.
// /my에 리포트 렌더러를 복제하지 않으므로 시트·제안 CTA·계측이 전부 기존 경로를 그대로 탄다.
// 캐시가 살아 있으면 즉시(0콜) 뜨고, 소개서가 그새 바뀌었으면 자연스럽게 새 리포트가 생성된다.
//
// 카드 구성(2026-08-01 **2차** 개편): 쌍 캡션+지역 → **추천 콜라보(주인공)** → 구분선 → 근거 2축.
//
// ⭐1차(같은 날)는 한줄 요약(17 bold)만 지우고 칩 체급을 올렸는데, 대표 QA에서
//    *"추천 콜라보 강조는 좋으나 카드의 중간만 보인다"* 가 나왔다. 원인 두 가지:
//    ① **무게의 정점이 가운데 있었다** — 읽는 순서가 캡션(13) → 어울리는 점(14 body) →
//       칩(14 semibold, 제일 무거움) → 기대 효과(14 body). 카드에 머리가 없으니 눈이 중간에 착지한다.
//    ② **3축 라벨이 전부 같은 무게(13 bold ink)** 였다 — 한줄 요약이 빠지며 1층이 사라졌는데
//       나머지가 전부 2층이라 주인공과 보조가 구분되지 않는 '중간 한 덩어리'가 됐다.
//    → 처방 = 칩을 **캡션 바로 아래(카드의 머리)로** 올리고 라벨을 아이브로(12 mute)로 낮춰
//       사다리를 다시 세운다: **칩 14 semibold ink → 근거 13 body → 라벨 12 mute**.
//    ⭐구분선도 자리를 옮겼다 — 헤더/본문이 아니라 **주인공/근거**를 가른다(선이 의미를 갖게).
//    시트 순서(①아이디어 ②어울려요 …)와도 이제 같다 — 두 화면이 같은 얘기를 같은 순서로 한다.
//
// ⭐3차(같은 날): **카드에 pill을 하나만 남겼다.** 대표 —
//    *"업체×업체 초록칩과 추천 콜라보 칩이 겹치니 헷갈림. 칩은 한 개여야 할 것 같은데"*.
//    쌍 이름은 pill을 벗고 **카드 제목(15 semibold)** 으로, 초록은 `×` 한 글자에만 남겼다.
//    같은 날 밸런스 조정도 함께: 칩 14→13 / 근거 13 regular→14 medium(§각 주석).
//    최종 사다리 = **제목 15 semibold ink → 근거 14 medium body → 칩 13 semibold ink(+면) → 라벨 12 mute**.
//
// ⚠️ 칩은 **라벨 아래에서만** 쓴다. 라벨 없이 흩뿌리면 "이게 뭐지"가 되고(대표 07-26 1차 지적),
//    특히 지금은 제목 바로 밑이라 라벨이 없으면 **업체의 태그처럼** 읽힐 위험이 있다.
//    낮추되 지우지 않는 이유가 이것.
// ⚠️ 구 캐시 리포트엔 oneLiner가 남아 있지만 이 카드는 읽지 않는다(ideaTitles가 비면 라벨째 숨김).
import Link from "next/link";
import { track } from "@/lib/track";
import type { CollabReportListItem } from "@/lib/types";

/** 블록 라벨 — 아이브로(12 medium mute). 주인공·보조가 같은 한 tier를 쓴다.
 *  ⚠️ 시트 아이브로는 `text-faint`인데 여기만 `text-mute`인 건 **일이 다르기 때문**이다.
 *     시트 쪽은 보더+그림자 카드 안에서 16 bold 제목이 받쳐주는 곁다리 메타지만,
 *     이 라벨은 "이 덩어리가 뭔지" 알려주는 유일한 단서라 읽혀야 한다(faint는 흰 배경 대비 3:1 미만). */
function BlockLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[12px] font-medium tracking-wide text-mute">{children}</p>;
}

/** 근거 축 한 행 — 아이브로 위, 본문(14 medium body) 아래.
 *  ⭐대표 08-01: *"타이틀 하위 본문 bold하면 어때?"* + *"잘 어울리는 점과 기대 효과의 font를
 *     좀만 키워서 (칩과) 맞추면 어때?"* → 13 regular → **14 medium**.
 *  ⚠️ `font-bold`(700)까지 가지 않은 이유: 2줄짜리 한글 문장을 700으로 깔면 **읽는 글이 아니라
 *     외치는 글**이 되고, 바로 위 칩(13 semibold)과 무게가 같아져 다시 평평해진다.
 *     medium(500)이면 "굵어졌다"는 체감은 주면서 칩에 주인공 자리를 남긴다.
 *  ⭐크기(14)는 칩(13)보다 크고 무게(500)는 칩(600)보다 낮다 — **축을 엇갈리게 해서**
 *     둘이 서로 다른 이유로 눈에 들어오게 한 것. 같은 축으로 겨루면 하나가 죽는다. */
function PreviewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <BlockLabel>{label}</BlockLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export function ReportArchiveCard({ item }: { item: CollabReportListItem }) {
  // ⚠️ 예전의 `hasDetail`(3축 OR) 단일 게이트는 은퇴 — 주인공/근거가 서로 다른 블록이 되면서
  //    각자 자기 조건으로 켜진다. 하나로 묶으면 아이디어만 있는 리포트에 빈 구분선이 남는다.
  return (
    <Link
      href={`/m/${item.toSlug}?report=${encodeURIComponent(item.fromSlug)}`}
      onClick={() => track("report_archive_open")}
      className="block rounded-md border border-hairline bg-surface p-4 transition-colors hover:bg-surface-soft"
    >
      {/* 쌍 이름 + 상대 지역 — 날짜보다 "어디 브랜드였지"가 재인식에 쓸모 있다(대표 07-26).
          ⭐**pill을 벗고 카드 제목으로 승격**(대표 08-01): *"업체×업체 초록칩과 추천 콜라보 칩이
             겹치니 헷갈림. 칩은 한 개여야 할 것 같은데"* — 정확한 지적이다. 한 카드에 pill이 두 종류면
             독자는 **둘이 같은 종류의 정보라고 읽는다**(형태가 의미를 만든다). 그런데 이 둘은
             전혀 다르다: 쌍 이름 = 카드의 정체 / 아이디어 = 카드의 내용.
          ⭐**pill을 뺀 쪽이 여기인 이유**: 아이디어는 2~3개를 **열거**하는 게 목적이라 pill이 형태적으로
             옳고(07-26 확정), 쌍 이름은 하나뿐이라 애초에 pill일 이유가 없었다. 제목은 제목답게.
          ⚠️ 초록을 **`×` 하나에만** 남긴다 — 대표가 "text 컬러를 키위나 녹색으로"도 제안했지만,
             브랜드명 전체를 초록으로 칠하면 목록 카드마다 초록 문단이 깔려 Kiwi 희소 원칙이 깨진다
             (면색으로 Kiwi를 쓰는 곳은 primary CTA 하나뿐). `×`만 primary-on이면 초록은 최소로 남고,
             **"두 브랜드가 만난다"는 뜻을 색이 대신 말해준다**. 라이트 배경에 비비드 Kiwi를 글자로
             쓰는 건 여전히 금지(대비 부족) — primary-on(#1f5c00)은 대비 9:1로 안전. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[15px] font-semibold text-ink">
          {item.fromName} <span className="font-medium text-primary-on">×</span> {item.toName}
        </p>
        {item.toRegion && <span className="shrink-0 text-[13px] text-mute">{item.toRegion}</span>}
      </div>

      {/* ① 추천 콜라보 — 카드에 남은 **유일한 칩**. 여러 개를 나란히 보여주는 게 목적이라
          열거형(pill)이 형태적으로 옳다. 면은 surface-soft(뉴트럴) — 색 면은 카드에 두지 않는다.
          ⭐14 → **13**(대표 08-01): *"아이디어 칩은 좋은데 다른 거에 비해 font가 너무 커서
             밸런스가 안 맞아 보인다"*. 맞다 — 칩은 이미 **면(pill) + semibold + ink**로 강조 수단을
             셋이나 갖고 있어서, 거기에 크기까지 얹으면 과했다. 크기를 빼도 주인공 자리는 안 뺏긴다. */}
      {item.ideaTitles.length > 0 && (
        <div className="mt-3">
          <BlockLabel>추천 콜라보</BlockLabel>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {item.ideaTitles.map((t) => (
              <span
                key={t}
                className="rounded-pill bg-surface-soft px-3 py-1.5 text-[13px] font-semibold break-keep text-ink"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ② 근거 — 왜 어울리는지 / 뭐가 남는지. 주인공을 읽고 난 뒤의 뒷받침이라 한 단 낮다.
          구분선은 여기 붙어 **주인공과 근거를 가른다**(아이디어가 없는 구 데이터면
          캡션 바로 아래로 붙어 예전과 같은 모양이 된다 — 별도 분기 불필요). */}
      {(item.matchPoint || item.effect) && (
        <div className="mt-3 space-y-2.5 border-t border-hairline pt-3">
          {item.matchPoint && (
            <PreviewRow label="잘 어울리는 점">
              <p className="line-clamp-2 text-[14px] leading-relaxed font-medium break-keep text-body">
                {item.matchPoint}
              </p>
            </PreviewRow>
          )}
          {item.effect && (
            <PreviewRow label="기대 효과">
              <p className="line-clamp-2 text-[14px] leading-relaxed font-medium break-keep text-body">
                {item.effect}
              </p>
            </PreviewRow>
          )}
        </div>
      )}
    </Link>
  );
}
