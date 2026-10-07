// /dev/auto-draft/mail?id=… — 고객에게 갈 안내 메일 미리보기 (2026-10-05, 로컬 전용)
// 대표 10-05: *「이메일 초안도 내가 한번 봐야 될 것 같아. 링크가 달려 있어야 되고」* — 보내는 코드와 같은 함수를 그린다.
// 10-07: 신청하면 바로 가는 «접수 메일»이 생겨 두 통을 순서대로 보여 준다.
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { draftReadyMail, draftRequestedMail } from "@/lib/notify";
import { CHANNEL_LABEL, DAILY_CAP, type AutoDraftChannel } from "@/lib/autoDraft";

export const dynamic = "force-dynamic";

export default async function MailPreview({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const id = ((await searchParams).id ?? "").replace(/[^0-9a-z-]/gi, "");
  let brandName = "예시 브랜드";
  let to = "name@example.com";
  let slug = "draft-xxxx";
  let channels: AutoDraftChannel[] = [{ kind: "instagram", url: "https://instagram.com/example" }];
  if (id) {
    try {
      const r = JSON.parse(await readFile(path.join(process.cwd(), "_workspace", "auto-draft-queue", `${id}.json`), "utf8"));
      brandName = r.brandName;
      to = r.email;
      slug = r.slug || `draft-${id.slice(-4)}`;
      channels = r.channels ?? channels;
    } catch {}
  }
  const h = await headers();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `http://${h.get("host") ?? "localhost:3001"}`).replace(/\/$/, "");
  const mails = [
    {
      when: "① 신청하면 바로",
      m: draftRequestedMail({
        brandName,
        position: 1,
        etaDays: 1,
        dailyCap: DAILY_CAP,
        channels: channels.map((c) => `${CHANNEL_LABEL[c.kind]} ${c.url.replace(/^https:\/\//, "")}`),
      }),
    },
    { when: "② 초안이 완성되면 (아침 9시)", m: draftReadyMail({ brandName, url: `${base}/m/${slug}` }) },
  ];
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="text-[22px] font-bold text-ink">안내 메일 미리보기</h1>
      <p className="mt-2 text-[14px] text-mute">받는 사람 {to} · 보내는 사람 {process.env.DRAFT_MAIL_FROM || process.env.NOTIFY_FROM || "collab5 <onboarding@resend.dev>"}{process.env.DRAFT_MAIL_REPLY_TO ? ` · 답장 받는 곳 ${process.env.DRAFT_MAIL_REPLY_TO}` : ""}</p>
      {mails.map(({ when, m }) => (
        <section key={when} className="mt-10">
          <h2 className="text-[17px] font-bold text-ink">{when}</h2>
          <p className="mt-1 text-[14px] text-ink">제목: {m.subject}</p>
          <div className="mt-4 rounded-lg border border-hairline bg-white p-6" dangerouslySetInnerHTML={{ __html: m.html }} />
          <details className="mt-4">
            <summary className="cursor-pointer text-[14px] text-mute">글자만 보는 메일 앱에선 이렇게 보여요</summary>
            <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.7] text-body">{m.text}</pre>
          </details>
        </section>
      ))}
      <p className="mt-6 text-[13px] text-faint">① 메일의 대기 순번·기간은 예시 값이에요. 실제 메일엔 신청 순간의 값이 들어가요.</p>
    </main>
  );
}
