"use client";

// 홈 미리보기 — 실제 데모 소개서 2종을 폰 프레임 "걸쳐 보이는" 갤러리(피크 캐러셀)로 노출.
// 목적: 랜딩 순간 "결과물이 뭔지" 보여주기 + "사진 없어도 이 정도" 안심(사진 부재 이탈 대응).
// 탭별 슬라이드 3~4장 = 상단 카드만이 아니라 차이가 드러나는 구간(사진 슬라이더·블록 등)까지 (대표 지시).
// 이미지 = prod 데모 고정본 실화면 스크린샷(과장·미화 없음). 갱신은 데모 재복제 후 재캡처로.
// 내비게이션 없음(순수 시각 프리뷰). 모바일=네이티브 스와이프(관성+스냅), 데스크탑=마우스 드래그+관성 글라이드.
import { useRef, useState } from "react";
import Image from "next/image";

const SLIDE_GAP_PX = 29; // 슬라이드 간격 — 기존 16px의 약 1.8배 (대표와 함께 조정 중)

const DEMOS = [
  {
    key: "photos",
    label: "사진까지 첨부한 예시",
    slides: [
      { src: "/preview/slides/photo-1.jpg", alt: "사진까지 첨부한 소개서 — 브랜드 카드와 대표 사진" },
      { src: "/preview/slides/photo-2.jpg", alt: "사진까지 첨부한 소개서 — 활동 소개와 사진" },
      { src: "/preview/slides/photo-3.jpg", alt: "사진까지 첨부한 소개서 — 함께한 콜라보 사진" },
      { src: "/preview/slides/photo-4.jpg", alt: "사진까지 첨부한 소개서 — 숫자 지표와 소개된 곳" },
    ],
  },
  {
    key: "nophotos",
    label: "텍스트로 제작한 예시",
    slides: [
      { src: "/preview/slides/none-1.jpg", alt: "텍스트로 제작한 소개서 — 브랜드 카드와 자세히 소개" },
      { src: "/preview/slides/none-2.jpg", alt: "텍스트로 제작한 소개서 — 활동과 콜라보 이야기" },
      { src: "/preview/slides/none-3.jpg", alt: "텍스트로 제작한 소개서 — 키워드와 협업 정보" },
    ],
  },
] as const;

// 홈에서는 탭 없이 사진 예시 갤러리만 노출(결과물 티저). 두 버전 전체 탐색은 '소개서 미리보기' 버튼→/preview.
export function PreviewPhones() {
  return <PhoneGallery demo={DEMOS[0]} />;
}

// 피크 캐러셀 — 다음 장이 걸쳐 보이는 갤러리(화살표 없음).
// 모바일: 네이티브 터치 스크롤(관성·스냅). 데스크탑: 마우스 드래그 + 놓으면 관성 글라이드(스르륵).
function PhoneGallery({ demo }: { demo: (typeof DEMOS)[number] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  // 드래그 상태 + 속도 추적(px/ms). 놓을 때 관성으로 이어감.
  const drag = useRef<{ startX: number; startScroll: number; lastX: number; lastT: number; v: number } | null>(null);
  const raf = useRef(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + SLIDE_GAP_PX;
    setIdx(Math.min(demo.slides.length - 1, Math.round(el.scrollLeft / step)));
  };

  // 데스크탑 마우스 드래그로 좌우 스크롤(터치는 브라우저 네이티브 스와이프 그대로).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    cancelAnimationFrame(raf.current); // 진행 중이던 관성 글라이드 중단
    drag.current = { startX: e.clientX, startScroll: el.scrollLeft, lastX: e.clientX, lastT: performance.now(), v: 0 };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = trackRef.current;
    if (!d || !el) return;
    el.scrollLeft = d.startScroll - (e.clientX - d.startX);
    const now = performance.now();
    const dt = now - d.lastT;
    if (dt > 0) d.v = (d.lastX - e.clientX) / dt; // 마우스 왼쪽 이동 → 스크롤 오른쪽(+)
    d.lastX = e.clientX;
    d.lastT = now;
  };
  const endDrag = () => {
    const d = drag.current;
    const el = trackRef.current;
    drag.current = null;
    if (!d || !el) return;
    // 관성 글라이드 — 마지막 속도(px/ms)를 프레임 속도로 환산 후 감쇠.
    let v = Math.max(-40, Math.min(40, d.v * 16));
    const glide = () => {
      if (!trackRef.current || Math.abs(v) < 0.4) return;
      trackRef.current.scrollLeft += v;
      v *= 0.93;
      raf.current = requestAnimationFrame(glide);
    };
    if (Math.abs(v) >= 0.4) raf.current = requestAnimationFrame(glide);
  };

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}
        style={{ gap: SLIDE_GAP_PX }}
        className="flex snap-x snap-mandatory overflow-x-auto px-[calc(13%+5px)] pb-2 cursor-grab select-none active:cursor-grabbing sm:snap-none sm:px-[21px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {demo.slides.map((s, i) => (
          <div
            key={s.src}
            className="block w-[74%] max-w-[280px] shrink-0 snap-center rounded-[2.75rem] bg-ink p-1 shadow-e3 sm:snap-start"
          >
            <div className="overflow-hidden rounded-[2.5rem] bg-surface">
              <Image
                src={s.src}
                alt={s.alt}
                width={750}
                height={1540}
                priority={demo.key === "photos" && i === 0}
                draggable={false}
                sizes="(max-width: 640px) 74vw, 280px"
                className="h-auto w-full"
              />
            </div>
          </div>
        ))}
      </div>
      {/* 인디케이터 점 */}
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {demo.slides.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-pill transition-all ${
              i === idx ? "w-5 bg-primary" : "w-1.5 bg-border-strong"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
