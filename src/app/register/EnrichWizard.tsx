"use client";

// 딸깍 자동완성 위저드 (2026-07-01 재설계 v2):
//  ① 가중 키워드 입력(뱃지 max 4) — 동시에 백그라운드로 브랜드명 크롤링 시작(#3 로딩 체감↓)
//  ② 개별 필드 확인·수정(상호·주소·인스타·홈피)
//  ③ 한 줄 소개 5지선다(택1 + 직접 수정)
//  ④ 브랜드 소개 5지선다(택1 + 직접 수정) → 폼 반영
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

// 진행 단계: 키워드 → (로딩) → 필드 → 한줄소개 → 브랜드소개
type Kind = "keywords" | "loading" | "fields" | "oneLiner" | "desc" | "error";
const STEP_ORDER: Kind[] = ["fields", "oneLiner", "desc"];

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
  const [intro, setIntro] = useState(""); // 사장이 직접 쓴 한두 문장(생성의 중심축)
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");
  const [options, setOptions] = useState<EnrichOptions | null>(null);
  const [errMsg, setErrMsg] = useState("");

  // 개별 필드(수정 가능)
  const [fName, setFName] = useState("");
  const [fAddress, setFAddress] = useState("");
  const [fInstagram, setFInstagram] = useState("");
  const [fHomepage, setFHomepage] = useState("");
  // 5지선다 선택값(직접 수정 가능)
  const [pickOne, setPickOne] = useState("");
  const [pickDesc, setPickDesc] = useState("");

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
        body: JSON.stringify({
          mode: "options",
          name: query,
          research,
          focusKeywords: keywords,
          ownerNote: intro.trim() || undefined,
        }),
      });
      const d = await r.json();
      const o: EnrichOptions | null = d.options ?? null;
      if (!o || (!o.oneLiners.length && !o.descriptions.length)) {
        setErrMsg(d.error || "정보를 충분히 못 찾았어요. 직접 입력해 주세요.");
        setKind("error");
        return;
      }
      setOptions(o);
      setFName(o.identity.name || query);
      setFAddress(o.identity.address || "");
      setFInstagram(o.identity.instagram || "");
      setFHomepage(o.identity.homepage || "");
      setPickOne(o.oneLiners[0] ?? "");
      setPickDesc(o.descriptions[0] ?? "");
      setKind("fields");
    } catch {
      setErrMsg("불러오기에 실패했어요. 잠시 후 다시 시도해 주세요.");
      setKind("error");
    }
  };

  const stepIdx = STEP_ORDER.indexOf(kind);
  const goNext = () => stepIdx >= 0 && stepIdx < STEP_ORDER.length - 1 && setKind(STEP_ORDER[stepIdx + 1]);
  const goBack = () => stepIdx > 0 && setKind(STEP_ORDER[stepIdx - 1]);

  const apply = () => {
    onApply({
      name: fName.trim() || query || undefined,
      oneLiner: pickOne.trim() || undefined,
      description: pickDesc.trim() || undefined,
      address: fAddress.trim() || undefined,
      instagram: fInstagram.trim() || undefined,
      homepage: fHomepage.trim() || undefined,
      values: options?.values.length ? options.values : undefined,
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

        {/* 진행 단계 표시 + 뒤로 */}
        {stepIdx >= 0 && (
          <div className="mb-3 flex items-center gap-2 pr-8">
            {stepIdx > 0 && (
              <button
                type="button"
                onClick={goBack}
                className="-ml-1 inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
              >
                ← 뒤로
              </button>
            )}
            <span className="ml-auto text-xs font-medium text-mute">
              {stepIdx + 1} / {STEP_ORDER.length}
            </span>
          </div>
        )}

        {kind === "loading" && <LoadingView name={query} />}

        {kind === "error" && (
          <div className="pt-4 text-center">
            <p className="text-lg font-bold text-ink">앗, 자동으로 못 채웠어요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">{errMsg}</p>
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
            <p className="pr-8 text-lg font-bold text-ink">소개의 방향을 함께 정해볼까요?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">
              몇 줄만 적어주시면, 그 내용을 바탕으로 브랜드 소개 초안을 만들어드려요.
            </p>

            {/* 사장 핵심 설명 — 생성의 중심축 */}
            <div className="mt-5">
              <label className="mb-2 block text-[15px] font-semibold text-body">
                브랜드를 짧게 소개해주세요.
              </label>
              <textarea
                value={intro}
                onChange={(e) => setIntro(e.target.value)}
                rows={3}
                placeholder="예: 버려지는 천으로 가방을 만드는 업사이클링 브랜드예요. 직접 만드는 워크숍도 함께 운영하고 있어요."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus"
              />
              <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
                한두 문장이면 충분해요. 적어주실수록 브랜드에 더 잘 맞는 소개를 만들어드릴 수 있어요.
              </p>
            </div>

            {/* 가중 키워드 */}
            <label className="mb-2 mt-6 block text-[15px] font-semibold text-body">
              강조할 키워드 <span className="font-normal text-faint">· 선택 · 최대 {MAX_KEYWORDS}개</span>
            </label>
            <div className="flex flex-wrap gap-2">
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
              {intro.trim() || keywords.length ? "이 방향으로 찾기" : "그냥 찾아주세요"}
            </button>
          </div>
        )}

        {/* 스텝 1 — 개별 필드 확인·수정 */}
        {kind === "fields" && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">찾은 정보가 맞나요?</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">틀리면 바로 고쳐주세요. 빈 칸은 건너뛰어도 돼요.</p>
            <div className="mt-4 space-y-3">
              <FieldEdit label="상호" value={fName} onChange={setFName} placeholder="예: 캔버스가든" />
              <FieldEdit label="주소" value={fAddress} onChange={setFAddress} placeholder="예: 서울 성동구 성수동" />
              <FieldEdit label="인스타그램" value={fInstagram} onChange={setFInstagram} placeholder="@handle" />
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

        {/* 스텝 2 — 한 줄 소개 5지선다 */}
        {kind === "oneLiner" && options && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">한 줄 소개를 골라주세요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">고른 뒤 아래에서 직접 다듬어도 돼요.</p>
            <div className="mt-4 max-h-[42vh] overflow-y-auto pr-0.5">
              <OptionPicker items={options.oneLiners} value={pickOne} onChange={setPickOne} />
            </div>
            <button
              onClick={goNext}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              다음 · 브랜드 소개 고르기
            </button>
          </div>
        )}

        {/* 스텝 3 — 브랜드 소개 5지선다 */}
        {kind === "desc" && options && (
          <div>
            <p className="pr-8 text-lg font-bold text-ink">브랜드 소개를 골라주세요</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-mute">고른 뒤 아래에서 직접 다듬어도 돼요.</p>
            <div className="mt-4 max-h-[42vh] overflow-y-auto pr-0.5">
              <OptionPicker items={options.descriptions} value={pickDesc} onChange={setPickDesc} multiline />
            </div>
            <button
              onClick={apply}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              선택한 내용으로 채우기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 개별 필드 — 라벨 + 수정 가능한 입력
function FieldEdit({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[15px] font-medium text-body">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
      />
    </div>
  );
}

// 5지선다 + 선택값 직접 수정(AI 초안 → 사장 보강)
function OptionPicker({
  items,
  value,
  onChange,
  multiline,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const custom = value.trim().length > 0 && !items.includes(value);
  return (
    <div>
      <div className="space-y-2">
        {items.map((it, i) => {
          const on = value === it;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChange(it)}
              className={`flex w-full items-start gap-2.5 rounded-md border px-3 py-3 text-left text-[15px] transition-colors ${
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
      <div className="mt-3">
        <p className="mb-1.5 text-[13px] font-medium text-mute">
          고른 내용 · 직접 다듬어도 돼요{custom ? " (수정됨)" : ""}
        </p>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={4}
            className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-[15px] leading-relaxed text-ink outline-none focus:border-focus"
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-[15px] text-ink outline-none focus:border-focus"
          />
        )}
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
