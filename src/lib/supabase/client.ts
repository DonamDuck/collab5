"use client";
// 브라우저용 Auth 클라이언트 — 비번 재설정 링크(code 교환)·카카오 OAuth에 사용.
import { createBrowserClient } from "@supabase/ssr";

export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export const authEnvReady =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
