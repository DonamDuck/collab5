"use client";

import { useEffect, useRef, useState, type ElementType } from "react";

// 스크롤 리빌 — 뷰포트에 들어오면 살짝 아래(20px)에서 페이드업. 한 번만 재생.
// IntersectionObserver + CSS transition(라이브러리 없음 — 저장소 방침). prefers-reduced-motion이면 애니 없이 즉시.
// ⚠️ 히어로(첫 화면)엔 쓰지 않는다 — 초기 opacity-0이라 JS 하이드레이션 전엔 안 보여서 위화감.
//    스크롤로 들어오는 하단 섹션 전용. delay는 같은 그리드 카드들 순차 등장(스태거)용.
export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: React.ReactNode;
  delay?: number; // ms — 카드 스태거
  className?: string;
  as?: ElementType; // 시맨틱 유지용(예: "section"). 기본 div
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true); // 모션 최소화 사용자 = 즉시 표시(움직임 없음)
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        // isIntersecting(뷰포트 진입) OR 이미 위로 지나침(top<0) — 후자는 점프 스크롤·스크롤 복원·딥링크로
        // 요소를 건너뛰어도 숨은 채 남지 않게(IO는 "안보임→안보임"은 콜백을 안 쏘므로 이 가드가 필요).
        if (e.isIntersecting || e.boundingClientRect.top < 0) {
          setShown(true);
          io.disconnect(); // 리빌은 1회 — 위로 되감기지 않음
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" } // 살짝 일찍 트리거
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<HTMLElement>}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`transition-all duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
