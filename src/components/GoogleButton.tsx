"use client";
// 구글 로그인 버튼 — /login·/signup 공용. **GIS(Google Identity Services) ID 토큰 방식.**
//
// ⭐ 왜 리디렉션(signInWithOAuth)이 아니라 GIS인가 (07-31 대표 확정)
//    예전 방식은 `<ref>.supabase.co/auth/v1/callback`으로 한 번 나갔다 온다. 구글 동의 화면은
//    **앱 이름이 아니라 리디렉션 URI의 호스트**를 표시하기 때문에, 사용자에게
//    "yfvesialziwdacsjlzph.supabase.co에 로그인" 이라고 뜬다 — 앱 이름·게시 상태·소유확인
//    무엇으로도 못 바꾼다. 유료 커스텀 도메인($10/월)이 아니면 콜백을 우리 도메인에 둘 수 없다.
//    GIS는 **리디렉션 자체가 없다.** 구글이 팝업 안에서 ID 토큰을 돌려주고, 그걸 Supabase가
//    서버에서 검증한다. supabase.co를 한 번도 방문하지 않으므로 문구가 우리 도메인이 된다.
//
// ⚠️ 그래서 구글 콘솔에서 쓰는 항목이 다르다 — 리디렉션 URI가 아니라 **승인된 자바스크립트 원본**
//    (`https://collab5.co.kr`, 개발용 `http://localhost:3000`)이 맞아야 버튼이 동작한다.
//    Supabase Google 프로바이더의 **Client IDs**에도 같은 클라이언트 ID가 들어가 있어야
//    signInWithIdToken이 토큰을 받아준다.
//
// ⚠️ 버튼 모양은 구글이 그린다(renderButton). 자체 버튼으로 팝업을 띄우는 공식 API는 없다 —
//    `prompt()`는 원탭 전용이고 `use_fedcm_for_prompt`는 폐기돼 무시된다(2026-07 확인).
//    대신 text/theme/size/locale로 문구와 톤을 맞추고, 구글이 고정해버리는 높이(40px)·라운드(4px)는
//    globals.css의 `[data-gsi] div[role="button"]`에서 우리 버튼 치수(51px·16px)로 덮는다.
//
// ⚠️ 라벨이 "Google로 계속하기"(continue_with)인 이유: 소셜 로그인은 **가입과 로그인이 한 버튼**이다.
//    "가입"이라 쓰면 기존 유저에게, "로그인"이라 쓰면 신규 유저에게 거짓말이 된다.
//
// ⚠️ 구글은 이름·이메일만 준다. 우리 계정은 브랜드명·휴대폰번호가 필수라서 성공 후
//    `/welcome`(온보딩 분기점)으로 보낸다. 이미 채워진 사람은 /welcome이 알아서 홈으로 넘긴다.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";

const GOOGLE_ON = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const GSI_SRC = "https://accounts.google.com/gsi/client";
/** renderButton width 상한(구글 스펙). 컨테이너가 이보다 넓어도 여기서 잘린다. */
const MAX_W = 400;

// ── GIS 최소 타입 — @types 패키지를 새로 물지 않는다(쓰는 건 아래 셋뿐) ──────────────
type CredentialResponse = { credential?: string };
interface GsiId {
  initialize(cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    nonce?: string;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: "popup" | "redirect";
    use_fedcm_for_button?: boolean;
  }): void;
  renderButton(
    el: HTMLElement,
    cfg: {
      type: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: string;
      locale?: string;
    }
  ): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

/** gsi/client 로더 — 모듈 레벨 캐시. StrictMode 이중 마운트·두 페이지 왕복에도 한 번만 받는다. */
let gsiPromise: Promise<void> | null = null;
function loadGsi(): Promise<void> {
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const prev = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const tag = prev ?? document.createElement("script");
    tag.addEventListener("load", () => resolve());
    tag.addEventListener("error", () => {
      gsiPromise = null; // 다음 마운트에서 재시도할 수 있게 캐시를 비운다
      reject(new Error("gsi-load-failed"));
    });
    if (!prev) {
      tag.src = GSI_SRC;
      tag.async = true;
      tag.defer = true;
      document.head.appendChild(tag);
    }
  });
  return gsiPromise;
}

/**
 * 논스 — 재생 공격 방지. 구글에는 **해시(SHA-256 hex)**, Supabase에는 **원문**을 준다.
 * 반대로 넣으면 검증이 조용히 실패한다(= "구글 연결에 실패" 로만 보인다).
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return { raw, hashed };
}

/** 플래그·환경 판정은 훅 밖에서 — 아래 본체가 훅을 쓰므로 조기 return을 여기에 둔다(훅 규칙). */
export function GoogleButton({ className = "" }: { className?: string }) {
  if (!GOOGLE_ON || !CLIENT_ID || !authEnvReady) return null;
  return <GoogleIdButton className={className} />;
}

