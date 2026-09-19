import Link from "next/link";
import { primaryBtnCls } from "../../ui";

// 🔎09-17 QA — 없는 예약 번호로 오면 루트 404(「삭제된 소개서일 수 있어요」)가 떴다. 하루 팝업 말로 돌려보낸다.
//   남의 예약도 여기로 온다(`page.tsx`가 notFound). 「있는데 못 본다」를 말하지 않는 건 그대로다.
export default function RentDoneNotFound() {
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">이 예약을 찾지 못했어요</h1>
      <p className="mt-3 text-[16px] leading-relaxed break-keep text-mute">
        주소가 틀렸거나 다른 계정으로 한 예약일 수 있어요. 내 예약에서 다시 찾아보세요.
      </p>
      <Link href="/rent/requests" className={`${primaryBtnCls} mt-8 h-[48px] w-full`}>
        내 예약 보기
      </Link>
    </main>
  );
}
