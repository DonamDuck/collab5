"use client";
// 「연결된 로그인」 — 한 계정에 이메일·카카오·구글을 붙였다 뗀다 (대표 설계 08-15).
//
// ⭐ 왜 필요한가
//    소셜 로그인의 가장 흔한 사고는 **같은 사람이 계정을 둘 만드는 것**이다.
//    이메일로 가입해 소개서를 다 만들어 둔 사장님이 어느 날 카카오 버튼을 누르면,
//    카카오 이메일이 다를 경우 **아무것도 없는 새 계정**으로 들어가 "내 소개서가 사라졌다"가 된다.
//    Supabase가 **같은 인증된 이메일**은 자동으로 묶어주지만(자동 연결), 주소가 다르면 못 묶는다.
//    그 구멍을 사용자가 직접 메우는 자리가 여기다.
//
// ⭐ 이메일이 달라도 된다 — 이게 이 기능의 핵심이다.
//    `linkIdentity`는 **이미 로그인한 상태**에서 붙이는 것이라 "누구인지"가 이미 확정돼 있다.
//    그래서 카카오 주소가 hanmail이든 뭐든 상관없다. (이메일을 맞춰 오라고 안내할 필요가 없다.)
//
// 🚨 **Supabase 대시보드에서 manual linking을 켜야 동작한다** (Authentication → 설정,
//    또는 `GOTRUE_SECURITY_MANUAL_LINKING_ENABLED`). 꺼져 있으면 연결 시도가 에러로 떨어지므로
//    아래에서 그 경우를 따로 안내한다 — 조용히 실패하면 원인을 못 찾는다.
//
// ⚠️ **구글 연결은 로그인 때와 방식이 다르다.** 로그인 버튼은 GIS 토큰 방식이라 구글 동의 화면에
//    우리 도메인이 뜨지만, `linkIdentity`는 OAuth 리디렉션만 지원해서 **`<ref>.supabase.co`를 거친다.**
//    (07-31에 로그인에서 피했던 그 화면이다.) 이미 로그인한 사람이 계정 설정에서 하는 행위라
//    처음 만나는 로그인 화면보다는 부담이 덜하다고 보고 그대로 둔다 — 바꾸려면 커스텀 도메인($10/월).
import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";
import { kakaoButtonEnabled } from "@/components/KakaoButton";
import { googleButtonEnabled } from "@/components/GoogleButton";
import { LoadingDots } from "@/components/LoadingDots";

type Provider = "kakao" | "google";

const LABEL: Record<Provider, string> = { kakao: "카카오", google: "구글" };

/**
 * 🚨**실패 이유를 삼키지 않는다**(08-15에 당했다 — "잠시 후 다시 시도해주세요"만 띄웠더니
 * 연결도 해제도 안 되는데 **왜인지 아무 데도 안 남아** 네트워크를 뒤져야 했다).
 * 서버 원문을 괄호로 덧붙이고 콘솔에도 남긴다. 화면 문구는 사람 말로, 원인은 그 옆에.
 *
 * ⭐가장 흔한 원인은 **Supabase의 manual linking이 꺼져 있는 것**이라 그건 우리 말로 번역해준다.
 *   (읽기(getUserIdentities)는 되는데 연결·해제만 막히면 십중팔구 이것이다.)
 */
function reason(e: unknown): string {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
  console.error("[LinkedAccounts]", e);
  if (/manual linking|not enabled|disabled/i.test(msg)) {
    return "(Supabase에서 계정 연결(manual linking)이 꺼져 있어요 — 관리자 설정이 필요합니다)";
  }
  if (/already|exists|linked/i.test(msg)) {
    return "(이미 다른 계정에 연결된 로그인이에요. 그 계정을 정리한 뒤 다시 시도해주세요)";
  }
  return msg ? `(${msg})` : "잠시 후 다시 시도해주세요.";
}

