"use client";

// 딸깍 자동완성 위저드 (2026-07-01 재설계):
//  ① 가중 키워드 입력(뱃지 max 4) — 동시에 백그라운드로 브랜드명 크롤링 시작(#3 로딩 체감↓)
//  ② 키워드 제출 → 크롤 완료 대기 → 키워드 가중 5지선다 생성
//  ③ 한 줄 소개·브랜드 소개를 각각 5개 중 택1 → 폼 반영
import { useEffect, useRef, useState } from "react";
import type { EnrichOptions } from "@/lib/enrich";
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
};

const SUGGESTED_KEYWORDS = [
  "친환경",
  "핸드메이드",
  "로컬",
  "감성",
  "프리미엄",
  "스토리",
  "실용성",
  "지속가능",
];
const MAX_KEYWORDS = 4;

type Kind = "keywords" | "loading" | "options" | "error";

export function EnrichWizard({
  query,
  onClose,
  onApply,
}: {
  query: string;
  onClose: () => void;
  onApply: (fill: WizardFill) => void;
}) {
  const [kind, setKind] = useState<Kind>("keywords");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [options, setOptions] = useState<EnrichOptions | null>(null);
  const [pickOne, setPickOne] = useState(""); // 선택한 한 줄 소개
  const [pickDesc, setPickDesc] = useState(""); // 선택한 브랜드 소개
  const [errMsg, setErrMsg] = useState("");

  // 백그라운드 크롤: 열리자마자 브랜드명으로 조사 시작(사용자가 키워드 고르는 동안 진행 → 체감 속도↑)
  const researchRef = useRef<Promise<string> | null>(null);
  useEffect(() => {
    researchRef.current = fetch("/api/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "research", name: query }),
    })
      .then((r) => r.json())
      .then((d) => (typeof d.research === "string" ? d.research : ""))
      .catch(() => "");
  }, [query]);

  const toggleKw = (k: string) =>
    setKeywords((p) =>
      p.includes(k) ? p.filter((x) => x !== k) : p.length >= MAX_KEYWORDS ? p : [...p, k]
    );
  const addKw = () => {
    const v = kwInput.trim();
    if (v && !keywords.includes(v) && keywords.length < MAX_KEYWORDS) setKeywords((p) => [...p, v]);
    setKwInput("");
  };

  const runOptions = async () => {
    setKind("loading");
    try {
      const research = (await researchRef.current) ?? "";
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "options", name: query, research, focusKeywords: keywords }),
      });
      const d = await r.json();
      const o: EnrichOptions | null = d.options ?? null;
      if (!o || (!o.oneLiners.length && !o.descriptions.length)) {
        setErrMsg(d.error || "정보를 충분히 못 찾았어요. 직접 입력해 주세요.");
        setKind("error");
        return;
      }
      setOptions(o);
      setPickOne(o.oneLiners[0] ?? "");
      setPickDesc(o.descriptions[0] ?? "");
      setKind("options");
    } catch {
      setErrMsg("불러오기에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setKind("error");
    }
  };

  const apply = () => {
    if (!options) return;
    const id = options.identity;
    onApply({
      name: id.name || query || undefined,
      oneLiner: pickOne || undefined,
      description: pickDesc || undefined,
      region: id.region,
      address: id.address,
      instagram: id.instagram,
      homepage: id.homepage,
      values: options.values.length ? options.values : undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
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

        {kind === "loading" && <LoadingView name={query} />}

        {kind === "error" && (
          <div className="pt-4 text-center">
            <p className="text-base font-bold text-ink">앗, 자동으로 못 채웠어요</p>
            <p className="mt-1 text-sm text-mute">{errMsg}</p>
            <button
              onClick={onClose}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              직접 입력할게요
            </button>
          </div>
        )}

        {kind === "keywords" && (
          <div>
            <p className="pr-8 text-base font-bold text-ink">어떤 점을 강조할까요?</p>
            <p className="mt-1 text-sm text-mute">
              골라주신 키워드를 중심으로 소개를 찾아드려요. 건너뛰어도 괜찮아요.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGESTED_KEYWORDS.map((k) => {
                const on = keywords.includes(k);
                const full = !on && keywords.length >= MAX_KEYWORDS;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKw(k)}
                    disabled={full}
                    className={`inline-flex h-9 items-center rounded-pill border px-3.5 text-sm transition-colors ${
                      on
                        ? "border-primary bg-primary-tint text-primary-on"
                        : "border-hairline bg-surface text-mute"
                    } ${full ? "cursor-not-allowed opacity-40" : ""}`}
                  >
                    {k}
                    {on ? " ✓" : ""}
                  </button>
                );
              })}
              {keywords
                .filter((k) => !SUGGESTED_KEYWORDS.includes(k))
                .map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleKw(k)}
                    className="inline-flex h-9 items-center rounded-pill border border-primary bg-primary-tint px-3.5 text-sm text-primary-on"
                  >
                    {k} ✕
                  </button>
                ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    addKw();
                  }
                }}
                placeholder="직접 더하기 (예: 반려동물)"
                disabled={keywords.length >= MAX_KEYWORDS}
                className="h-11 flex-1 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus disabled:opacity-40"
              />
              <button
                type="button"
                onClick={addKw}
                disabled={keywords.length >= MAX_KEYWORDS}
                className="h-11 shrink-0 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-ink disabled:opacity-40"
              >
                추가
              </button>
            </div>
            <p className="mt-2 text-xs text-mute">
              {keywords.length} / {MAX_KEYWORDS} · 그동안 {query}
              {josa(query, "을", "를")} 미리 찾고 있어요
            </p>
            <button
              onClick={runOptions}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              {keywords.length ? "이 방향으로 찾기" : "그냥 찾아주세요"}
            </button>
          </div>
        )}

        {kind === "options" && options && (
          <div>
            <p className="pr-8 text-base font-bold text-ink">
              {options.identity.name || query}
            </p>
            {(options.identity.address || options.identity.region) && (
              <p className="mt-0.5 text-sm text-mute">
                {options.identity.address || options.identity.region}
              </p>
            )}
            <div className="mt-4 max-h-[52vh] space-y-5 overflow-y-auto pr-0.5">
              <OptionGroup title="한 줄 소개" items={options.oneLiners} value={pickOne} onPick={setPickOne} />
              <OptionGroup
                title="브랜드 소개"
                items={options.descriptions}
                value={pickDesc}
                onPick={setPickDesc}
                multiline
              />
            </div>
            <button
              onClick={apply}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              선택한 내용으로 채우기
            </button>
            <p className="mt-2 text-center text-xs text-mute">
              고른 내용은 폼에서 자유롭게 다듬을 수 있어요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// 5지선다 한 그룹 — 라디오처럼 하나만 선택
function OptionGroup({
  title,
  items,
  value,
  onPick,
  multiline,
}: {
  title: string;
  items: string[];
  value: string;
  onPick: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-body">
        {title} <span className="font-normal text-faint">· 하나 골라주세요</span>
      </p>
      <div className="space-y-2">
        {items.map((it, i) => {
          const on = value === it;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(it)}
              className={`flex w-full items-start gap-2.5 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${
                on
                  ? "border-primary bg-primary-pale text-ink"
                  : "border-hairline bg-surface text-body hover:bg-surface-soft"
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-pill border text-[10px] font-bold ${
                  on ? "border-primary bg-primary text-primary-on" : "border-border-strong text-transparent"
                }`}
              >
                ✓
              </span>
              <span className={multiline ? "leading-relaxed" : "line-clamp-1"}>{it}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 아톰 마크 + 순환 메시지 로딩 (회전 X = 어지럼 방지)
const LOADING_STEPS = [
  "웹에서 정보를 모으는 중…",
  "인스타·홈페이지를 살펴보는 중…",
  "브랜드의 분위기를 읽는 중…",
  "소개 후보를 다듬는 중…",
];
function LoadingView({ name }: { name: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % LOADING_STEPS.length), 2000);
    return () => clearInterval(t);
  }, []);
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
        {name ? `${name}${josa(name, "을", "를")} 살펴보는 중이에요` : "브랜드를 살펴보는 중이에요"}
      </p>
      <p className="mt-1.5 text-sm text-mute">{LOADING_STEPS[i]}</p>
    </div>
  );
}
