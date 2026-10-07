"use client";

// 소개서 사전 정보 입력 창 (2026-10-03 로컬 시험판 · 10-04 대표 QA 19건 반영) — 정본 설명은 lib/autoDraft.ts 머리말.
//
// 흐름: 로그인 확인 → 브랜드 → (권유) 이름으로 미리 찾아보기 → 인스타 계정 · 그 밖의 주소 → 안내 이메일
//   → 그 밖에 → 동의 → 요청 → (접수 메일) → 확인을 누르면 홈으로
//
// ⏳10-07 대표: 「미리 찾아보기」를 처음부터 띄워 두지 않는다. 브랜드 이름을 치고 1초쯤 지나면 이름 칸 바로 아래에
//   스르륵 올라온다 — 이름이 있어야 찾을 수 있는 칸이라, 이름보다 먼저 보이면 «뭘 찾는다는 거지?»가 된다.
//
// 🔁10-05 대표: 브리프(요약 리포트)는 자동 흐름에서 뺐다(「AI 티가 난다」). 그래서 브리프 재료였던 고민 칸도 뺐다.
//
// ⭐인스타와 그 밖의 주소를 칸을 나눠 받는다(대표 10-04). 한 칸에 섞어 받았더니 `www.canvasgarden.shop`이
//   인스타 계정으로 읽혔다. 칸이 갈리면 고객이 무엇을 적는지 스스로 정하고, 판별이 틀릴 여지가 줄어든다.
// 🔑**로그인한 사람만 요청할 수 있다**(대표 10-04). 초안이 그 계정에 바로 붙어야 이관 단계가 사라진다.
//   화면에서 막고, 서버(/api/auto-draft)에서도 한 번 더 막는다 — 화면만 막으면 주소로 바로 부르는 길이 남는다.
// 🔎「미리 찾아보기」는 기존 위저드의 검색 한 단계(/api/enrich keywords)만 빌린다. 한 번에 약 4원(10-04 실측).
//   찾은 것은 후보로만 보여 주고 고객이 「추가」를 눌러야 들어간다(위저드의 「맞아요」 원칙 그대로).
//   10-04 395빵집 시험에서 인스타 후보 셋 중 하나가 다른 가게였다 — 자동으로 넣으면 안 되는 이유다.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useDismissable } from "@/components/useDismissable";
import { instagramSlug } from "@/lib/links";
import {
  CHANNEL_LABEL,
  CONSENT_TEXT,
  DAILY_CAP,
  DELIVERY_PROMISE,
  EMAIL_RE,
  etaDays,
  parseChannel,
} from "@/lib/autoDraft";

type Props = { initialName: string; onClose: () => void };

/** 인스타 칸 한 줄 → 핸들. @·주소 어느 쪽으로 적어도 받는다. 핸들 모양이 아니면 "". */
function handleOf(raw: string): string {
  const h = instagramSlug(raw);
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : "";
}

