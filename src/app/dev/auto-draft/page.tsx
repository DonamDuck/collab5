// /dev/auto-draft — 자동 만들기 신청함 (2026-10-04, 로컬 전용)
// 신청 목록과 상태, 초안이 나온 신청은 [초안 소개서로 보기] 버튼. 사장님께 여쭐 질문도 같이 보여 준다.
// ⚠️운영 빌드에선 404. 대기열이 이 컴퓨터의 파일이라 운영에선 의미가 없다(설계 = lib/autoDraft.ts 머리말).
import { notFound } from "next/navigation";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { CHANNEL_LABEL, LOCAL_DRAFT_PASSWORD, type AutoDraftRequest } from "@/lib/autoDraft";
import { loadDraftAction } from "./actions";

export const dynamic = "force-dynamic";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");
const STATUS: Record<string, string> = { queued: "대기", working: "만드는 중", done: "완성", failed: "실패" };

type Row = AutoDraftRequest & { draft?: string; questions?: string[]; counts?: { a: number; c: number } };

async function rows(): Promise<Row[]> {
  let names: string[] = [];
  try {
    names = (await readdir(QUEUE_DIR)).filter((n) => n.endsWith(".json")).sort().reverse();
  } catch {
    return [];
  }
  const out: Row[] = [];
  for (const n of names) {
    try {
      const r = JSON.parse(await readFile(path.join(QUEUE_DIR, n), "utf8")) as Row;
      if (r.draft) {
        try {
          const d = JSON.parse(await readFile(r.draft, "utf8"));
          r.questions = Array.isArray(d.open_questions) ? d.open_questions : [];
          r.counts = { a: d.activities?.length ?? 0, c: d.collab_history?.length ?? 0 };
        } catch {
          r.draft = undefined;
        }
      }
      out.push(r);
    } catch {}
  }
  return out;
}

export default async function AutoDraftInbox() {
  if (process.env.NODE_ENV !== "development") notFound();
  const list = await rows();
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="text-[26px] font-bold tracking-[-0.025em] text-ink">자동 만들기 신청함</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-mute">
        로컬 전용 화면이에요. 초안이 나온 신청은 버튼을 누르면 비공개 초안 소개서로 열려요. 수정 비번은{" "}
        <b className="text-ink">{LOCAL_DRAFT_PASSWORD}</b>이에요.
      </p>

      {list.length === 0 && <p className="mt-10 text-[15px] text-mute">아직 신청이 없어요.</p>}

      <ul className="mt-8 space-y-5">
        {list.map((r) => (
          <li key={r.id} className="rounded-xl border border-hairline bg-surface px-5 py-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[18px] font-bold text-ink">{r.brandName}</span>
              <span className="rounded-pill bg-surface-soft px-2.5 py-0.5 text-[12px] font-medium text-body">
                {STATUS[r.status] ?? r.status}
              </span>
              <span className="text-[12px] text-faint">{r.createdAt.slice(0, 16).replace("T", " ")}</span>
            </div>
            <p className="mt-1 text-[13px] text-mute">
              {[r.region, r.businessType].filter(Boolean).join(" · ")} · {r.email}
            </p>
            <ul className="mt-2 space-y-0.5 text-[13px] text-body">
              {r.channels.map((c) => (
                <li key={c.url}>
                  <span className="inline-block w-[84px] text-mute">{CHANNEL_LABEL[c.kind]}</span>
                  <a href={c.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                    {c.url.replace(/^https:\/\//, "")}
                  </a>
                </li>
              ))}
            </ul>

            {r.draft ? (
              <>
                <form action={loadDraftAction} className="mt-4">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="h-11 rounded-md bg-primary px-4 text-[14px] font-bold text-primary-on">
                    초안 소개서로 보기 · 활동 {r.counts?.a} · 콜라보 {r.counts?.c}
                  </button>
                </form>
                {!!r.questions?.length && (
                  <details className="mt-4 rounded-md bg-surface-soft px-4 py-3">
                    <summary className="cursor-pointer text-[14px] font-medium text-ink">
                      사장님께 여쭐 질문 {r.questions.length}개
                    </summary>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[13px] leading-[1.6] text-body">
                      {r.questions.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ol>
                  </details>
                )}
              </>
            ) : (
              <p className="mt-4 text-[13px] text-faint">초안을 만드는 중이거나 아직 시작 전이에요.</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
