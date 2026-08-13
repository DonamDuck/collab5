"use client";

// AI 콜라보 분석 리포트 시트 — 풀하이트 바텀시트(제안 시트 패턴 재사용).
// 상태 머신: idle → (select: 소개서 2개+ 첫 depth 선택) → loading(카피 3단 순환) → ok(5조각) | thin | no_match | error(재시도).
// 멀티 소개서는 칩 선택 + [분석하기]를 눌러야 fetch — 자동 생성으로 콜 낭비하지 않는다(대표 QA 07-26).
// sampleMode = 무소개서 유저 티저: fetch 없이 sample-report.json 렌더 + 위저드 CTA.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §4·§5
import { useCallback, useEffect, useRef, useState } from "react";
import { useDismissable } from "@/components/useDismissable";
import { collabMethodLabel } from "@/lib/dna-pool";
import { orderIdeaCards } from "@/lib/report-cards";
import { track } from "@/lib/track";
import type { CollabReportData } from "@/lib/types";
import sampleData from "@/lib/sample-report.json";

// 로딩 = **고정 타이틀 + 아래 회색 롤링** (대표 지시 08-02).
// EnrichWizard `LoadingView`와 같은 얼굴로 맞췄다 — 두 화면 다 "AI가 오래 일하는 중"이라
// 사장님 입장에선 같은 경험인데, 여기만 타이틀 없이 회색 한 줄이 굴러 **무슨 일이 벌어지는지
// 모른 채 기다렸다.** 타이틀이 '무엇을'을 고정하고, 롤링이 '지금 어디쯤'을 말한다.
const LOADING_TITLE = "콜라보 아이디어를 분석하고 있어요";

// 롤링 문구 — 타이틀이 큰 그림을 잡아주므로 여기선 **진행 단계**만 말한다.
// ⚠️ 예전 1번 문구 "두 소개서를 읽고 있어요…"는 **뺐다**(대표: "똑같이 겹치는 건 빼자").
//    타이틀과 같은 '-고 있어요' 종결형이라 **타이틀이 두 줄로 보였다** — 롤링은 전부 '~중…'
//    조각으로 통일해야 타이틀과 역할이 갈린다(위저드 CRAWL_STEPS/GEN_STEPS와 같은 규칙).
// 순환 간격 = **2000ms**(08-09 대표 지적 "전환 속도 쪼금 느려" → 4000ms에서 단축).
//   EnrichWizard LoadingView가 원래부터 2000ms였다 — "같은 얼굴" 원칙(위 LOADING_TITLE 주석)을
//   문구 내용뿐 아니라 **템포**까지 맞춘 것. 2번째 자리(소요시간 안내)가 이제 t=2s·10s·18s·26s에
//   뜬다(실측 25~28초 기준 3~4회) — 07-31 "아직 참을 만할 때 끝을 알린다"는 취지는 그대로 살아있고
//   더 자주 재확인시켜준다. (⏱ 파이프라인이 빨라지면 간격도 같이 낮출 것)
const LOADING_INTERVAL_MS = 2000;
const LOADING_COPY = [
  "두 소개서를 읽는 중…",
  "보통 30초 정도 걸려요…",
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
  /** 소유권이 떠난 브랜드의 옛 리포트 — 읽기만 된다(08-07). 재생성 UI를 숨기는 신호. */
  readOnly?: boolean;
};

