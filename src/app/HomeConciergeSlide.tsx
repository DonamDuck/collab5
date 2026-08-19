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
// 🖼️**오른쪽 그림 자리는 비어 있다**(`image` prop). 1번 슬라이드는 매거진 커버가 그 자리를 채우는데
//   우리에게 쓸 만한 가로 이미지가 없다 — `/public/preview/*`는 전부 세로 폰 스크린샷이라
//   16:10으로 자르면 소개서가 잘린다. 대표가 그림(고양이든 뭐든)을 주면 `image`로 넘기면 된다.
//   ⛔그 그림을 우리가 만들어 넣지 않는다 — 08-16 로고 사고와 같은 자리다(준 것을 다시 만들지 말 것).
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
      className="relative mx-auto block w-full max-w-[1320px] px-4 py-7 sm:px-6 sm:py-12"
    >
      <div className="grid items-center gap-5 sm:grid-cols-[1fr_46%] sm:gap-9">
        {image && (
          <div className="order-first overflow-hidden rounded-lg bg-surface-soft sm:order-last">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} className="aspect-[16/10] w-full object-cover" />
          </div>
        )}
        <div className="min-w-0">
          {/* 🏛️1번의 제호(「collab5 매거진」+「창간호」)와 **같은 자리·같은 크기**.
              여기서는 「collab5팀이 직접」이 이름 노릇을 하고 「무료」가 배지 노릇을 한다. */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[15px] font-bold tracking-[0.06em] text-primary sm:text-[17px]">
              collab5팀이 직접
            </span>
            <span className="inline-flex items-center rounded-pill bg-white/15 px-2 py-0.5 text-[11px] font-bold text-white/80">
              무료
            </span>
          </div>
          <p className="mt-3 break-keep text-[13px] font-medium text-white/70 sm:text-[15px]">
            소개서 쓰기 어려우신가요?
          </p>
          {/* 📏1번 슬라이드 제목과 같은 크기(24/40). 여기가 더 크면 슬라이드마다 목소리가 달라진다. */}
          <h2 className="mt-1.5 text-balance break-keep text-[24px] font-bold leading-[1.25] tracking-[-0.025em] text-white sm:mt-2 sm:text-[40px]">
            소개서, 저희가 만들어드릴게요.
          </h2>
          {/* 🔻1번 슬라이드는 요약을 모바일에서 숨기는데(사진이 이미 화면을 채운다) **여기는 반대로 켠다.**
              🔬실측 @375 — 배너 높이는 사진 있는 1번이 정해서 444인데 이 슬라이드는 219밖에 안 돼
                **검은 여백이 225px** 남았다. 그림이 없는 슬라이드는 글이 그 자리를 대신해야 한다.
              ⭐같은 규칙이라도 **무엇이 자리를 채우고 있는지**에 따라 답이 뒤집힌다. */}
          <p className="mt-3 text-[14px] leading-relaxed break-keep text-white/75 sm:text-[16px]">
            웹과 인스타그램에 흩어져 있는 사진과 이야기를 모아 collab5팀이 소개서를 만들어드려요.
            이미 소개서가 있다면 더 풍성하게 채워드리고요.
          </p>
          <div className="mt-5 flex items-center gap-3 sm:mt-7">
            {/* 슬라이드 전체가 링크라 이건 `<span>`이다 — 중첩 앵커 금지(1번과 같은 이유). */}
            <span className="inline-flex h-11 items-center rounded-pill bg-white px-5 text-[14px] font-medium text-ink sm:h-13 sm:px-7 sm:text-[15px]">
              신청하기
            </span>
            <span className="text-[12px] text-white/55 sm:text-[13px]">신청하고 하루면 완성돼요</span>
          </div>
        </div>
      </div>
    </a>
  );
}
