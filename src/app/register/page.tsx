"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMakerAction } from "@/lib/actions";
import type { CollabType } from "@/lib/types";
import type { EnrichField } from "@/lib/enrich";
import { EnrichWizard, type WizardFill } from "./EnrichWizard";
import {
  PortfolioCard,
  downloadPortfolioPng,
  downloadPortfolioPdf,
  type PortfolioData,
} from "./PortfolioCard";

const COLLAB_TYPES: CollabType[] = [
  "공간대여",
  "제품컬래버",
  "워크숍",
  "팝업",
  "굿즈",
  "콘텐츠",
  "행사참여",
];

// 결 추천 어휘 — "우리가 멋진 말을 골라드려요"(분석 도움). 직접 추가도 가능.
const SUGGESTED_VIBES = [
  "친환경",
  "손맛",
  "느린 호흡",
  "빈티지",
  "다정함",
  "로컬",
  "정성",
  "미니멀",
  "핸드메이드",
  "계절감",
  "큐레이션",
  "따뜻함",
  "실험적",
  "클래식",
  "위트",
  "지속가능",
];

// 5-2 수정/보강 제안 (수기 입력 vs 크롤링값 비교)
type Suggestion = { key: string; label: string; current: string; suggested: string };

export default function RegisterPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [region, setRegion] = useState("");
  const [offers, setOffers] = useState<CollabType[]>([]);
  const [seeks, setSeeks] = useState<CollabType[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [collabOpen, setCollabOpen] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [homepage, setHomepage] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);

  // ── enrich(딸깍 자동완성) 상태 ──
  const [query, setQuery] = useState(""); // 불러오기 검색어(업체명만)
  const [wizardOpen, setWizardOpen] = useState(false); // 딸깍 자동완성 위저드
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set()); // AI가 채운 필드
  const [missing, setMissing] = useState<EnrichField[]>([]); // 못 찾은 필드(직접 입력 노티)
  const [reviewMode, setReviewMode] = useState(false); // 검수 게이트 배너

  // ── 5-2 초안받기(수기 고객) 상태 ──
  const [draftBusy, setDraftBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestIdx, setSuggestIdx] = useState(0);
  const [suggestPicks, setSuggestPicks] = useState<Record<string, string | null>>({});
  const [suggestDirect, setSuggestDirect] = useState<string | null>(null); // 직접입력 모드 값
  const [stopSuggest, setStopSuggest] = useState(false); // "더이상 제안마세요"

  const toggle = (
    list: CollabType[],
    setList: (v: CollabType[]) => void,
    t: CollabType
  ) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const toggleVibe = (v: string) =>
    setValues((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));

  const addCustomVibe = () => {
    const v = customVibe.trim();
    if (v && !values.includes(v)) setValues((p) => [...p, v]);
    setCustomVibe("");
  };

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next].slice(0, 4));
  };

  // 규칙 기반 소개 초안 (mock — 입력값 조합)
  const ruleDraft = () => {
    const parts: string[] = [];
    if (oneLiner.trim()) parts.push(oneLiner.trim().replace(/[.\s]*$/, "."));
    if (values.length)
      parts.push(`${values.slice(0, 3).join(", ")} — 우리를 잘 보여주는 말이에요.`);
    if (name.trim()) parts.push(`${name.trim()}의 이야기를 카드에 담았어요.`);
    if (parts.length) setDescription(parts.join(" "));
  };

  // 수기 입력 vs 크롤링값 비교 → 수정/보강 제안 목록
  const buildSuggestions = (c: Record<string, unknown>): Suggestion[] => {
    const rows: [string, string, string][] = [
      ["name", "상호", name],
      ["oneLiner", "한 줄 소개", oneLiner],
      ["region", "지역", region],
      ["instagram", "인스타그램", instagram],
      ["homepage", "홈페이지", homepage],
    ];
    const out: Suggestion[] = [];
    rows.forEach(([key, label, cur]) => {
      const sug = c[key];
      if (typeof sug === "string" && sug.trim() && sug.trim() !== cur.trim()) {
        out.push({ key, label, current: cur.trim(), suggested: sug.trim() });
      }
    });
    return out;
  };

  // 초안받기: 딸깍으로 채웠으면 규칙 재생성 / 수기 고객은 상호로 크롤링 → 초안 + 제안
  const draftDescription = async () => {
    if (aiFilled.size > 0 || !name.trim()) {
      ruleDraft();
      return;
    }
    setDraftBusy(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: name.trim() }),
      });
      const data = await res.json();
      const c = data.candidates?.[0];
      if (!c) {
        ruleDraft();
        return;
      }
      if (typeof c.description === "string" && c.description) setDescription(c.description);
      else ruleDraft();
      if (!stopSuggest) {
        const sugg = buildSuggestions(c);
        if (sugg.length) {
          setSuggestions(sugg);
          setSuggestIdx(0);
          setSuggestPicks({});
          setSuggestDirect(null);
        }
      }
    } catch {
      ruleDraft();
    } finally {
      setDraftBusy(false);
    }
  };
  const canDraft = !!(oneLiner.trim() || values.length || name.trim());

  // 제안 일괄 적용 + 순차 처리 (6번 뒤로가기 포함)
  const applySuggestionPicks = (picks: Record<string, string | null>) => {
    Object.entries(picks).forEach(([key, val]) => {
      if (!val) return;
      if (key === "name") setName(val);
      else if (key === "oneLiner") setOneLiner(val);
      else if (key === "region") setRegion(val);
      else if (key === "instagram") setInstagram(val);
      else if (key === "homepage") setHomepage(val);
    });
  };
  const closeSuggest = () => {
    setSuggestions([]);
    setSuggestIdx(0);
    setSuggestPicks({});
    setSuggestDirect(null);
  };
  const answerSuggestion = (action: "accept" | "skip" | "direct", directVal?: string) => {
    const s = suggestions[suggestIdx];
    if (!s) return;
    if (action === "skip") {
      setStopSuggest(true);
      applySuggestionPicks(suggestPicks);
      closeSuggest();
      return;
    }
    const val = action === "direct" ? (directVal ?? "").trim() : s.suggested;
    const picks = { ...suggestPicks, [s.key]: val || null };
    setSuggestPicks(picks);
    setSuggestDirect(null);
    if (suggestIdx < suggestions.length - 1) {
      setSuggestIdx((i) => i + 1);
    } else {
      applySuggestionPicks(picks);
      closeSuggest();
    }
  };
  const backSuggestion = () => {
    if (suggestIdx > 0) {
      setSuggestDirect(null);
      setSuggestIdx((i) => i - 1);
    }
  };

  // ── enrich: 업체명 → 위저드 오픈(불러오기) ──
  const openWizard = () => {
    if (!query.trim()) return;
    setWizardOpen(true);
  };

  // 위저드가 고른 항목만 폼에 반영(검수 게이트). AI는 '초안'만 — 사용자가 확인·수정 후 저장.
  const applyWizard = (fill: WizardFill) => {
    const filled = new Set<string>();
    if (fill.name !== undefined) {
      setName(fill.name);
      filled.add("name");
    }
    if (fill.oneLiner !== undefined) {
      setOneLiner(fill.oneLiner);
      filled.add("oneLiner");
    }
    if (fill.region !== undefined) {
      setRegion(fill.region);
      filled.add("region");
    }
    if (fill.address !== undefined) {
      setAddress(fill.address);
      filled.add("address");
    }
    if (fill.instagram !== undefined) {
      setInstagram(fill.instagram);
      filled.add("instagram");
    }
    if (fill.homepage !== undefined) {
      setHomepage(fill.homepage);
      filled.add("homepage");
    }
    if (fill.values !== undefined) {
      setValues(fill.values);
      filled.add("values");
    }
    if (fill.description !== undefined) {
      setDescription(fill.description);
      filled.add("description");
    }
    setAiFilled(filled);
    setMissing([]);
    setReviewMode(true);
    setWizardOpen(false);
  };

  // 라벨 옆 표시: AI가 채운 필드면 ✨배지, 못 찾은 필드면 "직접 입력" 노티
  const hintFor = (key: string, miss?: EnrichField) => {
    if (aiFilled.has(key)) return <AiBadge />;
    if (miss && missing.includes(miss)) return <MissingNote />;
    return undefined;
  };

  const canSubmit = name.trim().length > 0 && !pending;

  // ── 소개서(포트폴리오) ──
  const portfolioRef = useRef<HTMLDivElement>(null);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [createdSlug, setCreatedSlug] = useState("");
  const portfolioData: PortfolioData = {
    name,
    oneLiner,
    region,
    address,
    offers,
    seeks,
    values,
    instagram,
    homepage,
    description,
    photos,
  };

  const submit = () => {
    startTransition(async () => {
      const { slug } = await createMakerAction({
        name,
        oneLiner,
        region,
        offers,
        seeks,
        values,
        collabOpen,
        instagram,
        homepage,
        address,
        description,
      });
      setCreatedSlug(slug);
      setPortfolioOpen(true); // redirect 대신 소개서 얼럿
    });
  };
  const goToPage = () => router.push(`/m/${createdSlug}`);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">
        당신의 브랜드, 멋지게 정리해드릴게요
      </h1>
      <p className="mt-1 text-base text-body">
        몇 가지만 알려주면 콜라보 카드를 만들 수 있는 내 페이지가 생겨요. 1분이면 충분해요.
      </p>

      {/* ✨ 딸깍 자동완성 — 이름만 알려주면 채워드릴게요 */}
      <div className="mt-6 rounded-lg border border-primary bg-primary-pale px-4 py-4">
        <p className="text-sm font-bold text-ink">
          ✨ 이름만 알려주세요, 나머지는 채워드릴게요
        </p>
        <p className="mt-0.5 text-xs text-mute">
          브랜드 이름을 적고 불러오면, 웹에서 찾아 소개·분위기·링크를 초안으로 채워드려요. 찾은 내용은 확인하고 고치면 돼요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                openWizard();
              }
            }}
            placeholder="예: 캔버스가든"
            className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <button
            type="button"
            onClick={openWizard}
            disabled={!query.trim()}
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-on disabled:opacity-40"
          >
            ✨ 불러오기
          </button>
        </div>
      </div>

      <div className="mt-7 space-y-7">
        {/* 검수 게이트 배너 — AI가 채운 직후 */}
        {reviewMode && (
          <div className="rounded-lg border border-primary bg-surface px-4 py-3 shadow-e1">
            <p className="text-sm font-medium text-ink">✨ AI가 초안을 채웠어요</p>
            <p className="mt-0.5 text-xs text-mute">
              맞는지 확인하고 자유롭게 고쳐주세요. 못 찾은 곳은 직접 채우면 돼요.
            </p>
          </div>
        )}
        {/* 기본 정보 */}
        <Field label="상호 *" hint={hintFor("name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 캔버스가든"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="한 줄 소개" hint={hintFor("oneLiner")}>
          <input
            value={oneLiner}
            onChange={(e) => setOneLiner(e.target.value)}
            placeholder="예: 패브릭으로 짓는 친환경 가방과 조각 워크숍"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="지역" hint={hintFor("region")}>
          <input
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="예: 서울"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>

        {/* 브랜드 사진 (선택) — 클라이언트 썸네일 프리뷰 */}
        <div>
          <label className="mb-1 block text-sm font-medium text-body">
            브랜드 사진 (선택)
          </label>
          <p className="mb-2.5 text-xs text-mute">
            분위기를 보여주는 사진을 올리면 카드가 더 풍성해져요. 최대 4장.
          </p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <div
                key={i}
                className="relative h-20 w-20 overflow-hidden rounded-md border border-hairline"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setPhotos((ps) => ps.filter((_, j) => j !== i))}
                  aria-label="사진 삭제"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 4 && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
                <span className="text-xl leading-none">＋</span>
                <span className="mt-1 text-[11px]">사진</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPhotos(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        {/* 하드축 */}
        <Field label="이런 콜라보 제공할 수 있어요">
          <ChipRow
            options={COLLAB_TYPES}
            selected={offers}
            onToggle={(t) => toggle(offers, setOffers, t)}
          />
        </Field>
        <Field label="이런 콜라보 찾고 있어요">
          <ChipRow
            options={COLLAB_TYPES}
            selected={seeks}
            onToggle={(t) => toggle(seeks, setSeeks, t)}
          />
        </Field>

        {/* 결 — 추천 어휘 + 커스텀 (분석 도움) */}
        <div>
          <label className="mb-1 flex items-center gap-2 text-sm font-medium text-body">
            <span>우리 브랜드를 표현하는 말</span>
            {aiFilled.has("values") && <AiBadge />}
          </label>
          <p className="mb-2.5 text-xs text-mute">
            어울리는 단어를 골라보세요. 우리가 고른 말들이에요. 직접 더해도 좋아요.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_VIBES.map((v) => {
              const on = values.includes(v);
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVibe(v)}
                  className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                    on
                      ? "border-primary bg-primary-tint text-primary-on"
                      : "border-hairline bg-surface text-mute"
                  }`}
                >
                  {v}
                  {on ? " ✓" : ""}
                </button>
              );
            })}
            {/* 커스텀으로 추가된 결 (추천 목록에 없는 것) */}
            {values
              .filter((v) => !SUGGESTED_VIBES.includes(v))
              .map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => toggleVibe(v)}
                  className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
                >
                  {v} ✕
                </button>
              ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              value={customVibe}
              onChange={(e) => setCustomVibe(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustomVibe();
                }
              }}
              placeholder="직접 더하기 (예: 아날로그)"
              className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            <button
              type="button"
              onClick={addCustomVibe}
              className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
            >
              추가
            </button>
          </div>
        </div>

        {/* ✨ 실시간 미리보기 — "본인도 몰랐던 나"가 카드로 */}
        <PreviewCard
          name={name}
          oneLiner={oneLiner}
          region={region}
          values={values}
          offers={offers}
        />

        {/* 신뢰 시그널 */}
        <Field label="인스타그램" hint={hintFor("instagram", "instagram")}>
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="홈페이지" hint={hintFor("homepage", "homepage")}>
          <input
            value={homepage}
            onChange={(e) => setHomepage(e.target.value)}
            placeholder="https://"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <Field label="주소" hint={hintFor("address", "address")}>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="예: 서울 성동구 성수동"
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-medium text-body">
              <span>소개 (한 문단)</span>
              {aiFilled.has("description") && <AiBadge />}
            </label>
            <button
              type="button"
              onClick={draftDescription}
              disabled={!canDraft || draftBusy}
              className="inline-flex h-7 items-center gap-1 rounded-pill border border-primary bg-primary-pale px-2.5 text-xs font-medium text-primary-on disabled:opacity-40"
            >
              {draftBusy
                ? "찾는 중…"
                : description.trim()
                  ? "✨ 초안 다시 받기"
                  : "✨ 초안 받기"}
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="버려지는 천에 새 이야기를 입히는 패브릭 브랜드."
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          <p className="mt-1.5 text-xs text-mute">
            위 정보로 초안을 만들어드려요. 그대로 써도, 더 다듬어도 좋아요.
          </p>
        </div>

        {/* 콜라보 열림/닫힘 */}
        <div className="flex items-center justify-between rounded-lg border border-hairline bg-surface px-4 py-3">
          <div>
            <p className="text-base font-medium text-ink">콜라보 받는 중</p>
            <p className="text-sm text-mute">
              켜두면 다른 메이커가 먼저 콜라보를 제안할 수 있어요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCollabOpen((v) => !v)}
            role="switch"
            aria-checked={collabOpen}
            aria-label="콜라보 받는 중"
            className={`flex h-[26px] w-11 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
              collabOpen ? "bg-primary" : "bg-border-strong"
            }`}
          >
            <span
              className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${
                collabOpen ? "translate-x-[18px]" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
        >
          {pending ? "만드는 중…" : "등록하고 내 페이지 만들기"}
        </button>
      </div>

      {/* 딸깍 자동완성 위저드 — 로딩·후보확인·인스타/홈피·재크롤링·항목선택 */}
      {wizardOpen && (
        <EnrichWizard
          query={query.trim()}
          onClose={() => setWizardOpen(false)}
          onApply={applyWizard}
        />
      )}

      {/* 5-2 수정/보강 제안 — 수기 고객 초안받기 후, 순차 + 뒤로가기(6번) */}
      {suggestions.length > 0 && suggestions[suggestIdx] && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-e2">
            {suggestIdx > 0 && (
              <button
                type="button"
                onClick={backSuggestion}
                className="mb-3 -ml-1 inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
              >
                ← 뒤로
              </button>
            )}
            <p className="text-xs font-medium text-mute">
              제안 {suggestIdx + 1} / {suggestions.length}
            </p>
            <p className="mt-1 text-base font-bold text-ink">
              {suggestions[suggestIdx].current
                ? `${suggestions[suggestIdx].label}, 이렇게 고쳐볼까요?`
                : `${suggestions[suggestIdx].label} 정보를 찾았어요`}
            </p>
            <div className="mt-3 rounded-md border border-hairline bg-surface-soft p-3">
              {suggestions[suggestIdx].current && (
                <p className="text-sm text-faint line-through">
                  {suggestions[suggestIdx].current}
                </p>
              )}
              <p className="text-sm font-medium text-ink">
                {suggestions[suggestIdx].suggested}
              </p>
            </div>

            {suggestDirect !== null ? (
              <div className="mt-4 flex gap-2">
                <input
                  value={suggestDirect}
                  onChange={(e) => setSuggestDirect(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      answerSuggestion("direct", suggestDirect);
                    }
                  }}
                  className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-focus"
                />
                <button
                  type="button"
                  onClick={() => answerSuggestion("direct", suggestDirect)}
                  className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-on"
                >
                  적용
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => answerSuggestion("accept")}
                  className="h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
                >
                  {suggestIdx < suggestions.length - 1 ? "네, 바꿀게요" : "네, 반영할게요"}
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSuggestDirect(suggestions[suggestIdx].current || "")}
                    className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
                  >
                    직접 입력
                  </button>
                  <button
                    type="button"
                    onClick={() => answerSuggestion("skip")}
                    className="h-11 flex-1 rounded-md text-sm font-medium text-mute"
                  >
                    그만 제안
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 소개서 캡처용 — 화면 밖에서 렌더(다운로드 대상) */}
      <div style={{ position: "fixed", left: -9999, top: 0 }} aria-hidden="true">
        <PortfolioCard ref={portfolioRef} data={portfolioData} />
      </div>

      {/* 등록 완료 → 브랜드 소개서 얼럿 */}
      {portfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-lg border border-hairline bg-surface p-5 text-center shadow-e2">
            <p className="text-base font-bold text-ink">✨ 브랜드 소개서가 만들어졌어요</p>
            <p className="mt-1 text-sm text-mute">
              입력한 정보를 한 장으로 정리했어요. 바로 받아보세요.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  portfolioRef.current &&
                  downloadPortfolioPng(portfolioRef.current, `${name.trim() || "브랜드"}_소개서`)
                }
                className="h-11 rounded-md bg-primary text-sm font-medium text-primary-on"
              >
                PNG 이미지로 다운로드
              </button>
              <button
                type="button"
                onClick={() =>
                  portfolioRef.current &&
                  downloadPortfolioPdf(portfolioRef.current, `${name.trim() || "브랜드"}_소개서`)
                }
                className="h-11 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
              >
                PDF로 다운로드
              </button>
            </div>
            <button type="button" onClick={goToPage} className="mt-3 text-sm font-medium text-mute">
              닫고 내 페이지로 가기
            </button>
            <p className="mt-3 text-xs text-faint">
              소개서는 내 프로필에서 언제든 다운로드할 수 있어요
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-medium text-body">
        <span>{label}</span>
        {hint}
      </label>
      {children}
    </div>
  );
}

// AI가 채운 필드 표시 (✓검증마크 아님 — '초안' 표시)
function AiBadge() {
  return (
    <span className="inline-flex items-center rounded-pill bg-primary-tint px-1.5 py-0.5 text-[10px] font-medium text-primary-on">
      ✨ AI가 채웠어요
    </span>
  );
}

// 못 찾은 검증가능 필드 — 직접 입력 노티
function MissingNote() {
  return <span className="text-[11px] font-normal text-mute">· 직접 입력이 필요해요</span>;
}

function ChipRow({
  options,
  selected,
  onToggle,
}: {
  options: CollabType[];
  selected: CollabType[];
  onToggle: (t: CollabType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((t) => {
        const on = selected.includes(t);
        return (
          <button
            key={t}
            type="button"
            onClick={() => onToggle(t)}
            className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
              on
                ? "border-primary bg-primary-tint text-primary-on"
                : "border-hairline bg-surface text-mute"
            }`}
          >
            {t}
            {on ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}

