"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMakerAction } from "@/lib/actions";
import type { CollabHistory, CollabType } from "@/lib/types";
import { deriveRegion } from "@/lib/region";
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

// 브랜드 표현 어휘 — 4카테고리(감성·가치·스타일·성격). 직접 추가 가능, 최대 10개 선택.
const VIBE_CATEGORIES: { label: string; words: string[] }[] = [
  { label: "브랜드 감성", words: ["따뜻함", "감성", "정성", "손맛", "핸드메이드", "큐레이션"] },
  { label: "브랜드 가치", words: ["지속가능", "친환경", "로컬", "윤리적", "사회적 가치", "공정무역"] },
  { label: "브랜드 스타일", words: ["미니멀", "클래식", "빈티지", "모던", "실험적", "프리미엄"] },
  { label: "브랜드 성격", words: ["위트", "대담함", "유쾌함", "진정성", "감각적", "섬세함"] },
];
const ALL_VIBES = VIBE_CATEGORIES.flatMap((c) => c.words);
const MAX_VIBES = 10;

// 타겟 고객 추천 어휘 — 분위기칩과 동일 패턴. 직접 추가 가능.
const SUGGESTED_AUDIENCE = [
  "20-30대 여성",
  "20-30대 남성",
  "30-40대",
  "로컬 주민",
  "직장인",
  "학생",
  "가족 단위",
  "여행자",
  "감성 소비층",
  "친환경 관심층",
  "반려인",
  "비건",
];

// 콜라보 이력 년도 선택지 (최신순 정렬용)
const HISTORY_YEARS = ["2025", "2024", "2023", "2022", "2021", "그 이전", "모름"];

