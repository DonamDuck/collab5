"use client";

// 홈 미리보기 — 실제 데모 소개서 2종을 폰 프레임 "걸쳐 보이는" 갤러리(피크 캐러셀)로 노출.
// 목적: 랜딩 순간 "결과물이 뭔지" 보여주기 + "사진 없어도 이 정도" 안심(사진 부재 이탈 대응).
// 탭별 슬라이드 3~4장 = 상단 카드만이 아니라 차이가 드러나는 구간(사진 슬라이더·블록 등)까지 (대표 지시).
// 이미지 = prod 데모 고정본 실화면 스크린샷(과장·미화 없음). 갱신은 데모 재복제 후 재캡처로.
import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";

const DEMOS = [
  {
    key: "photos",
    label: "사진까지 첨부한 예시",
    slug: "m-demo-photo",
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
    slug: "m-demo-none",
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

      <p className="mt-5 text-center text-sm text-mute">화면을 누르면 실제 소개서를 구경할 수 있어요.</p>
    </div>
  );
}

// 피크 캐러셀 — 다음 장이 걸쳐 보이는 스와이프 갤러리(화살표 없음). CSS scroll-snap 기반.
function PhoneGallery({ demo }: { demo: (typeof DEMOS)[number] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + 16; // gap-4
    setIdx(Math.min(demo.slides.length - 1, Math.round(el.scrollLeft / step)));
  };

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-[13%] pb-2 sm:px-[30%] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {demo.slides.map((s, i) => (
          <Link
            key={s.src}
            href={`/m/${demo.slug}`}
            aria-label={`${demo.label} 소개서 보기`}
            className="block w-[74%] max-w-[280px] shrink-0 snap-center rounded-[2rem] bg-ink p-2 shadow-e2 transition-transform hover:-translate-y-1"
          >
            <div className="overflow-hidden rounded-[1.5rem] bg-surface">
              <Image
                src={s.src}
                alt={s.alt}
                width={750}
                height={1540}
                priority={demo.key === "photos" && i === 0}
                sizes="(max-width: 640px) 74vw, 280px"
                className="h-auto w-full"
              />
            </div>
          </Link>
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
