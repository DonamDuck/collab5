"use client";

// 딸깍 자동완성 위저드 (2026-07-15 크롤→키워드 재설계 v3):
//  ⓪ 씨앗: 지역·업종 필수 입력(동명 구분 + 크롤 정확도) — 자유문장 씨앗 폐기(블랭크 페이지 제거)
//  ① 키워드 선택(넓게): 크롤이 캐온 키워드 칩을 "최대한 많이" 고르게 + 직접 추가
//     · 빈손이면 업종 스타터 칩 + 솔직 배너 (막다른 길 없음)
//  ② 확인·강조(좁게): 고른 것만 다시 보며 ⭐최대 3개 + 사실 게이트(숫자·이력 = 탭 확인)
//     · 인스타/홈피는 아무리 확실해도 자동첨부 없이 "맞나요?" 제안 → 유저가 선택
//  ③ 생성(options 1콜 — 키워드 재료·별표 가중치·조사메모 재사용, 재크롤 없음)
//  ④~ 기존 결과 스텝 승계: 정보 확인 → 한 줄 소개 → 브랜드 소개 → 찾은 이야기 체크리스트
import { useEffect, useState } from "react";
import { ScrollLock } from "@/components/ScrollLock";
import type {
  ActivityHint,
  BlockHint,
  CollabHint,
  EnrichOptions,
  KeywordChip,
  SeeksHint,
} from "@/lib/enrich";
import { josa } from "@/lib/josa";

export type WizardFill = {
  name?: string;
  oneLiner?: string;
  region?: string;
  address?: string;
  instagram?: string;
  homepage?: string;
  values?: string[];
  description?: string;
  activityHints?: ActivityHint[]; // 크롤이 발견한 활동 흔적(참고용)
  collabHints?: CollabHint[]; // 크롤이 발견한 콜라보 흔적(참고용)
  blockHints?: BlockHint[]; // 크롤 근거 기반 추천 블록(전체 — 폼 인라인 힌트 영속용)
  seeksHint?: SeeksHint; // 원하는 파트너·협업 단서(전체)
  // 이야기 스텝에서 체크한 것 — 인덱스/타입 기반. 있으면 page가 즉시 폼에 주입.
  selectedHints?: { activities: number[]; collabs: number[]; blocks: string[]; seeks: boolean };
};

const MAX_STARS = 4;

// 진행 단계: 씨앗 → (크롤) → 키워드 선택 → 확인·강조 → (생성) → 정보 → 한줄 → 소개 → 이야기
type Kind =
  | "seed"
  | "loading"
  | "chips"
  | "confirm"
  | "links"
  | "generating"
  | "fields"
  | "oneLiner"
  | "desc"
  | "story"
  | "error";

// 칩 섹션 표시 순서 + 사람이 읽는 라벨
const SECTION_ORDER = ["키워드", "정체", "제품", "활동", "콜라보", "원하는협업", "고객", "숫자", "알려짐", "공간", "추천", "직접"];
const SECTION_LABELS: Record<string, string> = {
  키워드: "브랜드 키워드",
  정체: "우리는",
  제품: "만드는 것",
  활동: "하는 일",
  콜라보: "함께한 곳",
  원하는협업: "원하는 협업",
  고객: "고객",
  숫자: "숫자로 보면",
  알려짐: "알려진 곳",
  공간: "공간",
  추천: "혹시 해당되나요?",
  직접: "직접 적은 것",
};

// 크롤 응답 링크 후보
type LinkFinds = { instagram?: string; instagramConfirmed?: boolean; homepage?: string };

// 이야기 스텝 체크 항목 — 크롤 힌트를 섹션 라벨+미리보기+근거로 평탄화(한 줄/자세히 소개는 앞 스텝이 처리).
type StoryItem = { key: string; sectionLabel: string; preview: string; reason: string };

// 블록 힌트 라벨 — BlockEditor CATALOG 라벨 승계(카탈로그와 문장 일치 유지)
const BLOCK_HINT_LABELS: Record<BlockHint["type"], string> = {
  metrics: "우리를 보여주는 숫자",
  press: "소개된 곳들",
  space: "우리의 공간",
  reviews: "고객들의 이야기",
};

