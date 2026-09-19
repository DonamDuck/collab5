import Link from "next/link";
import { primaryBtnCls, secondaryBtnCls } from "./ui";

// 하루 팝업 404 (2026-09-18 밤 QA G-03)
//
// 🩸없는 공간·아직 안 열린 공간 주소로 오면 루트 404가 떴고, 거기 적힌 말은 *「삭제된 소개서일 수 있어요」*였다.
//   공간을 찾아온 손님에게 소개서 이야기를 하고, 다음 버튼은 「브랜드 찾아보기」였다. 다른 서비스로 안내한 셈이다.
// ⭐`/rent/**` 아래 404는 전부 여기로 온다 — 상세(`[slug]/page.tsx`)의 `notFound()`가 제일 잦은 길이다.
//   예약 상세(`/rent/done/[bookingId]`)는 자기 404를 따로 갖고 있어 그대로다(예약과 공간은 찾는 것이 다르다).
// ⚠️「있는데 못 본다」와 「없다」를 여기서도 안 가른다. 문장 하나로 두 경우를 같이 받는다.
export default function RentNotFound() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">이 공간을 찾지 못했어요</h1>
      <p className="mt-3 text-[16px] leading-relaxed break-keep text-mute">
        공개가 끝났거나 주소가 바뀌었을 수 있어요.
      </p>
      <Link href="/rent" className={`${primaryBtnCls} mt-8 h-[48px] w-full`}>
        하루 팝업 둘러보기
      </Link>
      <Link href="/rent/requests" className={`${secondaryBtnCls} mt-2 h-[48px] w-full`}>
        내 예약 보기
      </Link>
    </main>
  );
}
