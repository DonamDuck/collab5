"use client";

// 홈 「콜라보 아이디어 추천 받기」 — 08-16 대표 지시. **홈의 유일한 주 전환 버튼**이다.
//
// ⭐이 버튼이 하는 일은 "분석을 받으러 가는 길"을 사람 상태에 맞게 갈라 주는 것뿐이다.
//   대표가 정한 3분기 그대로:
//     ① 비로그인          → 얼럿「로그인이 필요해요」 → 로그인 → **홈으로 복귀**
//     ② 로그인 + 소개서 X → 얼럿「소개서 등록 후 …」  → 소개서 만들기
//     ③ 로그인 + 소개서 O → `/search`로 이동 → 도착하면 **바텀시트**가 다음 할 일을 알려준다
//
// ⭐왜 미리 막지 않고 **눌러야 알려주나** — 이게 이번 개편의 요지다. 문턱을 먼저 보여주면
//   "나는 아직 자격이 없네"로 읽혀 이탈한다. 반대로 **일단 누르게 하고 그 자리에서 이유를 말하면**
//   맥락이 이미 생긴 뒤라 소개서 작성이 우리 요구가 아니라 **내 목적의 전제조건**이 된다.
//   ⚠️이건 문구 장난이 아니라 사실이다 — 분석은 A(내 소개서)와 B(상대)가 있어야 돌아간다.
//     없는 기능을 미끼로 쓰는 게 아니므로 도착해서 배신당하지 않는다.
//
// ⚠️왜 클라 컴포넌트인가 — 홈은 ISR(revalidate 300)이다. 서버에서 세션을 읽는 순간 홈 전체가
//   매 요청 렌더로 바뀐다(=캐시 증발). 판정을 **누른 뒤에** 하면 홈 HTML은 계속 캐시된다.
//   🪤그래서 마운트 시점에 미리 부르지 않는다(HomeMenuBar·HomeEnrichBanner는 라벨이 바뀌어야 해서
//     미리 불렀지만, 여기는 라벨이 하나라 **클릭 후 조회**로 충분하다 — 방문마다 도는 쿼리가 없다).
import { useState } from "react";
import { useRouter } from "next/navigation";
import { homeIdeaGateAction } from "@/lib/actions";
import { track } from "@/lib/track";
import { HomeGateAlert } from "./HomeGateAlert";

/** ⚓메뉴바 「콜라보 아이디어 찾기」의 점프 목적지 id.
 *
 *  🚨**id가 붙는 곳은 이 파일이 아니라 `page.tsx`의 ③섹션(`<section id={IDEA_CTA_ANCHOR}>`)이다.**
 *    08-16 대표 지시로 CTA 버튼 → 섹션 제목으로 목적지를 옮겼다(버튼만 보면 왜 누르는지가 없다).
 *    상수를 계속 여기 두는 이유는 **이름이 이 CTA를 가리키기 때문**이고, page.tsx와 HomeMenuBar가
 *    같은 값을 보게 하려면 한 곳에만 있어야 한다. 바꾸려면 여기만 고치면 둘 다 따라온다. */
export const IDEA_CTA_ANCHOR = "home-idea-cta";

type Gate = "login" | "brand" | null;

export function HomeIdeaCta() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [gate, setGate] = useState<Gate>(null);

  const onClick = async () => {
    if (busy) return; // 연타로 액션이 두 번 도는 걸 막는다
    setBusy(true);
    track("home_idea_cta_click");
    try {
      const { loggedIn, hasBrand } = await homeIdeaGateAction();
      if (!loggedIn) {
        setGate("login");
      } else if (!hasBrand) {
        setGate("brand");
      } else {
        // ③ 소개서가 있는 사람 — 다음 할 일은 **상대를 고르는 것**이다.
        //   `?guide=idea`는 도착지(/search)에서 바텀시트를 띄우는 신호다(SearchIdeaGuide 참조).
        //   ⚠️쿼리로 넘기는 이유: /search는 서버가 목록을 주입하는 페이지라 상태를 들고 갈 수 없고,
        //     주소에 있으면 새로고침·뒤로가기에도 안내가 유지된다.
        track("home_idea_cta_to_search");
        router.push("/search?guide=idea");
      }
    } catch {
      // 판정이 실패하면 **막지 않는다** — 로그인한 사람을 문 앞에 세우는 것보다
      // 콜라보 찾기로 보내는 쪽이 손해가 적다(거기서 다시 안내를 받는다).
      router.push("/search?guide=idea");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* 📐`max-w-[640px] sm:mx-auto` = **바로 위 리포트 카드와 같은 폭·같은 중앙정렬**이다.
          ⚠️`sm:mx-auto`가 없으면 안 된다 — 부모 섹션의 `sm:text-center`는 **인라인 내용만**
            가운데로 보낸다. 블록 요소(이 div)는 그대로 왼쪽에 붙어서 카드와 축이 갈린다.
          🔻앵커 id는 여기 없다 — page.tsx의 ③섹션으로 옮겼다(위 IDEA_CTA_ANCHOR 주석 참조). */}
      {/* 📏`mt-10`(42.5) → **`mt-6`**(25.5) — 대표: *"버튼이 조금 너무 아래다"*.
          ⭐카드와 버튼은 **한 덩어리**여야 한다: 리포트를 보고 "그래서?" 하는 순간 바로 눌러야 하는데,
            사이가 뜨면 카드가 끝난 걸로 읽히고 버튼이 별개 섹션처럼 보인다.
            (「분석 결과는 요청한 분만…」 줄을 08-16에 뺐는데, 그게 채우던 자리가 그대로 빈 공백으로
             남아 있었던 것도 겹쳤다 — 문구를 지우면 그 자리 여백도 다시 재야 한다.) */}
      <div className="mt-6 max-w-[640px] text-center sm:mx-auto">
        {/* 🔤`font-medium`이 이 저장소의 버튼 정본이다. 08-16에 여기만 `font-bold`로 썼다가
            대표가 잡아냈다 — *"우리 원래 버튼 안에 볼드 처리 안 했던 것 같아"*. 실제로 `bg-primary`
            버튼 87곳 중 75곳이 `font-medium`이고, `font-bold`인 9곳은 대부분 버튼이 아니라 배지·칩이다.
            ⛔버튼을 굵게 해서 강조하지 않는다. 강조는 **색과 크기**가 이미 하고 있고, 거기에 굵기까지
              더하면 한 요소가 강조 수단을 셋 쥐게 되어 주변이 눌린다. */}
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          className="inline-flex h-13 min-w-[260px] items-center justify-center rounded-md bg-primary px-8 text-[17px] font-medium text-primary-on transition-opacity disabled:opacity-60"
        >
          {/* 📝「나도,」를 앞에 붙였다(대표 08-16). 바로 위에서 **남의 리포트**(캔버스가든 ×
              호락호락도서관)를 한참 읽고 내려온 자리라, 「나도」 한 마디가 그 예시와 자기를 잇는다.
              구경하던 사람을 주인공으로 바꾸는 두 글자다. */}
          나도, 콜라보 아이디어 추천받기
        </button>
        {/* 무엇이 필요한지는 **버튼 아래**에 둔다 — 안에 넣으면 라벨이 두 줄이 되고,
            위에 두면 누르기 전에 문턱으로 읽힌다. 아래면 안내로 읽힌다. */}
        <p className="mt-3 break-keep text-[14px] leading-relaxed text-mute">
          내 소개서와 상대 소개서를 함께 읽고 분석해요.
        </p>
      </div>

      {gate && <HomeGateAlert kind={gate} onClose={() => setGate(null)} />}
    </>
  );
}