// 실시간 미리보기 — 채울수록 브랜드가 카드로 완성되는 "분석 도움" 순간
function PreviewCard({
  name,
  oneLiner,
  region,
  values,
  offers,
}: {
  name: string;
  oneLiner: string;
  region: string;
  values: string[];
  offers: CollabType[];
}) {
  const initial = name.trim().charAt(0) || "?";
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface-soft p-4">
      <p className="mb-3 text-xs font-medium text-mute">✨ 이렇게 카드에 담겨요</p>
      <div className="rounded-lg border border-hairline bg-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-primary-pale text-xl font-bold text-primary-on">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-ink">
              {name.trim() || "내 브랜드 이름"}
            </p>
            <p className="truncate text-sm text-mute">
              {oneLiner.trim() || "한 줄 소개가 여기 보여요"}
              {region.trim() ? ` · ${region.trim()}` : ""}
            </p>
          </div>
        </div>
        {(values.length > 0 || offers.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {values.map((v) => (
              <span
                key={`v-${v}`}
                className="rounded-pill bg-mint-pale px-2.5 py-0.5 text-[11px] font-medium text-mint-on"
              >
                {v}
              </span>
            ))}
            {offers.map((o) => (
              <span
                key={`o-${o}`}
                className="rounded-pill bg-primary-pale px-2.5 py-0.5 text-[11px] font-medium text-primary-on"
              >
                {o}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
