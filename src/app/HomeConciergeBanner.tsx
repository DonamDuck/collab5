"use client";

// 홈 컨시어지 배너 — 「소개서, 저희가 만들어드릴게요」. ④ 소개서 미리보기 구좌 **바로 아래**.
//
// ⭐왜 여기인가 — ④에서 소개서 실물 7장을 막 넘겨 본 참이다. 그때 생기는 감정이 둘로 갈린다:
//   ① "이쁘다, 나도 만들어야지" → **플로팅 알약**(3분 만에 등록하기, /register)이 받는다.
//   ② "이쁜데… 나는 못 쓰겠는데" → **여기가 그 사람을 받는다.** 지금까지 홈에는 ②의 답이 없었다.
//   즉 알약과 경쟁하는 게 아니라 **알약이 못 받는 절반**을 받는다.
//
// 🔗목적지 = 구글폼(컨시어지 신청). `/m/[slug]`의 EnrichBanner와 **같은 폼**이다
//   (대표가 08-19에 준 `docs.google.com/...1FAIpQLSf...` = `forms.gle/6XnnSTCQ2HDVkf2Y7`의 원본 주소).
//   ⚠️폼 주소를 바꿀 일이 생기면 `src/app/m/[slug]/page.tsx`의 `ENRICH_FORM_URL`도 같이 고친다.
//
// 🗑️`HomeEnrichBanner.tsx`(08-02)를 **대체한다.** 그쪽은 로그인 상태를 물어(`hasOwnBrandAction`)
//   「있는 사람=폼 / 없는 사람=/register」로 갈랐는데, 대표 지시가 *"만들어+보강해 드립니다"*라
//   **두 사람 모두 폼으로** 간다. 갈래가 사라졌으니 세션 조회도 필요 없다 —
//   그래서 이 파일은 서버 왕복이 0이고, 홈 ISR(revalidate 300)에도 영향이 없다.
//   ⚠️`HomeEnrichBanner`는 지금도 어디서도 import되지 않는다(창고 부품). 처분은 대표 판단 대기.
import { track } from "@/lib/track";

const FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfMfp0FOtQtmHx4dlY46iF5JR0y-mv107JYMpa4al2JJdz4JQ/viewform";

/** 🐱소개서 뒤에서 빼꼼 내다보는 고양이 — 대표 지시 *"엄청 귀여운 느낌"*.
 *  ⭐선화(line art)로 그린 이유 — 우리 지면은 순백+중성 그레이(07-31 확정)라 **꽉 찬 색면 캐릭터**를
 *    올리면 혼자 튄다. 선으로 그리면 귀여움은 형태(둥근 얼굴·감은 눈·앞발)가 내고, 색은
 *    코·볼·귀 안쪽 **점 세 군데**만 Kiwi로 찍어 브랜드에 붙는다.
 *  🎨색은 전부 `primary-on`(currentColor)이다. `text-ink`를 쓰면 **다크 테마에서 선이 하얘져**
 *    연둣빛 카드 위에서 통째로 사라진다(--ink는 다크에서 #fafafa로 뒤집힌다).
 *    반대로 --primary-on은 다크에서 #222222 — 밝은 면 위에 있어야 하는 이 카드에 딱 맞는다.
 *  🪤흰 부분은 `#fff` **리터럴**이다. `fill-surface`를 쓰면 다크에서 #2c2c2c가 되어 고양이가 검어진다. */
function CatPeek({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 110"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* 귀 — 머리보다 먼저 그린다(머리 원이 밑동을 덮어 삼각형 아랫변이 안 보이게) */}
      <path d="M44 24 L38 4 L58 13 Z" fill="#fff" />
      <path d="M88 24 L94 4 L74 13 Z" fill="#fff" />
      <path d="M45 20 L42 10 L52 14 Z" className="fill-primary-strong" strokeWidth={0} />
      <path d="M87 20 L90 10 L80 14 Z" className="fill-primary-strong" strokeWidth={0} />
      {/* 머리 */}
      <ellipse cx="66" cy="42" rx="30" ry="27" fill="#fff" />
      {/* 감은 눈(∧) — 뜬 눈보다 이게 더 귀엽다. 점 두 개는 무표정에 가깝다 */}
      <path d="M51 43 q5 -7 10 0" />
      <path d="M71 43 q5 -7 10 0" />
      {/* 볼 */}
      <ellipse cx="46" cy="52" rx="6" ry="3.6" className="fill-primary-strong" strokeWidth={0} opacity={0.75} />
      <ellipse cx="86" cy="52" rx="6" ry="3.6" className="fill-primary-strong" strokeWidth={0} opacity={0.75} />
      {/* 코 — 카드에서 유일하게 원색 Kiwi가 찍히는 자리 */}
      <path d="M62.5 50 L69.5 50 L66 54 Z" className="fill-primary" strokeWidth={1.6} />
      {/* 수염 */}
      <g opacity={0.45} strokeWidth={2}>
        <path d="M36 46 L20 42" />
        <path d="M36 51 L20 53" />
        <path d="M96 46 L112 42" />
        <path d="M96 51 L112 53" />
      </g>
      {/* 소개서 — 고양이 아랫부분을 덮어 「뒤에서 빼꼼」이 성립한다 */}
      <rect x="14" y="60" width="104" height="46" rx="7" fill="#fff" />
      <g strokeWidth={0} fill="currentColor" opacity={0.17}>
        <rect x="27" y="72" width="52" height="5" rx="2.5" />
        <rect x="27" y="84" width="74" height="5" rx="2.5" />
        <rect x="27" y="96" width="38" height="5" rx="2.5" />
      </g>
      {/* 앞발 — 종이 윗변에 걸친다. 이게 없으면 고양이가 종이 뒤에 「잘려 있는」 것처럼 보인다 */}
      <rect x="27" y="54" width="19" height="12" rx="6" fill="#fff" />
      <rect x="86" y="54" width="19" height="12" rx="6" fill="#fff" />
    </svg>
  );
}

