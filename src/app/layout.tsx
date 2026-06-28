import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "collab5 — 마음 맞는 메이커들의 콜라보 카드",
  description:
    "소소하고 소중한 아기자기한 곳들이 자기 이야기를 세상에 더 펼쳐나가는 교두보. 콜라보 요청 카드로 부담 없이 제안하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <a href="/" className="flex items-center">
            <img src="/logo-lockup.svg" alt="collab5" className="h-7 w-auto" />
          </a>
          <nav className="flex items-center gap-1 text-sm">
            <a href="/search" className="rounded-md px-3 py-1.5 text-mute hover:text-ink">
              찾기
            </a>
            <a
              href="/register"
              className="rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink"
            >
              콜라보 카드 만들기
            </a>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
