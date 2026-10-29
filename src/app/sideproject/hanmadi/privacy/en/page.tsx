// Hanmadi 개인정보 처리방침 영어판(/sideproject/hanmadi/privacy/en) — 아이폰 1.1 영어 앱스토어용(10-29).
// ../page.tsx(한국어)를 그대로 옮긴 것이다. 한국어가 원본이니 그쪽을 고치면 여기도 같이 고친다.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hanmadi Privacy Policy — collab5",
  description: "Hanmadi doesn't collect any personal information. Your memos, photos and recordings stay on your own device.",
  alternates: { canonical: "/sideproject/hanmadi/privacy/en", languages: { ko: "/sideproject/hanmadi/privacy", en: "/sideproject/hanmadi/privacy/en" } },
};

const H2 = "mt-9 text-[18px] font-bold leading-snug text-ink";
const P = "mt-2.5 text-[16px] leading-relaxed text-pretty text-body";
const LI = "text-[16px] leading-relaxed text-pretty text-body";

export default function HanmadiPrivacyEnPage() {
  return (
    <main lang="en" className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/sideproject/hanmadi"
          className="-ml-2 inline-flex h-[44px] items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Hanmadi
        </Link>
        <Link href="/sideproject/hanmadi/privacy" lang="ko" className="inline-flex h-[44px] items-center px-2 text-[14px] text-mute hover:text-ink">
          한국어
        </Link>
      </div>
      <h1 className="mt-4 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">Hanmadi Privacy Policy</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-pretty text-body">
        Hanmadi doesn&apos;t collect any personal information. Your memos, photos and recordings are stored only on your own device.
      </p>

      <h2 className={H2}>What stays on your device</h2>
      <p className={P}>
        The memos you write, copies of your screenshots and photos, your recordings, and the text transcribed from them. None of it is sent to
        our servers, and it&apos;s deleted when you delete the app.
      </p>

      <h2 className={H2}>Permissions the app uses</h2>
      <ul className="mt-2.5 flex list-disc flex-col gap-1.5 pl-5">
        <li className={LI}>Photos: to show your screenshots and photos, and to save a copy of the photo you pick inside the app.</li>
        <li className={LI}>Microphone: to record when you leave a spoken memo.</li>
        <li className={LI}>Speech recognition: to turn your recordings into text on your device.</li>
        <li className={LI}>Automation (Mac): to import Apple Notes, or to add the browser address of a captured screen to a memo.</li>
      </ul>

      <h2 className={H2}>Internet connection</h2>
      <p className={P}>
        The iPhone app doesn&apos;t connect to the internet. The Mac app downloads one small version file from collab5.co.kr to check for
        updates.
      </p>

      <h2 className={H2}>What we don&apos;t collect or share</h2>
      <p className={P}>There&apos;s no sign-up, and we haven&apos;t added ads or analytics tools. We don&apos;t give any information to other companies.</p>

      <h2 className={H2}>Contact</h2>
      <p className={P}>
        If you have questions, let us know through the{" "}
        <Link href="/help" className="font-medium text-ink underline underline-offset-2">
          collab5 Help Center
        </Link>
        .
      </p>

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed text-mute">Effective: October 23, 2026</p>
    </main>
  );
}
