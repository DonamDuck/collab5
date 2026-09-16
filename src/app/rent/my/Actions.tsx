"use client";

// 내 하루 가게 — 버튼 세 종류 (2026-09-13)
//
// ⚠️화면에서 버튼을 숨기는 건 UX일 뿐이다. 권한은 세 액션이 전부 **자기 첫 줄에서** 다시 검사한다
//   (`lib/rent-actions.ts` 머리말). 그러니 여기서 할 일은 「막기」가 아니라
//   **되돌릴 수 없는 행동을 실수로 누르지 않게 하는 것**이다 — 거절과 취소에 한 번 더 묻는 이유.
//
// 🎨09-13 재작업 — 버튼은 보조(흰 면 + border-strong) 44px 한 종류, 수락만 키위.
//   `rounded-sm` 각진 버튼을 `rounded-md`로, 13px 글자를 15로 올렸다.
// 🪟09-14 — 거절·취소의 「한 번 더 묻기」를 줄 안의 두 번째 버튼에서 **팝업**(`ConfirmDialog`)으로 옮겼다
//   (대표: 의사 확인은 팝업으로). 취소 팝업은 환불액을 서버에 물어서 보여 준다 — 환불표가 서버 전용이라
//   화면엔 숫자를 안 적는다(적으면 표가 바뀌는 날 화면만 뒤처진다).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decideBookingAction,
  cancelBookingAction,
  quoteCancelAction,
  publishSpaceAction,
} from "@/lib/rent-actions";
import { InfoList, InfoRow, primaryBtnCls, rentTextareaCls, secondaryBtnCls, won } from "../ui";
import { ConfirmDialog } from "../ConfirmDialog";

