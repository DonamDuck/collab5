"use client";

// 사진 보강 신청 배너 — 소개서 **주인에게만**, 사진이 부족할 때 페이지 맨 위에 뜬다.
// 목적: AI 크롤로 막 만든 소개서는 사진이 0~2장이라 비어 보인다. 그 아쉬움이 최고조인 자리에서
//       "온라인·인스타에서 찾아 채워드릴게요"를 건다(컨시어지 신청 = 구글폼).
//
// ⚠️ 노출 규칙은 **부모(page.tsx)가 서버에서 판정**하고(주인 여부·사진 수), 여기서는 **시간 규칙만** 본다.
//    localStorage에 소개서별로 기록 — 서버 컬럼을 만들지 않는다(하루 2건 규모엔 과하다).
//    · ✕ 누르면 **1일** 숨김
//    · 처음 본 날부터 **7일** 뒤 영구 종료(계속 따라다니면 자기 소개서가 광고판이 된다)
//    기기를 바꾸면 다시 보인다 — 알고 감수하는 트레이드오프.
import { useEffect, useState } from "react";

const DAY = 24 * 60 * 60 * 1000;
const DISMISS_MS = 1 * DAY; // ✕ 누른 뒤 쉬는 기간
const LIFETIME_MS = 7 * DAY; // 최초 노출 후 수명

export type BannerVariant = "a" | "b";

type Stored = { firstSeen: number; dismissedUntil?: number };

function readStore(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export function EnrichBanner({
  slug,
  formUrl,
  variant = "a",
  preview = false,
}: {
  slug: string;
  formUrl: string;
  variant?: BannerVariant;
  /** 시안 비교용 — 시간 규칙을 무시하고 무조건 보여준다(?banner=a|b) */
  preview?: boolean;
}) {
  // 서버·클라 첫 렌더를 맞추려고 null로 시작한다(하이드레이션 불일치 방지).
  const [show, setShow] = useState<boolean | null>(preview ? true : null);
  const key = `collab5.enrichBanner.${slug}`;

  useEffect(() => {
    if (preview) return;
    const now = Date.now();
    const s = readStore(key);
    if (!s) {
      // 최초 노출 — 이 시각부터 7일을 센다.
      try {
        localStorage.setItem(key, JSON.stringify({ firstSeen: now } satisfies Stored));
      } catch {}
      setShow(true);
      return;
    }
    if (now - s.firstSeen > LIFETIME_MS) return setShow(false); // 수명 종료
    if (s.dismissedUntil && now < s.dismissedUntil) return setShow(false); // 쉬는 중
    setShow(true);
  }, [key, preview]);

  const dismiss = () => {
    setShow(false);
    if (preview) return;
    try {
      const s = readStore(key);
      localStorage.setItem(
        key,
        JSON.stringify({ firstSeen: s?.firstSeen ?? Date.now(), dismissedUntil: Date.now() + DISMISS_MS })
      );
    } catch {}
  };

  if (!show) return null;

  const isB = variant === "b";

  // A = 키위 틴트 / B = 잉크 다크. 라이트·다크 양쪽에서 본문과 갈라져야 한다.
  // ⚠️ B는 **토큰 클래스를 쓰지 않는다** — `--surface-dark`는 @theme에 `--color-*`로 노출돼 있지 않아
  //    `bg-surface-dark`/`text-on-dark`가 유틸로 생성되지 않는다(08-02 실측: 제목이 안 보였다).
  //    비교용 안이라 토큰을 늘리는 대신 값을 박는다. B로 확정되면 그때 토큰을 추가한다.
  const shell = isB ? "bg-[#2c2c2c] border-[#2c2c2c]" : "bg-primary-pale border-primary-strong";
  const title = isB ? "text-[#fafafa]" : "text-primary-on";
  const desc = isB ? "text-[#c9c9c9]" : "text-body";
  // 닫기 버튼 — 시트들의 공통 패턴(h-8 w-8 rounded-pill + 호버 시 면이 깔린다)을 따른다.
  // ⚠️ 호버 면은 `bg-surface-soft`(회색)를 쓰지 않는다 — 배너 바탕이 키위 틴트라 회색이 탁하게 얹힌다.
  const xBtn = isB
    ? "text-[#fafafa]/60 hover:bg-white/10 hover:text-[#fafafa]"
    : "text-primary-on/55 hover:bg-primary-tint hover:text-primary-on";

  // ⚠️ 배너는 **소개서보다 작아야 한다** — 주인이 열자마자 자기 소개서를 봐야지 배너를 보면 안 된다.
  //    그래서 무료 칩을 빼고(문구 끝 "(무료)"가 대신한다) 제목을 맨 위로 올려 높이를 줄였다(대표 지시 08-02).
  return (
    <section className={`mb-5 rounded-lg border px-4 py-3.5 ${shell}`} aria-label="소개서 보강 신청">
      {/* ⚠️ 닫기 버튼을 absolute로 띄우지 않는다 — 제목이 두 줄이 되면 세로 중심이 어긋난다.
          flex 형제로 두고 -mt로만 당겨 **제목 첫 줄**과 시각 중심을 맞춘다(대표 QA 08-02). */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className={`break-keep text-[15.5px] font-bold leading-[1.4] tracking-[-0.02em] ${title}`}>
            🌱 소개서를 더 풍성하게 만들어드릴까요?
          </h2>
          <p className={`mt-1 break-keep text-[13px] leading-[1.6] ${desc}`}>
            collab5가 온라인과 인스타그램에 있는 사진과 이야기를 찾아 소개서에 함께 담아드려요.(무료, 1일 소요)
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="배너 닫기"
          className={`-mr-1.5 -mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[17px] leading-none transition-colors ${xBtn}`}
        >
          ✕
        </button>
      </div>

      {/* 좌측 정렬 — 위 문단이 왼쪽 정렬이라 시선이 그대로 버튼으로 이어진다.
          중앙 정렬은 버튼이 폭 전체를 쓸 때 어울리는데, 그러면 배너가 다시 커진다. */}
      <a
        href={formUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-[14px] font-bold text-primary-on"
      >
        소개서 더 채우기
      </a>
    </section>
  );
}
