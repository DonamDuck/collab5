"use client";

// 콜라보 찾기 도착 안내 바텀시트 — 08-16 대표 지시.
//
// 언제 뜨나 — **두 갈래**다(08-16 2차 지시로 ②가 추가됐다).
//   ① `?guide=idea` — 홈의 「콜라보 아이디어 추천 받기」를 눌렀는데 **소개서가 이미 있는 사람**.
//      명시적으로 요청한 안내니까 **횟수 제한이 없다.** 누를 때마다 뜬다.
//   ② 파라미터 없이 `/search`에 **처음 온 사람** — 「콜라보 찾기」 메뉴로 들어온 사람도 결국
//      목록 앞에 툭 떨어지는 건 똑같다. 다만 이건 요청한 적 없는 안내라 **생애 1회**로 묶는다
//      (localStorage). 두 번째부터 뜨면 안내가 아니라 통행세다.
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
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDismissable } from "@/components/useDismissable";
import { track } from "@/lib/track";

// 생애 1회 플래그 — 값은 안 읽고 존재만 본다. 키 이름은 기존 시트(`collab5.enrichIntroSheet`)와 같은 문법.
// ⚠️여긴 **기한이 없다.** EnrichIntroSheet는 "닫고 7일 쉬기"였지만 이건 도착지 설명이라
//   한 번 읽었으면 끝이다. 다시 보고 싶은 사람에겐 홈 CTA(①)라는 상시 경로가 따로 있다.
const LS_KEY = "collab5.searchIdeaGuideSeen";

