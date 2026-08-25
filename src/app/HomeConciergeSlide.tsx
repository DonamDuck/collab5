// 상단 배너 **2번 슬라이드** — 「소개서, 저희가 만들어드릴게요」(대표 지시 08-19).
//
// ⭐1번(매거진)과 **같은 골격**이다: 제호줄 → 제목 → 요약 → 흰 알약.
//   한 배경(카본) 위에서 내용만 바뀌어야 「배너 띠」로 읽힌다 — 대표가 08-16에 배경 A안(카본 단색)을
//   고른 이유가 정확히 이거였다(*"나중에 슬라이드로 업체 소개나 이벤트가 될 자리"*).
//   ⚠️슬라이드마다 배경을 다르게 하면 배너가 아니라 **서로 다른 섹션 두 개**가 번갈아 뜨는 것처럼 보인다.
//
// 🔗목적지 = 구글폼(컨시어지 신청). `/m/[slug]`의 보강 배너와 **같은 폼**이다
//   (대표가 준 `docs.google.com/...1FAIpQLSf...` = `forms.gle/6XnnSTCQ2HDVkf2Y7`의 원본 주소).
//   ⚠️폼을 바꾸면 `src/app/m/[slug]/page.tsx`의 `ENRICH_FORM_URL`도 같이 고친다.
//
// 🖼️**그림이 없다. 그리고 그게 문제가 아니다**(08-25 대표가 재료를 찾아 해결).
//   1번(매거진)은 오른쪽 46%를 커버 사진이 채우는데 여기는 빌 수밖에 없었고, 그 빈 자리가
//   08-19에 이 슬라이드를 내리게 한 이유 중 하나였다.
//   ⭐대표가 인스타 「브랜드 탐방록」 표지를 가리켰다 — https://www.instagram.com/p/DcQ1tn3EoU0/
//     **사진 없이 글자만으로 성립하는 판**이라 가로로 옮기면 그대로 맞는다.
//   📐원본 = 클로드 디자인 「브랜드 소개서 모집 캐러셀」의 `MainDark.dc.html`(1080×1350).
//     https://claude.ai/code/artifact/fb92301a-5453-4414-8de7-9d74fadc0c47
//   🎨**대표가 아이폰에서 만진 판을 따랐다.** 원본은 보조 글자가 전부 어두운 초록(#7acb4e)인데
//     게시본에서는 **회색·흰색**이다. 카본 위에서 #7acb4e는 탁해서 잘 안 읽힌다 — 대표 판단이 맞다.
//     ⛔우리가 그림을 다시 그리지 않는다. **옮긴 것은 색·크기·배치이고 문안과 구조는 원본 그대로다.**

"use client";

import { track } from "@/lib/track";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfMfp0FOtQtmHx4dlY46iF5JR0y-mv107JYMpa4al2JJdz4JQ/viewform";

