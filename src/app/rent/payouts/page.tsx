import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  hostShare,
  listSettleable,
  listSpacesByIds,
  listStuckBookings,
  markFinishedBookings,
  type SpaceBrief,
} from "@/lib/spaces";
import { getProfileById, type Profile } from "@/lib/profiles";
import { isRentAdmin } from "@/lib/rent-actions";
import type { SpaceBooking } from "@/lib/types";
import { bookingWhen, won } from "../ui";
import { PayoutButton } from "./PayoutButton";

// 하루 가게 — 정산 (2026-09-16) · 대표만
//
// ⭐**1단계 정산은 대표가 손으로 입금한다.** 이 화면은 그 손을 돕는 장부다 — 누구에게 얼마를 드릴지,
//   드렸는지 안 드렸는지. 은행 이체를 자동으로 하지 않는다([[manual-before-productizing]]).
//
// 📐계산은 행에 박힌 값으로만 한다(`hostShare`). 요율이 바뀌어도 옛 거래는 그때 값으로 준다.
//   - 다녀온 예약 → 손님이 낸 돈에서 수수료를 뺀 몫
//   - 손님이 취소했지만 전액 환불이 아니었던 예약 → **환불하고 남은 돈**에서 수수료를 뺀 몫(약관 제8조)
//
// 🔒이용일이 «지난» 것만 올라온다(약관 제9조: 「이용이 끝난 것을 확인한 뒤」).
// ⚠️**사장님 계좌를 받는 칸이 아직 없다.** 약관 제9조는 「호스트가 지정한 계좌」라 했는데 등록 폼이 안 묻는다.
//   금융 정보를 받는 일이라 대표 결정이 먼저다. 그때까진 연락처로 여쭤본다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "정산 — 하루 가게",
  robots: { index: false },
};

type HostGroup = {
  ownerUserId: number;
  profile: Profile | null;
  unpaid: SpaceBooking[];
  paid: SpaceBooking[];
};

export default async function RentPayoutsPage() {
  // 🔒없는 척한다. 「권한이 없어요」라고 말하면 이 주소가 무엇을 하는 곳인지 알려 주는 셈이다.
  if (!(await isRentAdmin())) notFound();

  // ⏹끝난 확정 예약부터 넘긴다 — 안 넘기면 어제 다녀온 예약이 정산에 안 올라온다.
  await markFinishedBookings();

  const [settleable, stuck] = await Promise.all([listSettleable(), listStuckBookings()]);
  const all = [...settleable, ...stuck.unanswered, ...stuck.refundFailed];
  const spaces = await listSpacesByIds(all.map((b) => b.spaceId));

  // 사장님별로 묶는다 — 입금은 사람 단위로 한다.
  const groups = new Map<number, HostGroup>();
  for (const b of settleable) {
    const owner = spaces.get(b.spaceId)?.ownerUserId ?? -1;
    const g = groups.get(owner) ?? { ownerUserId: owner, profile: null, unpaid: [], paid: [] };
    (b.paidOutAt ? g.paid : g.unpaid).push(b);
    groups.set(owner, g);
  }
  await Promise.all(
    Array.from(groups.values()).map(async (g) => {
      g.profile = g.ownerUserId > 0 ? await getProfileById(g.ownerUserId) : null;
    }),
  );

  const owed = Array.from(groups.values()).filter((g) => g.unpaid.length > 0);
  const done = Array.from(groups.values()).filter((g) => g.paid.length > 0);
  const owedTotal = owed.reduce((sum, g) => sum + g.unpaid.reduce((x, b) => x + hostShare(b), 0), 0);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent/my" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 내 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">정산</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          이용일이 지난 예약만 올라와요. 입금은 은행에서 직접 하시고, 하신 뒤에 여기서 표시해 주세요.
        </p>
      </header>

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">드릴 돈</h2>
          {owed.length > 0 && <p className="text-[17px] font-medium tabular-nums text-ink">{won(owedTotal)}</p>}
        </div>
        {owed.length === 0 ? (
          <p className="mt-5 text-[15px] leading-relaxed break-keep text-faint">지금 드릴 돈이 없어요.</p>
        ) : (
          <div className="mt-5 space-y-8">
            {owed.map((g) => (
              <HostBlock key={g.ownerUserId} group={g} rows={g.unpaid} spaces={spaces} withButton />
            ))}
          </div>
        )}
      </section>

      {(stuck.unanswered.length > 0 || stuck.refundFailed.length > 0) && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">손이 필요한 예약</h2>
          <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
            정산에 넣지 않았어요. 손님 돈이 붙잡혀 있거나 돌려드려야 하는 자리예요.
          </p>
          {stuck.unanswered.length > 0 && (
            <StuckList
              title="사장님이 답하지 않은 채 날이 지났어요"
              hint="사장님이 거절하시면 전액 환불돼요. 연락해서 여쭤봐 주세요."
              rows={stuck.unanswered}
              spaces={spaces}
            />
          )}
          {stuck.refundFailed.length > 0 && (
            <StuckList
              title="거절했는데 환불이 안 됐어요"
              hint="토스 관리자 화면에서 직접 취소해 주세요. 손님 돈이에요."
              rows={stuck.refundFailed}
              spaces={spaces}
            />
          )}
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">드린 돈</h2>
          <div className="mt-5 space-y-8">
            {done.map((g) => (
              <HostBlock key={g.ownerUserId} group={g} rows={g.paid} spaces={spaces} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function HostBlock({
  group,
  rows,
  spaces,
  withButton = false,
}: {
  group: HostGroup;
  rows: SpaceBooking[];
  spaces: Map<number, SpaceBrief>;
  withButton?: boolean;
}) {
  const p = group.profile;
  const sum = rows.reduce((x, b) => x + hostShare(b), 0);
  const contact = [p?.phone?.trim(), p?.email?.trim()].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium text-ink">{p?.brandName?.trim() || "이름을 안 적으셨어요"}</p>
          <p className="mt-0.5 text-[15px] break-all text-mute">{contact || "연락처가 없어요"}</p>
        </div>
        <p className="shrink-0 text-[17px] font-medium tabular-nums text-ink">{won(sum)}</p>
      </div>
      <ul>
        {rows.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-body">{spaces.get(b.spaceId)?.name ?? "공간"}</p>
              <p className="mt-0.5 text-[14px] text-mute">
                {bookingWhen(b)}
                {b.status === "cancelled" && ` · 취소 · ${won(b.amountRefunded)} 환불하고 남은 몫`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] tabular-nums text-ink">{won(hostShare(b))}</p>
              <p className="text-[13px] tabular-nums text-faint">
                {b.paidOutAt ? `${b.paidOutAt.slice(0, 10)} 입금` : `손님 ${won(b.amountTotal)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {withButton && (
        <div className="mt-3">
          <PayoutButton bookingIds={rows.map((b) => b.id)} amount={sum} name={p?.brandName?.trim() || "이 사장님"} />
        </div>
      )}
    </div>
  );
}

function StuckList({
  title,
  hint,
  rows,
  spaces,
}: {
  title: string;
  hint: string;
  rows: SpaceBooking[];
  spaces: Map<number, SpaceBrief>;
}) {
  return (
    <div className="mt-6">
      <p className="text-[16px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">{hint}</p>
      <ul className="mt-3">
        {rows.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-body">{spaces.get(b.spaceId)?.name ?? "공간"}</p>
              <p className="mt-0.5 text-[14px] text-mute">{bookingWhen(b)}</p>
            </div>
            <p className="shrink-0 text-[15px] tabular-nums text-ink">{won(b.amountTotal)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
