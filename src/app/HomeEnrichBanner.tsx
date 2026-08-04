"use client";

// 홈 보강 배너 — 섹션 ③('브랜드 소개서 작성 예시' 버튼) 바로 아래.
// 방금 캐러셀에서 "사진 있는 소개서 vs 텍스트 소개서"를 본 직후라, 그 차이에 대한 답이 된다.
//
// ⭐**보는 사람에 따라 말이 달라야 한다**(대표 지시 08-02):
//   · 소개서가 이미 있는 사람 → "더 풍성하게 만들어드릴까요?" → 신청 폼으로 바로
//   · 없는 사람(비로그인 포함) → "작성이 어려우신가요?" → 소개서 만들기로
//   없는 사람을 폼으로 보내면 "소개서 먼저 만들어주세요"로 되돌아온다(폼 1번이 그렇게 안내한다).
//
// ⚠️ 왜 클라 컴포넌트인가 — 홈은 ISR(revalidate 300)이다. 서버에서 세션을 읽는 순간
//    홈 전체가 매 요청 렌더로 바뀐다. 배너만 클라에서 판정하면 홈 HTML은 계속 캐시된다.
//    첫 페인트는 '없는 사람' 문구로 나가고(방문자 대다수가 그렇다), 판정 후 필요할 때만 바뀐다.
import { useEffect, useState } from "react";
import { hasOwnBrandAction } from "@/lib/actions";
import { TrackLink } from "@/components/TrackLink";

const FORM_URL = "https://forms.gle/6XnnSTCQ2HDVkf2Y7";

export function HomeEnrichBanner() {
  const [hasBrand, setHasBrand] = useState(false);

  useEffect(() => {
    let alive = true;
    hasOwnBrandAction()
      .then((v) => {
        if (alive) setHasBrand(v);
      })
      .catch(() => {}); // 실패해도 '없는 사람' 문구가 그대로 — 배너가 사라지진 않는다
    return () => {
      alive = false;
    };
  }, []);

  return (
    // ⚠️ 폭을 좁히지 않는다 — 위 캐러셀·브랜드 그리드가 부모 폭(960px)을 꽉 쓰는데
    //    배너만 560px이면 혼자 짧아 보인다(대표 QA 08-02). 부모 폭을 그대로 따른다.
    <div className="mt-8 flex flex-col gap-4 rounded-lg border border-primary-strong bg-primary-pale px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-8 sm:px-7 sm:py-6">
      <div className="min-w-0">
        <p className="break-keep text-[16.5px] font-bold leading-[1.4] tracking-[-0.02em] text-primary-on sm:text-[17.5px]">
          {hasBrand ? "🌱 소개서를 더 풍성하게 만들어드릴까요?" : "🌱 소개서 작성이 어려우신가요?"}
        </p>
        <p className="mt-1.5 break-keep text-[14px] leading-[1.6] text-body sm:text-[15px]">
          {hasBrand
            ? "온라인과 인스타그램에 있는 사진과 활동을 함께 담아, collab5팀이 소개서를 더욱 풍성하게 만들어드립니다."
            : "AI의 도움으로 3분 만에 소개서를 만든 뒤, collab5팀이 온라인과 인스타그램의 사진과 이야기를 더해 더욱 풍성한 소개서로 완성해드릴 수 있어요."}
        </p>
      </div>

      {hasBrand ? (
        <a
          href={FORM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-[14.5px] font-bold text-primary-on"
        >
          소개서 더 채우기
        </a>
      ) : (
        <TrackLink
          href="/register"
          event="home_enrich_banner_click"
          className="flex h-11 shrink-0 items-center justify-center rounded-md bg-primary px-5 text-[14.5px] font-bold text-primary-on"
        >
          소개서 만들기
        </TrackLink>
      )}
    </div>
  );
}
