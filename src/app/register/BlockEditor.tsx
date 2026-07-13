"use client";
// 선택 블록 편집기 — 코어 ⑦과 ⑧ 사이. 카탈로그에서 골라 인라인 카드로 편집.
// 카드 = 공통 헤더(라벨 + ↑ ↓ 삭제) + 타입별 편집 UI + 공통 첨부(사진 최대3·링크 최대3).
import { useState } from "react";
import type { Block, BlockType, BlockLink } from "@/lib/types";
import { uploadPhoto } from "@/lib/upload";

const CATALOG: { type: BlockType; label: string; hint: string }[] = [
  { type: "metrics", label: "우리를 보여주는 숫자", hint: "팔로워, 월 방문, 누적 판매 등의 지표도 콜라보에 도움을 줄 수 있어요." },
  { type: "reviews", label: "고객들의 이야기", hint: "고객의 반응을 공유해보세요." },
  { type: "team", label: "만드는 사람들", hint: "콜라버 정보를 등록하면 더 가깝게 느껴질 수 있어요." },
  { type: "press", label: "소개된 곳들", hint: "수상이나 언론, 방송에 나온 적이 있다면요." },
  { type: "space", label: "우리의 공간", hint: "공간이 있다면, 그 자체가 매력이 돼요." },
  { type: "custom", label: "직접 만들기", hint: "소개 영역을 직접 구성해보세요." },
];
const MAX_CUSTOM = 2;

// space 기본 제안 특징 — 키워드칩(③) 토글 패턴, 직접 추가 가능.
const SPACE_FEATURES = ["대관 가능", "클래스 진행", "촬영 친화", "주차", "팝업 경험", "쇼룸"];

// register 폼과 동일한 인풋·텍스트에어리어 클래스(활동 카드 h-10 기준).
const inputCls =
  "h-10 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus";
const taCls =
  "w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-base leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus";

export function emptyBlock(type: BlockType): Block {
  const base = { uid: crypto.randomUUID(), photos: [] as string[], links: [] as BlockLink[] };
  switch (type) {
    case "metrics": return { ...base, type, items: [{ label: "", value: "" }] };
    case "reviews": return { ...base, type, items: [{ quote: "", source: "" }] };
    case "team": return { ...base, type, intro: "" };
    case "press": return { ...base, type, items: [{ title: "", year: "" }] };
    case "space": return { ...base, type, desc: "", features: [] };
    case "custom": return { ...base, type, title: "", body: "" };
  }
}