export function SearchIdeaGuide() {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  // 이 마운트에서 "띄울지 말지"를 이미 정했나. 🪤**없으면 무한 재등장 버그가 난다** —
  //   ①로 뜬 시트를 닫으면 close()가 `router.replace`로 주소를 바꾸고, 그러면 `params`가 바뀌어
  //   이 이펙트가 다시 돈다. 그땐 `guide`가 없으니 ②(첫 방문) 분기로 떨어져 방금 닫은 시트가
  //   즉시 다시 올라온다. 필터 칩으로 주소가 바뀔 때도 마찬가지다. 판단은 마운트당 한 번뿐.
  const decidedRef = useRef(false);

  useEffect(() => {
    if (decidedRef.current) return;
    decidedRef.current = true;

    // ⚠️localStorage는 **반드시 이펙트 안에서** 읽는다. 렌더 중에 읽으면 서버 HTML(항상 '안 봤음')과
    //   클라 첫 렌더가 어긋나 하이드레이션이 깨진다.
    const viaCta = params.get("guide") === "idea";

    if (!viaCta) {
      let seen = true; // 🔒기본값이 "봤음"이다 — 읽기가 막힌 환경(프라이빗 모드 등)에선 **안 띄운다.**
      //                  판단 근거가 없을 때 띄우는 쪽을 고르면 매 방문 뜨는 사람이 생긴다.
      try {
        seen = localStorage.getItem(LS_KEY) !== null;
      } catch {
        /* noop — seen=true 유지 */
      }
      if (seen) return;
    }

    // ⭐기록은 **띄우기로 확정한 지금**이다(대표 지시). 이펙트 맨 위에서 미리 찍으면
    //   ?guide=idea로만 들락거린 사람이나 위에서 return된 사람의 1회가 조용히 소진된다.
    // ①로 뜬 경우에도 찍는 이유: 이 사람은 이미 안내를 읽었다. 나중에 메뉴로 들어왔을 때
    //   같은 내용을 또 띄우면 그건 새 정보가 아니라 반복이다.
    try {
      localStorage.setItem(LS_KEY, String(Date.now()));
    } catch {
      /* noop — 못 남겨도 시트는 띄운다. 안내를 못 보는 것보다 또 보는 쪽이 낫다 */
    }

    setOpen(true);
    // 🚨이벤트 **이름은 그대로** 둔다(대표 지시) — 바꾸면 08-16부터의 지표가 두 동강 난다.
    //   대신 `via`로 갈라 "명시적으로 요청해서 본 사람"과 "그냥 들어왔다가 본 사람"을 구분한다.
    //   둘은 기대치가 달라서 뒤이은 이탈률을 같은 바구니에 담으면 안 된다.
    track("search_idea_guide_shown", { via: viaCta ? "cta" : "first_visit" });
  }, [params]);

  const close = () => {
    setOpen(false);
    // 주소에서 신호를 지운다 — 새로고침·공유·뒤로가기에 다시 뜨지 않게.
    // `replace`라 히스토리에 쌓이지 않는다(뒤로가기를 두 번 눌러야 홈으로 가는 일 방지).
    //
    // 🚨**`guide`만 빼고 나머지 쿼리는 살린다.** 예전엔 `/search`로 통째로 갈아치웠는데,
    //   ②(파라미터 없이 첫 방문)가 생기면서 그게 실제 사고가 된다 — 홈에서 유형 칩을 눌러
    //   `/search?type=팝업`으로 들어온 첫 방문자가 시트를 닫는 순간 `type`까지 날아가
    //   **필터가 저 혼자 풀린다**(이 페이지는 서버가 `type`을 읽어 초기값을 만든다).
    // 지울 게 없으면 아예 주소를 안 건드린다 — 불필요한 replace는 서버 재조회를 부른다.
    if (params.get("guide") !== "idea") return;
    const next = new URLSearchParams(params.toString());
    next.delete("guide");
    const qs = next.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
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
            {/* 제목은 **설명이 아니라 권유**다(대표 지시 08-16). 구 문구 "콜라보 아이디어 받는 법"은
                사용법 안내서 제목이라 읽는 사람을 학생 자리에 앉힌다. 지금 문형은 "해보세요" — 아래
                본문이 이미 방법을 말하므로 제목까지 방법을 맡을 이유가 없다. */}
            <p className="text-[18px] font-bold break-keep text-ink">콜라보 아이디어를 추천받아보세요.</p>
            <p className="mt-1.5 break-keep text-[14px] leading-relaxed text-mute">
              마음에 드는 브랜드의 소개서를 연 다음,
              <br />
              아래 <b className="font-medium text-body">콜라보 미리 그려보기</b>를 누르면 분석이 시작돼요.
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
            ⚠️`aria-hidden` — 위 문장이 이미 같은 말을 한다. 스크린리더에 두 번 들릴 이유가 없다.

            🚨🚨**이 그림의 정본은 `src/app/m/[slug]/MakerActionBar.tsx`다.** 08-16에 여기가 실물과
              어긋나 있는 걸 대표가 잡았다 — 목업은 [♡][키위 「콜라보 추천받기」] 2칸이었는데 실물은
              키위 자리가 **「콜라보 제안 시작하기」**(=DM 보내는 완전히 다른 동작)다. 즉 이 그림은
              **틀린 버튼을 가리키고 있었다.** 안내 그림이 틀리면 없느니만 못하다.
            ⚠️실제 컴포넌트를 import하지 않는 이유 — MakerActionBar는 로그인·소유권·`collabPaused`에
              따라 버튼이 통째로 바뀐다(내 소개서면 「소개서 수정하기」가 뜬다). 목업으로 못 쓴다.
            📏치수는 **전부 px**다. 루트 폰트가 17px이라 `h-9`·`gap-2` 같은 rem 유틸은 전부 6.25%씩
              커진다 — 축소 목업처럼 비율이 생명인 그림에선 그 오차가 눈에 보인다.
            📐실물 대비 축소 규칙: 높이 48px→32px, 본문 16px→11px. **flex 비율(0.8 : 1)과 순서는
              실물 그대로** 유지한다 — 사람이 도착해서 알아보는 건 절대 크기가 아니라 배치다. */}
        <div
          aria-hidden="true"
          className="mt-4 rounded-lg border border-hairline bg-surface-soft p-3"
        >
          <p className="text-[11px] font-medium tracking-wide text-faint">소개서 화면 아래쪽</p>

          {/* 유틸 줄 — 실물은 바 **위쪽에 떠 있고 우측 정렬**이다(🔗 링크 복사 = 키위 알약 / ♡ 찜).
              ⭐이 줄을 빼면 안 된다: 실물에서 키위색이 제일 먼저 눈에 띄는 자리가 여기라,
                없으면 아래 키위 버튼이 화면에서 유일한 키위인 줄 알고 그걸 누른다. */}
          <div className="mt-2 flex items-center justify-end gap-[7px]">
            <span className="flex h-[26px] items-center rounded-pill bg-primary px-[10px] text-[10px] font-medium text-primary-on shadow-e1">
              🔗 링크 복사
            </span>
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-pill border border-hairline bg-surface text-[12px] text-faint shadow-e1">
              ♡
            </span>
          </div>

          {/* 바 본체 — 흰 배경 + **상단 좌우만** 라운드(화면 바닥에 붙어 있는 바라서). */}
          <div className="mt-[6px] rounded-t-lg border border-b-0 border-hairline bg-surface px-[10px] pb-[10px] pt-[7px] shadow-e1">
            {/* 소요시간 헬퍼 — 실물과 똑같이 **왼쪽 버튼 폭(flex-[0.8]) 위 정중앙**에 앉힌다.
                이 한 줄이 "왼쪽 버튼이 시간이 걸리는 그 동작"이라는 걸 위치만으로 알려준다. */}
            <div className="mb-[6px] flex items-center gap-[7px]">
              <p className="flex-[0.8] text-center text-[9px] leading-none text-faint">🕐 약 30초면 완료돼요</p>
              <span className="flex-1" />
            </div>
            <div className="flex items-center gap-[7px]">
              {/* ⭐**눌러야 할 버튼.** 실물에선 흰 배경 + 테두리라 옆 키위보다 약해 보이는데,
                  정작 이 안내가 가리키는 건 이쪽이다. 그래서 색을 바꾸지 않고(=실물과 달라지면
                  또 거짓말이 된다) **바깥에 링만 두른다** — 실물 모양은 보존하면서 "여기"만 얹는 방식.
                  링 색은 primary가 아니라 ink 계열이다: 키위 링이면 옆 키위 버튼과 한 덩어리로 읽힌다. */}
              <span className="flex h-[32px] flex-[0.8] items-center justify-center rounded-md border border-border-strong bg-surface text-[11px] font-medium text-ink ring-2 ring-ink ring-offset-2 ring-offset-surface">
                콜라보 미리 그려보기
              </span>
              <span className="flex h-[32px] flex-1 items-center justify-center rounded-md bg-primary text-[11px] font-medium text-primary-on">
                콜라보 제안 시작하기
              </span>
            </div>
          </div>

          {/* 화살표 주석 — 링만으로는 "테두리가 원래 저런가?"로 읽힐 수 있어 말로 한 번 더 못을 박는다.
              바 **바깥**에 둔다(바 안에 넣으면 실물에 없는 UI가 있는 걸로 오해된다).
              위 두 줄과 **같은 flex 비율**을 써서 화살표가 왼쪽 버튼 정중앙 아래에 선다. */}
          <div className="mt-[6px] flex items-start gap-[7px] px-[10px]">
            <p className="flex-[0.8] text-center text-[10px] font-medium leading-none text-ink">↑ 이 버튼이에요</p>
            <span className="flex-1" />
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