/** 받은 신청 — 수락 · 거절. 거절은 전액 환불이라 되돌릴 수 없다(대표 09-13). */
export function HostDecide({
  bookingId,
  amountTotal,
  started = false,
}: {
  bookingId: number;
  amountTotal: number;
  /** ⏯이용 시간이 이미 시작했나. 그러면 «수락»은 뜻이 없고 거절(= 전액 환불)만 남긴다(09-16). */
  started?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);

  const run = (accept: boolean) =>
    start(async () => {
      setConfirmReject(false);
      setErr("");
      const r = await decideBookingAction(bookingId, accept, message);
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      router.refresh();
    });

  return (
    <div className="mt-4 space-y-3">
      {/* 한 줄 메시지 — 수락이든 거절이든 같은 칸을 쓴다. 거절에만 칸을 주면 「거절할 때만 말한다」가
          되고, 수락 뒤 첫 연락이 아무 말 없이 주소만 열리는 것으로 시작된다. */}
      <textarea
        rows={2}
        className={`${rentTextareaCls} resize-y`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="한 줄 남기실 말 (예: 그날 오전엔 제가 있을게요)"
        aria-label="신청하신 분께 남길 말"
      />
      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
      {/* ⏯이용 시간이 이미 지난 신청 — 답을 못 한 채 날이 갔다. 손님 돈이 붙잡혀 있으니 돌려줄 길만 남긴다. */}
      {started && (
        <p className="text-[15px] leading-relaxed break-keep text-mute">
          이용 시간이 이미 지나 수락할 수 없어요. 거절하시면 신청하신 분께 전액 환불됩니다.
        </p>
      )}
      <div className="flex gap-2">
        {/* ⭐항목마다 키위가 하나씩 나올 수 있는 화면이라(받은 신청 여러 건) 예외로 허용하되 작게 —
            폭을 내용만큼만. 높이는 옆 보조 버튼과 같은 44px(한 줄에서 높이가 다르면 어긋나 보인다). */}
        {/* 수락은 팝업 없이 — 문구가 결과를 미리 말한다(누르면 연락처가 열린다는 것). */}
        {!started && (
          <button
            type="button"
            onClick={() => run(true)}
            disabled={pending}
            className={`${primaryBtnCls} h-[44px] px-5 text-[15px]`}
          >
            {pending ? "처리 중…" : "수락하고 연락처 열기"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmReject(true)}
          disabled={pending}
          className={`${secondaryBtnCls} text-[15px]`}
        >
          거절
        </button>
      </div>
      <ConfirmDialog
        open={confirmReject}
        title="이 신청을 거절할까요"
        confirmLabel="거절하기"
        busy={pending}
        onConfirm={() => run(false)}
        onCancel={() => setConfirmReject(false)}
      >
        <p>거절하면 {won(amountTotal)} 전액이 손님께 돌아가요. 그날은 다시 비는 날이 돼요.</p>
        {message.trim() && <p className="text-mute">남기신 말도 같이 전해드려요.</p>}
      </ConfirmDialog>
    </div>
  );
}

/** 내가 보낸 신청 취소. 환불률은 우리 규정표가 정한다 — 그래서 **여기 숫자를 적지 않는다.**
 *  화면에 「전액 환불」이라고 박아 두면 당일 취소에도 그 말이 남아 거짓이 된다.
 *  실제 금액은 액션이 계산해서 메시지로 돌려준다. */
export function GuestCancel({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /** 서버가 계산해 준 환불 견적. 있으면 팝업이 열려 있다는 뜻. */
  const [quote, setQuote] = useState<{ total: number; refund: number; rate: number } | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  /** 팝업을 열기 «전에» 환불액을 서버에 묻는다. 「얼마 돌려받는지」를 모른 채 확인을 누르게 하지 않는다. */
  const ask = () =>
    start(async () => {
      setErr("");
      const q = await quoteCancelAction(bookingId);
      if (!q.ok) {
        setErr(q.message);
        return;
      }
      setQuote({ total: q.total, refund: q.refund, rate: q.rate });
    });

  const run = () =>
    start(async () => {
      setQuote(null);
      setErr("");
      const r = await cancelBookingAction(bookingId);
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      setDone(r.message);
      router.refresh();
    });

  if (done) return <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">{done}</p>;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={ask}
        disabled={pending}
        // 배경 없는 글자 버튼은 세로 패딩으로 44px를 채운다(디자인-시스템 §터치 타깃).
        className="py-[12px] text-[15px] text-mute underline underline-offset-2 disabled:opacity-60"
      >
        {pending && !quote ? "확인하는 중…" : "신청 취소하기"}
      </button>
      {err && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
      <ConfirmDialog
        open={quote !== null}
        title="신청을 취소할까요?"
        confirmLabel="취소하기"
        cancelLabel="그냥 둘게요"
        busy={pending}
        onConfirm={run}
        onCancel={() => setQuote(null)}
      >
        {/* 💸09-15 대표 — *「결제한 금액 / 수수료: NN원(MM%) / 환불 금액, 이런 식으로 구성하고 이쁘게」*.
            ⭐줄글일 땐 「80,000원 중 80,000원(100%)이 돌아와요」였는데, 그 문장은 **안 돌아오는 돈이 얼마인지를
              말하지 않는다.** 항목으로 세우면 빠지는 돈이 자기 줄을 갖는다. 취소는 그걸 보고 정하는 일이다.
            🔻「취소하면 되돌릴 수 없어요」 삭제(대표 [9]) — 확인 팝업 자체가 이미 그 말이다.
            ⚠️수수료율은 화면에서 계산하지 않는다. 서버가 준 `rate`에서 거꾸로 낸다 — 두 곳에서 따로 계산하면
              언젠가 두 값이 갈라지고, 그때 손님이 보는 쪽이 틀린다. */}
        {quote && (
          <InfoList className="border-t border-hairline pt-3">
            <InfoRow label="결제한 금액" value={won(quote.total)} />
            <InfoRow
              label="취소 수수료"
              value={
                <>
                  {won(quote.total - quote.refund)}
                  <span className="text-mute"> ({100 - Math.round(quote.rate * 100)}%)</span>
                </>
              }
            />
            <InfoRow
              label="환불 금액"
              value={<span className="font-medium text-ink">{won(quote.refund)}</span>}
            />
          </InfoList>
        )}
        {quote?.refund === 0 && (
          <p className="text-[15px] leading-relaxed break-keep text-mute">당일 취소라 돌려드릴 수 없어요.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** 검토 통과 → 공개. 대표에게만 보이는 버튼이다(진짜 관문은 `publishSpaceAction` 안에 있다). */
export function PublishButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            const r = await publishSpaceAction(slug);
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            router.refresh();
          })
        }
        className={`${secondaryBtnCls} text-[15px]`}
      >
        {pending ? "여는 중…" : "공개하기"}
      </button>
      {err && <p className="mt-2 text-[15px] text-danger">{err}</p>}
    </div>
  );
}
