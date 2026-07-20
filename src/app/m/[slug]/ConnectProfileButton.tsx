"use client";

// 소개서 최하단 "프로필에 소개서 연결하기" — 비회원 관리비번으로 만든 소개서(미점유)를 로그인 계정에 귀속.
// 흐름: 비로그인 → 로그인(복귀 경로 `?connect=1`) → 돌아와 비번 얼럿 자동 오픈 → 점유.
//       로그인 상태 → 버튼 클릭 → 비번 얼럿 → 점유. (mechanism = claimMakerAction, /my 연결과 동일)
import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { claimMakerAction } from "@/lib/actions";
import { ScrollLock } from "@/components/ScrollLock";

export function ConnectProfileButton({ slug, loggedIn }: { slug: string; loggedIn: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  // 로그인 후 `?connect=1`로 복귀 → 로그인 상태면 비번 얼럿 자동 오픈.
  useEffect(() => {
    if (loggedIn && searchParams.get("connect") === "1") setOpen(true);
  }, [loggedIn, searchParams]);

  const onClick = () => {
    if (!loggedIn) {
      // 로그인 필요 → 로그인 후 이 소개서(+connect 플래그)로 복귀
      router.push(`/login?redirect=${encodeURIComponent(`/m/${slug}?connect=1`)}`);
      return;
    }
    setOpen(true);
  };

  const submit = () =>
    start(async () => {
      setErr("");
      const r = await claimMakerAction(slug, pw);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setOpen(false); // 비번 얼럿 닫고
      setDone(true); // 완료 얼럿 오픈 (닫을 때 소유자 전환 반영)
    });

  // 완료 얼럿 확인 → 얼럿만 닫음. 겸사겸사 소유자 전환 반영(연결 버튼 사라지고 수정 세션 인증) + connect 플래그 URL 정리.
  const closeDone = () => {
    setDone(false);
    router.replace(`/m/${slug}`);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink hover:border-primary hover:text-primary-on"
      >
        내 프로필에 소개서 연결하기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <ScrollLock />
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
            <p className="text-base font-bold text-ink">프로필에 연결하기</p>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">
              이 소개서의 관리 비밀번호를 입력하면 지금 로그인한 계정에 연결돼요.
            </p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && pw.trim()) submit();
              }}
              placeholder="관리 비밀번호"
              className="mt-4 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-4 flex gap-2">
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
                disabled={pending || !pw.trim()}
                className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
              >
                {pending ? "연결 중…" : "연결하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <ScrollLock />
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-base font-bold text-ink">🎉 소개서 연결 완료</p>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">
              프로필 메뉴에서 언제든 내 소개서를 확인할 수 있어요.
            </p>
            <button
              type="button"
              onClick={closeDone}
              className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </>
  );
}
