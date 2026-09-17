import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildPreviewMail } from "@/lib/dev-mail-preview";

// 📨메일 미리보기 화면 (2026-09-18) · 개발 빌드 전용
// 대표 코멘트: 「여기 내부 들어가서 상세 컨텐츠는 코멘트를 못 남기는 게 아쉬워. 거기도 코멘트 날릴 수 있게」.
// ⭐페이지로 그려서 사이트 레이아웃의 코멘트 위젯이 붙는다. 메일 본문은 iframe이 아니라 **같은 문서 안에** 넣는다 —
//   iframe 안 요소는 위젯이 고를 수 없다. 메일 HTML은 인라인 스타일만 쓰니 사이트 CSS와 부딪힐 일이 적다.
// 🔒운영에선 미들웨어가 `/dev/*`를 404로 막고, 여기서도 한 번 더 막는다.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "메일 미리보기 (개발용)", robots: { index: false } };

export default async function MailPreviewPage({ params }: { params: Promise<{ kind: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { kind } = await params;
  const mail = buildPreviewMail(decodeURIComponent(kind));
  if (!mail) notFound();
  return (
    <main className="mx-auto w-full max-w-[680px] px-4 pt-6 pb-16 sm:px-6">
      <p className="text-[13px] break-all text-mute">
        <Link href="/dev/map#mail" className="underline underline-offset-2">
          ← 지도로
        </Link>{" "}
        · 받는 사람 {mail.to || "(없음)"} · 보내지 않은 미리보기
      </p>
      <p className="mt-1 text-[16px] font-semibold break-keep text-ink">{mail.subject}</p>
      <div className="mt-3 rounded-xl bg-[#f4f4f5] p-3 sm:p-4">
        <div className="rounded-lg bg-white p-4 sm:p-5" dangerouslySetInnerHTML={{ __html: mail.html }} />
      </div>
      <details className="mt-3 text-[13px] text-body">
        <summary className="cursor-pointer py-2">글자만 받는 메일함에서 보이는 모양</summary>
        <pre className="whitespace-pre-wrap break-words">{mail.text}</pre>
      </details>
    </main>
  );
}