export function BlockEditor({ blocks, onChange, onUploadingChange }: {
  blocks: Block[];
  // 값 또는 업데이터 함수 모두 허용(React setState 호환) — 비동기 병합 시 최신 상태 사용.
  onChange: (b: Block[] | ((prev: Block[]) => Block[])) => void;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [, setUploading] = useState(0);
  const canAdd = (t: BlockType) =>
    t === "custom" ? blocks.filter((b) => b.type === "custom").length < MAX_CUSTOM
                   : !blocks.some((b) => b.type === t);
  const add = (t: BlockType) => { onChange([...blocks, emptyBlock(t)]); setOpen(false); };
  const remove = (i: number) => onChange(blocks.filter((_, k) => k !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  // 공통 필드(photos·links)만 patch. 타입별 필드는 setBlock으로 좁힌 뒤 통째 교체.
  const patch = (i: number, p: Partial<Block>) =>
    onChange(blocks.map((b, k) => (k === i ? ({ ...b, ...p } as Block) : b)));
  const setBlock = (i: number, nb: Block) =>
    onChange(blocks.map((b, k) => (k === i ? nb : b)));
  const addPhotos = async (i: number, files: FileList | null) => {
    const uid = blocks[i].uid; // await 후 배열이 바뀌어도 이 블록을 정확히 찾도록 캡처
    const room = 3 - blocks[i].photos.length;
    const list = Array.from(files ?? []).filter((f) => f.type.startsWith("image/")).slice(0, room);
    if (!list.length) return;
    setUploading((n) => { const v = n + 1; onUploadingChange?.(v > 0); return v; });
    try {
      const urls = await Promise.all(list.map((f) => uploadPhoto(f, 800)));
      onChange((prev) =>
        prev.map((b, k) =>
          (uid ? b.uid === uid : k === i) ? { ...b, photos: [...b.photos, ...urls] } : b
        )
      );
    } catch { alert("사진 업로드에 실패했어요. 다시 시도해주세요."); }
    finally { setUploading((n) => { const v = n - 1; onUploadingChange?.(v > 0); return v; }); }
  };
  const removePhoto = (i: number, k: number) =>
    patch(i, { photos: blocks[i].photos.filter((_, x) => x !== k) });
  // ── 링크(최대 3) ──
  const addLink = (i: number) => {
    if (blocks[i].links.length >= 3) return;
    patch(i, { links: [...blocks[i].links, { url: "", label: "" }] });
  };
  const setLink = (i: number, k: number, p: Partial<BlockLink>) =>
    patch(i, { links: blocks[i].links.map((l, x) => (x === k ? { ...l, ...p } : l)) });
  const removeLink = (i: number, k: number) =>
    patch(i, { links: blocks[i].links.filter((_, x) => x !== k) });

  return (
    <div className="space-y-4">
      {blocks.map((b, i) => {
        const cat = CATALOG.find((c) => c.type === b.type)!;
        return (
          <div key={b.uid ?? i} className="space-y-4 rounded-md border border-hairline bg-surface p-3">
            {/* 공통 헤더 — 라벨 + ↑ ↓ 삭제 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-body">{cat.label}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="위로"
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-mute hover:bg-surface-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === blocks.length - 1}
                  aria-label="아래로"
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-mute hover:bg-surface-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="ml-1 text-sm text-faint hover:text-ink"
                >
                  삭제
                </button>
              </div>
            </div>

            {/* ── 타입별 편집 UI ── */}
            {b.type === "custom" && (
              <div className="space-y-2.5">
                <input
                  value={b.title}
                  onChange={(e) => setBlock(i, { ...b, title: e.target.value })}
                  placeholder="제목 (예: 우리가 지키는 약속)"
                  className={inputCls}
                />
                <textarea
                  value={b.body}
                  onChange={(e) => setBlock(i, { ...b, body: e.target.value })}
                  rows={3}
                  placeholder="하고 싶은 이야기를 편하게 적어주세요."
                  className={taCls}
                />
              </div>
            )}

            {b.type === "metrics" && (
              <div className="space-y-2">
                {b.items.map((it, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      value={it.label}
                      onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, label: e.target.value } : x)) })}
                      placeholder="어떤 숫자인가요? 예: 인스타 팔로워"
                      className={inputCls}
                    />
                    <input
                      value={it.value}
                      onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, value: e.target.value } : x)) })}
                      placeholder="예: 1.2만"
                      className="h-10 w-28 shrink-0 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    {b.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBlock(i, { ...b, items: b.items.filter((_, y) => y !== k) })}
                        className="shrink-0 text-sm text-faint hover:text-ink"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                {b.items.length < 4 && (
                  <button
                    type="button"
                    onClick={() => setBlock(i, { ...b, items: [...b.items, { label: "", value: "" }] })}
                    className="rounded-sm border border-dashed border-border-strong bg-surface px-3 py-1.5 text-sm text-mute"
                  >
                    ＋ 추가
                  </button>
                )}
              </div>
            )}

            {b.type === "press" && (
              <div className="space-y-2">
                {b.items.map((it, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      value={it.title}
                      onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, title: e.target.value } : x)) })}
                      placeholder="예: 2025 서울디자인위크 참여"
                      className={inputCls}
                    />
                    <input
                      value={it.year ?? ""}
                      onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, year: e.target.value.replace(/\D/g, "").slice(0, 4) } : x)) })}
                      placeholder="연도"
                      inputMode="numeric"
                      maxLength={4}
                      className="h-10 w-20 shrink-0 rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    {b.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBlock(i, { ...b, items: b.items.filter((_, y) => y !== k) })}
                        className="shrink-0 text-sm text-faint hover:text-ink"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                ))}
                {b.items.length < 5 && (
                  <button
                    type="button"
                    onClick={() => setBlock(i, { ...b, items: [...b.items, { title: "", year: "" }] })}
                    className="rounded-sm border border-dashed border-border-strong bg-surface px-3 py-1.5 text-sm text-mute"
                  >
                    ＋ 추가
                  </button>
                )}
              </div>
            )}

            {b.type === "reviews" && (
              <div className="space-y-3">
                {b.items.map((it, k) => (
                  <div key={k} className="space-y-2 rounded-sm border border-hairline bg-surface-soft p-2.5">
                    <div className="flex items-start gap-2">
                      <textarea
                        value={it.quote}
                        onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, quote: e.target.value } : x)) })}
                        rows={2}
                        placeholder="예: 선물했더니 반응이 정말 좋았어요"
                        className={taCls}
                      />
                      {b.items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBlock(i, { ...b, items: b.items.filter((_, y) => y !== k) })}
                          className="mt-1 shrink-0 text-sm text-faint hover:text-ink"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <input
                      value={it.source ?? ""}
                      onChange={(e) => setBlock(i, { ...b, items: b.items.map((x, y) => (y === k ? { ...x, source: e.target.value } : x)) })}
                      placeholder="어디서 들었나요? 예: 인스타 DM (선택)"
                      className={inputCls}
                    />
                  </div>
                ))}
                {b.items.length < 3 && (
                  <button
                    type="button"
                    onClick={() => setBlock(i, { ...b, items: [...b.items, { quote: "", source: "" }] })}
                    className="rounded-sm border border-dashed border-border-strong bg-surface px-3 py-1.5 text-sm text-mute"
                  >
                    ＋ 추가
                  </button>
                )}
              </div>
            )}

            {b.type === "team" && (
              <textarea
                value={b.intro}
                onChange={(e) => setBlock(i, { ...b, intro: e.target.value })}
                rows={3}
                placeholder="만드는 사람들의 이야기를 편하게 들려주세요."
                className={taCls}
              />
            )}

            {b.type === "space" && (
              <div className="space-y-3">
                <textarea
                  value={b.desc}
                  onChange={(e) => setBlock(i, { ...b, desc: e.target.value })}
                  rows={3}
                  placeholder="공간을 소개해주세요. 어떤 분위기인지, 무엇을 할 수 있는지요."
                  className={taCls}
                />
                <FeatureChips
                  features={b.features}
                  onChange={(features) => setBlock(i, { ...b, features })}
                />
              </div>
            )}

            {/* ── 공통 첨부: 사진(최대3) + 링크(최대3) ── */}
            <div className="space-y-3 border-t border-hairline pt-3">
              <div>
                <p className="mb-1.5 text-sm text-mute">사진 담기 (선택 · 최대 3장)</p>
                <div className="flex flex-wrap gap-2">
                  {b.photos.map((url, k) => (
                    <div key={k} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md border border-hairline">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(i, k)}
                        aria-label="사진 삭제"
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {b.photos.length < 3 && (
                    <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
                      <span className="text-xl leading-none">＋</span>
                      <span className="mt-1 text-[11px]">사진</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => addPhotos(i, e.target.files)}
                      />
                    </label>
                  )}
                </div>
              </div>
              <div>
                {b.links.map((l, k) => (
                  <div key={k} className="mb-2 flex items-center gap-2">
                    <input
                      value={l.url}
                      onChange={(e) => setLink(i, k, { url: e.target.value })}
                      placeholder="https://"
                      className="h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    <input
                      value={l.label ?? ""}
                      onChange={(e) => setLink(i, k, { label: e.target.value })}
                      placeholder="링크 이름 (선택)"
                      className="h-9 w-32 shrink-0 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
                    />
                    <button
                      type="button"
                      onClick={() => removeLink(i, k)}
                      aria-label="링크 삭제"
                      className="shrink-0 text-sm text-faint hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {b.links.length < 3 && (
                  <button
                    type="button"
                    onClick={() => addLink(i)}
                    className="text-sm font-medium text-mute hover:text-ink"
                  >
                    ＋ 링크 추가
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── 진입 한 줄 → 카탈로그 카드 그리드 ── */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-md border border-dashed border-border-strong px-4 py-3 text-left text-[15px] font-medium text-body"
        >
          + 브랜드의 이야기를 더 담아볼까요? <span className="text-faint">(선택)</span>
        </button>
      ) : (
        <div className="space-y-2 rounded-md border border-hairline p-3">
          {CATALOG.map((c) => (
            <button
              key={c.type}
              type="button"
              disabled={!canAdd(c.type)}
              onClick={() => add(c.type)}
              className="w-full rounded-md px-3 py-2.5 text-left hover:bg-surface-soft disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <p className="text-[15px] font-semibold text-ink">{c.label}</p>
              <p className="mt-0.5 text-[13px] text-mute">{c.hint}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full py-1.5 text-center text-sm text-faint"
          >
            접기
          </button>
        </div>
      )}
    </div>
  );
}

// space 특징 칩 — 키워드칩(③) 토글 패턴 + 직접 추가. 입력 상태를 이 카드에 격리.
function FeatureChips({ features, onChange }: { features: string[]; onChange: (f: string[]) => void }) {
  const [custom, setCustom] = useState("");
  const toggle = (f: string) =>
    onChange(features.includes(f) ? features.filter((x) => x !== f) : [...features, f]);
  const addCustom = () => {
    const v = custom.trim();
    if (v && !features.includes(v)) onChange([...features, v]);
    setCustom("");
  };
  const extras = features.filter((f) => !SPACE_FEATURES.includes(f));
  return (
    <div>
      <p className="mb-1.5 text-sm text-mute">이 공간의 특징을 골라주세요.</p>
      <div className="flex flex-wrap gap-2">
        {SPACE_FEATURES.map((f) => {
          const on = features.includes(f);
          return (
            <button
              key={f}
              type="button"
              onClick={() => toggle(f)}
              className={`inline-flex h-8 items-center rounded-pill border px-3 text-sm transition-colors ${
                on
                  ? "border-primary bg-primary-tint text-primary-on"
                  : "border-hairline bg-surface text-mute"
              }`}
            >
              {f}
              {on ? " ✓" : ""}
            </button>
          );
        })}
        {extras.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => toggle(f)}
            className="inline-flex h-8 items-center rounded-pill border border-primary bg-primary-tint px-3 text-sm text-primary-on"
          >
            {f} ✕
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder="직접 더하기 (예: 루프탑)"
          className="h-9 flex-1 rounded-sm border border-hairline bg-surface px-3 text-sm text-ink outline-none placeholder:text-faint focus:border-focus"
        />
        <button
          type="button"
          onClick={addCustom}
          className="h-9 rounded-sm border border-border-strong bg-surface px-4 text-sm font-medium text-ink"
        >
          추가
        </button>
      </div>
    </div>
  );
}
