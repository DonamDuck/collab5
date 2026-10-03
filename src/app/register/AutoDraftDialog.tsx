"use client";

// 소개서 자동 만들기 신청 창 (2026-10-03, 로컬 시험판) — 정본 설명은 lib/autoDraft.ts 머리말.
//
// 흐름: 브랜드 → 채널(직접 적거나 「이름으로 찾아보기」) → 알림 이메일 → 동의 체크 → 신청 → 대기 순서 안내
//
// ⭐채널을 먼저 묻는 이유 — 컨시어지 때 대표가 DM으로 「인스타·블로그 있으면 알려주세요」를 물었고,
//   그 목록이 스킬의 첫 재료였다. 특히 **링크 모음(리틀리·링크트리)이 있으면 그게 제일 좋다** —
//   거기에 그분이 글을 쓰는 채널이 다 걸려 있어서다(08-25 터 건: 인스타 132편만 봤다가 276편이 나왔다).
// 🔎「이름으로 찾아보기」는 기존 위저드의 검색 한 단계(/api/enrich keywords)만 빌린다. 한 번에 약 6원.
//   찾은 것은 후보로만 보여 주고 고객이 「추가」를 눌러야 들어간다(위저드의 「맞아요」 원칙 그대로).
import { useEffect, useMemo, useState } from "react";
import { useDismissable } from "@/components/useDismissable";
import {
  CHANNEL_LABEL,
  CONSENT_TEXT,
  DAILY_CAP,
  EMAIL_RE,
  etaDays,
  parseChannel,
} from "@/lib/autoDraft";

type Props = { initialName: string; onClose: () => void };

