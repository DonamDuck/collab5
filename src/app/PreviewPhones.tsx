"use client";

// 홈 미리보기 — 실제 데모 소개서 2종을 브라우저 카드 "걸쳐 보이는" 갤러리(피크 캐러셀)로 노출.
// (07-31: 폰 프레임 → 브라우저 카드. 이유는 아래 프레임 주석 참조 — 앱 오해 제거 + 링크가 결과물임을 전달)
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
      { src: "/preview/slides/photo-4.jpg", alt: "사진까지 첨부한 소개서 — 이런 곳에 소개됐어요" },
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

// 홈 갤러리는 한 스크롤로 사진 소개서(4장) → 텍스트 소개서(3장) 총 7장을 이어서 노출(결과물 티저).
// ⭐4:3 (대표 지시 07-28 — 3:3 대칭으로 줄였다가 되돌림). 사진본의 4번째는 press 블록("이런 곳에 소개됐어요")으로,
//   무사진본엔 대응 장면이 없다. 대칭보다 "사진이 있으면 보여줄 게 하나 더 있다"를 택한 것.
// key:"photos"로 둬야 첫 슬라이드(브랜드 카드+사진)가 priority 로딩됨. 두 버전 전체 탐색은 '소개서 미리보기' 버튼→/preview.
const HOME_SLIDES = {
  key: "photos" as const,
  slides: [...DEMOS[0].slides, ...DEMOS[1].slides],
};

export function PreviewPhones() {
  return <PhoneGallery demo={HOME_SLIDES} />;
}

// 피크 캐러셀 — 다음 장이 걸쳐 보이는 갤러리(화살표 없음).
// 모바일: 네이티브 터치 스크롤(관성·스냅). 데스크탑: 마우스 드래그 + 놓으면 관성 글라이드(스르륵).
function PhoneGallery({ demo }: { demo: { key: string; slides: readonly { src: string; alt: string }[] } }) {
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
        // overscroll-x-contain: 레일 끝에서 오버스크롤이 문서로 새면 브라우저 뒤로가기가 발동한다. 세로축은 그대로.
        // pb-12: overflow-x-auto는 세로축도 auto라 프레임 그림자(아래로 ~44px)가 잘려 레일 밑에 가로줄이 그어졌다.
        //        확산 그림자가 다 들어갈 만큼 띄우고, 그만큼 아래 인디케이터를 -mt로 당겨 간격은 전과 동일하게 유지.
        className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain pl-[calc(6%+5px)] pr-[calc(13%+5px)] pb-12 cursor-grab select-none active:cursor-grabbing sm:snap-none sm:pl-1 sm:pr-[21px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {demo.slides.map((s, i) => (
          // 브라우저 카드 — 예전엔 폰 프레임이었다(대표 지시로 07-31 교체).
          // ⚠️ **폰 목업은 "앱이 있다"는 가장 강한 시각 신호**라, 웹서비스인 우리 홈이
          //    앱 다운로드 랜딩처럼 읽히게 만들던 주범이었다(대표 제보).
          //    게다가 우리 제품의 결과물은 **공유되는 링크(URL)** 인데 폰 프레임이 그걸 가리고 있었다
          //    → 주소창을 노출해 "링크가 나온다"를 그림 하나로 전달한다.
          // · 스크린샷이 세로형(750×1540 모바일 캡처)이라 데스크탑 창이 아니라 **모바일 브라우저 창** 형태로 간다.
          //   데스크탑 크롬(점3개+넓은 주소창)을 세로 비율에 씌우면 창이 기형적으로 길어 보인다.
          // · bg-white 고정: 다크 테마에서도 "브라우저 UI 색"이다(bg-surface면 테마 따라 변해 크롬이 사라진다).
          // · 라운드 16px — 기기(44px)보다 확 낮춰야 '창'으로 읽힌다. 폭이 줄어도 안 말랑해지는 값.
          // · 그림자 3겹(접지 1px·몸통·확산)은 폰 프레임에서 그대로 계승 — 한 겹짜리가 허접해 보이던 주 원인.
          <div
            key={s.src}
            className="block w-[74%] max-w-[280px] shrink-0 snap-center overflow-hidden rounded-[16px] bg-white ring-1 ring-black/[.07] sm:snap-start"
            style={{
              boxShadow:
                "0 1px 2px rgba(24,24,22,.05), 0 10px 24px -8px rgba(24,24,22,.14), 0 32px 64px -20px rgba(24,24,22,.16)",
            }}
          >
            {/* 주소창 — 실제 공개 주소. aria-hidden: 장식이고, 링크가 아니라 그림이다(누를 수 없는데 읽히면 혼란) */}
            <div
              className="flex items-center gap-1.5 border-b border-black/[.06] bg-[#f5f5f6] px-2.5 py-[7px]"
              aria-hidden="true"
            >
              <svg viewBox="0 0 12 12" className="h-[9px] w-[9px] shrink-0 text-[#9a9a9a]" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="2.4" y="5.2" width="7.2" height="5.4" rx="1.2" />
                <path d="M4.2 5.2V3.9a1.8 1.8 0 0 1 3.6 0v1.3" strokeLinecap="round" />
              </svg>
              <span className="truncate text-[9px] leading-none text-[#6b6b6b]">collab5.co.kr/m/…</span>
            </div>
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
        ))}
      </div>
      {/* 인디케이터 점 — -mt-7은 위 레일의 pb-12(그림자 여유) 상쇄용. 프레임 밑 간격은 예전 그대로 ~20px */}
      <div className="-mt-7 flex justify-center gap-1.5" aria-hidden="true">
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