function storyItemsOf(o: EnrichOptions): StoryItem[] {
  const items: StoryItem[] = [];
  (o.activityHints ?? []).forEach((h, i) =>
    items.push({
      key: `activity-${i}`,
      sectionLabel: "주로 어떤 활동을 하나요?",
      preview: [h.title, h.desc].filter(Boolean).join(" — "),
      reason: h.source || "웹에서 봤어요",
    })
  );
  (o.collabHints ?? []).forEach((h, i) =>
    items.push({
      key: `collab-${i}`,
      sectionLabel: "이런 콜라보 경험이 있어요.",
      preview: [h.partner, h.desc].filter(Boolean).join(" — "),
      reason: h.source || "웹에서 봤어요",
    })
  );
  if (o.seeksHint) {
    const types = o.seeksHint.types ?? [];
    items.push({
      key: "seeks",
      sectionLabel: "이런 파트너를 찾고 있어요.",
      preview: types.length ? `${o.seeksHint.note} — ${types.join(" · ")}` : o.seeksHint.note,
      reason: o.seeksHint.reason || "웹에서 봤어요",
    });
  }
  (o.blockHints ?? []).forEach((b) =>
    items.push({
      key: `block-${b.type}`,
      sectionLabel: BLOCK_HINT_LABELS[b.type],
      preview: b.items?.length
        ? b.items.map((it) => [it.label, it.value ?? it.year].filter(Boolean).join(" ")).join(" · ")
        : b.reason,
      reason: b.reason || "웹에서 봤어요",
    })
  );
  return items;
}

