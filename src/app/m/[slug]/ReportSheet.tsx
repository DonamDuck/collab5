"use client";

// AI 콜라보 분석 리포트 시트 — 풀하이트 바텀시트(제안 시트 패턴 재사용).
// 상태 머신: idle → loading(카피 3단 순환) → ok(6조각) | thin | no_match | error(재시도).
// sampleMode = 무소개서 유저 티저: fetch 없이 sample-report.json 렌더 + 위저드 CTA.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §4·§5
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollLock } from "@/components/ScrollLock";
import { track } from "@/lib/track";
import type { CollabReportData } from "@/lib/types";
import sampleData from "@/lib/sample-report.json";

const LOADING_COPY = ["두 소개서를 읽고 있어요…", "접점을 찾는 중…", "콜라보를 상상하는 중…"];

type Phase = "idle" | "loading" | "ok" | "thin" | "no_match" | "error";

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
}: {
  open: boolean;
  onClose: () => void;
  fromBrands: { id: number; slug: string; name: string }[]; // 내 소개서들 — 어떤 걸로 분석할지
  toSlug: string;
  toName: string;
  sampleMode: boolean; // 소개서 0개 유저 — 샘플 리포트 티저
  onPropose: () => void; // CTA — 리포트 닫고 제안 시트 오픈(부모가 처리)
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<OkPayload | null>(null);
  const [thin, setThin] = useState<{ side: "from" | "to"; distinctTypes?: number }>({ side: "from" });
  const [selectedSlug, setSelectedSlug] = useState(fromBrands[0]?.slug);
  const [copyIdx, setCopyIdx] = useState(0);

  // in-flight 가드 — 생성 중 재요청 금지(이중 지출 차단). 도중에 칩이 바뀌면 완료 후 최신 선택으로 1회 재실행.
  const inFlightRef = useRef(false);
  const wantSlugRef = useRef<string | null>(null);

  const selected = fromBrands.find((b) => b.slug === selectedSlug) ?? fromBrands[0];

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
            track("report_thin_blocked", { side, distinct_types: data.distinctTypes ?? 0 });
          } else if (data.state === "no_match") {
            setPhase("no_match");
            track("report_no_match");
          } else if (data.state === "ok" && data.report) {
            const ok = data as OkPayload;
            setResult(ok);
            setPhase("ok");
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
        if (wantSlugRef.current && wantSlugRef.current !== fromSlug) run(wantSlugRef.current);
      }
    },
    [toSlug]
  );

  // 열릴 때 + 선택 소개서가 바뀔 때 fetch(캐시면 서버가 즉시 반환). 샘플 모드는 fetch 없음.
  useEffect(() => {
    if (!open || sampleMode || !selected?.slug) return;
    run(selected.slug);
  }, [open, sampleMode, selected?.slug, run]);

  // 샘플 모드(잠금 티저) 오픈 계측 — 무소개서 퍼널 시작점
  useEffect(() => {
    if (open && sampleMode) track("report_locked_view");
  }, [open, sampleMode]);

  // 로딩 카피 3단 순환(4초 간격)
  useEffect(() => {
    if (phase !== "loading") return;
    setCopyIdx(0);
    const t = window.setInterval(() => setCopyIdx((i) => (i + 1) % LOADING_COPY.length), 4000);
    return () => window.clearInterval(t);
  }, [phase]);

  if (!open) return null;

  const sampleReport = sampleData.report as CollabReportData;
  const report = sampleMode ? sampleReport : result?.report ?? null;
  const fromName = sampleMode ? sampleData.fromName : selected?.name ?? "";
  const reportToName = sampleMode ? sampleData.toName : toName;

  // ── 6조각 렌더(ok·샘플 공용) ──
  const pieces = report && (
    <div>
      {/* ① 타이틀 줄 — 작은 라벨 + 한 줄 결론 */}
      <p className="text-[13px] font-medium text-mute">
        우리({fromName}) × {reportToName}
      </p>
      <p className="mt-1.5 text-xl font-bold leading-snug break-keep text-ink">{report.oneLiner}</p>

      {/* ② 이런 점이 잘 어울려요 — ✔ 리스트 */}
      <p className="mt-6 text-[15px] font-bold text-ink">이런 점이 잘 어울려요</p>
      <ul className="mt-2 space-y-2">
        {report.matchPoints.map((p, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-body">
            <span className="shrink-0">✔</span>
            <span className="break-keep">{p.text}</span>
          </li>
        ))}
      </ul>

      {/* ③ 추천 콜라보 아이디어 — 카드 + 형태 태그 */}
      <p className="mt-6 text-[15px] font-bold text-ink">추천 콜라보 아이디어</p>
      <div className="mt-2 space-y-2.5">
        {report.ideas.map((idea, i) => (
          <div key={i} className="rounded-md border border-hairline p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-bold break-keep text-ink">{idea.title}</p>
              {idea.method && (
                <span className="shrink-0 rounded-pill bg-surface-soft px-2 py-0.5 text-[12px] text-body">
                  {idea.method}
                </span>
              )}
            </div>
            <p className="mt-1 text-[14px] leading-relaxed break-keep text-body">{idea.desc}</p>
          </div>
        ))}
      </div>

      {/* ④ 실행 플랜 — 번호 스텝 */}
      <p className="mt-6 text-[15px] font-bold text-ink">실행 플랜</p>
      <ol className="mt-2 space-y-2">
        {report.steps.map((s, i) => (
          <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-body">
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
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-body">
            <span className="shrink-0 text-faint">•</span>
            <span className="break-keep">{s}</span>
          </li>
        ))}
      </ul>

      {/* ⑥ CTA — 샘플 모드는 위저드 CTA로 대체 */}
      {!sampleMode && (
        <div className="mt-8">
          <p className="text-center text-[15px] font-medium text-ink">이 제안이 마음에 드셨나요? ✨</p>
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 print:hidden" onClick={onClose}>
      <ScrollLock />
      <div
        className="relative max-h-[85vh] w-full max-w-[640px] overflow-y-auto rounded-t-2xl border border-b-0 border-hairline bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-e2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 우측 상단 닫기 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>

        {/* 샘플 모드 배너 — 최상단 */}
        {sampleMode && (
          <div className="mb-4 mr-8 rounded-md bg-surface-soft px-3 py-2 text-[13px] font-medium text-body">
            예시 리포트예요
          </div>
        )}

        {/* 멀티 소개서 — 브랜드명 칩 셀렉터(2개+일 때만. 1개면 타이틀 줄에 명시, 0개=샘플 모드) */}
        {!sampleMode && fromBrands.length > 1 && (
          <div className="mb-4 pr-8">
            <p className="text-[13px] font-medium text-body">어떤 소개서로 분석할까요</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {fromBrands.map((b) => {
                const on = b.slug === selected?.slug;
                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => setSelectedSlug(b.slug)}
                    className={`h-8 rounded-pill px-3 text-[13px] font-medium transition-colors ${
                      on ? "bg-primary text-primary-on" : "border border-border-strong bg-surface text-body"
                    }`}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 상태별 본문 ── */}
        {sampleMode ? (
          <>
            {pieces}
            {/* 무소개서 퍼널 — 위저드 CTA */}
            <div className="mt-8 rounded-md border border-hairline bg-surface-soft p-4">
              <p className="text-[14px] leading-relaxed break-keep text-body">
                소개서를 등록하면 {toName}님과 나의 콜라보 분석을 받을 수 있어요
              </p>
              <a
                href="/register"
                onClick={() => track("wizard_start_from_report")}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
              >
                내 소개서 만들기
              </a>
            </div>
          </>
        ) : phase === "loading" || phase === "idle" ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-pill border-2 border-hairline border-t-primary-strong" />
            <p className="mt-4 animate-pulse text-[15px] text-mute">{LOADING_COPY[copyIdx]}</p>
          </div>
        ) : phase === "ok" ? (
          pieces
        ) : phase === "thin" ? (
          <div className="py-10 text-center">
            {thin.side === "from" ? (
              <>
                <p className="text-lg font-bold break-keep text-ink">내 소개서를 보강하면 분석이 더 정확해져요</p>
                <a
                  href={`/register?edit=${selected?.slug ?? ""}`}
                  className="mx-auto mt-5 flex h-12 w-full max-w-xs items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
                >
                  소개서 보강하기
                </a>
              </>
            ) : (
              <>
                <p className="text-lg font-bold break-keep text-ink">{toName}님의 소개서 정보가 아직 적어요</p>
                <p className="mt-2 text-[14px] leading-relaxed text-mute">소개서가 채워지면 분석할 수 있어요</p>
              </>
            )}
          </div>
        ) : phase === "no_match" ? (
          <div className="py-10 text-center">
            <p className="text-lg font-bold break-keep text-ink">아직 뚜렷한 접점을 찾지 못했어요</p>
            <p className="mt-2 text-[14px] leading-relaxed break-keep text-mute">
              두 소개서가 더 채워지면 새로운 접점이 보일 수 있어요. 다음에 다시 분석해볼게요.
            </p>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-lg font-bold break-keep text-ink">분석에 실패했어요</p>
            <button
              type="button"
              onClick={() => selected?.slug && run(selected.slug)}
              className="mx-auto mt-5 flex h-12 w-full max-w-xs items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink"
            >
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
