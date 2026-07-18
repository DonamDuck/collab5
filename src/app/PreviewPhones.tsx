"use client";

// 홈 미리보기 — 실제 데모 소개서 2종을 폰 프레임 "걸쳐 보이는" 갤러리(피크 캐러셀)로 노출.
// 목적: 랜딩 순간 "결과물이 뭔지" 보여주기 + "사진 없어도 이 정도" 안심(사진 부재 이탈 대응).
// 탭별 슬라이드 3~4장 = 상단 카드만이 아니라 차이가 드러나는 구간(사진 슬라이더·블록 등)까지 (대표 지시).
// 이미지 = prod 데모 고정본 실화면 스크린샷(과장·미화 없음). 갱신은 데모 재복제 후 재캡처로.
// 클릭 내비게이션 없음(순수 시각 프리뷰) — 데스크탑은 마우스 드래그, 모바일은 네이티브 스와이프로 넘김.
import { useRef, useState } from "react";
import Image from "next/image";

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

export function PreviewPhones() {
  const [active, setActive] = useState<(typeof DEMOS)[number]["key"]>("photos");

  return (
    <div>
      {/* 탭 — 예시 종류 전환 */}
      <div className="mb-6 flex justify-center gap-2">
        {DEMOS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setActive(d.key)}
            className={`inline-flex h-9 items-center rounded-pill border px-4 text-sm font-medium transition-colors ${
              active === d.key
                ? "border-primary bg-primary-tint text-primary-on"
                : "border-hairline bg-surface text-mute"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {DEMOS.map((d) => (
        <div key={d.key} className={active === d.key ? "" : "hidden"}>
          <PhoneGallery demo={d} />
        </div>
      ))}
    </div>
  );
}

// 피크 캐러셀 — 다음 장이 걸쳐 보이는 갤러리(화살표 없음). 모바일=네이티브 스와이프, 데스크탑=마우스 드래그.
function PhoneGallery({ demo }: { demo: (typeof DEMOS)[number] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const dragRef = useRef<{ startX: number; startScroll: number } | null>(null);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + 16; // gap-4
    setIdx(Math.min(demo.slides.length - 1, Math.round(el.scrollLeft / step)));
  };

  // 데스크탑 마우스 드래그로 좌우 스크롤(터치는 브라우저 네이티브 스와이프 그대로 사용).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = trackRef.current;
    if (!el) return;
    dragRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = trackRef.current;
    if (!drag || !el) return;
    el.scrollLeft = drag.startScroll - (e.clientX - drag.startX);
  };
  const endDrag = () => {
    dragRef.current = null;
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
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[13%] pb-2 cursor-grab select-none active:cursor-grabbing sm:px-[30%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {demo.slides.map((s, i) => (
          <div
            key={s.src}
            className="block w-[74%] max-w-[280px] shrink-0 snap-center rounded-[2rem] bg-ink p-1.5 shadow-e2"
          >
            <div className="overflow-hidden rounded-[1.625rem] bg-surface">
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
