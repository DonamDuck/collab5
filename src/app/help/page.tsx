import type { Metadata } from "next";
import Link from "next/link";
import { KAKAO_CHAT_URL, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/site";

// 고객센터 (2026-09-16 대표)
//
// ⭐대표: *「고객센터 메뉴를 하나 만들어서 거기도 넣자」*. 문의가 모이는 곳은 카카오톡 채널이다.
//   phase 1(채팅 기능 없음)에서 하루 가게의 «사장님이 답을 안 하는 일»도 여기로 받아 우리가 직접 처리한다.
// ⛔운영 시간·답변 시간은 적지 않았다. 정한 적이 없는 약속을 화면에 먼저 쓰지 않는다 — 정하면 그때 더한다.
export const metadata: Metadata = {
  title: "고객센터 — collab5",
  description: "collab5에 궁금한 게 있으면 카카오톡으로 편하게 물어봐 주세요.",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식 페이지에 그대로 상속된다(08-07 발견).
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
      <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">고객센터</h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
        궁금한 게 생기면 편하게 물어봐 주세요. 카카오톡으로 남기시면 저희가 직접 읽고 답해 드려요.
      </p>

      {/* 카카오 노랑은 카카오의 얼굴이라 그대로 쓴다. 이 화면의 주 버튼이 이것 하나다. */}
      <a
        href={KAKAO_CHAT_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-8 flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] text-[16px] font-medium text-[#191919]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[20px]" fill="#191919">
          <path d="M12 3.5c-5.25 0-9.5 3.33-9.5 7.44 0 2.66 1.78 4.99 4.46 6.31l-.9 3.3c-.08.3.26.54.52.37l3.94-2.6c.48.06.97.09 1.48.09 5.25 0 9.5-3.33 9.5-7.47S17.25 3.5 12 3.5Z" />
        </svg>
        카카오톡으로 물어보기
      </a>

      <section className="mt-10 border-t border-hairline pt-7">
        <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">하루 가게를 쓰시다가</h2>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
          예약한 날 사장님과 연락이 닿지 않거나, 취소와 환불이 생각과 다르게 됐을 때도 카카오톡으로 알려 주세요.
          신청 내역을 같이 보면서 확인해 드릴게요.
        </p>
      </section>

      <section className="mt-10 border-t border-hairline pt-7">
        <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">다른 방법</h2>
        <dl className="mt-4 space-y-2.5">
          <div className="flex gap-3 text-[16px] leading-relaxed">
            <dt className="w-[64px] shrink-0 text-mute">메일</dt>
            <dd className="min-w-0 flex-1 break-all">
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-body underline underline-offset-2">
                {SUPPORT_EMAIL}
              </a>
            </dd>
          </div>
          <div className="flex gap-3 text-[16px] leading-relaxed">
            <dt className="w-[64px] shrink-0 text-mute">전화</dt>
            <dd className="min-w-0 flex-1">
              <a href={`tel:${SUPPORT_PHONE.replace(/[^0-9]/g, "")}`} className="text-body underline underline-offset-2">
                {SUPPORT_PHONE}
              </a>
            </dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 border-t border-hairline pt-7">
        <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">약관과 방침</h2>
        <ul className="mt-3">
          {[
            { href: "/terms", label: "이용약관" },
            { href: "/terms/host", label: "공간 제공자 약관" },
            { href: "/privacy", label: "개인정보처리방침" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-block py-[10px] text-[16px] text-body underline underline-offset-2">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
