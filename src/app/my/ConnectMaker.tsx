"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimBySlugAction } from "@/lib/actions";

// 기존 소개서 연결 — URL/슬러그 + 비번. 성공 시 /my 새로고침.
// label: 트리거 버튼 문구(추가 연결 시 "+ 소개서 추가 연결").
export function ConnectMaker({ label = "기존 소개서 연결하기" }: { label?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setErr("");
      const r = await claimBySlugAction(link, pw);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });

  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-sm font-medium text-ink"
      >
        {label}
      </button>
    );

  return (
    <div className="rounded-md border border-hairline bg-surface p-4 text-left">
      <p className="text-sm font-medium text-body">소개서 링크와 관리 비밀번호를 입력해주세요.</p>
      <input
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="소개서 링크 또는 m-xxxxxx"
        className="mt-3 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
      />
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="관리 비밀번호"
        className="mt-2 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
      />
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-[13px] text-faint">
        링크를 모르겠다면 <a href="/search" className="underline">찾기</a>에서 내 브랜드를 검색해 링크를 확인해보세요.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
        >
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending || !link.trim() || !pw.trim()}
          className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
        >
          {pending ? "연결 중…" : "연결하기"}
        </button>
      </div>
    </div>
  );
}