export function EnrichWizard({
  query,
  onClose,
  onApply,
}: {
  query: string;
  onClose: () => void;
  onApply: (fill: WizardFill) => void;
}) {
  const [kind, setKind] = useState<Kind>("seed");
  const [errMsg, setErrMsg] = useState("");

  // ⓪ 씨앗 — 지역·업종 둘 다 필수(동명 구분 검증자 + 크롤 정확도)
  const [regionInput, setRegionInput] = useState("");
  const [btype, setBtype] = useState("");
  const seedReady = !!regionInput.trim() && !!btype.trim();

  // 크롤 결과
  const [crawlChips, setCrawlChips] = useState<KeywordChip[]>([]);
  const [starterChips, setStarterChips] = useState<KeywordChip[]>([]);
  const [customChips, setCustomChips] = useState<KeywordChip[]>([]);
  const [tier, setTier] = useState<"rich" | "thin">("rich");
  const [links, setLinks] = useState<LinkFinds>({});
  const [research, setResearch] = useState("");

  // ① 선택(순서 유지) / ② 별표(탭 순서=우선순위, 캡 3) + 사실 확인 + 링크 답변
  const [selected, setSelected] = useState<string[]>([]);
  const [starred, setStarred] = useState<string[]>([]);
  const [factualOk, setFactualOk] = useState<Set<string>>(new Set());
  const [igAnswer, setIgAnswer] = useState<"yes" | "no" | null>(null);
  const [hpAnswer, setHpAnswer] = useState<"yes" | "no" | null>(null);
  const [customInput, setCustomInput] = useState("");

  const [options, setOptions] = useState<EnrichOptions | null>(null);
  // 마지막 생성 입력 스냅샷 — 뒤로 갔다가 그대로 다음 누르면 재생성 스킵(콜 절약)
  const [lastGenKey, setLastGenKey] = useState("");

  // 개별 필드(수정 가능)
  const [fName, setFName] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fInstagram, setFInstagram] = useState("");
  const [fHomepage, setFHomepage] = useState("");
  // 5지선다: 편집 가능한 후보 리스트 + 선택 인덱스(스텝 오가도 유지)
  const [oneLinerList, setOneLinerList] = useState<string[]>([]);
  const [oneLinerSel, setOneLinerSel] = useState(0);
  const [descList, setDescList] = useState<string[]>([]);
  const [descSel, setDescSel] = useState(0);
  // 이야기 체크 상태 — 기본 전부 체크(옵션 도착 시 초기화)
  const [storyChecked, setStoryChecked] = useState<Set<string>>(new Set());
  const toggleStoryItem = (key: string) =>
    setStoryChecked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // 전체 칩(선택 화면 표시용) — 크롤 + (빈손이면 스타터) + 직접 추가. 텍스트로 dedupe.
  const allChips: KeywordChip[] = (() => {
    const seen = new Set<string>();
    const out: KeywordChip[] = [];
    for (const c of [...crawlChips, ...(tier === "thin" ? starterChips : []), ...customChips]) {
      const k = c.text.replace(/\s/g, "");
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out;
  })();
  const chipOf = (text: string) => allChips.find((c) => c.text === text);
  const isFactual = (text: string) => !!chipOf(text)?.factual;

  const toggleChip = (text: string) => {
    setSelected((p) => {
      if (p.includes(text)) {
        setStarred((s) => s.filter((t) => t !== text));
        setFactualOk((f) => {
          const n = new Set(f);
          n.delete(text);
          return n;
        });
        return p.filter((t) => t !== text);
      }
      return [...p, text];
    });
  };

  const toggleStar = (text: string) =>
    setStarred((p) => (p.includes(text) ? p.filter((t) => t !== text) : p.length >= MAX_STARS ? p : [...p, text]));

  const confirmFactual = (text: string) =>
    setFactualOk((p) => {
      const n = new Set(p);
      if (n.has(text)) {
        n.delete(text);
        setStarred((s) => s.filter((t) => t !== text)); // 확인 해제 시 별표도 해제
      } else n.add(text);
      return n;
    });

  const addCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    if (!allChips.some((c) => c.text.replace(/\s/g, "") === v.replace(/\s/g, ""))) {
      setCustomChips((p) => [...p, { text: v, section: "직접", factual: false }]);
    }
    setSelected((p) => (p.includes(v) ? p : [...p, v]));
    setCustomInput("");
  };

  // ⓪→① 크롤 실행 — 상호+지역+업종으로 1회(negative-region·지도 교차검증은 서버가 수행)
  const runCrawl = async () => {
    setKind("loading");
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "keywords",
          name: query,
          region: regionInput.trim(),
          businessType: btype.trim(),
        }),
      });
      const d = await r.json();
      setCrawlChips(Array.isArray(d.chips) ? d.chips : []);
      setStarterChips(Array.isArray(d.starter) ? d.starter : []);
      setTier(d.tier === "thin" ? "thin" : "rich");
      setLinks(d.links && typeof d.links === "object" ? d.links : {});
      setResearch(typeof d.research === "string" ? d.research : "");
      // 재크롤 시 이전 선택 초기화(칩 구성이 달라짐)
      setSelected([]);
      setStarred([]);
      setFactualOk(new Set());
      setIgAnswer(null);
      setHpAnswer(null);
      setKind("chips");
    } catch {
      // 크롤 실패여도 막다른 길 없음 — 스타터 칩 + 직접 추가로 진행
      setCrawlChips([]);
      setStarterChips([]);
      setTier("thin");
      setLinks({});
      setResearch("");
      setKind("chips");
    }
  };

  // ②→③ 생성 — 확인된 재료만. 조사메모 재사용(재크롤 없음).
  const generate = async () => {
    // 사실 게이트: factual인데 확인 안 한 칩은 재료에서 제외
    const ingredients = selected.filter((t) => !isFactual(t) || factualOk.has(t));
    const stars = starred.filter((t) => ingredients.includes(t)).slice(0, MAX_STARS);
    // 직접 쓴 문구에 별표 = 그대로 넣기(유저의 표현을 의역하지 않는다)
    const verbatim = stars.filter((t) => customChips.some((c) => c.text === t));
    const genKey = JSON.stringify({ ingredients, stars, igAnswer, hpAnswer });
    if (genKey === lastGenKey && options) {
      setKind("fields"); // 입력 그대로면 재생성 스킵(콜 절약)
      return;
    }
    setKind("generating");
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "options",
          name: query,
          research,
          focusKeywords: ingredients,
          starredKeywords: stars,
          verbatimKeywords: verbatim,
        }),
      });
      const d = await r.json();
      const o: EnrichOptions | null = d.options ?? null;
      if (!o || (!o.oneLiners.length && !o.descriptions.length)) {
        setErrMsg(d.error || "소개 후보를 만들지 못했어요. 직접 입력해 주세요.");
        setKind("error");
        return;
      }
      setOptions(o);
      setLastGenKey(genKey);
      setFName(o.identity.name || query);
      setFAddress(o.identity.address || "");
      // 링크는 유저가 "맞아요" 한 것만 — 크롤이 찾았어도 자동첨부 금지(오귀속 방지)
      setFInstagram(igAnswer === "yes" && links.instagram ? links.instagram : "");
      setFHomepage(hpAnswer === "yes" && links.homepage ? links.homepage : "");
      setOneLinerList(o.oneLiners);
      setOneLinerSel(0);
      setDescList(o.descriptions);
      setDescSel(0);
      setStoryChecked(new Set(storyItemsOf(o).map((it) => it.key))); // 기본 전부 체크
      setKind("fields");
    } catch {
      setErrMsg("불러오기에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setKind("error");
    }
  };

  // 진행 스텝(칩 이후) — 이야기 스텝은 힌트가 있을 때만
  const storyItems = options ? storyItemsOf(options) : [];
  const hasLinks = !!(links.instagram || links.homepage);
  const steps: Kind[] = [
    "chips",
    "confirm",
    ...(hasLinks ? (["links"] as Kind[]) : []),
    "fields",
    "oneLiner",
    "desc",
    ...(storyItems.length ? (["story"] as Kind[]) : []),
  ];
  const stepIdx = steps.indexOf(kind);
  const goNext = () => stepIdx >= 0 && stepIdx < steps.length - 1 && setKind(steps[stepIdx + 1]);
  const goBack = () => {
    if (kind === "chips") setKind("seed");
    else if (stepIdx > 0) setKind(steps[stepIdx - 1]);
  };

  const apply = () => {
    const selectedHints = storyItems.length
      ? {
          activities: (options?.activityHints ?? [])
            .map((_, i) => i)
            .filter((i) => storyChecked.has(`activity-${i}`)),
          collabs: (options?.collabHints ?? [])
            .map((_, i) => i)
            .filter((i) => storyChecked.has(`collab-${i}`)),
          blocks: (options?.blockHints ?? [])
            .filter((b) => storyChecked.has(`block-${b.type}`))
            .map((b) => b.type as string),
          seeks: !!options?.seeksHint && storyChecked.has("seeks"),
        }
      : undefined;
    onApply({
      name: fName.trim() || query || undefined,
      oneLiner: oneLinerList[oneLinerSel]?.trim() || undefined,
      description: descList[descSel]?.trim() || undefined,
      address: fAddress.trim() || undefined,
      instagram: fInstagram.trim() || undefined,
      homepage: fHomepage.trim() || undefined,
      values: options?.values.length ? options.values : undefined,
      activityHints: options?.activityHints?.length ? options.activityHints : undefined,
      collabHints: options?.collabHints?.length ? options.collabHints : undefined,
      blockHints: options?.blockHints?.length ? options.blockHints : undefined,
      seeksHint: options?.seeksHint ?? undefined,
      selectedHints,
    });
  };

  // 확인 화면에 보여줄 선택 칩(선택 순서 유지)
  const confirmList = selected.map((t) => chipOf(t)).filter((c): c is KeywordChip => !!c);
  const unconfirmedFactual = confirmList.filter((c) => c.factual && !factualOk.has(c.text));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <ScrollLock />
      <div
        className="relative w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-e2"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-pill text-lg text-mute hover:bg-surface-soft hover:text-ink"
        >
          ✕
        </button>

        {/* 진행 단계 표시 + 뒤로 */}
        {stepIdx >= 0 && (
          <div className="mb-3 flex items-center gap-2 pr-8">
            <button
              type="button"
              onClick={goBack}
              className="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
            >
              ← 뒤로
            </button>
            <span className="ml-auto text-xs font-medium text-mute">
              {stepIdx + 1} / {steps.length}
            </span>
          </div>
        )}

        {(kind === "loading" || kind === "generating") && (
          <LoadingView name={query} generating={kind === "generating"} />
        )}

        {kind === "error" && (
          <div className="pt-4 text-center">
            <p className="text-lg font-bold text-ink">앗, 문제가 생겼어요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">{errMsg}</p>
            <button
              onClick={onClose}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              직접 입력할게요
            </button>
          </div>
        )}

        {/* ⓪ 씨앗 — 지역·업종 필수 */}
        {kind === "seed" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">어디에 있는, 어떤 브랜드인가요?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              같은 이름의 다른 곳과 헷갈리지 않게, 딱 두 가지만 알려주세요.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[15px] font-medium text-body">
                  지역 <span className="text-primary-on">*</span>
                </label>
                <input
                  value={regionInput}
                  onChange={(e) => setRegionInput(e.target.value)}
                  placeholder="예: 성수동, 홍대"
                  className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[15px] font-medium text-body">
                  업종 <span className="text-primary-on">*</span>
                </label>
                <input
                  value={btype}
                  onChange={(e) => setBtype(e.target.value)}
                  placeholder="예: 빈티지 샵, 카페"
                  className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                />
              </div>
            </div>
            {/* 에코백 — 무엇으로 검색하는지 그대로 보여준다(잘못 겨냥 방지) */}
            {seedReady && (
              <p className="mt-3 rounded-md bg-surface-soft px-3 py-2 text-[13px] leading-relaxed text-mute">
                「{query} · {regionInput.trim()} · {btype.trim()}」(으)로 웹에서 찾아볼게요.
              </p>
            )}
            <button
              onClick={runCrawl}
              disabled={!seedReady}
              className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-40"
            >
              ✨ 이 정보로 찾아보기
            </button>
          </div>
        )}

        {/* ① 키워드 선택(넓게) */}
        {kind === "chips" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">
              {tier === "thin" ? "찾은 건 적지만, 함께 채워봐요" : "이런 모습들을 찾았어요"}
            </p>
            {tier === "thin" && (
              <p className="mt-2 rounded-md border border-hairline bg-surface-soft px-3 py-2.5 text-[13px] leading-relaxed text-mute">
                온라인에서 확인 가능한 정보를 최대한 찾아봤지만, 기본 정보만 수집할 수
                있었어요. 나머지는 직접 작성해 주세요.
              </p>
            )}
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              내 브랜드를 나타내는 게 보이면 <b className="text-body">최대한 많이</b> 골라주세요.
              많이 고를수록 더 정확한 소개서가 작성돼요.
            </p>
            <div className="mt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setKind("seed")}
                className="text-[13px] text-faint underline-offset-2 hover:text-mute hover:underline"
              >
                「{regionInput.trim()} · {btype.trim()}」 수정
              </button>
              <span className="text-[13px] text-faint">{selected.length}개 선택</span>
            </div>

            <div className="mt-2 max-h-[42vh] space-y-3 overflow-y-auto slim-scrollbar pr-0.5">
              {SECTION_ORDER.filter((s) => allChips.some((c) => c.section === s)).map((s) => (
                <div key={s}>
                  <p className="mb-1.5 text-[13px] font-medium text-faint">{SECTION_LABELS[s] ?? s}</p>
                  <div className="flex flex-wrap gap-2">
                    {allChips
                      .filter((c) => c.section === s)
                      .map((c) => {
                        const on = selected.includes(c.text);
                        return (
                          <button
                            key={c.text}
                            type="button"
                            onClick={() => toggleChip(c.text)}
                            className={`inline-flex min-h-9 items-center rounded-pill border px-3.5 py-1.5 text-left text-sm leading-snug transition-colors ${
                              on
                                ? "border-primary bg-primary-tint text-primary-on"
                                : "border-hairline bg-surface text-body"
                            }`}
                          >
                            {c.text}
                            {on ? " ✓" : ""}
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* 직접 추가 — 크롤 구멍 메움 + 문장으로 쓰고 싶은 사람의 출구 */}
            <div className="mt-3 flex gap-2">
              <input
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustom();
                  }
                }}
                placeholder="직접 추가 (예: 수제, 비건, 반려동물 동반)"
                className="h-11 min-w-0 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <button
                type="button"
                onClick={addCustom}
                className="h-11 shrink-0 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
              >
                추가
              </button>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-faint">
              문장으로 적어주셔도 좋아요. 적은 그대로 소개에 담아드려요.
            </p>

            <button
              onClick={() => (selected.length ? setKind("confirm") : generate())}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              {selected.length ? `고른 ${selected.length}개로 다음` : "키워드 없이 초안 받기"}
            </button>
          </div>
        )}

        {/* ② 확인·강조(좁게) — ⭐캡3 + 사실 게이트 + 링크 확인 */}
        {kind === "confirm" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">선택한 정보를 확인해주세요.</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              제일 중요한 것에 별표를 눌러주세요(최대 {MAX_STARS}개). 별표한 건 한 줄 소개에 꼭
              담고, 나머지도 상세 소개에 담아드려요.
            </p>
            <div className="mt-4 max-h-[38vh] space-y-2 overflow-y-auto slim-scrollbar pr-0.5">
              {confirmList.map((c) => {
                const star = starred.includes(c.text);
                const needsConfirm = c.factual && !factualOk.has(c.text);
                return (
                  <div
                    key={c.text}
                    className={`rounded-md border px-3 py-2.5 ${
                      needsConfirm ? "border-border-strong bg-surface-soft" : "border-hairline bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="min-w-0 flex-1 text-[15px] leading-snug text-ink">{c.text}</span>
                      {c.factual && !needsConfirm && (
                        <button
                          type="button"
                          onClick={() => confirmFactual(c.text)}
                          className="shrink-0 text-[12px] text-faint underline-offset-2 hover:underline"
                        >
                          확인 취소
                        </button>
                      )}
                      {!needsConfirm && (
                        <button
                          type="button"
                          onClick={() => toggleStar(c.text)}
                          disabled={!star && starred.length >= MAX_STARS}
                          aria-label={star ? "별표 해제" : "별표"}
                          className={`shrink-0 text-xl leading-none ${
                            star ? "" : "opacity-35"
                          } disabled:opacity-15`}
                        >
                          {star ? "⭐" : "☆"}
                        </button>
                      )}
                    </div>
                    {needsConfirm && (
                      <div className="mt-2">
                        <p className="text-[13px] leading-relaxed text-mute">
                          숫자·이력 정보예요. 다른 곳의 정보가 섞였을 수 있으니, 사실이 맞는지
                          확인해 주세요.
                        </p>
                        <button
                          type="button"
                          onClick={() => confirmFactual(c.text)}
                          className="mt-1.5 h-8 rounded-pill border border-border-strong bg-surface px-3 text-[13px] font-medium text-ink hover:border-primary"
                        >
                          맞아요, 우리 이야기예요
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {unconfirmedFactual.length > 0 && (
              <p className="mt-2 text-[13px] leading-relaxed text-faint">
                확인하지 않은 숫자·이력 항목은 소개에 담지 않아요.
              </p>
            )}

            <button
              onClick={hasLinks ? goNext : generate}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              {hasLinks ? "다음" : "✨ 이 내용으로 소개 만들기"}
            </button>
          </div>
        )}

        {/* ②-B 링크 확인(별도 스텝) — 자동첨부 금지. 기본 미선택, "맞아요"를 눌러야만 담긴다. */}
        {kind === "links" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">이 링크가 맞나요?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              확인한 것만 소개에 담아요. 아니면 그냥 두셔도 돼요.
            </p>
            <div className="mt-4 space-y-2">
              {links.instagram && (
                <LinkConfirmCard
                  label="인스타그램"
                  value={links.instagram}
                  note={links.instagramConfirmed ? "홈페이지에서 발견했어요" : "웹 검색에서 발견했어요"}
                  question={`이 계정이 ${query}${josa(query, "이", "가")} 맞나요?`}
                  answer={igAnswer}
                  onAnswer={setIgAnswer}
                />
              )}
              {links.homepage && (
                <LinkConfirmCard
                  label="홈페이지"
                  value={links.homepage}
                  note="웹 검색에서 발견했어요"
                  question={`이 홈페이지가 ${query}${josa(query, "이", "가")} 맞나요?`}
                  answer={hpAnswer}
                  onAnswer={setHpAnswer}
                />
              )}
            </div>
            <button
              onClick={generate}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              ✨ 이 내용으로 소개 만들기
            </button>
          </div>
        )}

        {/* 정보 확인·수정 */}
        {kind === "fields" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">찾은 정보가 맞나요?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">틀리면 바로 고쳐주세요. 빈 칸은 건너뛰어도 돼요.</p>
            <div className="mt-4 space-y-3">
              <FieldEdit label="상호" value={fName} onChange={setFName} placeholder="예: 캔버스가든" />
              <FieldEdit label="주소" value={fAddress} onChange={setFAddress} placeholder="예: 서울 성동구 성수동" />
              <FieldEdit
                label="인스타그램"
                value={fInstagram}
                onChange={setFInstagram}
                placeholder="@handle"
                candidates={options?.instagramCandidates}
                candidateHint="정확한 계정을 못 찾았어요. 아래 후보 중 맞는 걸 고르거나 직접 입력해주세요."
              />
              <FieldEdit label="홈페이지" value={fHomepage} onChange={setFHomepage} placeholder="https://" />
            </div>
            <button
              onClick={goNext}
              className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              다음 · 한 줄 소개 고르기
            </button>
          </div>
        )}

        {/* 한 줄 소개 5지선다 */}
        {kind === "oneLiner" && options && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">한 줄 소개를 골라주세요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">‘수정’으로 다듬으며 비교하고, 마음에 드는 하나를 골라주세요.</p>
            <div className="mt-4 max-h-[42vh] overflow-y-auto slim-scrollbar pr-0.5">
              <OptionPicker
                list={oneLinerList}
                sel={oneLinerSel}
                onSelect={setOneLinerSel}
                onEdit={(i, v) => setOneLinerList((p) => p.map((x, j) => (j === i ? v : x)))}
                onAddCustom={() => {
                  setOneLinerList((p) => [...p, ""]);
                  setOneLinerSel(oneLinerList.length);
                }}
              />
            </div>
            <button
              onClick={goNext}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              다음 · 브랜드 소개 고르기
            </button>
          </div>
        )}

        {/* 브랜드 소개 5지선다 */}
        {kind === "desc" && options && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">브랜드 소개를 골라주세요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">‘수정’으로 다듬으며 비교하고, 마음에 드는 하나를 골라주세요.</p>
            <div className="mt-4 max-h-[42vh] overflow-y-auto slim-scrollbar pr-0.5">
              <OptionPicker
                list={descList}
                sel={descSel}
                onSelect={setDescSel}
                onEdit={(i, v) => setDescList((p) => p.map((x, j) => (j === i ? v : x)))}
                onAddCustom={() => {
                  setDescList((p) => [...p, ""]);
                  setDescSel(descList.length);
                }}
                multiline
              />
            </div>
            <button
              onClick={storyItems.length ? goNext : apply}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              {storyItems.length ? "다음 · 찾은 이야기 고르기" : "선택한 내용으로 채우기"}
            </button>
          </div>
        )}

        {/* 찾은 이야기 체크리스트(힌트 있을 때만) */}
        {kind === "story" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">이런 이야기도 찾았어요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              웹에서 찾은 내용이에요. 담을 것만 골라주세요.
            </p>
            <div className="mt-4 max-h-[46vh] space-y-2 overflow-y-auto pr-0.5">
              {storyItems.map((it) => {
                const on = storyChecked.has(it.key);
                return (
                  <label
                    key={it.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-3 transition-colors ${
                      on ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleStoryItem(it.key)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary,theme(colors.lime.400))]"
                    />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-bold text-ink">{it.sectionLabel}</span>
                      <span className="mt-1 block line-clamp-2 text-[14px] leading-relaxed text-mute">
                        {it.preview}
                      </span>
                      <span className="mt-1 block text-[13px] text-faint">{it.reason}</span>
                    </span>
                  </label>
                );
              })}
            </div>
            <button
              onClick={apply}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              선택한 내용 담고 시작하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 링크 확인 카드 — 기본 미선택. "맞아요"를 눌러야만 폼에 담긴다(오귀속 방지).
function LinkConfirmCard({
  label,
  value,
  note,
  question,
  answer,
  onAnswer,
}: {
  label: string;
  value: string;
  note: string;
  question: string;
  answer: "yes" | "no" | null;
  onAnswer: (a: "yes" | "no") => void;
}) {
  return (
    <div className="rounded-md border border-hairline bg-surface px-3 py-2.5">
      <p className="text-[13px] text-faint">
        {label} · {note}
      </p>
      <p className="mt-0.5 break-all text-[15px] font-medium text-ink">{value}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-mute">{question}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={() => onAnswer("yes")}
          className={`h-8 rounded-pill border px-3.5 text-[13px] font-medium transition-colors ${
            answer === "yes"
              ? "border-primary bg-primary-tint text-primary-on"
              : "border-border-strong bg-surface text-ink"
          }`}
        >
          맞아요
        </button>
        <button
          type="button"
          onClick={() => onAnswer("no")}
          className={`h-8 rounded-pill border px-3.5 text-[13px] font-medium transition-colors ${
            answer === "no"
              ? "border-ink bg-surface-soft text-ink"
              : "border-border-strong bg-surface text-mute"
          }`}
        >
          아니에요
        </button>
      </div>
    </div>
  );
}

// 개별 필드 — 라벨 + 수정 가능한 입력 (+ 불확실할 때 후보 칩)
function FieldEdit({
  label,
  value,
  onChange,
  placeholder,
  candidates,
  candidateHint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  candidates?: string[];
  candidateHint?: string;
}) {
  // 값이 비어있고(=자동으로 확정 못함) 후보가 있으면 골라서 채우게 노출
  const showCandidates = !value.trim() && !!candidates?.length;
  return (
    <div>
      <label className="mb-1.5 block text-[15px] font-medium text-body">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
      />
      {showCandidates && (
        <div className="mt-2 rounded-md border border-hairline bg-surface-soft p-2.5">
          {candidateHint && <p className="mb-2 text-[13px] leading-relaxed text-mute">{candidateHint}</p>}
          <div className="flex flex-wrap gap-1.5">
            {candidates!.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange(c)}
                className="inline-flex h-8 items-center rounded-pill border border-border-strong bg-surface px-3 text-sm text-ink hover:border-primary hover:bg-primary-pale"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 5지선다 — 각 보기를 그 자리에서 수정 가능(controlled). 보기로 둔 채 다듬으며 비교→선택.
function OptionPicker({
  list,
  sel,
  onSelect,
  onEdit,
  multiline,
  onAddCustom,
}: {
  list: string[];
  sel: number;
  onSelect: (i: number) => void;
  onEdit: (i: number, v: string) => void;
  multiline?: boolean;
  onAddCustom?: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const setSel = onSelect;
  const editItem = onEdit;

  return (
    <div className="space-y-2">
      {list.map((it, i) => {
        const on = sel === i;
        const isEditing = editing === i;
        return (
          <div
            key={i}
            className={`rounded-md border transition-colors ${
              on ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
            }`}
          >
            <div className="flex items-start gap-2.5 px-3 py-3">
              <button
                type="button"
                onClick={() => setSel(i)}
                aria-label="이 소개 선택"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border text-[10px] font-bold ${
                  on ? "border-primary bg-primary text-primary-on" : "border-border-strong text-transparent"
                }`}
              >
                ✓
              </button>
              {isEditing ? (
                multiline ? (
                  <textarea
                    value={it}
                    onChange={(e) => editItem(i, e.target.value)}
                    autoFocus
                    rows={4}
                    className="flex-1 rounded-sm border border-hairline bg-surface px-2.5 py-2 text-[15px] leading-relaxed text-ink outline-none focus:border-focus"
                  />
                ) : (
                  <input
                    value={it}
                    onChange={(e) => editItem(i, e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        setEditing(null);
                      }
                    }}
                    className="h-9 flex-1 rounded-sm border border-hairline bg-surface px-2.5 text-[15px] text-ink outline-none focus:border-focus"
                  />
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setSel(i)}
                  className={`flex-1 text-left text-[15px] ${
                    on ? "text-ink" : "text-body"
                  } ${multiline ? "leading-relaxed" : "line-clamp-2"}`}
                >
                  {it}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(isEditing ? null : i)}
                className="shrink-0 text-[13px] font-medium text-primary-on underline-offset-2 hover:underline"
              >
                {isEditing ? "완료" : "수정"}
              </button>
            </div>
          </div>
        );
      })}
      {onAddCustom && (
        <button
          type="button"
          onClick={() => {
            onAddCustom();
            setEditing(list.length);
          }}
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute transition-colors hover:border-primary hover:text-primary-on"
        >
          ＋ 직접 입력하기
        </button>
      )}
    </div>
  );
}

// 아톰 마크 + 순환 메시지 로딩 (회전 X = 어지럼 방지)
const CRAWL_STEPS = [
  "웹에서 정보를 모으는 중…",
  "같은 이름의 다른 곳을 걸러내는 중…",
  "브랜드의 모습을 키워드로 정리하는 중…",
];
const GEN_STEPS = [
  "고른 키워드를 살펴보는 중…",
  "브랜드의 분위기를 읽는 중…",
  "소개 후보를 다듬는 중…",
];
function LoadingView({ name, generating }: { name: string; generating?: boolean }) {
  const msgs = generating ? GEN_STEPS : CRAWL_STEPS;
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % msgs.length), 2000);
    return () => clearInterval(t);
  }, [msgs.length]);
  return (
    <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
      <svg viewBox="0 0 56 56" className="h-11 w-11 text-ink" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeWidth="2">
          <ellipse cx="28" cy="28" rx="20" ry="7" transform="rotate(30 28 28)" />
          <ellipse cx="28" cy="28" rx="20" ry="7" transform="rotate(-30 28 28)" />
        </g>
        <circle cx="45.32" cy="38" r="2.8" fill="currentColor" />
        <circle cx="10.68" cy="18" r="2.8" fill="currentColor" />
        <circle cx="45.32" cy="18" r="2.8" fill="currentColor" />
        <circle cx="28" cy="28" r="7" fill="var(--primary)" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p className="mt-5 text-base font-bold text-ink">
        {generating
          ? "소개를 만드는 중이에요"
          : name
            ? `${name}${josa(name, "을", "를")} 살펴보는 중이에요`
            : "브랜드를 살펴보는 중이에요"}
      </p>
      <p className="mt-1.5 text-sm text-mute">{msgs[i]}</p>
    </div>
  );
}