export function ReportSheet({
  open,
  onClose,
  fromBrands,
  toSlug,
  toName,
  sampleMode,
  onPropose,
  collabPaused = false,
  initialFromSlug = null,
  restoreOnOpen = false,
  initialReport = null,
  initialReadOnly = false,
  initialFromName,
  cachedReports,
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
  /** 이 브랜드가 [콜라보 요청 잠시 안받기] 중인가(08-12). 켜져 있으면 CTA를 **버튼이 아니라 안내로** 바꾼다.
   *  ⚠️버튼만 남기고 눌러도 아무 일 없게 두면 안 된다 — 고장으로 읽힌다. */
  collabPaused?: boolean;
  initialFromSlug?: string | null; // /my 아카이브 딥링크 — 이 slug로 선택 스텝 없이 바로 실행
  /** 제안 시트 [← 뒤로]로 다시 열렸다 — **손에 쥔 결과를 버리지 않고 그대로 되살린다**(08-08 대표 QA).
   *  네트워크·유료 콜 0. 시트를 X로 아예 닫으면 부모가 false로 되돌려, 다음 오픈은 평소대로 처음부터. */
  restoreOnOpen?: boolean;
  /** 이미 손에 쥔 저장본 — 있으면 **fetch를 아예 하지 않고 즉시 `ok`로 연다**(08-07 대표 지적).
   *  /my 아카이브는 목록 쿼리가 리포트 전문을 이미 읽어왔는데도 시트가 API를 다시 불러
   *  "콜라보 아이디어를 분석하고 있어요"를 띄웠다 — **다시 읽는 화면인데 분석 중이라 말한 것**.
   *  ⭐부수효과(의도된 것): 아카이브 열람이 더는 재생성(유료 콜)을 태우지 않는다.
   *     최신 분석이 필요하면 소개서 페이지에서 열거나 [다른 소개서로 분석]으로 명시 실행한다. */
  initialReport?: CollabReportData | null;
  /** 소개서 페이지(`/m/[slug]`)판 `initialReport` — **1건 고정이 아니라 쌍(fromSlug)별 맵**이다(08-09).
   *  마커 페이지는 /my와 달리 "내 소개서가 몇 개"·"어떤 게 선택될지"가 열기 전엔 안 정해져 있어서
   *  (칩 선택 UI가 있다) 단일 `initialReport`로는 못 커버한다. 서버(`page.tsx`)가 **DNA 안 바뀐 쌍만**
   *  미리 읽기 전용으로 골라 이 맵에 담아 내려준다(유료 콜 0 — `lib/collab-report.ts`의
   *  `isReportCacheFresh`가 라우트 ⑥ 캐시 3조건과 같은 판정을 쓴다).
   *  키에 없는 fromSlug는 지금처럼 fetch+로딩 화면을 그대로 탄다(신규 쌍·DNA 변경분). */
  cachedReports?: Record<string, CollabReportData>;
  /** 그 쌍의 내 브랜드 이름 — **넘긴 브랜드는 `fromBrands`에 없어서** 이름을 그쪽에서 못 찾는다.
   *  없이 두면 헤더가 `?? fromBrands[0]`으로 **엉뚱한 내 소개서 이름**을 박는다
   *  (08-07 prod 실측: 아그레아블 카드를 열었는데 제목이 "로컬페이지 × 두더지요가원"). */
  initialFromName?: string;
  /** 넘긴 브랜드의 보관본이라는 표시 — `initialReport`로 즉시 열 땐 서버 응답(readOnly)이 없어서 부모가 알려준다.
   *  ⚠️ 이건 **안내 문구용 힌트지 권한 검문이 아니다**(권한 판정은 서버 몫 — 08-07 아카이브 버그의 교훈). */
  initialReadOnly?: boolean;
  /** 계측용 오픈 위치 — 홈 샘플 오픈이 /m 잠금 티저 지표(report_locked_view)를 오염시키지 않게 구분(07-31).
   *  🆕 "my" = /my 아카이브에서 **제자리로** 연 것(08-02). 남의 소개서로 튕겨나가지 않는 다시보기라
   *     "새로 궁금해서 연 것"과 성격이 다르다 — 섞이면 리포트 수요가 부풀어 보인다. */
  source?: "maker_page" | "home" | "my";
  /** 리포트가 실제로 열렸을 때 부모에게 올려준다 — 제안 시트가 콜라보 아이디어를 초안에 넣는 데 쓴다(07-31).
   *  ⚠️ 샘플(가상 쌍)은 올리지 않는다 — 남의 브랜드 얘기가 내 DM 초안에 섞이면 안 된다. */
  onReportLoaded?: (report: CollabReportData) => void;
}) {
  // 저장본을 들고 왔으면 **첫 렌더부터 `ok`** — 아래 effect에서 세우면 로딩 화면이 한 프레임 스친다.
  //
  // ⭐08-09 2차 수정 — 열자마자 보여줄 쌍을 고르는 우선순위:
  //   ①딥링크(`initialFromSlug`) → ②**저장본이 딱 1건뿐이면 그것** → ③소개서가 1개뿐이면 그것
  //   ②가 이번에 추가됐다. 1차 땐 ③만 있어서, **소개서를 14개 가진 대표 계정에선 한 번도 안 걸렸다**
  //   (대표 제보: "로컬페이지에서 콜라보 분석 누르면 여전히 로딩이 뜬다" — 실측 결과 리포트가 있는
  //   쌍은 캔버스가든 1건뿐인데도 선택 화면부터 시작했다).
  //   ⚠️저장본이 2건 이상이면 여전히 선택 화면이 맞다 — 어느 쌍을 원하는지 시스템이 알 수 없다.
  //   ⚠️"선택이 첫 depth"(07-26 대표 QA)를 어기는 게 아니다. 그 규칙은 **유료 콜 낭비 방지**가
  //     목적인데, 저장본을 여는 건 0원이다. 다른 쌍을 원하면 [다른 소개서로 분석]이 그대로 있다.
  const cachedSlugs = cachedReports ? Object.keys(cachedReports) : [];
  const initialArchiveSlug =
    initialFromSlug ??
    (cachedSlugs.length === 1 ? cachedSlugs[0] : undefined) ??
    (fromBrands.length === 1 ? fromBrands[0]?.slug : undefined);
  const archived: OkPayload | null = initialReport
    ? { report: initialReport, cached: true, model: "archive", readOnly: initialReadOnly }
    : initialArchiveSlug && cachedReports?.[initialArchiveSlug]
      ? { report: cachedReports[initialArchiveSlug], cached: true, model: "cache" }
      : null;
  // ⚠️초기 phase를 **정확히** 세운다 — `idle`은 아래에서 로딩 화면을 그리므로, 실제로 fetch가
  //   따라오지 않는 상황에서 idle로 두면 **"분석하고 있어요"를 한 프레임 거짓말**하게 된다.
  //   소개서가 2개+면 곧 select로 갈 것이 확정이니 처음부터 select로 연다.
  const [phase, setPhase] = useState<Phase>(
    archived ? "ok" : fromBrands.length > 1 ? "select" : "idle",
  );
  const [result, setResult] = useState<OkPayload | null>(archived);
  const [thin, setThin] = useState<{
    side: "from" | "to";
    distinctTypes?: number;
  }>({ side: "from" });
  // ⚠️저장본으로 바로 여는 경우 **그 쌍의 slug로 시작해야** 헤더가 "A × B"를 맞게 쓰고
  //   [다른 소개서로 분석]도 올바른 칩이 선택된 채 열린다(안 그러면 fromBrands[0]로 어긋난다).
  const [selectedSlug, setSelectedSlug] = useState(initialArchiveSlug ?? fromBrands[0]?.slug);
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
      // 캐시 신선 쌍(DNA 변경 없음)이면 네트워크 없이 즉시 연다 — /my 아카이브와 같은 경험(08-09).
      // 위 `archived`(딥링크·단일 소개서 자동선택)가 못 잡는 경로가 하나 있다 — **멀티 소개서 select
      // 스텝에서 칩 고르고 [분석하기]를 누르는 경우**는 useEffect를 안 타고 run()을 직접 부르므로
      // 여기서 한 번 더 확인해야 한다. 대표 지적: "콜라보 분석중이에요 이거 안 보여주고!" — 소개서
      // 페이지의 모든 실행 경로가 /my와 같은 대우를 받아야 한다는 뜻.
      const hit = cachedReports?.[fromSlug];
      if (hit) {
        const ok: OkPayload = { report: hit, cached: true, model: "cache" };
        setResult(ok);
        setPhase("ok");
        loadedCbRef.current?.(ok.report);
        track("report_view", { cache_hit: true });
        return;
      }
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
    [toSlug, cachedReports],
  );

  // 열릴 때: 소개서 1개면 바로 fetch(캐시면 서버가 즉시 반환), 2개+면 선택(select)이 첫 depth.
  // 칩 변경만으로는 fetch하지 않는다 — [분석하기]를 눌러야 실행(콜 낭비 방지).
  useEffect(() => {
    if (!open || sampleMode) return;
    // 🔙제안 시트에서 [← 뒤로]로 돌아온 길 — **아무것도 다시 하지 않는다.** 방금 보던 리포트가
    //   아직 state에 그대로 있으니 그 화면으로 되돌리기만 하면 된다(08-08 대표 QA로 잡은 버그).
    //   이 가드가 없으면 아래 `fromBrands.length > 1`에 걸려 **소개서 고르는 첫 화면으로 떨어졌다**
    //   — 뒤로가기가 뒤가 아니라 맨 앞으로 보내던 셈. 소개서가 여러 개인 계정에서 항상 재현된다.
    if (restoreOnOpen && result) {
      setPhase("ok");
      return;
    }
    // 아카이브 딥링크 — 쌍이 이미 정해져 있으니 선택 스텝을 건너뛰고 바로 실행(캐시면 즉시)
    // ⚠️**`fromBrands` 포함 여부로 막지 않는다**(08-07 버그): 소유권을 넘긴 브랜드는 내 목록에서 빠지는데
    //   아카이브 목록은 "내가 요청한 것" 기준이라 카드가 남는다 → 검문에 걸려 **선택 화면으로 떨어졌다**
    //   (08-06 아그레아블 이전 후 실제 발생). 판정은 서버가 한다 — 내가 요청했던 쌍이면 읽기 전용으로 열어주고,
    //   아니면 403 → 아래 error phase. 클라가 미리 막으면 정당한 열람까지 함께 막힌다.
    // 저장본을 이미 손에 쥐었으면 **어느 경로로 왔든** 여기서 끝 — 네트워크도 유료 콜도 없다.
    // (08-07엔 딥링크일 때만 이 길로 왔는데, 08-09에 "저장본 1건뿐이면 그것"이 더해지면서
    //  딥링크가 아닌 일반 [콜라보 분석] 클릭도 여기로 들어온다.)
    if (archived && initialArchiveSlug) {
      setSelectedSlug(initialArchiveSlug);
      setResult(archived);
      setPhase("ok");
      loadedCbRef.current?.(archived.report);
      track("report_view", { cache_hit: true });
      return;
    }
    if (initialFromSlug) {
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

  // 로딩 카피 4단 순환(2초 간격) — 2번째가 소요시간 안내
  useEffect(() => {
    if (phase !== "loading") return;
    setCopyIdx(0);
    const t = window.setInterval(
      () => setCopyIdx((i) => (i + 1) % LOADING_COPY.length),
      LOADING_INTERVAL_MS,
    );
    return () => window.clearInterval(t);
  }, [phase]);

  // 오버레이 공통 동작(ESC·딤클릭·스크롤잠금·포커스 트랩·aria-modal) — 훅 규칙상 early return보다 위에서 호출.
  // 리포트는 읽는 시트라 딤 클릭·ESC 둘 다 허용(작성 중인 내용이 없다).
  const { overlayProps, panelProps } = useDismissable(open, { onClose });

  if (!open) return null;

  const sampleReport = sampleData.report as CollabReportData;
  const report = sampleMode ? sampleReport : (result?.report ?? null);
  // ⚠️ 헤더 이름은 `selected`(= 못 찾으면 fromBrands[0]로 떨어지는 값)를 그대로 쓰면 안 된다 —
  //    소유권이 떠난 브랜드는 목록에 없어서 **엉뚱한 내 소개서 이름**이 박힌다. 정확히 일치할 때만 쓰고,
  //    없으면 부모가 준 이름(아카이브 행의 fromName)으로 간다.
  const exactFrom = fromBrands.find((b) => b.slug === selectedSlug);
  const fromName = sampleMode
    ? sampleData.fromName
    : (exactFrom?.name ?? initialFromName ?? selected?.name ?? "");
  const reportToName = sampleMode ? sampleData.toName : toName;

  // ── 5조각 렌더(ok·샘플 공용) ──
  // ① 식별 메타(A×B 캡션)와 [다른 소개서로 분석]은 **고정 유틸 바로 이사**(디자인팀 07-26).
  // ⭐순서 개편(2026-08-01, 디자인팀 시안): ①아이디어 ②어울려요 ③실행플랜 ④기대효과 ⑤CTA.
  //    한줄 요약 박스는 폐지했다 — ideas[0]의 축약이라 정보가 겹쳤다(대표 확정, 실쌍 11개 10라운드).
  //    빈자리를 메운 게 아니라 **제품이 파는 것(아이디어)을 얼굴로 세운 정보 위계 재설계**다.
  //    새 사다리: 카드제목 16 → 섹션헤더 15 → 본문 14 → 메타 13. **18 슬롯은 은퇴**.
  // ⭐아이디어 카드 순서 — 정본은 `lib/report-cards.ts`. `/my` 아카이브 카드의 칩도 같은 함수를 쓴다
  //   (08-07: 여기에만 규칙이 있어서 카드 칩 순서와 시트 순서가 어긋났다 — 1팀 지적).
  const ideaCards = orderIdeaCards(report);

  const pieces = report && (
    <div>
      {/* ① 추천 콜라보 아이디어 — 리포트의 얼굴 */}
      <p className="text-[15px] font-bold text-ink">추천 콜라보 아이디어</p>
      {/* 카운트 캡션 — 개수가 2~3으로 흔들려도 "부족"이 아니라 "선별"로 읽히게 먼저 선언한다.
          ⚠️ 문구 확정(대표 08-01): ~~"두 소개서의 DNA에서 찾은 N가지 방향이에요"~~ → 아래 문장.
             ① **`DNA`는 우리 내부 용어**(brands.dna 파생층)라 사장님 화면에 나갈 말이 아니었다.
             ② "방향"이라는 추상어를 **"콜라보 아이디어"라는 물건 이름**으로 — 무엇을 받았는지가
                한 줄에서 끝난다(바로 위 섹션 헤더와 겹치는 건 감수: 첫 문장은 중복보다 모호함이 비싸다).
             ③ 어미를 **완료형("찾았어요")**으로 — 일이 끝났다는 신호. */}
      <p className="mt-1 text-[13px] text-mute">
        두 소개서를 분석해 {ideaCards.length}가지 콜라보 아이디어를 찾았어요.
      </p>
      <div className="mt-3 space-y-3">
        {ideaCards.map((idea, i) => (
          /* shadow-e1은 **리포트에서 이 카드만** — "우리가 파는 물건"이라 유일하게 살짝 뜬다.
             나머지 섹션은 플랫 유지(경계는 hairline+e1 전담). */
          <div key={i} className="rounded-lg border border-hairline bg-surface p-4 shadow-e1">
            {/* 아이브로 — method를 제목 오른쪽 칩에서 윗줄로 올렸다(07-31 제목 4줄 사고 재발 방지).
                제목과 폭을 다투지 않고 번호가 공짜로 생긴다(/m ItemLabel `활동 1 · …` 문법과 통일).
                ⚠️ method는 반드시 collabMethodLabel()을 거친다 — 원문은 16자짜리 Pool 어휘다.
                🔁~~우측 추천·확장 태그(08-06)~~ 철거(08-08 대표): 두 장에만 태그가 붙으니 **나머지가 덜 중요해
                  보였다.** 이제 카드에 종류 구분이 없다 — 한 풀에서 점수순으로 고른 4장이다(정본 = lib/report-cards.ts). */}
            <p className="text-[12px] font-medium tracking-wide text-faint">
              아이디어 {i + 1}
              {idea.method ? ` · ${collabMethodLabel(idea.method)}` : ""}
            </p>
            <p className="mt-1.5 text-[16px] font-bold leading-snug break-keep text-ink">
              {idea.title}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-body">
              {idea.desc}
            </p>
            {/* 양쪽에 남는 것 — ⚠️"우리가 얻는 것/상대가 얻는 것" 라벨은 쓰지 않는다(대표 08-06).
                주어를 지우고 기대 효과 섹션과 같은 불릿 문형으로 — 이익을 나열하면 노골적으로 읽힌다. */}
            {idea.gains && idea.gains.length > 0 && (
              <ul className="mt-3 space-y-1 border-t border-hairline pt-2.5">
                {idea.gains.map((g, gi) => (
                  <li key={gi} className="flex gap-1.5 text-[13px] leading-relaxed text-mute">
                    <span className="shrink-0 text-faint">•</span>
                    <span className="break-keep">{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
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

      {/* ③ 실행 플랜 — 번호 스텝 */}
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

      {/* ④ 기대 효과 — 불릿 */}
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

      {/* ⑤ CTA — 샘플 모드는 위저드 CTA로 대체 */}
      {!sampleMode && (
        <div className="mt-8">
          <p className="text-center text-[15px] font-medium text-ink">
            이 제안이 마음에 드셨나요? ✨
          </p>
          {collabPaused ? (
            // 쉬는 중 — 분석은 끝까지 보여주되 제안만 막는다. 아이디어는 남으니 나중에 다시 오면 된다.
            <p className="mt-3 rounded-md border border-hairline bg-surface-soft px-3 py-3 text-center text-[14px] leading-relaxed text-mute">
              지금은 이 브랜드가 콜라보를 쉬고 있어요.<br />
              찜해두면 나중에 다시 찾아오기 쉬워요.
            </p>
          ) : (
          <button
            type="button"
            onClick={() => {
              track("report_cta_propose"); // 리포트→제안 전환 = P1→P3 퍼널 핵심 지표
              onPropose();
            }}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
          >
            콜라보 제안 시작하기
          </button>
          )}
          {/* 넘긴 브랜드의 보관본(08-07) — 왜 다시 만들 수 없는지 한 줄로. 없으면 "왜 갱신이 안 되지"가 된다. */}
          {result?.readOnly && (
            <p className="mt-3 rounded-md border border-hairline bg-surface-soft px-3 py-2 text-[13px] leading-relaxed text-mute">
              🗄 예전에 만들어 둔 보관본이에요. 이 소개서는 이제 다른 분 것이라 새로 분석할 수는 없어요.
            </p>
          )}
          {/* 다른 소개서로 분석 — 상단 바에서 이사(07-31). 제안 버튼 아래 보조 위치로 격 낮춤. */}
          {fromBrands.length > 1 && (
            <button
              type="button"
              onClick={() => setPhase("select")}
              className="mt-3 flex h-9 w-full items-center justify-center text-[13px] font-medium text-mute underline underline-offset-2 hover:text-ink"
            >
              다른 소개서로 분석
            </button>
          )}
        </div>
      )}
    </div>
  );

  // 리포트 본문 뷰만 '고정 바 + 스크롤 영역' 구조를 쓴다(디자인팀: 짧은 뷰는 과설계라 현행 유지).
  const isReportView = !!report && (sampleMode || phase === "ok");

  // 🆕 소개서 페이지에서 연 무소개서 티저(08-07 대표 QA) — **홈과 갈라 쓴다.**
  //   왜 갈랐나: 08-01에 홈 예시를 가상 쌍에서 **실제 쌍**(캔버스가든×호락호락도서관)으로 바꿨는데,
  //   그 파일을 /m 티저도 함께 읽는다는 걸 놓쳤다. 그래서 **캔버스가든 페이지에서 열면**
  //   헤더엔 "캔버스가든 × 호락호락도서관", 아래 CTA엔 "캔버스가든님과 나의 분석을 받을 수 있어요" —
  //   **같은 브랜드가 제안하는 쪽과 받는 쪽을 동시에** 하는 화면이 됐다(대표 실측).
  //   ⭐고친 방향은 "샘플을 바꾸기"가 아니라 **"예시임을 화면 구조로 못 박기"**다(대표 지시):
  //   ①맨 위에서 왜 예시를 보는지 말하고 ②쌍 이름을 배너에 명시하고 ③헤더의 쌍 캡션은 뺀다
  //   (헤더에 남으면 *지금 보는 브랜드의 분석*으로 읽힌다) ④CTA는 스크롤과 무관하게 늘 잡히는 자리로.
  //   ⚠️홈(source="home")은 이 분기를 타지 않는다 — 홈 UI는 손대지 않는다(대표 지시).
  const sampleTeaser = sampleMode && source !== "home";

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
            : "overflow-y-auto p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {isReportView ? (
          <>
            {/* 고정 유틸 바 — 리포트가 길어 스크롤해도 닫기가 항상 잡힌다(대표 요청 07-26) */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
              {/* 고정 바의 유일한 텍스트라 13→15px로 키움(대표 07-26). 색은 body 유지 —
                  ink로 올리면 스크롤 영역의 아이디어 카드 제목(16 bold ink)과 경쟁해 위계가 뭉갠다. */}
              {/* ⚠️ "다른 소개서로 분석"은 여기 안 둔다(07-31 대표 QA) — 이 줄엔 원래도 캡션+버튼+닫기가
                  붙어살아 좁았는데, 업체명이 길면 "캔버스가든 × 콜…"처럼 잘렸다. 그 버튼을 아래 CTA
                  블록(제안 보내기 버튼 밑)으로 옮기면 이 줄엔 캡션과 닫기만 남아 truncate가 훨씬 덜 걸린다. */}
              {/* ⭐티저는 **쌍 이름만 두지 않고 "예시"까지 한 문장으로** 넣는다(대표 08-07 2차).
                  쌍 이름만 두면 *내가 연 브랜드의 분석*으로 읽히는데(1차 사고), 문장으로 쓰면
                  같은 자리가 오히려 **예시임을 못 박는 자리**가 된다 — 헤더는 스크롤해도 안 사라지므로
                  본문 회색 박스보다 이 정보가 있기에 더 나은 곳이다(그래서 아래 박스는 뺐다).
                  ⚠️여기만 13px·mute·두 줄 허용 — 문장이라 15px·truncate면 "…리포트 예…"로 잘린다. */}
              {sampleTeaser ? (
                <p className="min-w-0 flex-1 text-[13px] leading-snug font-medium break-keep text-mute">
                  {sampleData.fromName} × {sampleData.toName}의 콜라보 추천 리포트 예시예요.
                </p>
              ) : (
                <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-body">
                  {fromName} × {reportToName}
                </p>
              )}
              {closeButton("")}
            </div>

            {/* 스크롤 영역 — 첫 요소가 추천 아이디어 섹션. 패널에 있던 패딩·safe-area는 여기로 이사.
                ⚠️티저는 CTA가 아래 고정 바로 빠지므로 하단 여백을 safe-area 없이 짧게 준다(이중 여백 방지). */}
            <div
              className={`flex-1 overflow-y-auto px-5 pt-4 ${
                sampleTeaser ? "pb-5" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              }`}
            >
              {/* 티저 최상단 — **왜 예시를 보고 있는지**를 리포트보다 먼저 말한다(대표 지시 08-07).
                  이게 없으면 리포트가 띡 하고 나와서 "내 분석인가?"로 읽힌다.
                  ⭐크기 16→**20**(대표 08-07 2차): 16 bold ink는 바로 아래 섹션헤더(15 bold ink)와
                    **한 급 차이도 안 나서** 둘이 겹쳐 보였다. 20은 시트 최상단 안내 타이틀의 기존 슬롯이다
                    (`phase==="select"`의 "어떤 소개서로 분석할까요"와 같은 `text-xl`) — 새 크기를 만든 게
                    아니라 **같은 역할엔 같은 크기**를 쓴 것. 리포트 본문 사다리(16→15→14→13)는 그대로. */}
              {/* ⭐**문장마다 줄을 바꾼다**(대표 08-07 4차) — 두 문장이 하는 일이 다르다:
                  앞은 *왜 못 보는지*, 뒤는 *대신 무엇을 주는지*. 이어 붙이면 데스크탑에서
                  "…가능해요. 우선 예시 리포트를"처럼 문장 경계가 줄 가운데 묻힌다.
                  ⚠️한때 `<br>`를 뺐다가 되살렸다 — 뺀 이유(모바일에서 줄이 늘어남)보다
                     **문장 구분이 눈에 보이는 쪽**이 이 화면엔 더 중요하다는 대표 판단. */}
              {sampleTeaser && (
                <p className="mb-4 text-xl font-bold leading-snug break-keep text-ink">
                  콜라보 추천은 내 소개서 작성 후 받아볼 수 있어요.
                  <br />
                  우선 예시 리포트를 보여드릴게요.
                </p>
              )}
              {/* 회색 박스는 **홈 전용으로 남았다** — 티저는 같은 정보를 위 고정 헤더로 올렸다(대표 08-07 2차).
                  본문에 두면 타이틀과 섹션헤더 사이에 끼어 덩어리가 셋이 되고, 스크롤하면 사라진다. */}
              {sampleMode && !sampleTeaser && (
                <div className="mb-4 rounded-md bg-surface-soft px-3 py-2 text-[13px] font-medium leading-relaxed break-keep text-body">
                  예시 리포트예요
                </div>
              )}
              {/* ⭐경계 구분선(대표 08-07 3차) — **안내가 끝나고 리포트가 시작되는 지점**을 선으로 긋는다.
                  헤더 문장이 *무엇의* 예시인지(쌍 이름)를 맡고, 이 선은 *어디부터*를 맡아 역할이 갈린다.
                  같은 말의 반복처럼 보여도 이 화면의 목적이 "예시임을 못 박기"라 반복이 기능한다.
                  ⚠️새 컴포넌트를 만들지 않았다 — register 폼의 "또는 아래에 직접 입력할 수 있어요" 구분선과
                     **같은 어휘**(h-px hairline + 13 medium mute)다. 라벨만 '샘플'→'예시'로(화면 전체 통일). */}
              {sampleTeaser && (
                <div className="mb-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-hairline" />
                  <span className="shrink-0 text-[13px] font-medium text-mute">
                    분석 리포트 예시
                  </span>
                  <div className="h-px flex-1 bg-hairline" />
                </div>
              )}
              {pieces}
              {sampleMode && !sampleTeaser && (
                /* 무소개서 퍼널 — 위저드 CTA (홈 전용. /m 티저는 아래 고정 바가 대신한다) */
                <div className="mt-8 rounded-md border border-hairline bg-surface-soft p-4">
                  {/* 홈(source=home)에선 상대 브랜드가 없어 toName이 빈 문자열 — 범용 문구로 분기(07-31) */}
                  <p className="text-[14px] leading-relaxed break-keep text-body">
                    {toName
                      ? `소개서를 등록하면 ${toName}님과 나의 콜라보 추천을 받아볼 수 있어요`
                      : "소개서를 등록하면 마음에 드는 브랜드와 우리 브랜드의 콜라보 추천을 받아볼 수 있어요"}
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

            {/* 🆕 고정 CTA(08-07 대표 지시) — 스크롤 영역의 **형제**라 리포트가 아무리 길어도 늘 보인다.
                (스크롤 안에 두면 끝까지 내려야 나오는데, 이 사람에게 필요한 건 리포트가 아니라 이 버튼이다.)
                문구는 안내 없이 버튼만 — 무엇을 하는 버튼인지는 위 타이틀이 이미 말했다. */}
            {sampleTeaser && (
              <div className="shrink-0 border-t border-hairline bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                <a
                  href="/register"
                  onClick={() => track("wizard_start_from_report")}
                  className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
                >
                  내 소개서 만들기
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            {closeButton("absolute right-3 top-3")}

            {/* ── 짧은 상태 뷰(선택·로딩·thin·no_match·에러) ──
                샘플 모드는 report가 항상 있어 위 isReportView 분기로 빠지므로 여기 오지 않는다. */}
            {phase === "select" ? (
              /* 멀티 소개서 — 선택이 첫 depth. 칩 고르고 [분석하기]를 눌러야 생성(대표 QA 07-26) */
              <div>
                {/* ⚠️ pr-8(닫기 ✕ 회피)은 **제목 줄에만** 건다 — 예전엔 이 블록 전체(칩·버튼까지)에
                    걸려 있어서, 오른쪽만 여백이 32px 더 붙는 바람에 [분석하기] 버튼이 시트 중앙이 아니라
                    왼쪽으로 치우쳐 보였다(실측 07-31, 대표 QA). 닫기 버튼은 제목 높이에서만 겹칠 수 있다. */}
                <p className="pr-8 text-xl font-bold break-keep text-ink">
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
              <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-16 text-center">
                {/* ⚠️ fill은 토큰(var(--primary))으로 — 예전엔 #98ff5c 하드코딩이었다. */}
                <svg width="44" height="44" viewBox="0 0 56 56" fill="none" className="text-faint" aria-hidden="true">
                  <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(28 28 28)" />
                  <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(-28 28 28)" />
                  <circle cx="28" cy="28" r="6" fill="var(--primary)" />
                </svg>
                {/* 고정 타이틀 + 회색 롤링 — 위저드 LoadingView와 같은 사다리(18 bold / 13 mute).
                    animate-pulse는 안 쓴다 — 문구가 4초마다 바뀌는 것 자체가 '살아있음' 신호다.
                    ⚠️ 롤링 줄은 길이가 제각각이라 한 줄↔두 줄로 오갈 수 있다 → `min-h`로 자리를 미리
                       잡아둬야 타이틀·마크가 위아래로 튀지 않는다(13px·leading-relaxed 두 줄 ≈ 40px). */}
                <p className="mt-5 text-[18px] font-bold break-keep text-ink">{LOADING_TITLE}</p>
                <p className="mt-1.5 min-h-[40px] text-[13px] leading-relaxed text-mute">
                  {LOADING_COPY[copyIdx]}
                </p>
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
