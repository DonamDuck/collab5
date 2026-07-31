"use client";

// AI 콜라보 분석 리포트 시트 — 풀하이트 바텀시트(제안 시트 패턴 재사용).
// 상태 머신: idle → (select: 소개서 2개+ 첫 depth 선택) → loading(카피 3단 순환) → ok(6조각) | thin | no_match | error(재시도).
// 멀티 소개서는 칩 선택 + [분석하기]를 눌러야 fetch — 자동 생성으로 콜 낭비하지 않는다(대표 QA 07-26).
// sampleMode = 무소개서 유저 티저: fetch 없이 sample-report.json 렌더 + 위저드 CTA.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §4·§5
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismissable } from "@/components/useDismissable";
import { track } from "@/lib/track";
import type { CollabReportData } from "@/lib/types";
import sampleData from "@/lib/sample-report.json";

// 순환 문구 — 2번째에 소요시간을 끼운다(대표 지시 07-31).
// 전엔 "보통 30초 정도 걸려요"가 순환 문구 **아래 고정 줄**로 따로 있었다. 배열에 넣으면서
// 그 줄은 지운다 — 안 지우면 2번째 차례에 같은 문장이 위아래로 두 번 보인다.
// 2번째 자리인 이유: 첫 문구(4초)로 "일이 시작됐다"를 알린 직후, **아직 참을 만할 때** 끝을 알려준다.
//   기다림에서 힘든 건 길이가 아니라 끝을 모르는 것 — 실측 25~28초라 30초는 넉넉하게 부른 값이다.
// ⚠️ 이제 소요시간이 상시 노출이 아니라 4초마다 한 번 지나간다. 늦게 연 사람은 최대 12초 뒤에 본다.
//    (⏱ 파이프라인이 빨라지면 이 문구도 같이 낮출 것)
const LOADING_COPY = [
  "두 소개서를 읽고 있어요…",
  "보통 30초 정도 걸려요",
  "접점을 찾는 중…",
  "콜라보를 상상하는 중…",
];

type Phase =
  "idle" | "select" | "loading" | "ok" | "thin" | "no_match" | "error";

// /api/collab-report 200 응답(state 있는 형태)
type OkPayload = {
  report: CollabReportData;
  cached: boolean;
  model: string;
  durationMs?: number;
  dnaCalls?: number;
};

