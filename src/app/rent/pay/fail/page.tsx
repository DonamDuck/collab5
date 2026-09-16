import type { Metadata } from "next";
import Link from "next/link";
import { secondaryBtnCls } from "../../ui";

// 하루 가게 — 결제가 안 끝났을 때 (2026-09-13)
//
// ⭐말투를 「실패」로 쓰지 않는다. 여기 닿는 사람의 대부분은 고장이 아니라 **마음이 바뀐 쪽**이고,
//   카드가 안 됐더라도 그건 본인 잘못이 아니다. 다시 돌아갈 길만 분명히 보이면 된다.
//
// 🎨09-13 재작업 — 크기만 사다리에 맞췄다(제목 22 · 본문 17 · 사유 15). 버튼은 둘 다 보조 —
//   돌아가는 길이 둘인데 하나만 키위면 「그쪽으로 가라」가 된다. 토스 사유의 회색 상자는 인용선으로.
export const metadata: Metadata = {
  title: "결제가 끝나지 않았어요 — collab5",
  robots: { index: false },
};

export default async function RentPayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; code?: string }>;
}) {
  const sp = await searchParams;
  // ⚠️토스가 보내는 `message`는 남의 문자열이다. 그대로 화면에 쓰되 링크나 마크업으로 해석될 일은 없다
  //   (React가 텍스트로 이스케이프한다). 길이만 잘라 레이아웃이 무너지지 않게 한다.
  const reason = (sp.message ?? "").slice(0, 200);

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">결제가 끝나지 않았어요</h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">
        신청은 아직 접수되지 않았어요. 사장님께도 아무 연락이 가지 않았어요.
      </p>
      {reason && (
        <p className="mt-5 border-l-2 border-hairline pl-4 text-[15px] leading-relaxed break-keep text-mute">
          {reason}
        </p>
      )}
      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/rent" className={secondaryBtnCls}>
          다른 공간 보기
        </Link>
        {/* 09-16 손님 전용 목록으로(B81). `/rent/my`는 사장님 화면이다. */}
        <Link href="/rent/requests" className={secondaryBtnCls}>
          내 신청 보기
        </Link>
      </div>
    </main>
  );
}