export default function RegisterPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [offers, setOffers] = useState<CollabType[]>([]);
  const [seeks, setSeeks] = useState<CollabType[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [customVibe, setCustomVibe] = useState("");
  const [targetAudience, setTargetAudience] = useState<string[]>([]);
  const [customAudience, setCustomAudience] = useState("");
  const [collabHistory, setCollabHistory] = useState<CollabHistory[]>([]);
  const [histDraft, setHistDraft] = useState<{
    partner: string;
    types: string[];
    year: string;
  } | null>(null);
  const [histCustomType, setHistCustomType] = useState("");
  const [collabOpen, setCollabOpen] = useState(true);
  const [instagram, setInstagram] = useState("");
  const [homepage, setHomepage] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [photos, setPhotos] = useState<{ name: string; url: string }[]>([]);
  const region = deriveRegion(address); // 주소에서 자동 추출 (별도 입력 없음)

  // ── enrich(딸깍 자동완성) 상태 ──
  const [query, setQuery] = useState(""); // 불러오기 검색어(업체명만)
  const [wizardOpen, setWizardOpen] = useState(false); // 딸깍 자동완성 위저드
  const [aiFilled, setAiFilled] = useState<Set<string>>(new Set()); // AI가 채운 필드
  const [missing, setMissing] = useState<EnrichField[]>([]); // 못 찾은 필드(직접 입력 노티)
  const [reviewMode, setReviewMode] = useState(false); // 검수 게이트 배너

  // ── 초안받기 상태 ──
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftGenerated, setDraftGenerated] = useState(false); // AI 초안을 한 번이라도 생성했나(버튼 분기 기준)
  const [draftRound, setDraftRound] = useState(0); // 다시 받기마다 다른 각도로 변주

  const toggle = (
    list: CollabType[],
    setList: (v: CollabType[]) => void,
    t: CollabType
  ) => setList(list.includes(t) ? list.filter((x) => x !== t) : [...list, t]);

  const toggleVibe = (v: string) =>
    setValues((p) =>
      p.includes(v) ? p.filter((x) => x !== v) : p.length >= MAX_VIBES ? p : [...p, v]
    );

  const addCustomVibe = () => {
    const v = customVibe.trim();
    if (v && !values.includes(v) && values.length < MAX_VIBES) setValues((p) => [...p, v]);
    setCustomVibe("");
  };

  // ── 타겟 고객 (분위기칩과 동일 패턴) ──
  const toggleAudience = (a: string) =>
    setTargetAudience((p) => (p.includes(a) ? p.filter((x) => x !== a) : [...p, a]));
  const addCustomAudience = () => {
    const a = customAudience.trim();
    if (a && !targetAudience.includes(a)) setTargetAudience((p) => [...p, a]);
    setCustomAudience("");
  };

  // ── 콜라보 이력 ──
  const toggleHistType = (t: string) =>
    setHistDraft((d) =>
      d ? { ...d, types: d.types.includes(t) ? d.types.filter((x) => x !== t) : [...d.types, t] } : d
    );
  const addHistCustomType = () => {
    const t = histCustomType.trim();
    if (t) setHistDraft((d) => (d && !d.types.includes(t) ? { ...d, types: [...d.types, t] } : d));
    setHistCustomType("");
  };
  const addHistory = () => {
    if (!histDraft || !histDraft.partner.trim()) return;
    setCollabHistory((p) =>
      [
        ...p,
        {
          partner: histDraft.partner.trim(),
          types: histDraft.types,
          year: histDraft.year && histDraft.year !== "모름" ? histDraft.year : undefined,
        },
      ].slice(0, 3)
    );
    setHistDraft(null);
    setHistCustomType("");
  };
  const removeHistory = (i: number) =>
    setCollabHistory((p) => p.filter((_, j) => j !== i));

  const onPhotos = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));
    setPhotos((p) => [...p, ...next].slice(0, 4));
  };

  // 규칙 기반 소개 초안 폴백 (AI 실패 시 — 입력값 조합)
  const ruleDraft = () => {
    const parts: string[] = [];
    if (oneLiner.trim()) parts.push(oneLiner.trim().replace(/[.\s]*$/, "."));
    if (values.length)
      parts.push(`${values.slice(0, 3).join(", ")} — 우리를 잘 보여주는 말이에요.`);
    if (name.trim()) parts.push(`${name.trim()}의 이야기를 카드에 담았어요.`);
    if (parts.length) setDescription(parts.join(" "));
  };

  // 초안받기: 폼에 입력한 정보 기준으로 백엔드 AI 크롤링+작성.
  // 첫 클릭='초안 받기', 이후='초안 다시 받기'(round 증가 → 다른 각도의 글).
  const draftDescription = async () => {
    if (!name.trim()) {
      ruleDraft();
      setDraftGenerated(true);
      return;
    }
    setDraftBusy(true);
    try {
      const res = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "draft",
          name: name.trim(),
          oneLiner,
          values,
          offers,
          targetAudience,
          round: draftRound,
        }),
      });
      const data = await res.json();
      if (typeof data.description === "string" && data.description.trim()) {
        setDescription(data.description.trim());
      } else {
        ruleDraft();
      }
    } catch {
      ruleDraft();
    } finally {
      setDraftGenerated(true);
      setDraftRound((r) => r + 1);
      setDraftBusy(false);
    }
  };
  const canDraft = !!(name.trim() || oneLiner.trim() || values.length);

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
      setDraftGenerated(true); // 위저드가 이미 소개 초안을 채움 → 버튼은 '다시 받기'로
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
        offers,
        seeks,
        values,
        targetAudience,
        collabHistory,
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
      <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">
        브랜드 소개서, 생각보다 금방 완성돼요.
      </h1>
      <p className="mt-2 text-[17px] leading-relaxed text-body">
        브랜드 이름만 입력하면 AI가 소개서 초안을 준비해드려요. 확인하고 다듬으면 1분 안에 완성할 수 있어요.
      </p>

      {/* ✨ 딸깍 자동완성 — 이름만 알려주면 채워드릴게요 */}
      <div className="mt-10 rounded-xl border border-primary bg-primary-pale px-5 py-5">
        <p className="text-base font-bold text-ink">
          ✨ 브랜드 이름을 알려주세요. 나머지는 AI가 준비해드릴게요.
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-mute">
          웹, SNS에서 찾은 정보를 기준으로 소개 초안을 준비해드려요. 찾아온 정보는 언제든 자유롭게 수정할 수 있어요.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
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

      {/* AI 불러오기(위) ↔ 직접 입력(아래) 구분 소제목 */}
      <div className="mt-10 flex items-center gap-3">
        <div className="h-px flex-1 bg-hairline" />
        <span className="shrink-0 text-sm font-medium text-mute">
          또는 아래에 직접 입력 할 수 있어요.
        </span>
        <div className="h-px flex-1 bg-hairline" />
      </div>

      <div className="mt-8 space-y-8">
        {/* 검수 게이트 배너 — AI가 채운 직후 */}
        {reviewMode && (
          <div className="rounded-lg border border-primary bg-surface px-4 py-3 shadow-e1">
            <p className="text-[15px] font-medium text-ink">
              ✨ 온라인 정보와 SNS를 참고해서 브랜드를 분석해봤어요.
            </p>
            <p className="mt-0.5 text-sm text-mute">
              맞는지 확인하고 자유롭게 고쳐주세요. 못 찾은 곳은 직접 채우면 돼요.
            </p>
          </div>
        )}

        {/* ── 그룹 A. 정체성 ── */}
        <GroupHeader n="①" title="브랜드 소개" />
        <div className="space-y-7">
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

          {/* 브랜드 사진 (선택) */}
          <div>
            <label className="mb-1 block text-base font-medium text-body">
              브랜드 사진 (선택)
            </label>
            <p className="mb-2.5 text-[15px] text-mute">
              콜라보 카드에 담을 사진을 올려주세요.
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

          {/* 분위기칩 — 우리를 표현하는 말 */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-lg font-bold text-ink">
              <span>우리 브랜드를 표현하는 말</span>
              {aiFilled.has("values") && <AiBadge />}
              <span className="ml-auto text-xs font-normal text-mute">
                {values.length} / {MAX_VIBES}
              </span>
            </label>
            <p className="mb-4 text-[15px] text-mute">
              브랜드와 어울리는 단어를 선택해주세요. 직접 추가도 가능해요. 최대 10개
            </p>
            <div className="space-y-4">
              {VIBE_CATEGORIES.map((cat, i) => (
                <div
                  key={cat.label}
                  className={i > 0 ? "border-t border-hairline pt-4" : ""}
                >
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-body">
                    <span className="h-1.5 w-1.5 rounded-full bg-mint" />
                    {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.words.map((v) => {
                      const on = values.includes(v);
                      const full = !on && values.length >= MAX_VIBES;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleVibe(v)}
                          disabled={full}
                          className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                            on
                              ? "border-primary bg-primary-tint text-primary-on"
                              : "border-hairline bg-surface text-mute"
                          } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                        >
                          {v}
                          {on ? " ✓" : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {/* 직접 추가한 칩 (추천 목록에 없는 것) */}
            {values.some((v) => !ALL_VIBES.includes(v)) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {values
                  .filter((v) => !ALL_VIBES.includes(v))
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
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={customVibe}
                onChange={(e) => setCustomVibe(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomVibe();
                  }
                }}
                placeholder="직접 더하기 (예: 아날로그)"
                disabled={values.length >= MAX_VIBES}
                className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
              />
              <button
                type="button"
                onClick={addCustomVibe}
                disabled={values.length >= MAX_VIBES}
                className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
              >
                추가
              </button>
            </div>
          </div>

          {/* 소개 — 브랜드를 소개해주세요 */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-base font-medium text-body">
                <span>브랜드를 소개해주세요.</span>
                {aiFilled.has("description") && <AiBadge />}
              </label>
              <button
                type="button"
                onClick={draftDescription}
                disabled={!canDraft || draftBusy}
                className="inline-flex h-7 items-center gap-1 rounded-pill border border-primary bg-primary-pale px-2.5 text-sm font-medium text-primary-on disabled:opacity-40"
              >
                {draftBusy
                  ? "쓰는 중…"
                  : draftGenerated
                    ? "✨ 초안 다시 받기"
                    : "✨ 초안 받기"}
              </button>
            </div>
            <div className="relative">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={draftBusy}
                placeholder="버려지는 천에 새 이야기를 입히는 패브릭 브랜드."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2 text-base text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-60"
              />
              {draftBusy && (
                <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-surface/80 backdrop-blur-[1px]">
                  <p className="flex items-center gap-2 text-sm font-medium text-primary-on">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    온라인 정보를 살펴 소개를 쓰고 있어요…
                  </p>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-sm text-mute">
              {draftGenerated
                ? "‘초안 다시 받기’를 누르면 다른 느낌의 소개로 새로 써드려요."
                : "‘초안 받기’를 누르면 입력한 정보로 소개를 대신 써드려요. 그대로 써도, 더 다듬어도 좋아요."}
            </p>
          </div>
        </div>

        {/* ── 그룹 B. 콜라보 ── */}
        <GroupHeader n="②" title="콜라보" sub="어떻게 함께해요" />
        <div className="space-y-7">
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

          {/* 함께한 콜라보 (이력) */}
          <div>
            <label className="mb-1 flex items-center gap-2 text-base font-medium text-body">
              <span>함께한 콜라보</span>
              <span className="text-sm font-normal text-faint">선택 · 최대 3개</span>
            </label>
            <p className="mb-2.5 text-[15px] text-mute">
              지난 콜라보를 더하면 “검증된 파트너”라는 신호가 돼요.
            </p>

            {collabHistory.length > 0 && (
              <div className="mb-2 space-y-2">
                {collabHistory.map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-md bg-surface-soft px-3 py-2"
                  >
                    <span className="text-sm text-ink">
                      <span className="font-medium">{h.partner}</span>
                      {h.types.length > 0 && (
                        <span className="text-mute"> · {h.types.join("·")}</span>
                      )}
                      {h.year && <span className="text-mute"> · {h.year}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeHistory(i)}
                      aria-label="이력 삭제"
                      className="text-faint hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {histDraft !== null ? (
              <div className="space-y-3 rounded-md border border-border-strong bg-surface p-3">
                <input
                  value={histDraft.partner}
                  onChange={(e) =>
                    setHistDraft((d) => (d ? { ...d, partner: e.target.value } : d))
                  }
                  autoFocus
                  placeholder="함께한 곳 (예: 오월의숲)"
                  className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                />
                <div>
                  <p className="mb-1.5 text-sm text-mute">어떤 콜라보였나요?</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLLAB_TYPES.map((t) => {
                      const on = histDraft.types.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleHistType(t)}
                          className={`inline-flex h-7 items-center rounded-pill border px-2.5 text-sm transition-colors ${
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
                    {histDraft.types
                      .filter((t) => !COLLAB_TYPES.includes(t as CollabType))
                      .map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleHistType(t)}
                          className="inline-flex h-7 items-center rounded-pill border border-primary bg-primary-tint px-2.5 text-sm text-primary-on"
                        >
                          {t} ✕
                        </button>
                      ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={histCustomType}
                      onChange={(e) => setHistCustomType(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          addHistCustomType();
                        }
                      }}
                      placeholder="유형 직접 더하기"
                      className="h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    <button
                      type="button"
                      onClick={addHistCustomType}
                      className="h-9 rounded-sm border border-border-strong bg-surface px-3 text-sm font-medium text-ink"
                    >
                      추가
                    </button>
                  </div>
                </div>
                <select
                  value={histDraft.year}
                  onChange={(e) =>
                    setHistDraft((d) => (d ? { ...d, year: e.target.value } : d))
                  }
                  className="h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none focus:border-focus"
                >
                  <option value="">시기 (선택)</option>
                  {HISTORY_YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addHistory}
                    disabled={!histDraft.partner.trim()}
                    className="h-10 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-40"
                  >
                    추가
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHistDraft(null);
                      setHistCustomType("");
                    }}
                    className="h-10 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : collabHistory.length < 3 ? (
              <button
                type="button"
                onClick={() => setHistDraft({ partner: "", types: [], year: "" })}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface py-2.5 text-sm text-mute"
              >
                ＋ {collabHistory.length === 0 ? "콜라보 경험이 있으신가요?" : "직접 입력하기"}
              </button>
            ) : null}

            {collabHistory.length === 0 && histDraft === null && (
              <p className="mt-2 text-sm text-faint">
                아직 콜라보 경험이 없어요 — 카드에 그대로 표시돼요.
              </p>
            )}
          </div>

          {/* 이런 분들과 만나요 (타겟 고객) */}
          <div>
            <label className="mb-1 block text-base font-medium text-body">
              이런 분들과 만나요
            </label>
            <p className="mb-2.5 text-[15px] text-mute">
              우리 고객층이에요. 수신자가 “내 손님과 결이 맞나” 가늠하는 핵심이에요.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_AUDIENCE.map((a) => {
                const on = targetAudience.includes(a);
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary-tint text-primary-on"
                        : "border-hairline bg-surface text-mute"
                    }`}
                  >
                    {a}
                    {on ? " ✓" : ""}
                  </button>
                );
              })}
              {targetAudience
                .filter((a) => !SUGGESTED_AUDIENCE.includes(a))
                .map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAudience(a)}
                    className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
                  >
                    {a} ✕
                  </button>
                ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customAudience}
                onChange={(e) => setCustomAudience(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addCustomAudience();
                  }
                }}
                placeholder="직접 더하기 (예: 신혼부부)"
                className="h-10 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <button
                type="button"
                onClick={addCustomAudience}
                className="h-10 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
              >
                추가
              </button>
            </div>
          </div>
        </div>

        {/* ── 그룹 C. 신뢰·연결 ── */}
        <GroupHeader n="③" title="신뢰·연결" sub="어디서 만나요" />
        <div className="space-y-7">
          <Field label="주소" hint={hintFor("address", "address")}>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울 성동구 성수동"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {region && (
              <p className="mt-1 text-sm text-mute">
                지역 자동 인식: <span className="text-body">{region}</span>
              </p>
            )}
          </Field>
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

        <div className="space-y-2">
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-40"
          >
            {pending ? "만드는 중…" : "콜라보 카드 등록하기"}
          </button>
          <p className="text-center text-sm text-mute">
            등록 후에는 콜라보 카드를 다운로드·공유할 수 있어요.
          </p>
        </div>
      </div>

      {/* 딸깍 자동완성 위저드 — 로딩·후보확인·인스타/홈피·재크롤링·항목선택 */}
      {wizardOpen && (
        <EnrichWizard
          query={query.trim()}
          onClose={() => setWizardOpen(false)}
          onApply={applyWizard}
        />
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
            <p className="mt-3 text-sm text-faint">
              소개서는 내 프로필에서 언제든 다운로드할 수 있어요
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function GroupHeader({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-hairline pb-2">
      <span className="rounded-pill bg-primary-tint px-2 py-0.5 text-sm font-bold text-primary-on">
        {n}
      </span>
      <span className="text-[17px] font-bold text-ink">{title}</span>
      {sub && <span className="text-sm text-mute">{sub}</span>}
    </div>
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
      <label className="mb-2 flex items-center gap-2 text-base font-medium text-body">
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
      ✨ 미리 채웠어요
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
