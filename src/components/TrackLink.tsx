"use client";

// 계측 달린 Link — 서버 컴포넌트(홈 등)에서 CTA 클릭을 GA4로 보낼 때 쓰는 얇은 래퍼.
// 네비게이션은 Link 그대로(soft 전환 유지), 클릭 순간 track만 얹는다.
import Link from "next/link";
import { track } from "@/lib/track";

export function TrackLink({
  href,
  event,
  params,
  className,
  children,
}: {
  href: string;
  event: string;
  params?: Record<string, string | number | boolean>;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} onClick={() => track(event, params)} className={className}>
      {children}
    </Link>
  );
}
