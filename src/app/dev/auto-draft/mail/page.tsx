// /dev/auto-draft/mail?id=… — 고객에게 갈 안내 메일 미리보기 (2026-10-05, 로컬 전용)
// 대표 10-05: *「이메일 초안도 내가 한번 봐야 될 것 같아. 링크가 달려 있어야 되고」* — 보내는 코드와 같은 함수(draftReadyMail)를 그린다.
import { notFound } from "next/navigation";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { draftReadyMail } from "@/lib/notify";

export const dynamic = "force-dynamic";

export default async function MailPreview({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const id = ((await searchParams).id ?? "").replace(/[^0-9a-z-]/gi, "");
  let brandName = "예시 브랜드";
  let to = "name@example.com";
  let slug = "draft-xxxx";
  if (id) {
    try {
      const r = JSON.parse(await readFile(path.join(process.cwd(), "_workspace", "auto-draft-queue", `${id}.json`), "utf8"));
      brandName = r.brandName;
      to = r.email;
      slug = r.slug || `draft-${id.slice(-4)}`;
    } catch {}
  }
  const h = await headers();
  const base = (process.env.NEXT_PUBLIC_SITE_URL || `http://${h.get("host") ?? "localhost:3001"}`).replace(/\/$/, "");
  const m = draftReadyMail({ brandName, url: `${base}/m/${slug}` });
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="text-[22px] font-bold text-ink">안내 메일 미리보기</h1>
      <p className="mt-2 text-[14px] text-mute">받는 사람 {to} · 보내는 사람 {process.env.NOTIFY_FROM || "collab5 <onboarding@resend.dev>"}</p>
      <p className="mt-1 text-[14px] text-ink">제목: {m.subject}</p>
      <div className="mt-5 rounded-lg border border-hairline bg-white p-6" dangerouslySetInnerHTML={{ __html: m.html }} />
      <details className="mt-5">
        <summary className="cursor-pointer text-[14px] text-mute">글자만 보는 메일 앱에선 이렇게 보여요</summary>
        <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-[1.7] text-body">{m.text}</pre>
      </details>
    </main>
  );
}
