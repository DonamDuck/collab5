"use client";

// 딸깍 자동완성 위저드 — 업체명 → 크롤링 → 후보확인 → (인스타/홈피 옵셔널) → 재크롤링 → 항목선택 → 폼 반영.
// mock 기반(ENRICH_FORCE_MOCK). 실제 API 연결은 비용 최적화 후. 정책: master-brain 2026-06-24.
import { useEffect, useRef, useState } from "react";
import type { EnrichCandidate } from "@/lib/enrich";

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

type FieldKey = keyof WizardFill;
const FIELD_ROWS: { key: FieldKey; label: string }[] = [
  { key: "name", label: "상호" },
  { key: "oneLiner", label: "한 줄 소개" },
  { key: "region", label: "지역" },
  { key: "address", label: "주소" },
  { key: "instagram", label: "인스타그램" },
  { key: "homepage", label: "홈페이지" },
  { key: "values", label: "분위기" },
  { key: "description", label: "소개" },
];

// 로딩 순환 메시지 (2단계 파이프라인 반영)
const ENRICH_STEPS = [
  "웹에서 정보를 모으는 중…",
  "인스타·홈페이지를 살펴보는 중…",
  "브랜드의 분위기를 읽는 중…",
  "카드로 담는 중…",
];

function fillFromCandidate(c: EnrichCandidate): WizardFill {
  return {
    name: c.name || undefined,
    oneLiner: c.oneLiner || undefined,
    region: c.region,
    address: c.address,
    instagram: c.instagram,
    homepage: c.homepage,
    values: c.values?.length ? c.values : undefined,
    description: c.description || undefined,
  };
}

type Kind = "loading" | "pick" | "askIg" | "askHp" | "recrawl" | "fields" | "error";

