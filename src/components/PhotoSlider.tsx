"use client";

// 브랜드 사진 스와이프 슬라이드 — 자동재생 없음. 모바일=손가락 스와이프(스크롤스냅),
// 데스크탑=마우스 드래그(잡고 끌기) + 화살표. 인디케이터 점으로 위치 표시.
// 사진 탭/클릭 = 원본 보기(라이트박스). 목록은 4:3 object-cover라 잘려 보이지만,
// 저장본은 비율 유지 축소본(크롭 아님)이라 라이트박스에서 object-contain으로 전체가 보인다.
import { useEffect, useRef, useState } from "react";
import { ScrollLock } from "./ScrollLock";

export function PhotoSlider({
  photos,
  sources,
  rounded = "rounded-lg",
}: {
  photos: string[];
  /** 사진 주소 → 출처 글자. 소개서 전체가 표 하나를 공유하므로 **슬라이더마다 그대로 넘기면 된다.**
   *  대부분의 사진엔 출처가 없다 — 있는 장에서만 캡션이 뜬다(대표 확정 08-20). */
  sources?: Record<string, string>;
  rounded?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startLeft: 0 });
  // 원본 보기 — 열린 사진 index(null=닫힘)
  const [zoom, setZoom] = useState<number | null>(null);
  // "클릭 vs 스와이프/드래그" 구분용 누른 지점 + 그때 스크롤 위치.
  // null = 기록 없음 → 막지 않는다(기본 허용). 기록이 있을 때만 이동량으로 판정.
  const press = useRef<{ x: number; y: number; left: number } | null>(null);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // 데스크탑 마우스 드래그(잡고 끌기). 터치는 네이티브 스크롤스냅에 맡김(pointerType 분기).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    // 클릭/스와이프 판정용 — 포인터 종류 무관하게 기록
    press.current = { x: e.clientX, y: e.clientY, left: el?.scrollLeft ?? 0 };
    if (photos.length <= 1 || e.pointerType !== "mouse" || !el) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft };
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active || !el) return;
    el.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    if (!el) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}
    // 살짝만 밀어도 넘어가게 — 시작 장 기준 이동량이 폭의 15% 넘으면 다음/이전 장으로.
    const width = el.clientWidth || 1;
    const startPage = Math.round(drag.current.startLeft / width);
    const moved = el.scrollLeft - drag.current.startLeft;
    const threshold = width * 0.15;
    let target = startPage;
    if (moved > threshold) target = startPage + 1;
    else if (moved < -threshold) target = startPage - 1;
    goTo(Math.max(0, Math.min(photos.length - 1, target)));
  };

  // 누른 지점에서 8px 이상 움직였거나 그 사이 슬라이드가 넘어갔으면 스와이프/드래그로 보고 열지 않는다.
  const openZoom = (i: number, e: React.MouseEvent) => {
    const p = press.current;
    if (p) {
      const movedPx = Math.hypot(e.clientX - p.x, e.clientY - p.y);
      const scrolled = Math.abs((ref.current?.scrollLeft ?? 0) - p.left);
      if (movedPx > 8 || scrolled > 8) return;
    }
    setZoom(i);
  };

  if (!photos.length) return null;
  const multi = photos.length > 1;
  // 지금 보이는 장의 출처. 없으면 빈 문자열 → 줄은 남고 글자만 사라진다.
  const caption = sources?.[photos[idx]]?.trim() || "";
  // ⭐**이 슬라이더 안에 출처가 하나라도 있을 때만** 캡션 줄을 만든다.
  //   대부분의 사진엔 출처가 없어서(대표 확정 08-20), 줄을 늘 그리면 소개서 전체에
  //   빈 줄이 사진 수만큼 생긴다. 반대로 출처가 섞여 있는 슬라이더에서는 줄을 **미리 잡아둬야**
  //   출처 있는 장을 지날 때마다 아래 내용이 들썩이지 않는다.
  const anySource = photos.some((p) => sources?.[p]?.trim());
  // 인쇄본은 첫 장만 나온다(`:not(:first-child):print:hidden`) → 인쇄용 출처도 첫 장 것으로.
  const printCaption = sources?.[photos[0]]?.trim() || "";

  return (
    <div className="select-none">
      <div className={`relative overflow-hidden ${rounded}`}>
        {/* ⚠️ 원본 보기 클릭은 <img>가 아니라 이 컨테이너에 건다.
            데스크탑 드래그용 setPointerCapture가 걸리면 click 이벤트가 캡처 대상(이 div)으로 가서
            이미지에 붙인 onClick은 아예 안 불린다(모바일은 터치라 캡처를 안 걸어 정상 동작 → 데스크탑만 실패). */}
        <div
          ref={ref}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClick={(e) => openZoom(idx, e)}
          // overscroll-x-contain: 레일 끝에서 오버스크롤이 문서로 새면 브라우저 뒤로가기가 발동한다. 세로축은 그대로.
          className={`no-scrollbar flex ${
            multi ? "overflow-x-auto overscroll-x-contain" : "overflow-hidden"
          } ${multi && !dragging ? "snap-x snap-mandatory" : ""} ${
            multi ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          }`}
        >
          {/* 비율 = 4:3 고정. 1:1 정방형을 시험했으나(07-26) 4:3이 더 낫다는 대표 판정으로 복귀. */}
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-soft [&:not(:first-child)]:print:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`브랜드 사진 ${i + 1}`}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* 장수 카운터 */}
        {multi && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-pill bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white print:hidden">
            {idx + 1} / {photos.length}
          </span>
        )}

        {/* 원본 보기 안내 — 사진 위 레이어(우측 하단). 사진을 눌러도 같은 동작이지만,
            "원본을 볼 수 있다"는 걸 알려주는 표지가 없으면 아무도 안 누른다.
            스크롤 컨테이너 밖이라 드래그 판정과 무관 → setZoom을 직접 부른다. */}
        <button
          type="button"
          onClick={() => setZoom(idx)}
          aria-label="사진 원본 보기"
          className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-pill bg-ink/55 text-white hover:bg-ink/75 print:hidden"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4M8.5 6.5v4M6.5 8.5h4" strokeLinecap="round" />
          </svg>
        </button>

        {/* 데스크탑 화살표(모바일은 스와이프) */}
        {multi && idx > 0 && (
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            aria-label="이전 사진"
            className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill bg-surface/85 text-ink shadow-e1 hover:bg-surface sm:flex print:hidden!"
          >
            ‹
          </button>
        )}
        {multi && idx < photos.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            aria-label="다음 사진"
            className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill bg-surface/85 text-ink shadow-e1 hover:bg-surface sm:flex print:hidden!"
          >
            ›
          </button>
        )}
      </div>

      {/* 사진 출처 캡션 — 지금 보이는 장에 출처가 있을 때만 글자가 뜬다.
          🎨매거진 본문 사진 캡션과 **같은 값**을 쓴다(`ArticleBody.tsx`의 figcaption):
             가운데 정렬 · 14px · leading-relaxed · text-faint. 두 곳이 갈리면 같은 서비스로 안 보인다.
          min-h로 한 줄을 잡아둬서 장을 넘겨도 아래가 밀리지 않는다. */}
      {anySource && (
        <p className="mt-2 min-h-[23px] text-center text-[14px] leading-relaxed text-faint">
          <span className="print:hidden">{caption && `출처: ${caption}`}</span>
          <span className="hidden print:inline">{printCaption && `출처: ${printCaption}`}</span>
        </p>
      )}

      {/* 인디케이터 점 */}
      {multi && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 print:hidden">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 사진`}
              // 점 자체는 6.4px이라 44px 규칙의 1/7이었다 — 원하는 사진으로 넘어가질 못한다(QA #21).
              // ⚠️ 점을 키우면 디자인이 무너지니 **시각 픽셀은 그대로 두고 히트영역만** pseudo로 넓힌다.
              //    -inset-y-4(≈40px 세로) + 좌우 3px → 인접 점과 겹치지 않는 선에서 최대치.
              className={`relative h-1.5 rounded-pill transition-all after:absolute after:-inset-x-[3px] after:-inset-y-4 after:content-[''] ${
                i === idx ? "w-4 bg-primary" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>
      )}

      {zoom !== null && (
        <Lightbox photos={photos} sources={sources} index={zoom} onIndex={setZoom} onClose={() => setZoom(null)} />
      )}
    </div>
  );
}

/** 원본 보기 — 목록은 4:3 크롭이지만 여기선 object-contain으로 잘린 부분까지 전부 보여준다.
 *  닫기 = X·배경 탭·Esc / 이동 = 좌우 화살표·키보드 ←→ (사진 여러 장일 때만). */
function Lightbox({
  photos,
  sources,
  index,
  onIndex,
  onClose,
}: {
  photos: string[];
  sources?: Record<string, string>;
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const multi = photos.length > 1;
  // 출처는 원본을 크게 볼 때 **가장 필요하다** — 목록보다 여기서 더 확실히 보인다.
  const caption = sources?.[photos[index]]?.trim() || "";
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (multi && e.key === "ArrowLeft") onIndex((index - 1 + photos.length) % photos.length);
      else if (multi && e.key === "ArrowRight") onIndex((index + 1) % photos.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, multi, photos.length, onIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/90 p-4 print:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="사진 원본 보기"
    >
      <ScrollLock />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[index]}
        alt={`사진 원본 ${index + 1}`}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="max-h-full max-w-full cursor-default object-contain"
      />

      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-pill bg-ink/60 text-on-dark hover:bg-ink/80"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
        </svg>
      </button>

      {multi && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="이전 사진"
            className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill bg-ink/60 text-[20px] text-on-dark hover:bg-ink/80"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="다음 사진"
            className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-pill bg-ink/60 text-[20px] text-on-dark hover:bg-ink/80"
          >
            ›
          </button>
          <span className="pointer-events-none absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-pill bg-ink/60 px-3 py-1 text-[13px] font-medium text-on-dark">
            {index + 1} / {photos.length}
          </span>
        </>
      )}

      {/* 출처 — 사진이 여러 장이면 장수 배지 위로 올린다(겹치지 않게). */}
      {caption && (
        <span
          className={`pointer-events-none absolute left-1/2 max-w-[86%] -translate-x-1/2 rounded-pill bg-ink/60 px-3 py-1 text-center text-[12.5px] leading-snug text-on-dark ${
            multi
              ? "bottom-[calc(3.1rem+env(safe-area-inset-bottom))]"
              : "bottom-[calc(1rem+env(safe-area-inset-bottom))]"
          }`}
        >
          출처: {caption}
        </span>
      )}
    </div>
  );
}