export function ReportSheet({
  open,
  onClose,
  fromBrands,
  toSlug,
  toName,
  sampleMode,
  onPropose,
  initialFromSlug = null,
  source = "maker_page",
  onReportLoaded,
}: {
  open: boolean;
  onClose: () => void;
  fromBrands: { id: number; slug: string; name: string }[]; // 내 소개서들 — 어떤 걸로 분석할지
  toSlug: string;
  toName: string;
  sampleMode: boolean; // 소개서 0개 유저 — 샘플 리포트 티저
  onPropose: () => void; // CTA — 리포트 닫고 제안 시트 오픈(부모가 처리)
  initialFromSlug?: string | null; // /my 아카이브 딥링크 — 이 slug로 선택 스텝 없이 바로 실행
  /** 계측용 오픈 위치 — 홈 샘플 오픈이 /m 잠금 티저 지표(report_locked_view)를 오염시키지 않게 구분(07-31) */
  source?: "maker_page" | "home";
  /** 리포트가 실제로 열렸을 때 부모에게 올려준다 — 제안 시트가 콜라보 아이디어를 초안에 넣는 데 쓴다(07-31).
   *  ⚠️ 샘플(가상 쌍)은 올리지 않는다 — 남의 브랜드 얘기가 내 DM 초안에 섞이면 안 된다. */
  onReportLoaded?: (report: CollabReportData) => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<OkPayload | null>(null);
  const [thin, setThin] = useState<{
    side: "from" | "to";
    distinctTypes?: number;
  }>({ side: "from" });
  const [selectedSlug, setSelectedSlug] = useState(fromBrands[0]?.slug);
  const [copyIdx, setCopyIdx] = useState(0);

  // in-flight 가드 — 생성 중 재요청 금지(이중 지출 차단). 도중에 칩이 바뀌면 완료 후 최신 선택으로 1회 재실행.
  const inFlightRef = useRef(false);
  const wantSlugRef = useRef<string | null>(null);
  // 콜백을 ref로 들고 있는다 — run의 useCallback 의존성에 넣으면 부모 리렌더마다 run이 새로 만들어진다.
  const loadedCbRef = useRef(onReportLoaded);
  loadedCbRef.current = onReportLoaded;

  const selected =
    fromBrands.find((b) => b.slug === selectedSlug) ?? fromBrands[0];

  const run = useCallback(
    async (fromSlug: string) => {
      if (inFlightRef.current) {
        wantSlugRef.current = fromSlug; // 완료 후 이 선택으로 재실행
        return;
      }
      inFlightRef.current = true;
      wantSlugRef.current = fromSlug;
      setPhase("loading");
      try {
        const res = await fetch("/api/collab-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fromSlug, toSlug }),
        });
        const data = await res.json().catch(() => null);
        if (wantSlugRef.current === fromSlug) {
          if (!res.ok || !data || typeof data.state !== "string") {
            setPhase("error");
          } else if (data.state === "thin") {
            const side: "from" | "to" = data.side === "to" ? "to" : "from";
            setThin({ side, distinctTypes: data.distinctTypes });
            setPhase("thin");
            track("report_thin_blocked", {
              side,
              distinct_types: data.distinctTypes ?? 0,
            });
          } else if (data.state === "no_match") {
            setPhase("no_match");
            track("report_no_match");
          } else if (data.state === "ok" && data.report) {
            const ok = data as OkPayload;
            setResult(ok);
            setPhase("ok");
            loadedCbRef.current?.(ok.report); // 제안 시트가 아이디어를 쓸 수 있게 부모로 올림
            track("report_view", { cache_hit: ok.cached });
            if (ok.cached === false) {
              track("report_generated", {
                duration_ms: ok.durationMs ?? 0,
                model: ok.model,
                dna_calls: ok.dnaCalls ?? 0,
              });
            }
          } else {
            setPhase("error");
          }
        }
      } catch {
        if (wantSlugRef.current === fromSlug) setPhase("error");
      } finally {
        inFlightRef.current = false;
        // 로딩 중 칩이 바뀌었으면 최신 선택으로 이어서 실행
        if (wantSlugRef.current && wantSlugRef.current !== fromSlug)
          run(wantSlugRef.current);
      }
    },
    [toSlug],
  );

  // 열릴 때: 소개서 1개면 바로 fetch(캐시면 서버가 즉시 반환), 2개+면 선택(select)이 첫 depth.
  // 칩 변경만으로는 fetch하지 않는다 — [분석하기]를 눌러야 실행(콜 낭비 방지).
  useEffect(() => {
    if (!open || sampleMode) return;
    // 아카이브 딥링크 — 쌍이 이미 정해져 있으니 선택 스텝을 건너뛰고 바로 실행(캐시면 즉시)
    if (initialFromSlug && fromBrands.some((b) => b.slug === initialFromSlug)) {
      setSelectedSlug(initialFromSlug);
      run(initialFromSlug);
      return;
    }
    if (fromBrands.length > 1) {
      setPhase("select");
      return;
    }
    if (selected?.slug) run(selected.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sampleMode, initialFromSlug]);

  // 샘플 모드(잠금 티저) 오픈 계측 — 무소개서 퍼널 시작점. source로 홈/소개서 유입 구분.
  useEffect(() => {
    if (open && sampleMode) track("report_locked_view", { source });
  }, [open, sampleMode, source]);

  // 로딩 카피 4단 순환(4초 간격) — 2번째가 소요시간 안내
  useEffect(() => {
    if (phase !== "loading") return;
    setCopyIdx(0);
    const t = window.setInterval(
      () => setCopyIdx((i) => (i + 1) % LOADING_COPY.length),
      4000,
    );
    return () => window.clearInterval(t);
  }, [phase]);

  // 오버레이 공통 동작(ESC·딤클릭·스크롤잠금·포커스 트랩·aria-modal) — 훅 규칙상 early return보다 위에서 호출.
  // 리포트는 읽는 시트라 딤 클릭·ESC 둘 다 허용(작성 중인 내용이 없다).
  const { overlayProps, panelProps } = useDismissable(open, { onClose });

  if (!open) return null;

  const sampleReport = sampleData.report as CollabReportData;
  const report = sampleMode ? sampleReport : (result?.report ?? null);
  const fromName = sampleMode ? sampleData.fromName : (selected?.name ?? "");
  const reportToName = sampleMode ? sampleData.toName : toName;

  // ── 6조각 렌더(ok·샘플 공용) ──
  // ① 식별 메타(A×B 캡션)와 [다른 소개서로 분석]은 **고정 유틸 바로 이사**(디자인팀 07-26).
  //    덕분에 스크롤 첫 요소가 '요약 카드(결론)'가 되어 열자마자 결론이 최상단에 온다.
  //    3층 위계(캡션 mute → 라벨 mute → 결론 20px ink)는 그대로 유지.
  const pieces = report && (
    <div>
      {/* 핵심 요약 박스 — 형광 대신 뉴트럴 면으로 독립(무대 원칙) */}
      <div className="rounded-lg bg-surface-soft p-4">
        <p className="text-[12px] font-medium tracking-wide text-mute">
          콜라보 한줄 요약
        </p>
        <p className="mt-1.5 text-[20px] font-bold leading-snug text-balance break-keep text-ink">
          {report.oneLiner}
        </p>
      </div>

      {/* ② 이런 점이 잘 어울려요 — ✔ 리스트 */}
      <p className="mt-7 text-[15px] font-bold text-ink">
        이런 점이 잘 어울려요
      </p>
      <ul className="mt-2 space-y-2">
        {report.matchPoints.map((p, i) => (
          <li
            key={i}
            className="flex gap-2 text-[14px] leading-relaxed text-body"
          >
            <span className="shrink-0">✔</span>
            <span className="break-keep">{p.text}</span>
          </li>
        ))}
      </ul>

      {/* ③ 추천 콜라보 아이디어 — 카드 + 형태 태그 */}
      <p className="mt-6 text-[15px] font-bold text-ink">
        추천 콜라보 아이디어
      </p>
      <div className="mt-2 space-y-2.5">
        {report.ideas.map((idea, i) => (
          <div key={i} className="rounded-md border border-hairline p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-bold break-keep text-ink">
                {idea.title}
              </p>
              {idea.method && (
                <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-[12px] text-body">
                  {idea.method}
                </span>
              )}
            </div>
            <p className="mt-1 text-[14px] leading-relaxed break-keep text-body">
              {idea.desc}
            </p>
          </div>
        ))}
      </div>

      {/* ④ 실행 플랜 — 번호 스텝 */}
      <p className="mt-6 text-[15px] font-bold text-ink">실행 플랜</p>
      <ol className="mt-2 space-y-2">
        {report.steps.map((s, i) => (
          <li
            key={i}
            className="flex gap-2.5 text-[14px] leading-relaxed text-body"
          >
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-primary text-[11px] font-bold text-primary-on">
              {i + 1}
            </span>
            <span className="break-keep">{s}</span>
          </li>
        ))}
      </ol>

      {/* ⑤ 기대 효과 — 불릿 */}
      <p className="mt-6 text-[15px] font-bold text-ink">기대 효과</p>
      <ul className="mt-2 space-y-1.5">
        {report.effects.map((s, i) => (
          <li
            key={i}
            className="flex gap-2 text-[14px] leading-relaxed text-body"
          >
            <span className="shrink-0 text-faint">•</span>
            <span className="break-keep">{s}</span>
          </li>
        ))}
      </ul>

      {/* ⑥ CTA — 샘플 모드는 위저드 CTA로 대체 */}
      {!sampleMode && (
        <div className="mt-8">
          <p className="text-center text-[15px] font-medium text-ink">
            이 제안이 마음에 드셨나요? ✨
          </p>
          <button
            type="button"
            onClick={() => {
              track("report_cta_propose"); // 리포트→제안 전환 = P1→P3 퍼널 핵심 지표
              onPropose();
            }}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
          >
            이 내용으로 협업 제안 보내기
          </button>
        </div>
      )}
    </div>
  );

  // 리포트 본문 뷰만 '고정 바 + 스크롤 영역' 구조를 쓴다(디자인팀: 짧은 뷰는 과설계라 현행 유지).
  const isReportView = !!report && (sampleMode || phase === "ok");

  const closeButton = (extra: string) => (
    <button
      type="button"
      onClick={onClose}
      aria-label="닫기"
      className={`flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink ${extra}`}
    >
      <svg
        viewBox="0 0 20 20"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
      </svg>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 print:hidden" {...overlayProps}>
      {/* ⚠️ max-h는 **dvh** — iOS Safari의 vh는 'URL바 숨은 큰 뷰포트' 기준이라 URL바가 떠 있으면
          시트 상단(=닫기 버튼)이 URL바 아래로 밀려 안 눌린다(대표 제보 07-26). */}
      <div
        {...panelProps}
        className={`relative max-h-[85dvh] w-full max-w-[640px] rounded-t-2xl border border-b-0 border-hairline bg-surface shadow-e2 ${
          isReportView
            ? "flex flex-col" // 고정 바 + 스크롤 영역 — overflow는 아래 스크롤 영역에만 준다
            : "overflow-y-auto p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        {isReportView ? (
          <>
            {/* 고정 유틸 바 — 리포트가 길어 스크롤해도 닫기가 항상 잡힌다(대표 요청 07-26) */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
              {/* 고정 바의 유일한 텍스트라 13→15px로 키움(대표 07-26). 색은 body 유지 —
                  ink로 올리면 스크롤 영역의 결론(20 bold ink)과 경쟁해 3층 위계가 다시 뭉갠다. */}
              <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-body">
                {fromName} × {reportToName}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {!sampleMode && fromBrands.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPhase("select")}
                    // 높이가 14px이라 44px 규칙에 한참 못 미쳤고, 12.75px 옆이 닫기 ✕라
                    // 엄지로 노리면 리포트가 통째로 닫혔다(QA #21). 글자 크기는 유지하고 히트영역만 넓힌다.
                    className="-my-1 flex h-9 items-center rounded-md px-2 text-[12px] font-medium text-mute underline underline-offset-2 hover:bg-surface-soft"
                  >
                    다른 소개서로 분석
                  </button>
                )}
                {/* 두 버튼 사이 시각적 구분선 — 붙어 있으면 잘못 누르기 쉽다 */}
                {!sampleMode && fromBrands.length > 1 && <span aria-hidden="true" className="h-4 w-px bg-hairline" />}
                {closeButton("")}
              </div>
            </div>

            {/* 스크롤 영역 — 첫 요소가 요약 카드(결론). 패널에 있던 패딩·safe-area는 여기로 이사 */}
            <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
              {sampleMode && (
                <div className="mb-4 rounded-md bg-surface-soft px-3 py-2 text-[13px] font-medium text-body">
                  예시 리포트예요
                </div>
              )}
              {pieces}
              {sampleMode && (
                /* 무소개서 퍼널 — 위저드 CTA */
                <div className="mt-8 rounded-md border border-hairline bg-surface-soft p-4">
                  {/* 홈(source=home)에선 상대 브랜드가 없어 toName이 빈 문자열 — 범용 문구로 분기(07-31) */}
                  <p className="text-[14px] leading-relaxed break-keep text-body">
                    {toName
                      ? `소개서를 등록하면 ${toName}님과 나의 콜라보 분석을 받을 수 있어요`
                      : "소개서를 등록하면 마음에 드는 브랜드와 우리 브랜드의 콜라보 분석을 받을 수 있어요"}
                  </p>
                  <a
                    href="/register"
                    onClick={() => track("wizard_start_from_report")}
                    className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
                  >
                    내 소개서 만들기
                  </a>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {closeButton("absolute right-3 top-3")}

            {/* ── 짧은 상태 뷰(선택·로딩·thin·no_match·에러) ──
                샘플 모드는 report가 항상 있어 위 isReportView 분기로 빠지므로 여기 오지 않는다. */}
            {phase === "select" ? (
              /* 멀티 소개서 — 선택이 첫 depth. 칩 고르고 [분석하기]를 눌러야 생성(대표 QA 07-26) */
              <div className="pr-8">
                <p className="text-xl font-bold break-keep text-ink">
                  어떤 소개서로 분석할까요
                </p>
                <p className="mt-1.5 text-[14px] text-mute">
                  {toName}님과의 콜라보를 분석할 내 소개서를 골라주세요.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {fromBrands.map((b) => {
                    const on = b.slug === selected?.slug;
                    return (
                      <button
                        key={b.slug}
                        type="button"
                        onClick={() => setSelectedSlug(b.slug)}
                        className={`h-9 rounded-pill px-3.5 text-[14px] font-medium transition-colors ${
                          on
                            ? "bg-primary text-primary-on"
                            : "border border-border-strong bg-surface text-body"
                        }`}
                      >
                        {b.name}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  disabled={!selected?.slug}
                  onClick={() => selected?.slug && run(selected.slug)}
                  className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
                >
                  분석하기
                </button>
              </div>
            ) : phase === "loading" || phase === "idle" ? (
              // ⚠️ 스피너를 쓰지 않는다 — design.md Loader 원칙: "움직임은 텍스트 순환만, 회전 금지"
              //    (브랜드 정체성 + 어지럼 방지). 여기만 `animate-spin`+`animate-pulse`로 어기고 있었다(QA #25).
              //    정적 아톰 마크 + 순환 문구가 기준 구현(EnrichWizard LoadingView)과 같은 얼굴이다.
              <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16">
                <svg width="44" height="44" viewBox="0 0 56 56" fill="none" className="text-faint" aria-hidden="true">
                  <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(28 28 28)" />
                  <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(-28 28 28)" />
                  <circle cx="28" cy="28" r="6" fill="#98ff5c" />
                </svg>
                {/* 소요시간("보통 30초…")은 07-31에 **순환 배열 2번째로 흡수**됐다(대표 지시) —
                    여기 있던 고정 줄을 지운 이유는 LOADING_COPY 주석 참조(안 지우면 중복 노출).
                    animate-pulse는 뺐다 — 문구가 4초마다 바뀌는 것 자체가 이미 '살아있음' 신호다.
                    ⚠️ 줄 하나가 사라져 문구 아래 여백이 달라지므로, 높이는 py-16이 잡아준다(레이아웃 안 튐). */}
                <p className="mt-4 text-[15px] text-mute">{LOADING_COPY[copyIdx]}</p>
              </div>
            ) : phase === "ok" ? (
              pieces
            ) : phase === "thin" ? (
              <div className="py-10 text-center">
                {thin.side === "from" ? (
                  <>
                    <p className="text-lg font-bold break-keep text-ink">
                      내 소개서를 보강하면 분석이 더 정확해져요
                    </p>
                    <a
                      href={`/register?edit=${selected?.slug ?? ""}`}
                      className="mx-auto mt-5 flex h-12 w-full max-w-xs items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
                    >
                      소개서 보강하기
                    </a>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-bold break-keep text-ink">
                      {toName}님의 소개서 정보가 아직 적어요
                    </p>
                    <p className="mt-2 text-[14px] leading-relaxed text-mute">
                      소개서가 채워지면 분석할 수 있어요
                    </p>
                  </>
                )}
              </div>
            ) : phase === "no_match" ? (
              <div className="py-10 text-center">
                <p className="text-lg font-bold break-keep text-ink">
                  아직 뚜렷한 접점을 찾지 못했어요
                </p>
                <p className="mt-2 text-[14px] leading-relaxed break-keep text-mute">
                  두 소개서가 더 채워지면 새로운 접점이 보일 수 있어요. 다음에
                  다시 분석해볼게요.
                </p>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-lg font-bold break-keep text-ink">
                  분석에 실패했어요
                </p>
                <button
                  type="button"
                  onClick={() => selected?.slug && run(selected.slug)}
                  className="mx-auto mt-5 flex h-12 w-full max-w-xs items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink"
                >
                  다시 시도
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