export function AutoDraftDialog({ initialName, onClose }: Props) {
  const [auth, setAuth] = useState<{ loggedIn: boolean; email: string } | null>(null);
  const [name, setName] = useState(initialName);
  const [region, setRegion] = useState("");
  const [btype, setBtype] = useState("");
  const [igRows, setIgRows] = useState<string[]>([""]);
  const [urlRows, setUrlRows] = useState<string[]>([""]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<string[] | null>(null);
  // position = 대기 순번. 운영은 진행 상태를 안 적어 모른다 → null(10-07)
  const [done, setDone] = useState<{ position: number | null; etaDays: number } | null>(null);
  const [findShown, setFindShown] = useState(false);
  const router = useRouter();

  // 요청을 마치면 홈으로(대표 10-07). ✕·ESC로 닫아도 같다 — 신청 창으로 돌아갈 이유가 없다.
  const close = done ? () => router.push("/") : onClose;
  const dialog = useDismissable(true, { onClose: close, overlayClose: false, labelledBy: "auto-draft-title" });

  // 이름을 치고 1초 쉬면 「미리 찾아보기」를 연다. 한 번 열리면 이름을 고쳐도 닫지 않는다(깜빡임 방지) — 다 지우면 닫는다.
  const hasName = !!name.trim();
  useEffect(() => {
    if (!hasName) {
      setFindShown(false);
      return;
    }
    const t = setTimeout(() => setFindShown(true), 1000);
    return () => clearTimeout(t);
  }, [hasName, name]);

  useEffect(() => {
    fetch("/api/auto-draft")
      .then((r) => r.json())
      .then((d) => {
        setWaiting(typeof d.waiting === "number" ? d.waiting : null);
        setAuth({ loggedIn: !!d.loggedIn, email: typeof d.email === "string" ? d.email : "" });
        // 계정 이메일로 미리 채운다 — 고객이 다른 주소로 받고 싶으면 고칠 수 있다
        if (typeof d.email === "string" && d.email) setEmail((p) => p || d.email);
      })
      .catch(() => setAuth({ loggedIn: false, email: "" }));
  }, []);

  const urlParsed = useMemo(() => urlRows.map((r) => parseChannel(r)), [urlRows]);
  const handles = igRows.map(handleOf).filter(Boolean);
  const urls = urlParsed.filter(Boolean);
  const channelCount = handles.length + urls.length;
  const ready = name.trim() && channelCount > 0 && EMAIL_RE.test(email.trim()) && consent && !busy;
  const nextPos = (waiting ?? 0) + 1;

  const put = (set: typeof setIgRows) => (v: string) =>
    set((p) => {
      // 빈 줄이 있으면 거기에 채운다 — 「추가」를 누를 때마다 빈 줄이 늘지 않게
      const empty = p.findIndex((x) => !x.trim());
      if (v && empty >= 0) return p.map((x, j) => (j === empty ? v : x));
      return p.length >= 6 ? p : [...p, v];
    });
  const addIg = put(setIgRows);
  const addUrl = put(setUrlRows);

  const findChannels = async () => {
    if (!name.trim() || finding) return;
    setFinding(true);
    setFound(null);
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "keywords", name: name.trim(), region: region.trim(), businessType: btype.trim() }),
      });
      const d = await r.json();
      const l = d.links ?? {};
      const ig: string[] = l.instagramCandidates?.length ? l.instagramCandidates : l.instagram ? [l.instagram] : [];
      const hp: string[] = l.homepageCandidates ?? [];
      const have = new Set([
        ...handles.map((h) => `https://instagram.com/${h}`.toLowerCase()),
        ...urls.map((c) => c!.url.toLowerCase()),
      ]);
      const list = [...ig.map((x) => `@${instagramSlug(String(x))}`), ...hp]
        .map((x) => parseChannel(String(x)))
        .filter((c): c is NonNullable<typeof c> => !!c && !have.has(c.url.toLowerCase()))
        .map((c) => c.url);
      setFound(Array.from(new Set(list)).slice(0, 6));
    } catch {
      setFound([]);
    } finally {
      setFinding(false);
    }
  };

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/auto-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: name.trim(),
          region: region.trim(),
          businessType: btype.trim(),
          channels: [...handles.map((h) => `@${h}`), ...urlRows.filter((x) => x.trim())],
          email: email.trim(),
          note: note.trim(),
          consent,
        }),
      });
      const d = await r.json();
      if (r.status === 401) {
        setAuth({ loggedIn: false, email: "" });
        return;
      }
      if (!r.ok) throw new Error(d.error || "요청하지 못했어요.");
      setDone({ position: d.position, etaDays: d.etaDays });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "요청하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "h-11 w-full min-w-0 rounded-sm border border-hairline bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";
  const sub = "text-[13px] font-medium text-body";
  const xBtn =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[15px] text-mute hover:bg-surface-soft hover:text-ink";
  const addBtn = "h-9 rounded-md border border-hairline px-3 text-[13px] font-medium text-body hover:border-border-strong";

  const closeBtn = (
    <button
      type="button"
      onClick={close}
      aria-label="닫기"
      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-[18px] text-mute hover:bg-surface-soft hover:text-ink"
    >
      ✕
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...dialog.overlayProps}>
      <div
        {...dialog.panelProps}
        className="slim-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-hairline bg-surface p-5 shadow-e2"
      >
        {closeBtn}

        {auth === null ? (
          <div className="flex h-40 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          </div>
        ) : !auth.loggedIn ? (
          <div className="pt-2">
            <p id="auto-draft-title" className="text-[19px] font-bold text-ink">
              로그인이 필요해요
            </p>
            <p className="mt-3 break-keep text-[15px] leading-[1.7] text-body">
              소개서 제작 요청은 로그인한 뒤에 할 수 있어요. 완성된 초안을 그 계정에 바로 연결해 드려요.
            </p>
            <a
              href="/login?redirect=/register"
              className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on"
            >
              로그인하러 가기
            </a>
          </div>
        ) : done ? (
          <div className="pt-2">
            <p id="auto-draft-title" className="text-[19px] font-bold text-ink">
              요청이 접수됐어요.
            </p>
            <p className="mt-3 break-keep text-[15px] leading-[1.7] text-body">
              {done.position ? `지금 대기 ${done.position}번째예요. ` : ""}하루 {DAILY_CAP}팀씩 순서대로 제작되고 있어서,{" "}
              {done.etaDays}~{done.etaDays + 1}일 안에 <b className="text-ink">{email.trim()}</b>로 안내해 드릴게요.
            </p>
            <p className="mt-2 break-keep text-[14px] leading-[1.65] text-mute">{DELIVERY_PROMISE}</p>
            <p className="mt-2 break-keep text-[14px] leading-[1.65] text-mute">접수 안내 메일도 방금 보내 드렸어요.</p>
            <button
              type="button"
              onClick={close}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="pr-8">
              <p id="auto-draft-title" className="text-[19px] font-bold text-ink">
                소개서 사전 정보 입력
              </p>
              <p className="mt-1.5 break-keep text-[14px] leading-[1.65] text-mute">
                그동안 올리신 글과 사진을 읽고, 브랜드 소개서 초안을 만들어 드릴게요.
              </p>
            </div>

            {/* 1. 브랜드 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">브랜드</p>
              <div>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="브랜드 이름" className={input} />
                {/* 미리 찾아보기 — 이름을 치고 1초 뒤 이름 칸 바로 아래로 스르륵(대표 10-07). 높이(0fr→1fr)와 함께 올라와서 아래 칸이 툭 밀리지 않는다 */}
                <div
                  inert={!findShown}
                  aria-hidden={!findShown}
                  className={`grid transition-[grid-template-rows,opacity,translate] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    findShown ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] translate-y-2 opacity-0"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="pt-2">
                      <section className="rounded-md border border-primary bg-primary-pale px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="break-keep text-[14px] font-medium leading-[1.5] text-ink">
                            브랜드 이름으로 아래 정보를 미리 찾아볼까요?
                          </p>
                          <button
                            type="button"
                            onClick={findChannels}
                            disabled={!name.trim() || finding}
                            className="h-9 shrink-0 rounded-md bg-primary px-3 text-[13px] font-bold text-primary-on disabled:opacity-40"
                          >
                            {finding ? "찾는 중…" : "찾아보기"}
                          </button>
                        </div>
                        {found && (
                          <div className="mt-3 border-t border-primary/30 pt-3">
                            {found.length === 0 ? (
                              <p className="text-[13px] text-mute">찾은 곳이 없어요. 아래에 직접 적어 주세요.</p>
                            ) : (
                              <>
                                <p className="text-[13px] text-mute">정보가 맞다면 추가 버튼으로 추가해주세요.</p>
                                <ul className="mt-2 space-y-1.5">
                                  {found.map((u) => {
                                    const c = parseChannel(u)!;
                                    return (
                                      <li key={u} className="flex items-center gap-2">
                                        <span className="w-[72px] shrink-0 text-[12px] text-mute">{CHANNEL_LABEL[c.kind]}</span>
                                        <a
                                          href={u}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="min-w-0 flex-1 truncate text-[13px] text-body underline underline-offset-2"
                                        >
                                          {u.replace(/^https:\/\//, "")}
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (c.kind === "instagram") addIg(`@${instagramSlug(u)}`);
                                            else addUrl(u);
                                            setFound((p) => (p ? p.filter((x) => x !== u) : p));
                                          }}
                                          className="h-8 shrink-0 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-on"
                                        >
                                          추가
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              </>
                            )}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="지역 (예: 서울 마포)" className={input} />
                <input value={btype} onChange={(e) => setBtype(e.target.value)} placeholder="하는 일 (예: 빵집)" className={input} />
              </div>
            </section>

            {/* 2. 확인할 게시글 채널 — 인스타 / 그 밖의 주소를 칸을 나눠 받는다 */}
            <section className="space-y-4">
              <p className="text-[14px] font-bold text-ink">확인할 게시글 채널</p>

              <div className="space-y-2">
                <p className={sub}>인스타그램 계정명</p>
                {igRows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="relative min-w-0 flex-1">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-faint">@</span>
                      <input
                        value={r.replace(/^@+/, "")}
                        onChange={(e) => setIgRows((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder="계정명"
                        className={`${input} pl-7`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIgRows((p) => (p.length <= 1 ? [""] : p.filter((_, j) => j !== i)))}
                      aria-label="이 계정 지우기"
                      className={xBtn}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addIg("")} className={addBtn}>
                  ＋ 인스타 계정 추가
                </button>
              </div>

              <div className="space-y-2">
                <p className={sub}>블로그, 리틀리 등 별도 URL 주소</p>
                <p className="break-keep text-[12px] leading-[1.6] text-mute">
                  리틀리나 링크트리가 있으면 그것 하나로도 충분해요.
                </p>
                {urlRows.map((r, i) => {
                  const c = urlParsed[i];
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={r}
                        onChange={(e) => setUrlRows((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                        placeholder="https://"
                        className={input}
                      />
                      {/* 종류 표시는 «적었을 때만» 자리를 차지한다 — 빈 칸에 72px 빈자리가 남아 입력칸이 덜 자라 보였다(10-06 QA) */}
                      {r.trim() && (
                        <span
                          className={`w-[72px] shrink-0 text-center text-[12px] ${c ? "font-medium text-primary-strong" : "text-faint"}`}
                        >
                          {c ? CHANNEL_LABEL[c.kind] : "확인 필요"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setUrlRows((p) => (p.length <= 1 ? [""] : p.filter((_, j) => j !== i)))}
                        aria-label="이 주소 지우기"
                        className={xBtn}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                <button type="button" onClick={() => addUrl("")} className={addBtn}>
                  ＋ 주소 추가
                </button>
              </div>
            </section>

            {/* 3. 안내 이메일 — 계정 이메일로 미리 채운다 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">초안이 완성되면 안내받을 이메일</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={input}
              />
            </section>

            {/* 4. 그 밖에 */}
            <section className="space-y-2">
              <p className="break-keep text-[14px] font-bold leading-[1.5] text-ink">
                그 외 저희가 알면 좋을 만한 것들이 있다면 알려주세요. <span className="font-normal text-mute">(선택)</span>
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="꼭 넣고 싶은 활동이나, 쓰지 말아 주셨으면 하는 사진이 있으면 적어 주세요."
                className="w-full rounded-sm border border-hairline bg-surface px-3 py-2.5 text-[15px] leading-[1.6] text-ink outline-none placeholder:text-faint focus:border-focus"
              />
            </section>

            {/* 5. 동의 */}
            <section className="rounded-md border border-hairline px-4 py-3.5">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-[3px] h-[18px] w-[18px] shrink-0 accent-[var(--primary)]"
                />
                <span className="break-keep text-[14px] font-medium leading-[1.6] text-ink">{CONSENT_TEXT}</span>
              </label>
              <ul className="mt-2.5 list-disc space-y-1 pl-[46px] text-[13px] leading-[1.6] text-mute">
                <li>공개 글과 사진을 활용해요.</li>
                <li>{DELIVERY_PROMISE}</li>
                <li>공개한 뒤에도 언제든 직접 고치거나 삭제할 수 있어요.</li>
              </ul>
            </section>

            <div>
              <p className="break-keep text-[13px] leading-[1.6] text-mute">
                하루 {DAILY_CAP}팀까지 순서대로 제작되고 있어요.
                {waiting !== null ? ` 지금 신청하시면 ${etaDays(nextPos)}~${etaDays(nextPos) + 1}일쯤 걸리고,` : " 보통 1~2일쯤 걸리고,"} 완성되면 이메일로 안내해 드릴게요.
              </p>
              {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={!ready}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on disabled:opacity-40"
              >
                {busy ? "요청하는 중…" : "소개서 제작 요청하기"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
