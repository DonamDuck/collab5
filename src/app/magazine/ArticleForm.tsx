"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BodyEditor } from "./BodyEditor";
import { CoverPicker } from "./CoverPicker";
import { saveArticleAction, lookupBrandAction } from "@/lib/magazine-actions";
import { normalizeSlug, suggestSlug, slugError } from "@/lib/magazine-slug";
import type { MagazineArticle, MagazineDoc, MagazineStatus } from "@/lib/types";

// 매거진 작성·수정 폼 (2026-08-10) — 지시서 §2 "폼 + 에디터 하이브리드".
// 위쪽 = 구조가 필요한 값(목록 카드·OG·정보 카드가 이걸 쓴다), 아래 = 서술만 있는 본문.

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[14px] font-medium text-ink">{label}</span>
      {hint && <span className="ml-1.5 text-[13px] text-faint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
const inputCls =
  "w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-[15px] text-ink outline-none placeholder:text-faint focus:border-focus";

export function ArticleForm({ initial }: { initial?: MagazineArticle }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const [title, setTitle] = useState(initial?.title ?? "");
  // 주소는 **적은 그대로 들고 있다가** 저장할 때 다듬는다(다듬은 결과는 아래에 미리 보여준다).
  // 타이핑 중에 글자를 지워버리면 한글을 칠 때 "아무것도 안 써지는" 화면이 된다.
  const [slugText, setSlugText] = useState(initial?.slug ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? "");
  const [editorName, setEditorName] = useState(initial?.editorName ?? "안톤");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [facts, setFacts] = useState(
    initial?.factBox?.length ? initial.factBox : [{ label: "", value: "" }]
  );
  const [links, setLinks] = useState(
    initial?.brandLinks?.length ? initial.brandLinks : [{ slug: "", name: "", tagline: "" }]
  );
  const [body, setBody] = useState<MagazineDoc>(initial?.body ?? {});

  // 저장하면 실제로 어떤 주소가 될지 — 편집자가 보는 그대로가 결과여야 한다.
  const cleanSlug = normalizeSlug(slugText);
  const slugSuggestion = suggestSlug(title);
  const slugWarn = cleanSlug ? slugError(cleanSlug) : null;
  const slugChanged = !!initial && !!cleanSlug && cleanSlug !== initial.slug;

  const save = (status: MagazineStatus) =>
    start(async () => {
      setErr("");
      const r = await saveArticleAction({
        slug: initial?.slug, desiredSlug: slugText, status, title, subtitle, editorName, location,
        coverImage, summary, factBox: facts, brandLinks: links, body,
      });
      if (!r.ok) { setErr(r.error); return; }
      // 발행이면 글로, 초안이면 목록으로 — 초안은 공개 상세가 404라 보내봐야 못 본다.
      router.push(status === "published" ? `/magazine/${r.slug}` : "/magazine");
      router.refresh();
    });

  /** slug를 치면 소개서에서 이름·한 줄을 자동으로 채운다 — 손으로 옮겨 적다 오타 나는 자리다. */
  const fillBrand = (i: number) =>
    start(async () => {
      const slug = links[i]?.slug?.trim();
      if (!slug) return;
      const found = await lookupBrandAction(slug);
      if (!found) { setErr(`'${slug}' 소개서를 찾지 못했어요.`); return; }
      setErr("");
      setLinks((p) => p.map((b, j) => (j === i ? { ...b, ...found } : b)));
    });

  return (
    <div className="space-y-8">
      {/* ── 구조 필드 ── */}
      <section className="space-y-5 rounded-lg border border-hairline bg-surface-soft p-5">
        <Field label="제목" hint="문장형">
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="방금 빚은 요가 자세를, 내 몸으로 해봤어요" />
        </Field>
        {/* 주소 — 제목 바로 아래. 제목에서 자동으로 만들던 걸 편집자 손에 돌려준 자리(08-13 대표 지시).
            ⭐다듬기(normalizeSlug)를 타이핑 중에 하지 않고 **아래 미리보기로만** 보여준다.
              입력칸에서 바로 글자를 지우면 한글을 칠 때 화면이 고장 난 것처럼 보인다. */}
        <Field label="주소" hint="영문 소문자·숫자·하이픈">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-[14px] text-faint">/magazine/</span>
            <input className={inputCls} value={slugText} inputMode="url"
              onChange={(e) => setSlugText(e.target.value)}
              placeholder={slugSuggestion || "moleyoga-clay-workshop"} />
          </div>
          {slugWarn ? (
            <p className="mt-1.5 text-[13px] text-red-600">{slugWarn}</p>
          ) : cleanSlug && cleanSlug !== slugText ? (
            <p className="mt-1.5 text-[13px] text-faint">
              이렇게 저장돼요 — <b className="font-medium text-mute">/magazine/{cleanSlug}</b>
              <span className="ml-1">(한글·공백·특수문자는 주소로 못 써서 빠져요)</span>
            </p>
          ) : !cleanSlug ? (
            <p className="mt-1.5 text-[13px] text-faint">
              {initial
                ? "비워두면 지금 주소를 그대로 씁니다."
                : "비워두면 제목에서 자동으로 만들어요. 한글 제목이면 article-xxxx 같은 주소가 되니 직접 적는 걸 권해요."}
            </p>
          ) : null}
          {/* 못 쓰는 주소일 땐 경고를 겹쳐 띄우지 않는다 — 고쳐야 할 게 뭔지부터 하나만 보여준다. */}
          {slugChanged && !slugWarn && (
            <p className="mt-1.5 text-[13px] text-amber-700">
              주소를 바꾸면 <b className="font-medium">이전 주소({initial!.slug})는 열리지 않아요.</b>{" "}
              이미 공유하셨다면 그 링크가 죽습니다.
            </p>
          )}
        </Field>
        <Field label="부제" hint="브랜드 × 브랜드 · 형식">
          <input className={inputCls} value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
            placeholder="캔버스가든 × 두더지요가원 · 요가 토우 워크숍" />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="글쓴이"><input className={inputCls} value={editorName} onChange={(e) => setEditorName(e.target.value)} /></Field>
          <Field label="장소"><input className={inputCls} value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="고양 일산동구 두더지요가원" /></Field>
        </div>
        <Field label="커버 사진" hint="목록 썸네일 + 링크 미리보기(카톡·검색) 겸용">
          <CoverPicker value={coverImage} onChange={setCoverImage} />
        </Field>
        <Field label="요약" hint="목록 카드와 검색 결과에 나가요. 2~3줄">
          <textarea className={`${inputCls} min-h-[80px] leading-relaxed`} value={summary}
            onChange={(e) => setSummary(e.target.value)} />
        </Field>

        {/* 정보 카드 — 항목 수가 호마다 다르므로 가변 */}
        <div>
          <p className="text-[14px] font-medium text-ink">콜라보 한눈에 보기</p>
          <p className="mt-0.5 text-[13px] text-faint">함께한 곳 / 언제 / 누가 / 무엇을 — 호마다 항목이 달라도 돼요.</p>
          <div className="mt-2 space-y-2">
            {facts.map((f, i) => (
              <div key={i} className="flex gap-2">
                <input className={`${inputCls} w-32 shrink-0`} placeholder="라벨" value={f.label}
                  onChange={(e) => setFacts((p) => p.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                <input className={inputCls} placeholder="값" value={f.value}
                  onChange={(e) => setFacts((p) => p.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                <button type="button" onClick={() => setFacts((p) => p.filter((_, j) => j !== i))}
                  className="shrink-0 px-2 text-[13px] text-faint hover:text-ink">삭제</button>
              </div>
            ))}
            <button type="button" onClick={() => setFacts((p) => [...p, { label: "", value: "" }])}
              className="w-full rounded-md border border-primary-tint bg-primary-pale py-2 text-[14px] font-medium text-primary-on">
              ＋항목 추가
            </button>
          </div>
        </div>

        {/* 연결 브랜드 — 매거진과 소개서를 잇는 동선 */}
        <div>
          <p className="text-[14px] font-medium text-ink">연결 브랜드</p>
          <p className="mt-0.5 text-[13px] text-faint">소개서 주소의 끝부분(slug)을 넣고 [불러오기]를 누르면 이름이 채워져요.</p>
          <div className="mt-2 space-y-3">
            {links.map((b, i) => (
              <div key={i} className="rounded-md border border-hairline bg-surface p-3">
                <div className="flex gap-2">
                  <input className={inputCls} placeholder="m-ofjghi" value={b.slug}
                    onChange={(e) => setLinks((p) => p.map((x, j) => (j === i ? { ...x, slug: e.target.value } : x)))} />
                  <button type="button" onClick={() => fillBrand(i)} disabled={pending}
                    className="shrink-0 rounded-sm border border-border-strong px-3 text-[13px] font-medium text-ink disabled:opacity-50">
                    불러오기
                  </button>
                  <button type="button" onClick={() => setLinks((p) => p.filter((_, j) => j !== i))}
                    className="shrink-0 px-1 text-[13px] text-faint hover:text-ink">삭제</button>
                </div>
                {(b.name || b.tagline) && (
                  <p className="mt-2 text-[13px] text-mute">
                    <b className="text-ink">{b.name}</b>{b.tagline && ` — ${b.tagline}`}
                  </p>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setLinks((p) => [...p, { slug: "", name: "", tagline: "" }])}
              className="w-full rounded-md border border-primary-tint bg-primary-pale py-2 text-[14px] font-medium text-primary-on">
              ＋브랜드 추가
            </button>
          </div>
        </div>
      </section>

      {/* ── 본문 ── */}
      <section>
        <p className="text-[14px] font-medium text-ink">본문</p>
        <p className="mt-0.5 mb-2 text-[13px] text-faint">
          마크다운 초안을 그대로 붙여넣으면 소제목·인용·목록이 서식으로 살아나요.
        </p>
        <BodyEditor initial={body} onChange={setBody} />
      </section>

      {err && <p className="text-[14px] text-red-600">{err}</p>}

      {/* 저장 바 — 초안/발행을 한 화면에서 가른다 */}
      <div className="sticky bottom-0 flex gap-2 border-t border-hairline bg-surface py-3">
        <button type="button" onClick={() => save("draft")} disabled={pending}
          className="h-12 flex-1 rounded-md border border-border-strong bg-surface text-[15px] font-medium text-ink disabled:opacity-50">
          {pending ? "저장 중…" : "초안으로 저장"}
        </button>
        <button type="button" onClick={() => save("published")} disabled={pending}
          className="h-12 flex-[1.4] rounded-md bg-primary text-[15px] font-medium text-primary-on disabled:opacity-50">
          {pending ? "저장 중…" : initial?.status === "published" ? "수정 내용 반영" : "발행하기"}
        </button>
      </div>
    </div>
  );
}