export function HomeConciergeSlide({ image }: { image?: { src: string; alt: string } }) {
  return (
    <a
      href={FORM_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track("home_banner_concierge_click")}
      // 📐1번 슬라이드의 안쪽 상자와 **같은 값**이다(max-w-1320 · px-4/6 · py-7/12).
      //   숫자가 어긋나면 슬라이드가 넘어갈 때 글이 좌우로 튄다.
      // 🎨**배경을 슬라이드가 직접 깐다.** 캐러셀 섹션이 카본을 깔고 있으므로 여기서 덮어야
      //   2번만 다른 면이 된다. `block w-full`이라 풀블리드가 그대로 유지된다.
      // 🎨**배경을 슬라이드가 직접 깐다.** 캐러셀 섹션이 카본을 깔고 있으므로 여기서 덮어야
      //   2번만 다른 면이 된다. 🪤`h-full`이 필수다 — 없으면 칸을 다 못 채워 위아래로 카본이 샌다.
      className="relative flex h-full w-full items-stretch bg-[#D6FFC0]"
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-col px-4 py-7 sm:px-6 sm:py-12">
      {/* 📐**데스크톱 2열 / 모바일 1열** — 1번 슬라이드와 같은 골격(`[1fr_46%]`)이다.
          오른쪽 46%는 1번에서 매거진 커버가 먹는 자리다. 여기엔 소개서 실물 목업이 들어간다. */}
      <div className="grid flex-1 items-center gap-5 sm:grid-cols-[1fr_46%] sm:gap-9">
        {/* 🔻**모바일 3단(`justify-between`)을 걷어냈다**(08-25 2차).
            그건 「모바일엔 그림이 없다」는 전제 위에 세운 처방이었는데, 목업을 모바일에도 넣으면서
            **전제가 사라졌다.** 이제 1번 슬라이드와 똑같이 「이미지 → 글」로 자연스레 흐른다. */}
        <div className="min-w-0">
          {/* 🏛️1번의 제호 자리와 같은 자리·같은 크기. 「모집」이 배지, 뒤가 이름 노릇을 한다.
              ⚠️인스타 원본은 알약이 **왼쪽**이다(1번과 순서가 반대). 원본을 따른다 —
                「모집」이 먼저 눈에 박히는 게 이 판의 문법이다. */}
          <div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="inline-flex items-center rounded-pill bg-[#111] px-2.5 py-0.5 text-[13px] font-bold text-[#D6FFC0] sm:px-3 sm:py-1 sm:text-[14px]">
              모집
            </span>
            <span className="text-[15px] font-bold tracking-[0.01em] text-[#3a4a2e] sm:text-[17px]">
              본격! 소개서 만들기 프로젝트
            </span>
          </div>
          </div>

          <div>
          {/* 🔻**모바일에서는 숨긴다**(대표 지적 08-25: *"텍스트가 너무 다닥다닥"*).
              ⭐답답함의 원인은 글자 크기가 아니라 **덩어리 수**였다 — 좁은 폭에서 제호줄·부제·2줄 제목·
                버튼줄이 넷이나 쌓이면 간격을 아무리 벌려도 빽빽하다. 하나를 덜어내야 나머지가 숨을 쉰다.
              🗑️부제를 고른 이유 = **제목이 이미 그 일을 한다.** 「그동안 해온 활동, 한 페이지로 만들어
                드려요」가 무엇을 주는지 말하고 있어서, 「막막하셨다면」은 공감을 한 번 더 얹는 것뿐이다.
                (대표도 *"이 문장을 빼도 되고"*라고 짚었다)
              🖥️데스크톱은 가로 여유가 있으니 그대로 남긴다. */}
          <p className="hidden break-keep font-medium text-[#3a4a2e] sm:mt-3 sm:block sm:text-[15px]">
            콜라보를 제안할 때, 뭘 보여줘야 할지 막막하셨다면
          </p>
          {/* 📏크기(24/40)는 1번 슬라이드 제목과 같다 — 여기가 더 크면 슬라이드마다 목소리가 달라진다.
              🎨글자는 **검정**이다. 밝은 면이라 흰 글자를 쓸 수 없고, 어두운 초록보다 대비가 세다. */}
          <h2 // 📏모바일 간격을 크게 잡는다 — 제목이 **2줄**이라 1줄짜리(1번 슬라이드) 기준으로 붙이면
          //   덩어리가 서로 밀착해 보인다. 줄 수가 늘면 위아래 여백도 같이 늘어야 한다.
          className="mt-4 text-balance break-keep text-[24px] font-bold leading-[1.22] tracking-[-0.03em] text-[#111] sm:mt-2 sm:text-[40px]">
            그동안 해온 활동,
            <br />한 페이지로 만들어 드려요.
          </h2>
          {/* 모바일에서는 숨긴다 — 1번 슬라이드의 요약과 같은 규칙. */}
          <p className="mt-3 hidden text-[15px] leading-relaxed break-keep text-[#3a4a2e] sm:block sm:text-[16px]">
            웹과 인스타그램에 흩어져 있는 사진과 이야기를 모아 collab5팀이 한 페이지로 정리해드려요.
          </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mt-7">
            {/* 슬라이드 전체가 링크라 이건 `<span>`이다 — 중첩 앵커 금지(1번과 같은 이유). */}
            <span className="inline-flex h-11 items-center rounded-pill bg-[#111] px-5 text-[14px] font-medium text-white sm:h-13 sm:px-7 sm:text-[15px]">
              신청하기
            </span>
            {/* 📝원본은 「비용 없음 · DM으로 신청」인데 우리는 폼으로 받는다 — 경로가 다르니 조건만 남긴다. */}
            <span className="text-[12px] text-[#4a5a3e] sm:text-[13px]">
              비용 없음 · 1인·소규모 브랜드라면 누구나
            </span>
          </div>
        </div>

        {/* 🖼️**모바일에도 뜬다**(08-25 2차, 대표: *"모바일에서 사진이 없으니 너무 심심해"*).
            🔻처음엔 데스크톱 전용이었다 — 「폰으로 보는 사람에게 화면 그림을 또 보여줄 이유가 없다」는
              생각이었는데, 실물에서 **2번만 그림이 없어 배너가 텅 비어 보였다.** 배너 높이는 사진이 있는
              1번이 정하기 때문이다. ⭐그림이 없어서 생긴 문제는 그림으로 푼다.
            📐**1번 슬라이드의 커버 사진과 똑같은 규격**이다 — 같은 `aspect-[16/10]`, 같은 자리
              (`order-first sm:order-last`: 모바일은 위, 데스크톱은 오른쪽), 같은 `gap-5 sm:gap-9`.
              🪤그래야 슬라이드를 넘길 때 **높이가 튀지 않는다.** 규격이 다르면 한 장은 길고 한 장은 짧아
                배너가 들썩인다(대표 지시 08-25).
            🔎창 두 대인 이유 — 16:10 가로 상자에 세로로 긴 화면 하나만 넣으면 좌우가 빈다.
              두 대를 나란히 두면 비율이 맞고, 홈 ④구좌 `PreviewPhones`와도 같은 얼굴이 된다.
            ⚠️모바일에서 창 안 글씨는 **못 읽는다**(폭 375에서 창 하나가 약 160px). 읽으라고 넣는 게 아니라
              「소개서 실물이 이렇게 생겼다」는 인상용이다. */}
        <div className="order-first sm:order-last">
          {/* 📐1번 슬라이드 커버와 **같은 상자**(16:10). 창은 그보다 길어 아래가 잘린다 —
              「방금 연 화면」으로 읽히고, 스크롤해 내려간 화면처럼 보이지 않는다. */}
          <div className="grid aspect-[16/10] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 overflow-hidden">
            {[
              { src: "/preview/brand-page-m1-v2.jpg", alt: "브랜드 소개서 예시 — 캔가의 소개와 대표 사진" },
              { src: "/preview/brand-page-m2-v2.jpg", alt: "브랜드 소개서 예시 — 캔가가 하고 있는 일" },
            ].map((m) => (
              // 창틀 = 홈 ④구좌 `PreviewPhones`와 같은 옷.
              // ⛔그림자 없음 — 라인과 그림자는 둘 다 「여기가 끝」을 말해 같이 쓰면 경계가 두 번 그어진다(볼트 08-14).
              // ⚠️`ring-black/[.10]` — `PreviewPhones`는 흰 지면 위라 `.07`이면 됐지만 여기는 연둣빛 면 위라 한 단 진해야 뜬다.
              <div
                key={m.src}
                // 🪤`min-w-0`이 필수다 — grid 칸은 기본이 `min-width:auto`라 **안에 든 이미지의 원본
                //   폭(780px)만큼 칸이 벌어진다.** 그러면 창이 상자를 넘쳐 오른쪽이 잘린다(실측 08-25).
                className="min-w-0 overflow-hidden rounded-[14px] bg-white ring-1 ring-black/[.10]"
              >
                <div className="flex items-center gap-1.5 border-b border-black/[.06] bg-[#f5f5f6] px-2.5 py-[7px]">
                  <svg
                    viewBox="0 0 12 12"
                    className="h-[9px] w-[9px] shrink-0 text-[#9a9a9a]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    aria-hidden="true"
                  >
                    <rect x="2.5" y="5.2" width="7" height="5" rx="1.2" />
                    <path d="M4.2 5.2V3.8a1.8 1.8 0 013.6 0v1.4" />
                  </svg>
                  <span className="truncate text-[8.5px] text-[#9a9a9a]">collab5.co.kr/m/…</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.src} alt={m.alt} className="block h-auto w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </a>
  );
}