export function HomeConciergeBanner() {
  return (
    // ⚠️카드 **전체가 링크**다(매거진 배너와 같은 구조). 그래서 아래 「신청하기」는 버튼이 아니라
    //   버튼처럼 보이는 `<span>`이다 — 링크 안에 링크를 두면 중첩 앵커(HTML 위반)가 된다.
    // 🎨면색 = `primary-pale`. 07-31에 **상단 풀블리드 배너**의 배경으로 썼다가 반려된 색이지만
    //   (*"연두색 배경 완전 별루"*), 그때 반려 사유는 「브랜드 색을 **큰 면**으로 쓰면 버튼의
    //   '눌러라'가 흐려진다」였다. 여기는 화면 폭 전체가 아니라 카드 하나고, `/m`의 보강 배너가
    //   이미 같은 면색으로 라이브다 — 두 배너가 같은 얼굴이어야 같은 서비스로 읽힌다.
    <section
      className="home-rise mt-16 sm:mt-20"
      style={{ animationDelay: "700ms" }}
      // 🎈**여기서 플로팅 알약이 내려간다**(B구간의 끝). 지우면 알약이 이 배너 위에 겹쳐 선다.
      data-pill-end
    >
      <a
        href={FORM_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track("home_concierge_banner_click")}
        className="group flex flex-col items-start gap-4 rounded-xl border border-primary-strong bg-primary-pale px-5 py-6 text-left transition-colors hover:bg-primary-tint sm:flex-row sm:items-center sm:gap-8 sm:px-9 sm:py-7"
      >
        {/* 📐데스크톱에서 고양이를 **왼쪽**에 둔다 — 시선이 그림에 붙었다가 글로, 글에서 버튼으로
            한 방향으로 흐른다. 모바일은 위로 올린다(좁은 화면에서 옆에 두면 글줄이 토막난다).
            ⚠️모바일은 **왼쪽 정렬**이다(`text-left`, 데스크톱에서도 그대로). ③·④와 같은 규칙 —
              좁은 화면에서 긴 한글 문장을 가운데로 두면 줄마다 시작점이 달라져 읽는 눈이 매 줄
              자리를 다시 찾는다. 🔻처음에 `text-center sm:text-left`로 짰다가 실물에서 걸렸다.
              그래서 고양이도 가운데가 아니라 **글과 같은 선**에서 시작한다. */}
        <CatPeek className="w-[116px] shrink-0 text-primary-on sm:w-[136px]" />
        <div className="min-w-0 flex-1">
          <span className="inline-flex items-center rounded-pill bg-primary-on/10 px-2.5 py-1 text-[12px] font-bold text-primary-on sm:text-[12.5px]">
            collab5팀이 직접 · 무료
          </span>
          <h2 className="mt-2.5 break-keep text-[19px] font-bold leading-[1.4] tracking-[-0.02em] text-primary-on sm:text-[23px]">
            소개서 쓰기 어려우면,
            {/* 모바일에서만 끊는다 — 좁은 화면에서 이 문장은 어차피 두 줄인데,
                끊는 자리를 우리가 안 정하면 「저희가」가 혼자 첫 줄에 남는다. */}
            <br className="sm:hidden" /> 저희가 만들어드릴게요.
          </h2>
          <p className="mt-2 break-keep text-[14.5px] leading-[1.65] text-body sm:text-[15.5px]">
            웹과 인스타그램에 흩어져 있는 사진과 이야기를 모아 collab5팀이 소개서를 만들어드려요.
            이미 소개서가 있다면 더 풍성하게 채워드리고요. 신청하고 하루면 완성돼요.
          </p>
        </div>
        {/* 🎈Kiwi 버튼을 써도 플로팅 알약과 안 부딪힌다 — 섹션의 `data-pill-end` 때문에 배너가
            화면에 들어오는 순간 **알약이 내려간다**(HomeFloatingCta ⑥).
            🔻처음엔 「배너가 뜰 땐 풋터 가드가 이미 걸려서 알약이 없다」고 적었는데 **실측에서 틀렸다** —
              배너를 넣은 만큼 풋터가 밀려 가드가 늦게 걸렸다. 그래서 표식을 따로 달았다. */}
        {/* 🪤`shadow-e2`가 필요하다 — Kiwi(#98ff5c)와 카드 면(#ecffe0)은 **둘 다 밝아서** 버튼이
            면에 잠긴다(흰 지면 위의 `/m` 보강 배너에서는 안 생기던 문제다). 색을 바꾸는 대신
            그림자로 띄운다 — **Kiwi는 「누르는 것」의 색**이라 여기서 다른 색으로 바꾸면 규칙이 깨진다. */}
        <span className="flex h-12 w-full shrink-0 items-center justify-center rounded-md bg-primary px-7 text-[15.5px] font-bold text-primary-on shadow-e2 transition-opacity group-hover:opacity-90 sm:w-auto">
          소개서 신청하기
        </span>
      </a>
    </section>
  );
}