type Phase = "loading" | "ready" | "signing" | "failed";

function GoogleIdButton({ className }: { className: string }) {
  const router = useRouter();
  const boxRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef("");
  const widthRef = useRef(0);
  const [phase, setPhase] = useState<Phase>("loading");
  const [err, setErr] = useState("");

  /** 컨테이너 폭에 맞춰 구글 버튼을 (다시) 그린다 — 회전·리사이즈로 폭이 바뀌면 재호출된다. */
  const draw = useCallback(() => {
    const box = boxRef.current;
    const id = window.google?.accounts?.id;
    if (!box || !id) return;
    const w = Math.min(Math.round(box.clientWidth) || MAX_W, MAX_W);
    if (w === widthRef.current) return;
    widthRef.current = w;
    box.replaceChildren(); // 재호출 시 이전 버튼이 남지 않게
    id.renderButton(box, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      logo_alignment: "left",
      width: String(w),
      locale: "ko",
    });
  }, []);

  useEffect(() => {
    let alive = true;

    const onCredential = async (res: CredentialResponse) => {
      if (!res.credential) return;
      setErr("");
      setPhase("signing");
      try {
        const supabase = createBrowserAuthClient();
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: res.credential,
          nonce: nonceRef.current, // ⚠️ 해시가 아니라 원문
        });
        if (error) {
          setErr("구글 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
          setPhase("ready");
          return;
        }
        // ⚠️ router.replace가 아니라 **하드 내비게이션**이다(07-31 실측 버그).
        //    이 로그인은 서버액션을 거치지 않고 브라우저에서만 세션이 생긴다. 그래서 Next의
        //    **클라이언트 라우터 캐시엔 로그인 전 RSC**가 그대로 남아 있고, router.replace로 가면
        //    헤더(SiteHeader=서버 컴포넌트)가 **비로그인 상태로 그려진다.**
        //    (이메일 로그인은 signInAction=서버액션이라 Next가 알아서 캐시를 무를 뿐, 우린 그 길이 없다.)
        //    로그인은 세션 경계라 문서를 새로 받는 게 맞다 — 옛 리디렉션 방식도 전체 이동이었다.
        window.location.replace("/welcome"); // 온보딩 분기점 — 이미 채워졌으면 거기서 홈으로 넘긴다
      } catch {
        setErr("구글 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
        setPhase("ready");
      }
    };

    (async () => {
      try {
        await loadGsi();
        const { raw, hashed } = await makeNonce();
        const id = window.google?.accounts?.id;
        if (!alive || !boxRef.current || !id) return;
        nonceRef.current = raw;
        id.initialize({
          client_id: CLIENT_ID,
          callback: onCredential,
          nonce: hashed, // ⚠️ 원문이 아니라 해시
          auto_select: false,
          cancel_on_tap_outside: true,
          ux_mode: "popup", // 리디렉션 금지 — 이 방식을 고른 이유가 그것이다
          // use_fedcm_for_button은 일부러 끈 채로 둔다(기본 false).
          // 버튼 흐름의 FedCM은 아직 옵트인이고 Chrome M125+ 한정이라, 먼저 검증된 팝업으로 깐다.
        });
        draw();
        setPhase("ready");
      } catch {
        if (alive) setPhase("failed");
      }
    })();

    return () => {
      alive = false;
    };
  }, [router, draw]);

  // 폭 변화만 감지해 다시 그린다(draw 안에서 같은 폭이면 무시).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(box);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <div className={className}>
      {/* 구글이 이 안에 버튼을 그린다. 자리를 미리 잡아둬야(min-h) 로드 직후 레이아웃이 튀지 않는다.
          data-gsi = globals.css에서 구글 버튼 높이·라운드를 우리 치수로 맞추는 훅. */}
      <div
        ref={boxRef}
        data-gsi
        className="flex min-h-12 justify-center"
        aria-busy={phase === "loading"}
      />
      {phase === "signing" && (
        <p className="mt-1.5 text-center text-sm text-mute">구글 계정을 확인하고 있어요…</p>
      )}
      {phase === "failed" && (
        <p role="alert" className="mt-1.5 text-sm text-mute">
          구글 로그인을 불러오지 못했어요. 이메일로 로그인해주세요.
        </p>
      )}
      {/* 에러는 라이브 리전으로 — role="alert"이 아니면 스크린리더가 아무 안내도 못 듣는다 */}
      {err && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
