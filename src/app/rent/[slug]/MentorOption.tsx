"use client";

// 하루 가게 — 「사장님께 잠깐 배워보기」 옵션 고르개 (2026-09-14)
//
// 대표: *「사장님께 잠깐 배워보기가 무언가 옵션처럼 나와야 할 거 같은데. 스마트스토어처럼 옵션 메뉴를
// 만들 순 없을까? 모바일의 경우 결제하고 신청하기 누르면 옵션 바텀 올라오고, 데스크탑은 뭔가 결제
// 버튼과 비슷한 위계에 옵션 선택 가능한 UI로 하고」*
//
// 🔻체크박스 한 줄이었을 땐 **값이 붙는 상품이 아니라 부가 문구**로 읽혔다. 상품을 고르는 일은
//   상품처럼 생겨야 한다 — 이름·설명·값이 각자 자리를 갖고, 고른 것이 면으로 켜지고, 합계가 따라 움직인다.
//
// 🧩같은 줄 두 벌을 **두 자리**에서 쓴다(대표가 그렇게 갈랐다).
//   · 폰: 결제 버튼을 누르면 바닥에서 올라오는 시트 안에
//   · 데스크톱: 하단 고정 바 «안», 결제 버튼과 나란히
//   ⭐그래서 이 파일은 «줄»만 그리고 어디에 놓일지는 모른다. 자리를 아는 건 부모다.
import { COFFEE_CHAT_WHEN_GUEST } from "@/lib/rent-copy";
import { won } from "../ui";

export type MentorPick = boolean;

/** 옵션 두 줄. 고르면 면이 켜지고 오른쪽에 값이 붙는다. */
type RowProps = {
  on: boolean;
  /** 이 줄을 누르면 넘기는 값. 🔁09-18 전엔 제목 글자(「공간만 빌릴게요」)로 갈랐다 — 제목을 바꾸면 조용히 뒤집혔다. */
  pick: MentorPick;
  title: string;
  desc?: string;
  amount: string;
  dense?: boolean;
  onChange: (v: MentorPick) => void;
};

/** ⚠️**컴포넌트 안에서 만들지 않는다.** 렌더마다 새 함수가 나오면 React는 매번 «다른 컴포넌트»로 보고
 *  통째로 다시 마운트한다(lint `react-hooks/static-components`). 고른 줄이 깜빡이는 원인이 여기서 난다. */
function Row({ on, pick, title, desc, amount, dense, onChange }: RowProps) {
  return (

    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={() => onChange(pick)}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 text-left transition-colors ${
        dense ? "py-2.5" : "py-3.5"
      } ${on ? "border-primary-tint bg-primary-pale" : "border-hairline bg-surface hover:bg-surface-soft"}`}
    >
      {/* 라디오 점 — 고른 줄이 «면»으로도 켜지지만, 면만으로는 「눌러서 바꾸는 것」임이 안 읽힌다. */}
      <span
        aria-hidden="true"
        className={`grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
          on ? "border-primary-on" : "border-border-strong"
        }`}
      >
        {on && <span className="size-[8px] rounded-full bg-primary-on" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium text-ink">{title}</span>
        {!dense && desc && <span className="mt-0.5 block text-[14px] leading-snug break-keep text-mute">{desc}</span>}
      </span>
      <span className="shrink-0 text-[15px] font-medium text-body">{amount}</span>
    </button>
  
  );
}

export function MentorOptions({
  minutes,
  price,
  value,
  onChange,
  dense,
}: {
  minutes: number;
  price: number;
  value: MentorPick;
  onChange: (v: MentorPick) => void;
  /** 하단 바 안에 들어갈 때(데스크톱) — 세로를 아끼려고 설명 줄을 접는다. */
  dense?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="신청 옵션" className="space-y-2">
      {/* 🔻09-15 대표 — 설명 줄 「그날 공간만 쓰고 혼자 해볼게요」를 뺐다.
          제목이 이미 그 문장이라 두 줄이 같은 말을 두 번 했다. 값이 안 붙는 쪽은 설명할 것이 없다. */}
      {/* 🛍09-18 「공간만 빌릴게요」 → 「커피챗 없이 할게요」. 상품 이름 「대관만」과 「공간만」이 한 팝업에 같이 서면
          손님이 공간 상품을 또 고르는 줄로 읽는다. 이 줄이 가르는 건 커피챗 하나다. */}
      <Row on={!value} pick={false} title="커피챗 없이 할게요" amount="+0원" dense={dense} onChange={onChange} />
      <Row
        on={value}
        pick={true}
        dense={dense}
        onChange={onChange}
        // ☕09-16 대표 — 「사장님께 잠깐 배워보기」 → 커피챗. 상세 절 제목(「사장님과 커피챗」)과 같은 이름이어야
        //   방금 읽은 그 상품을 고르는 줄로 읽힌다. (09-18부터 판정은 `pick`이 한다.)
        // 🔁09-18 대표 코멘트 — 고르는 줄이라 «하겠다»는 말로. 아래에 시간 조율 안내 한 줄(대표 문안).
        title="사장님과 커피챗을 신청할게요"
        // 🔁09-18 밤 QA(G-12) — 같은 약속을 이 줄만 자기 말로 적고 있었다(상세·메일은 `COFFEE_CHAT_WHEN_GUEST`).
        //   한 신청 안에서 「연락을 받으신 후에」와 「예약 확정 후 사장님께 연락이 오면」 둘이 같이 보였다. 정본 한 줄만 쓴다.
        desc={COFFEE_CHAT_WHEN_GUEST}
        // 🔁09-18 제목 글자로 값을 가르던 판정을 `pick`으로 옮겼다. 이제 제목은 자유롭게 바꿔도 된다.
        // 🔁09-15 대표 — *「사장님과 협의한 날짜에, 미리 이 일을 잠깐 배워볼 수 있어요 등과 같이 쓰자」*.
        //   ⭐전엔 「문 열기 전 60분」이라 **그날 아침으로 못 박혀 있었다.** 실제로는 사장님과 날을 맞추는 일이라
        //     이 줄이 그대로면 손님이 「그날 일찍 가면 되는구나」로 읽고 어긋난다.
        //   분은 남긴다 — 값(+30,000원)이 붙는 이유가 그 숫자다.
        // ☕09-16 대표 — 파는 것이 «배움»에서 «현업 이야기»로 바뀌었다. 09-15에 주신 앞머리(협의한 날짜에)는 그대로 두고 뒤만 갈았다.
        // ☕09-17 대표 — 「언제」는 `COFFEE_CHAT_WHEN_GUEST` 한 줄만 쓴다. 「협의한 날짜」는 상세·메일과 말이 갈렸다.
        // 🔻09-18 대표 코멘트 — 설명 줄을 뺐다. 상세 「사장님과 커피챗」 절에 이미 있다. 팝업에선 이름과 값만.
        amount={`+${won(price)}`}
      />
    </div>
  );
}
