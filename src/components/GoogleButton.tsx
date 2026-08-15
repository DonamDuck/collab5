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
//    대신 text/theme/size/locale로 문구와 톤을 맞추고, **보이는 박스(테두리·라운드·높이)는
//    globals.css의 `[data-gsi]`가 직접 소유한다** — 구글이 그린 건 로고+문구만 얹히는 내용물이다.
//    아래 draw()의 "iframe 인수인계 차단"과 한 세트다.
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

/**
 * 이 버튼이 실제로 그려지는가 — **「간편 로그인」 구분선이 이걸 보고 뜬다.**
 * ⚠️ 아래 조기 return과 **같은 조건**이어야 한다. 어긋나면 버튼 없는 구분선만 남는다.
 */
export const googleButtonEnabled = GOOGLE_ON && !!CLIENT_ID && authEnvReady;

/** 플래그·환경 판정은 훅 밖에서 — 아래 본체가 훅을 쓰므로 조기 return을 여기에 둔다(훅 규칙). */
export function GoogleButton({ className = "" }: { className?: string }) {
  if (!googleButtonEnabled) return null;
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
      // ⚠️ size를 large가 아니라 **medium**으로 두는 건 크기 취향이 아니다(대표 지시 07-31).
      //    large + 폭 200px 이상이면 구글이 **개인화 버튼**("○○ 계정 사용" + 내 이메일·프로필사진)을
      //    자동으로 띄운다 — 우리 앱에 구글로 이미 로그인한 적 있는 사람에게만. 끄는 설정은 **없다**
      //    (구글 문서 확인 07-31: 개인화를 막는 유일한 수단이 type=icon / size=medium·small / 폭<200px).
      //    medium이면 글자만 작아지는데, 겉박스는 [data-gsi]가 51px로 잡으므로
      //    옆 버튼과의 정합은 그대로다. 문구도 그대로 나온다(실측).
      size: "medium",
      // ⚠️ 문구는 **구글이 정한 네 가지 중에서만** 고를 수 있다(signin_with·signup_with·continue_with·signin).
      //    한국어 locale에서 continue_with = "Google 계정으로 계속하기"다. 임의 문구("구글로 시작하기")는
      //    renderButton이 받지 않는다 — 자체 버튼을 그리려면 리디렉션 방식으로 돌아가야 하는데,
      //    그건 동의 화면에 supabase.co가 뜨는 07-31 문제를 되살린다(머리말 참고). 문구는 이대로 둔다.
      text: "continue_with",
      shape: "rectangular",
      // 🎨 left → **center**(대표 지시 08-15). left는 로고를 버튼 왼쪽 끝에 붙이고 글자만 가운데 정렬해서
      //    옆의 카카오 버튼(아이콘+글자가 함께 가운데)과 축이 어긋나 보인다. center면 로고와 글자가
      //    한 덩어리로 가운데 선다.
      logo_alignment: "center",
      width: String(w),
      locale: "ko",
    });

    // 🚨 **구글의 '버튼 iframe 인수인계'를 여기서 끊는다** — "51px로 떴다가 팅 하고 40px" 버그의 진짜 원인.
    //    renderButton은 두 개를 만든다:
    //      ① 경량 DOM 버튼 `div[role="button"]` — 우리 CSS가 닿는다.
    //      ② `accounts.google.com/gsi/button` 크로스오리진 iframe — 처음엔 0×0이라 안 보인다.
    //    브라우저에 **구글 세션이 있으면** ②가 로드에 성공해 부모로 resize 메시지를 쏘고,
    //    gsi/client는 그 메시지를 받아 iframe을 키운 뒤 **①을 DOM에서 삭제한다**
    //    (gsi/client 소스 실측: resize 커맨드 → jv() → dispose() → removeChild).
    //    그 뒤로 보이는 버튼은 iframe 안(높이 40px·라운드 4px 고정)이라 **우리 CSS가 물리적으로 못 닿는다.**
    //    세션 없는 브라우저에선 ②가 영원히 0×0이라 우리 검증 환경에서는 재현이 안 됐다(두 번 헛짚은 이유).
    //    → src를 about:blank로 돌리면 ②는 부모와 메시지 채널을 못 열고, ①이 그대로 살아남는다.
    //    안전한 이유(모두 gsi/client 소스로 확인):
    //      - 클릭 리스너는 구글이 ①에 직접 걸어둔다. 그 핸들러가 여는 팝업 코드는 iframe을 쓰지 않는다.
    //      - 엘리먼트는 **지우지 않고 src만 비운다** — gsi/client가 iframeId로 찾을 때 없으면 로그를 남긴다.
    //      - ②가 담당하던 건 개인화 버튼("○○ 계정 사용")인데, size:"medium"을 고른 이유가 바로 그걸 안 쓰는 것이다.
    //    ⚠️ ①이 없으면(구글이 언젠가 iframe만 그리도록 바뀌면) **건드리지 않는다** —
    //       그땐 iframe이 유일한 버튼이라 죽이면 로그인이 통째로 막힌다. 모양보다 로그인 동작이 우선.
    const drawn = box.querySelector('[role="button"]');
    const frame = box.querySelector("iframe");
    if (drawn && frame) frame.src = "about:blank";
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
      {/* 구글이 이 안에 버튼을 그린다.
          data-gsi = globals.css가 **보이는 버튼 박스**(51px·라운드16·테두리·면)를 그리는 훅.
          자리(min-height)도 거기서 잡으므로 로드 직후 레이아웃이 튀지 않는다. */}
      <div
        ref={boxRef}
        data-gsi
        aria-busy={phase === "loading"}
        // 박스 안 어디를 눌러도 구글 버튼이 눌리게 하는 **2중 안전장치**.
        // CSS가 이미 구글 버튼을 박스에 꽉 채우지만(inset:0), 구글이 언젠가 인라인 `!important`로
        // 더 작은 높이를 박으면 아래쪽에 안 눌리는 띠가 생긴다(실측 확인). 그때도 죽은 영역이 없도록.
        // ⚠️ 구글 버튼이 이미 받은 클릭은 절대 건드리지 않는다 — 그래야 이중 발화·무한 재귀가 없다.
        // 합성 클릭이라도 진짜 사용자 제스처 처리 중이라 팝업 차단에 걸리지 않는다.
        onClick={(e) => {
          const el = boxRef.current?.querySelector<HTMLElement>('[role="button"]');
          if (!el || el.contains(e.target as Node)) return;
          el.click();
        }}
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