export function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const supabase = createBrowserAuthClient();
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      setIdentities(data?.identities ?? []);
    } catch {
      setIdentities([]); // 조회 실패해도 화면은 살린다 — 아래 목록이 "연결 안 됨"으로 보일 뿐
    }
  }, []);

  useEffect(() => {
    if (authEnvReady) void load();
  }, [load]);

  // 켜져 있는 소셜이 하나도 없으면 이 섹션 자체가 의미 없다(플래그 판정은 각 버튼이 정본).
  const available = ([] as Provider[])
    .concat(kakaoButtonEnabled ? ["kakao"] : [])
    .concat(googleButtonEnabled ? ["google"] : []);
  if (!authEnvReady || available.length === 0) return null;

  const linkedOf = (p: Provider) => identities?.find((i) => i.provider === p);

  const link = async (p: Provider) => {
    setErr("");
    setBusy(p);
    try {
      const supabase = createBrowserAuthClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: p,
        // 연결을 마치면 이 화면으로 돌아온다 — 어디서 시작했는지 잊지 않게.
        options: { redirectTo: `${window.location.origin}/my` },
      });
      // 성공하면 브라우저가 떠나므로 아래는 실행되지 않는다.
      if (error) {
        setErr(`${LABEL[p]} 연결을 시작하지 못했어요. ${reason(error)}`);
        setBusy(null);
      }
    } catch (e) {
      setErr(`${LABEL[p]} 연결을 시작하지 못했어요. ${reason(e)}`);
      setBusy(null);
    }
  };

  const unlink = async (p: Provider) => {
    const target = linkedOf(p);
    if (!target) return;
    // 🚨 마지막 하나는 못 뗀다 — 떼면 **다시 로그인할 방법이 사라진다.**
    //    Supabase도 서버에서 막지만(최소 1개), 그 에러를 보여주느니 여기서 미리 말해준다.
    if ((identities?.length ?? 0) <= 1) {
      setErr("마지막 남은 로그인 방법이라 해제할 수 없어요. 다른 방법을 먼저 연결해주세요.");
      return;
    }
    setErr("");
    setBusy(p);
    try {
      const supabase = createBrowserAuthClient();
      const { error } = await supabase.auth.unlinkIdentity(target);
      if (error) throw error;
      await load(); // 서버 상태를 다시 읽는다 — 화면에서만 지우면 실제와 어긋난다
    } catch (e) {
      setErr(`${LABEL[p]} 연결을 해제하지 못했어요. ${reason(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const emailIdentity = identities?.find((i) => i.provider === "email");

  return (
    <div>
      <h2 className="text-[17px] font-bold text-ink">연결된 로그인</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-mute">
        한 계정에 여러 로그인 방법을 연결해두면, 다음부터 편한 방법으로 들어오실 수 있어요.
      </p>

      {identities === null ? (
        <div className="mt-4 flex justify-center py-4">
          <LoadingDots />
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {/* 이메일은 여기서 연결/해제하지 않는다(비밀번호는 아래 버튼에서 건다) — 상태만 보여준다.
              🚨**행 자체는 항상 세운다.** 예전엔 `email` identity가 있을 때만 그렸는데,
                 소셜로만 가입한 계정은 그게 없어서 **목록에서 통째로 사라졌다**(08-15 카카오 실측).
                 그러면 "내 이메일 로그인은 어디 갔지"가 되고, 무엇보다 **로그인 문이 하나뿐이라는
                 사실이 화면에 안 드러난다.** 없으면 없다고 말해주는 게 맞다. */}
          <li className="flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3">
            <span className="text-[15px] text-body">이메일</span>
            <span className="text-[13px] text-mute">
              {emailIdentity ? "연결됨" : "비밀번호 미설정"}
            </span>
          </li>
          {available.map((p) => {
            const linked = linkedOf(p);
            return (
              <li
                key={p}
                className="flex items-center justify-between rounded-md border border-hairline bg-surface px-4 py-3"
              >
                <span className="text-[15px] text-body">{LABEL[p]}</span>
                {linked ? (
                  <button
                    type="button"
                    onClick={() => unlink(p)}
                    disabled={busy !== null}
                    className="rounded-pill border border-hairline px-3 py-1 text-[13px] text-mute disabled:opacity-40"
                  >
                    {busy === p ? "해제 중…" : "연결 해제"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => link(p)}
                    disabled={busy !== null}
                    className="rounded-pill border border-primary bg-primary-tint px-3 py-1 text-[13px] font-medium text-primary-on disabled:opacity-40"
                  >
                    {busy === p ? "이동 중…" : "연결하기"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {err && (
        <p role="alert" className="mt-2 text-[13px] text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