export function EnrichWizard({
  query,
  onClose,
  onApply,
}: {
  query: string;
  onClose: () => void;
  onApply: (fill: WizardFill, filledKeys: string[]) => void;
}) {
  const [kind, setKind] = useState<Kind>("loading");
  const [candidates, setCandidates] = useState<EnrichCandidate[]>([]);
  const [cand, setCand] = useState<EnrichCandidate | null>(null);
  const [igInput, setIgInput] = useState("");
  const [hpInput, setHpInput] = useState("");
  const [addedIg, setAddedIg] = useState(false);
  const [picks, setPicks] = useState<Record<string, boolean>>({}); // 채울지 여부
  const [edited, setEdited] = useState<Record<string, string>>({}); // 텍스트 항목 수정값
  const [vibes, setVibes] = useState<string[]>([]); // 분위기 칩 선택 상태
  const [vibeInput, setVibeInput] = useState(""); // 분위기 직접 추가
  const [editingKey, setEditingKey] = useState<string | null>(null); // 인라인 편집 중인 항목
  const [history, setHistory] = useState<Kind[]>([]); // 뒤로가기 스택(6번)
  const [errMsg, setErrMsg] = useState("");
  const started = useRef(false);

  // 단계 전환: 현재 단계를 히스토리에 쌓는다(로딩 단계는 제외 — 자동 전환이라 뒤로 대상 아님)
  const advance = (next: Kind) => {
    setHistory((h) => (kind === "loading" || kind === "recrawl" ? h : [...h, kind]));
    setKind(next);
  };
  const back = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const nh = [...h];
      setKind(nh.pop()!);
      return nh;
    });
  };

  // 시작: 1차 크롤링
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const r = await fetch("/api/enrich", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        const d = await r.json();
        if (d.error || !d.candidates?.length) {
          setErrMsg(d.error || "웹에서 정보를 충분히 못 찾았어요. 직접 입력해 주세요.");
          setKind("error");
          return;
        }
        setCandidates(d.candidates);
        setKind("pick");
      } catch {
        setErrMsg("불러오기에 실패했어요. 잠시 후 다시 시도해 주세요.");
        setKind("error");
      }
    })();
  }, [query]);

  const enterFields = (c: EnrichCandidate) => {
    const fill = fillFromCandidate(c);
    const init: Record<string, boolean> = {};
    const ed: Record<string, string> = {};
    FIELD_ROWS.forEach(({ key }) => {
      if (fill[key] !== undefined) {
        init[key] = true; // 기본 전부 선택
        if (key !== "values") ed[key] = String(fill[key]);
      }
    });
    setPicks(init);
    setEdited(ed);
    setVibes(fill.values ?? []);
    setVibeInput("");
    setEditingKey(null);
    setCand(c);
    advance("fields");
  };

  const doRecrawl = async (c: EnrichCandidate) => {
    setKind("recrawl");
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "recrawl",
          name: c.name,
          instagram: c.instagram,
          homepage: c.homepage,
        }),
      });
      const d = await r.json();
      enterFields(d.candidate ?? c);
    } catch {
      enterFields(c); // 재크롤 실패해도 1차 결과로 진행
    }
  };

  // 후보 선택 → 인스타/홈피 체크
  const pickCandidate = (c: EnrichCandidate) => {
    setCand(c);
    setAddedIg(false);
    if (!c.instagram) {
      setIgInput("");
      advance("askIg");
      return;
    }
    if (!c.homepage) {
      setHpInput("");
      advance("askHp");
      return;
    }
    enterFields(c); // 둘 다 있으면 재크롤 없이 항목선택
  };

  const afterIg = (ig: string | null) => {
    const base = cand!;
    let c = base;
    if (ig) {
      c = { ...base, instagram: ig.startsWith("@") ? ig : `@${ig}` };
      setCand(c);
      setAddedIg(true);
    }
    if (!c.homepage) {
      setHpInput("");
      advance("askHp");
      return;
    }
    if (ig) doRecrawl(c);
    else enterFields(c);
  };

  const afterHp = (hp: string | null) => {
    const base = cand!;
    let c = base;
    if (hp) {
      c = { ...base, homepage: hp };
      setCand(c);
    }
    if (hp || addedIg) doRecrawl(c);
    else enterFields(c);
  };

  const togglePick = (k: string) => setPicks((p) => ({ ...p, [k]: !p[k] }));
  const toggleVibe = (v: string) =>
    setVibes((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const addVibe = () => {
    const v = vibeInput.trim();
    if (v && !vibes.includes(v)) setVibes((p) => [...p, v]);
    setVibeInput("");
  };

  const apply = () => {
    if (!cand) return;
    const fill = fillFromCandidate(cand);
    const out: WizardFill = {};
    FIELD_ROWS.forEach(({ key }) => {
      if (!picks[key] || fill[key] === undefined) return;
      if (key === "values") {
        if (vibes.length) out.values = vibes;
      } else {
        const v = (edited[key] ?? String(fill[key])).trim();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (v) (out as any)[key] = v;
      }
    });
    onApply(out, Object.keys(out));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-hairline bg-surface p-5 shadow-e2"
        onClick={(e) => e.stopPropagation()}
      >
        {history.length > 0 &&
          (kind === "pick" || kind === "askIg" || kind === "askHp" || kind === "fields") && (
            <button
              type="button"
              onClick={back}
              className="mb-3 -ml-1 inline-flex items-center gap-1 text-xs font-medium text-mute hover:text-ink"
            >
              ← 뒤로
            </button>
          )}
        {kind === "loading" && <LoadingView name={query} />}
        {kind === "recrawl" && <LoadingView name={query} deep />}

        {kind === "error" && (
          <div className="text-center">
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

        {kind === "pick" && (
          <div>
            <p className="text-base font-bold text-ink">어느 곳이 맞나요?</p>
            <p className="mt-0.5 text-sm text-mute">
              {candidates.length === 1
                ? "이 곳이 맞는지 확인해 주세요."
                : `같은 이름을 ${candidates.length}곳 찾았어요. 맞는 곳을 골라주세요.`}
            </p>
            <div className="mt-4 space-y-2">
              {candidates.map((c, i) => {
                // 식별 정보 조합: 지역/주소 · 업종(한줄) → SNS/홈피. 상호만 있으면 헷갈리니 함께 보여줌.
                const idLine =
                  [c.region || c.address, c.oneLiner].filter(Boolean).join(" · ") || c.hint;
                const link = [c.instagram, c.homepage?.replace(/^https?:\/\//, "")]
                  .filter(Boolean)
                  .join("  ·  ");
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pickCandidate(c)}
                    className="block w-full rounded-md border border-hairline bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-soft"
                  >
                    <p className="text-[15px] font-medium text-ink">{c.name}</p>
                    {idLine && (
                      <p className="mt-0.5 text-sm text-mute line-clamp-2">{idLine}</p>
                    )}
                    {link && <p className="mt-0.5 text-xs text-faint">{link}</p>}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={onClose}
                className="block w-full rounded-md px-4 py-3 text-center text-sm text-mute"
              >
                직접 입력할게요
              </button>
            </div>
          </div>
        )}

        {kind === "askIg" && (
          <AskView
            title="인스타그램 계정이 있나요?"
            sub="핸들을 알려주시면 더 많은 정보를 찾는 데 도움이 돼요!"
            placeholder="@handle"
            value={igInput}
            onChange={setIgInput}
            onSubmit={() => afterIg(igInput.trim() || null)}
            onSkip={() => afterIg(null)}
          />
        )}

        {kind === "askHp" && (
          <AskView
            title="홈페이지가 있나요?"
            sub="주소를 알려주시면 더 정확하게 정리해드려요!"
            placeholder="https://"
            value={hpInput}
            onChange={setHpInput}
            onSubmit={() => afterHp(hpInput.trim() || null)}
            onSkip={() => afterHp(null)}
          />
        )}

        {kind === "fields" && cand && (
          <div>
            <p className="text-base font-bold text-ink">이 정보들을 채울까요?</p>
            <p className="mt-0.5 text-sm text-mute">
              체크한 항목만 폼에 담을게요. 수정 버튼으로 바로 고칠 수도 있어요.
            </p>
            <div className="mt-4 max-h-[44vh] space-y-1.5 overflow-y-auto pr-0.5">
              {FIELD_ROWS.map(({ key, label }) => {
                const fill = fillFromCandidate(cand);
                if (fill[key] === undefined) return null;
                const on = !!picks[key];
                const isVibes = key === "values";
                const editing = editingKey === key;
                return (
                  <div
                    key={key}
                    className={`rounded-md border transition-colors ${
                      on ? "border-primary bg-primary-pale" : "border-hairline bg-surface"
                    }`}
                  >
                    <div className="flex items-start gap-2.5 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => togglePick(key)}
                        aria-label={on ? "제외" : "포함"}
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px] font-bold ${
                          on
                            ? "border-primary bg-primary text-primary-on"
                            : "border-border-strong text-transparent"
                        }`}
                      >
                        ✓
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-mute">{label}</span>
                          {!isVibes && (
                            <button
                              type="button"
                              onClick={() => setEditingKey(editing ? null : key)}
                              className="text-[11px] font-medium text-primary-on underline-offset-2 hover:underline"
                            >
                              {editing ? "완료" : "수정"}
                            </button>
                          )}
                        </div>

                        {isVibes ? (
                          <div className="mt-1.5">
                            <div className="flex flex-wrap gap-1.5">
                              {vibes.map((v) => (
                                <button
                                  key={v}
                                  type="button"
                                  onClick={() => toggleVibe(v)}
                                  className="inline-flex h-7 items-center rounded-pill border border-primary bg-primary-tint px-2.5 text-xs text-primary-on"
                                >
                                  {v} ✕
                                </button>
                              ))}
                              {vibes.length === 0 && (
                                <span className="text-xs text-faint">아래에서 더해보세요</span>
                              )}
                            </div>
                            <div className="mt-1.5 flex gap-1.5">
                              <input
                                value={vibeInput}
                                onChange={(e) => setVibeInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                    e.preventDefault();
                                    addVibe();
                                  }
                                }}
                                placeholder="직접 더하기 (예: 아날로그)"
                                className="h-8 flex-1 rounded-sm border border-hairline bg-surface px-2.5 text-xs text-ink outline-none placeholder:text-faint focus:border-focus"
                              />
                              <button
                                type="button"
                                onClick={addVibe}
                                className="h-8 rounded-sm border border-border-strong bg-surface px-3 text-xs font-medium text-ink"
                              >
                                추가
                              </button>
                            </div>
                          </div>
                        ) : editing ? (
                          <input
                            value={edited[key] ?? ""}
                            onChange={(e) =>
                              setEdited((p) => ({ ...p, [key]: e.target.value }))
                            }
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                setEditingKey(null);
                              }
                            }}
                            className="mt-1 h-8 w-full rounded-sm border border-hairline bg-surface px-2.5 text-sm text-ink outline-none focus:border-focus"
                          />
                        ) : (
                          <span className="mt-0.5 block text-sm text-ink line-clamp-2">
                            {edited[key] || "—"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={apply}
              className="mt-4 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              선택한 정보로 채우기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// 아톰 마크 + 순환 메시지 로딩 (회전 X = 어지럼 방지). 디자인팀 시안 도착 시 교체(master-brain 멘션).
function LoadingView({ name, deep }: { name: string; deep?: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % ENRICH_STEPS.length), 2400);
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
        {deep ? "더 깊이 살펴보는 중…" : name ? `${name}을 살펴보는 중이에요` : "브랜드를 살펴보는 중이에요"}
      </p>
      <p className="mt-1.5 text-sm text-mute">
        {deep ? "인스타·홈페이지까지 함께 보고 있어요" : ENRICH_STEPS[i]}
      </p>
    </div>
  );
}

function AskView({
  title,
  sub,
  placeholder,
  value,
  onChange,
  onSubmit,
  onSkip,
}: {
  title: string;
  sub: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <p className="text-base font-bold text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-mute">{sub}</p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className="mt-4 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!value.trim()}
          className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-40"
        >
          이걸로 더 찾아보기
        </button>
        <button
          onClick={onSkip}
          className="h-11 rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-mute"
        >
          다음에 입력
        </button>
      </div>
    </div>
  );
}
