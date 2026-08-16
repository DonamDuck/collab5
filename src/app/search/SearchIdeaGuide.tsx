"use client";

// 콜라보 찾기 도착 안내 바텀시트 — 08-16 대표 지시.
//
// 언제 뜨나: 홈의 「콜라보 아이디어 추천 받기」를 눌렀는데 **소개서가 이미 있는 사람**일 때.
//   그 버튼이 `/search?guide=idea`로 보내고, 이 시트가 도착지에서 "이제 뭘 하면 되는지"를 알려준다.
//
// ⭐왜 필요한가 — 이게 없으면 사람이 목록 화면에 **툭 떨어진다.** 방금 누른 건 "아이디어 추천"인데
//   도착한 건 브랜드 목록이라, 둘을 잇는 한 문장이 없으면 "내가 뭘 누른 거지?"가 된다.
//   대표 지시대로 **다음 동작(소개서를 고른다 → 그 안에서 추천받기를 누른다)** 을 그림까지 붙여 말한다.
//
// ⚠️왜 쿼리(`?guide=idea`)로 넘기나 — /search는 서버가 목록을 주입하는 페이지라 클릭 상태를
//   들고 갈 수 없다. 주소에 있으면 새로고침·뒤로가기에도 안내가 유지된다.
//   ⭐대신 **닫으면 주소에서 지운다**(`router.replace`). 안 지우면 이 사람이 이 주소를 공유하거나
//     즐겨찾기했을 때 남에게도 계속 시트가 뜬다.
//
// 📌`overlayClose: true` — 이건 얼럿이 아니라 **안내**다. 07-29 정책의 "딤 클릭으로 안 닫는다"는
//   *얼럿·확인창·작성 중 위저드*에 붙는 규칙이고(실수로 내용이 날아가는 걸 막는 목적),
//   읽고 지나가면 그만인 안내까지 가두면 그냥 성가시다.
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDismissable } from "@/components/useDismissable";
import { track } from "@/lib/track";

export function SearchIdeaGuide() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (params.get("guide") === "idea") {
      setOpen(true);
      track("search_idea_guide_shown");
    }
  }, [params]);

  const close = () => {
    setOpen(false);
    // 주소에서 신호를 지운다 — 새로고침·공유·뒤로가기에 다시 뜨지 않게.
    // `replace`라 히스토리에 쌓이지 않는다(뒤로가기를 두 번 눌러야 홈으로 가는 일 방지).
    router.replace("/search", { scroll: false });
  };

  const dialog = useDismissable(open, { onClose: close, overlayClose: true });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 sm:items-center sm:p-4 print:hidden"
      {...dialog.overlayProps}
    >
      {/* 📐모바일 = 바텀시트(아래 붙고 위 모서리만 둥글게) / 데스크톱 = 가운데 카드.
          같은 컴포넌트가 두 얼굴을 갖는 건 이 저장소의 기존 시트들과 같은 문법이다. */}
      <div
        {...dialog.panelProps}
        className="w-full max-w-[420px] rounded-t-xl bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-e3 sm:rounded-xl sm:pb-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[18px] font-bold text-ink">콜라보 아이디어 받는 법</p>
            <p className="mt-1.5 break-keep text-[14px] leading-relaxed text-mute">
              마음에 드는 브랜드의 소개서를 연 다음,
              <br />
              아래 <b className="font-medium text-body">콜라보 추천받기</b>를 누르면 분석이 시작돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="닫기"
            className="-mr-2 -mt-2 flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-md text-mute"
          >
            ✕
          </button>
        </div>

        {/* 🖼️그림 설명(대표 지시 *"이미지가 뭔가 참고차 들어가면 이해하기 좋을 것 같다"*).
            ⭐**스크린샷을 쓰지 않는다.** 소개서 하단 액션바는 계속 손보는 화면이라 캡처를 넣으면
              화면이 바뀔 때마다 이 그림이 거짓말이 된다(홈 PreviewPhones가 그래서 재캡처 부담을 진다).
              대신 **그 액션바를 토큰으로 다시 그린다** — 실제 버튼과 같은 색·같은 모양이라
              도착해서 찾을 때 눈이 바로 알아본다. 화면이 바뀌면 여기도 같이 바꿔야 한다는 건 동일하지만,
              적어도 해상도·잘림·다크 대응 문제는 없다.
            ⚠️`aria-hidden` — 위 문장이 이미 같은 말을 한다. 스크린리더에 두 번 들릴 이유가 없다. */}
        <div
          aria-hidden="true"
          className="mt-4 rounded-lg border border-hairline bg-surface-soft p-3"
        >
          <p className="text-[11px] font-medium tracking-wide text-faint">소개서 화면 아래쪽</p>
          <div className="mt-2 flex items-center gap-2 rounded-md border border-hairline bg-surface p-2 shadow-e1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-hairline text-[14px] text-faint">
              ♡
            </span>
            <span className="flex h-9 flex-1 items-center justify-center rounded-md bg-primary text-[13px] font-medium text-primary-on">
              콜라보 추천받기
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            track("search_idea_guide_confirm");
            close();
          }}
          className="mt-5 flex h-12 w-full items-center justify-center rounded-md bg-ink text-[15px] font-medium text-on-dark"
        >
          브랜드 둘러보기
        </button>
      </div>
    </div>
  );
}