export function AutoDraftDialog({ initialName, onClose }: Props) {
  const [name, setName] = useState(initialName);
  const [region, setRegion] = useState("");
  const [btype, setBtype] = useState("");
  const [rows, setRows] = useState<string[]>([""]);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [waiting, setWaiting] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<string[] | null>(null);
  const [done, setDone] = useState<{ position: number; etaDays: number } | null>(null);

  const dialog = useDismissable(true, { onClose, overlayClose: false, labelledBy: "auto-draft-title" });

  useEffect(() => {
    fetch("/api/auto-draft")
      .then((r) => r.json())
      .then((d) => setWaiting(typeof d.waiting === "number" ? d.waiting : null))
      .catch(() => {});
  }, []);

  const parsed = useMemo(() => rows.map((r) => parseChannel(r)), [rows]);
  const validChannels = parsed.filter(Boolean).length;
  const ready = name.trim() && validChannels > 0 && EMAIL_RE.test(email.trim()) && consent && !busy;
  const nextPos = (waiting ?? 0) + 1;

  const setRow = (i: number, v: string) => setRows((p) => p.map((x, j) => (j === i ? v : x)));
  const addRow = (v = "") =>
    setRows((p) => {
      // 빈 줄이 있으면 거기에 채운다 — 「추가」를 누를 때마다 빈 줄이 늘지 않게
      const empty = p.findIndex((x) => !x.trim());
      if (v && empty >= 0) return p.map((x, j) => (j === empty ? v : x));
      return p.length >= 10 ? p : [...p, v];
    });
  const removeRow = (i: number) => setRows((p) => (p.length <= 1 ? [""] : p.filter((_, j) => j !== i)));

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
      const have = new Set(parsed.filter(Boolean).map((c) => c!.url.toLowerCase()));
      const list = [...ig, ...hp]
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
          channels: rows.filter((x) => x.trim()),
          email: email.trim(),
          note: note.trim(),
          consent,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "신청하지 못했어요.");
      setDone({ position: d.position, etaDays: d.etaDays });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "신청하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };

  const input =
    "h-11 w-full min-w-0 rounded-sm border border-hairline bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...dialog.overlayProps}>
      <div
        {...dialog.panelProps}
        className="slim-scrollbar relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-lg border border-hairline bg-surface p-5 shadow-e2"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-pill text-[18px] text-mute hover:bg-surface-soft hover:text-ink"
        >
          ✕
        </button>

        {done ? (
          <div className="pt-2">
            <p id="auto-draft-title" className="text-[19px] font-bold text-ink">
              신청이 접수됐어요.
            </p>
            <p className="mt-3 break-keep text-[15px] leading-[1.7] text-body">
              지금 대기 {done.position}번째예요. 하루 {DAILY_CAP}팀씩 순서대로 만들고 있어서, 약 {done.etaDays}일 안에{" "}
              <b className="text-ink">{email.trim()}</b>로 완성 소식을 보내 드릴게요.
            </p>
            <p className="mt-2 break-keep text-[14px] leading-[1.65] text-mute">
              초안은 공개되지 않은 상태로 만들어져요. 받아 보시고 고칠 곳을 고친 다음 공개하시면 돼요.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on"
            >
              확인
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="pr-8">
              <p id="auto-draft-title" className="text-[19px] font-bold text-ink">
                소개서 자동으로 만들기
              </p>
              <p className="mt-1.5 break-keep text-[14px] leading-[1.65] text-mute">
                그동안 올리신 글과 사진을 저희가 읽고, 활동과 콜라보까지 채운 초안을 만들어 드려요.
              </p>
            </div>

            {/* 1. 브랜드 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">브랜드</p>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="브랜드 이름" className={input} />
              <div className="flex gap-2">
                <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="지역 (예: 서울 마포)" className={input} />
                <input value={btype} onChange={(e) => setBtype(e.target.value)} placeholder="하는 일 (예: 빵집)" className={input} />
              </div>
            </section>

            {/* 2. 채널 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">글을 올리시는 곳</p>
              <p className="break-keep text-[13px] leading-[1.6] text-mute">
                인스타그램, 블로그, 브런치, 홈페이지를 모두 알려 주세요. 리틀리나 링크트리가 있으면 그것 하나로도 충분해요.
              </p>
              {rows.map((r, i) => {
                const c = parsed[i];
                return (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={r}
                      onChange={(e) => setRow(i, e.target.value)}
                      placeholder={i === 0 ? "@인스타그램 또는 주소" : "주소"}
                      className={input}
                    />
                    <span
                      className={`w-[76px] shrink-0 text-center text-[12px] ${c ? "font-medium text-primary-strong" : "text-faint"}`}
                    >
                      {c ? CHANNEL_LABEL[c.kind] : r.trim() ? "확인 필요" : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label="이 줄 지우기"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[15px] text-mute hover:bg-surface-soft hover:text-ink"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => addRow()}
                  className="h-9 rounded-md border border-hairline px-3 text-[13px] font-medium text-body hover:border-border-strong"
                >
                  ＋ 한 줄 더
                </button>
                <button
                  type="button"
                  onClick={findChannels}
                  disabled={!name.trim() || finding}
                  className="h-9 rounded-md border border-primary bg-primary-pale px-3 text-[13px] font-medium text-ink disabled:opacity-50"
                >
                  {finding ? "찾는 중…" : "🔎 이름으로 찾아보기"}
                </button>
              </div>
              {found && (
                <div className="rounded-md bg-surface-soft px-3 py-2.5">
                  {found.length === 0 ? (
                    <p className="text-[13px] text-mute">찾은 곳이 없어요. 직접 적어 주세요.</p>
                  ) : (
                    <>
                      <p className="text-[13px] text-mute">이 중에 맞는 곳이 있으면 추가해 주세요.</p>
                      <ul className="mt-2 space-y-1.5">
                        {found.map((u) => {
                          const c = parseChannel(u)!;
                          return (
                            <li key={u} className="flex items-center gap-2">
                              <span className="w-[76px] shrink-0 text-[12px] text-mute">{CHANNEL_LABEL[c.kind]}</span>
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
                                  addRow(u);
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

            {/* 3. 알림 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">완성 소식을 받을 이메일</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className={input}
              />
            </section>

            {/* 4. 하고 싶은 말 */}
            <section className="space-y-2">
              <p className="text-[14px] font-bold text-ink">
                저희가 알아 두면 좋을 것 <span className="font-normal text-mute">(선택)</span>
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
              <ul className="mt-2.5 space-y-1 pl-[28px] text-[13px] leading-[1.6] text-mute">
                <li>공개된 게시물과 하이라이트, 이미지 속 글자, 브랜드를 태그한 다른 분들의 공개 글을 읽어요.</li>
                <li>비밀번호나 DM은 받지도 보지도 않아요.</li>
                <li>초안은 공개되지 않은 상태로 만들어지고, 공개 여부는 직접 정하세요.</li>
                <li>원하시면 초안과 읽어 둔 자료를 언제든 지워 드려요.</li>
              </ul>
            </section>

            <div>
              <p className="break-keep text-[13px] leading-[1.6] text-mute">
                하루 {DAILY_CAP}팀까지 순서대로 만들어요.
                {waiting !== null && ` 지금 신청하시면 대기 ${nextPos}번째, 약 ${etaDays(nextPos)}일 걸려요.`}
              </p>
              {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={!ready}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on disabled:opacity-40"
              >
                {busy ? "신청하는 중…" : "자동으로 만들어 주세요"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
