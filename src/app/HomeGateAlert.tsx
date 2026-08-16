"use client";

// 홈 「콜라보 아이디어 추천 받기」 게이트 얼럿 — 08-16 대표 지시.
// 두 가지 경우만 있고, **둘의 다음 행동이 다르다**:
//   kind="login" 비로그인          → 로그인 → 끝나면 **홈으로 복귀**(대표 명시)
//   kind="brand" 로그인+소개서 없음 → 소개서 만들기 (3분이면 된다는 안심 문구 포함)
//
// ⚠️껍데기는 **매거진 하트 얼럿(`/magazine/[slug]/ArticleLikeBar`)과 완전히 같은 것**을 쓴다.
//   같은 사이트의 같은 뜻(=여기서 막힘)이면 같은 얼굴이어야 한다. 여기서 새 모양을 만들면
//   얼럿 어휘가 셋으로 갈린다(08-16에 그 파일이 「/m 얼럿과 같은 껍데기」로 정렬된 이력이 있다).
//   `text-[20px]`·`text-[16px]`처럼 **px로 박은 것도 그대로 승계** — 루트 폰트가 17px이라
//   rem 유틸(text-xl 등)은 21.25px 같은 분수로 떨어진다.
//
// ⚠️`overlayClose: false` — 얼럿은 딤 클릭으로 닫지 않는다(대표 정책 07-29). ESC로는 닫힌다.
//   키보드·스크린리더 사용자에겐 ESC가 사실상 유일한 탈출구라 그건 살려둔다.
//
// 🚨🚨**반드시 body 포털로 띄운다.** 이 얼럿을 부르는 `HomeIdeaCta`는 홈 ③구좌 안에 있고,
//   그 섹션에는 `home-rise` 애니메이션이 걸려 있다. **transform이 있는 조상은 `position: fixed`의
//   컨테이닝 블록이 된다** — 그래서 포털 없이 렌더하면 얼럿이 화면이 아니라 **섹션 박스 기준**으로
//   자리를 잡는다. 실제 증상(08-16 대표 제보): 얼럿이 화면 중앙이 아니라 왼쪽으로 치우쳐 뜨고,
//   화면 밖으로 튀어나가고, 메뉴바(z-[6])보다 아래로 깔린다(z-50인데도 — 쌓임 맥락이 갈렸기 때문).
//   ⚠️이 저장소가 07-31에 리포트 시트로 똑같이 당했고 `SampleReport`의 `PortalSheet`가 그 처방이다.
//     주석까지 남아 있었는데 그대로 반복했다. **홈 안에서 오버레이를 띄우면 무조건 포털.**
//   ⚠️`open`일 때만 렌더되는 컴포넌트라 SSR에서 `document`를 건드릴 일이 없다.
import { createPortal } from "react-dom";
import { useDismissable } from "@/components/useDismissable";
import { track } from "@/lib/track";

export function HomeGateAlert({
  kind,
  onClose,
}: {
  kind: "login" | "brand";
  onClose: () => void;
}) {
  const dialog = useDismissable(true, { onClose, overlayClose: false });

  const isLogin = kind === "login";
  // 제목은 **막힌 이유**, 설명은 **막히면 뭘 못 받는지**. 순서를 바꾸면 "왜 안 되지?"가 남는다.
  const title = isLogin ? "로그인이 필요해요" : "소개서를 먼저 만들어주세요";
  const desc = isLogin
    ? "브랜드 소개서 등록 후 콜라보 아이디어를 받아 볼 수 있어요."
    : "소개서를 등록하면 콜라보 아이디어를 받아 볼 수 있어요.";

  return createPortal(
    // 🎨딤 = `bg-ink/55` + `backdrop-blur-[2px]`(08-16 대표: *"딤도 최선인지 생각해보고"*).
    //   기존 `/40`은 홈 지면이 `surface-faint`(#fafafb)라 **뒤가 너무 잘 보였다** — 얼럿이
    //   "떠 있는 판"이 아니라 "위에 얹힌 흰 카드"로 읽혔다. 55%로 올리고 살짝 흐리면 뒤가
    //   덩어리로만 남아 시선이 얼럿에 갇힌다.
    //   ⚠️`backdrop-blur`를 세게 주면(4px+) 저사양 폰에서 열릴 때 한 프레임 끊긴다 — 2px면 충분하다.
    // 🔢z-[60] — 플로팅 알약(z-[8])·메뉴바(z-[6])·헤더(z-10)보다 확실히 위. 포털로 body에 붙으므로
    //   이제 쌓임 맥락이 하나라 이 숫자가 그대로 먹는다.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px] print:hidden"
      {...dialog.overlayProps}
    >
      <div
        {...dialog.panelProps}
        className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
          </svg>
        </button>

        <p className="px-6 text-[20px] font-bold leading-snug text-balance break-keep text-ink">
          {title}
        </p>
        <p className="mt-2 text-[16px] leading-relaxed text-balance break-keep text-mute">{desc}</p>

        {isLogin ? (
          <>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
              >
                취소
              </button>
              {/* 🔙`redirect=/` — 대표 명시 *"로그인 후 홈으로 다시 이동"*.
                  여기서 `/register`로 보내면 로그인만 하려던 사람이 갑자기 작성 폼에 떨어진다.
                  홈으로 돌아오면 방금 누르려던 그 버튼이 그 자리에 있고, 이번엔 통과한다. */}
              <a
                href="/login?redirect=%2F"
                onClick={() => track("home_gate_login_click")}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-[14px] font-medium text-primary-on"
              >
                로그인
              </a>
            </div>
            <p className="mt-4 text-[13px] text-mute">
              아직 회원이 아니신가요?{" "}
              <a
                href="/signup?redirect=%2F"
                onClick={() => track("home_gate_signup_click")}
                className="font-medium text-ink underline underline-offset-2"
              >
                회원가입
              </a>
            </p>
          </>
        ) : (
          <>
            {/* 이쪽은 **취소를 나란히 두지 않는다.** 이미 로그인한 사람이라 할 일이 하나뿐이고,
                옆에 회색 버튼을 두면 "안 해도 되는 일"처럼 보인다. 닫기는 우상단 X와 ESC. */}
            <a
              href="/register"
              onClick={() => track("home_gate_register_click")}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-medium text-primary-on"
            >
              소개서 만들기
            </a>
            {/* 대표 지정 문구 — 버튼 **아래**에 둔다. 시간이 얼마 안 든다는 말은 누르기 직전에
                한 번 더 밀어주는 역할이라, 위에 두면 조건처럼 읽힌다. */}
            <p className="mt-3 text-[13px] text-mute">3분이면 만들 수 있어요.</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
