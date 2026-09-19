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
  requestRefundAction,
  setSpacePausedAction,
} from "@/lib/rent-actions";
import { InfoList, InfoRow, primaryBtnCls, rentTextareaCls, secondaryBtnCls, won } from "../ui";
import { HOST_MESSAGE_MAX } from "@/lib/rent-limits";
import { REJECT_REASONS } from "@/lib/rent-reject-reasons";
import { ConfirmDialog } from "../ConfirmDialog";

/** 들어온 요청 — 수락 · 거절. 거절은 전액 환불이라 되돌릴 수 없다(대표 09-13).
 *  🔁09-17 대표 결정 4 — 사장님 쪽에 들어온 건 «요청»이라 부른다(손님 쪽은 결제 뒤 «예약»). */
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
      // 💬09-17 QA — 누르면 버튼이 사라지고 화면이 조용히 바뀌어서 됐는지 배지를 찾아봐야 했다.
      //   이 버튼은 상태가 바뀌면 화면에서 빠지므로(부모가 `paid`일 때만 그린다) 결과 줄은 부모가 띄운다.
      //   `did`와 예약 번호를 주소에 실어 보내면 그 줄 안에 한 번 뜬다. 거절 뒤 환불 성패는 부모가 상태로 읽는다.
      router.replace(`/rent/my?tab=host&did=${accept ? "accept" : "reject"}&b=${bookingId}`, { scroll: false });
      router.refresh();
    });

  return (
    // 🃏09-18 대표 코멘트 #63 — 요청 카드의 «발». 위 선 하나로 「읽는 곳」과 「답하는 곳」을 가른다.
    <div className="mt-4 space-y-3 border-t border-hairline pt-4">
      {/* 한 줄 메시지 — 수락이든 거절이든 같은 칸을 쓴다. 거절에만 칸을 주면 「거절할 때만 말한다」가
          되고, 수락 뒤 첫 연락이 아무 말 없이 주소만 열리는 것으로 시작된다. */}
      <textarea
        rows={2}
        className={`${rentTextareaCls} resize-y`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        // ✂️09-18 밤 QA(SEC-07) — 서버(`decideBookingAction`)와 같은 상한. 서버가 돌려보내면 그 말은 바로 아래 줄에 뜬다.
        maxLength={HOST_MESSAGE_MAX}
        placeholder="한 줄 남기실 말 (예: 그날 오전엔 제가 있을게요)"
        aria-label="손님께 남길 말"
      />
      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
      {/* ⏯이용 시간이 이미 지난 신청 — 답을 못 한 채 날이 갔다. 손님 돈이 붙잡혀 있으니 돌려줄 길만 남긴다. */}
      {started && (
        <p className="text-[15px] leading-relaxed break-keep text-mute">
          이용 시간이 이미 지나 수락할 수 없어요. 거절하시면 손님께 전액 돌아가요.
        </p>
      )}
      {/* 🔁09-18 — 순서를 [거절][수락]으로. 확인 팝업(`ConfirmDialog`)과 같이 «앞으로 가는 쪽»이 오른쪽이다.
          넓은 화면은 카드 오른쪽 끝에 모으고, 폰은 한 줄을 1:2로 나눠 엄지가 닿게 한다. */}
      <div className="flex gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => setConfirmReject(true)}
          disabled={pending}
          className={`${secondaryBtnCls} flex-1 text-[15px] sm:flex-none`}
        >
          거절
        </button>
        {/* ⭐항목마다 키위가 하나씩 나올 수 있는 화면이라(받은 신청 여러 건) 예외로 허용하되 작게 —
            넓은 화면에선 폭을 내용만큼만. 높이는 옆 보조 버튼과 같은 44px(한 줄에서 높이가 다르면 어긋나 보인다). */}
        {/* 수락은 팝업 없이 — 문구가 결과를 미리 말한다(누르면 연락처가 열린다는 것). */}
        {!started && (
          <button
            type="button"
            onClick={() => run(true)}
            disabled={pending}
            className={`${primaryBtnCls} h-[44px] flex-[2] px-5 text-[15px] sm:flex-none`}
          >
            {pending ? "처리 중…" : "수락하고 연락처 열기"}
          </button>
        )}
      </div>
      <ConfirmDialog
        open={confirmReject}
        title="이 요청을 거절할까요"
        confirmLabel="거절하기"
        busy={pending}
        onConfirm={() => run(false)}
        onCancel={() => setConfirmReject(false)}
      >
        <p>거절하면 {won(amountTotal)} 전액이 손님께 돌아가요. 그 시간은 다시 열려요.</p>
        {/* 💬09-19 대표 — 거절 이유 칩 + 직접 쓰기. 칩을 누르면 문장이 칸에 들어가고, 고쳐 쓸 수 있다.
            카드의 한 줄 칸과 같은 값(`message`)이라 거기 적어 둔 말도 여기서 이어 고친다. 손님 메일의 「사장님 말씀」으로 간다. */}
        <div className="mt-4">
          <p className="text-[15px] font-medium text-ink">손님께 남길 말</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="자주 쓰는 거절 이유">
            {REJECT_REASONS.map((r) => (
              <button
                key={r.label}
                type="button"
                aria-pressed={message === r.text}
                onClick={() => setMessage(r.text)}
                className={`h-[44px] rounded-md border px-3 text-[15px] transition-colors ${
                  message === r.text
                    ? "border-transparent bg-primary-tint font-medium text-primary-on"
                    : "border-hairline bg-surface text-ink hover:bg-primary-pale"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            className={`${rentTextareaCls} mt-3 resize-y`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={HOST_MESSAGE_MAX}
            placeholder="위에서 고르거나 직접 적어 주세요. 비워 두셔도 돼요."
            aria-label="거절하며 손님께 남길 말"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}

/** 내가 보낸 신청 취소. 환불률은 우리 규정표가 정한다 — 그래서 **여기 숫자를 적지 않는다.**
 *  화면에 「전액 환불」이라고 박아 두면 당일 취소에도 그 말이 남아 거짓이 된다.
 *  실제 금액은 액션이 계산해서 메시지로 돌려준다. */
/** 취소 팝업의 이유 한 줄. 전액이면 «왜 전액인지», 깎이면 «며칠 남아서인지», 0원이면 당일이라서.
 *  🆕09-19 오후 대표 — 수락 전 취소는 전액이다. 이유도 날짜보다 그게 먼저라 첫 갈래로 둔다. */
function cancelReason(q: { refund: number; rate: number; daysBefore: number; beforeAccept: boolean; grace: boolean }): string {
  if (q.beforeAccept && q.rate >= 1) return "사장님이 아직 수락하기 전이라 전액 돌아와요.";
  if (q.refund === 0) return "당일 취소라 돌려드릴 수 없어요.";
  if (q.rate >= 1) {
    return q.grace
      ? "사장님이 수락하신 지 한 시간이 안 지나서 전액 돌아와요."
      : `이용일까지 ${q.daysBefore}일 남아 전액 돌아와요.`;
  }
  // ✍️09-18 밤 QA(G-26) — 바로 위 두 줄은 「돌아와요」(손님에게 오는 돈)인데 이 줄만 「돌아가요」였다.
  //   셋은 같은 팝업의 갈래라 한 번에 하나만 뜨지만, 방향을 가리키는 말이 갈리면 누구 쪽으로 가는 돈인지가 흐려진다.
  return `이용일이 ${q.daysBefore}일 남았을 때라 ${Math.round(q.rate * 100)}%만 돌아와요.`;
}

export function GuestCancel({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  /** 서버가 계산해 준 환불 견적. 있으면 팝업이 열려 있다는 뜻. */
  const [quote, setQuote] = useState<{ total: number; refund: number; rate: number; daysBefore: number; beforeAccept: boolean; grace: boolean } | null>(null);
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
      setQuote({ total: q.total, refund: q.refund, rate: q.rate, daysBefore: q.daysBefore, beforeAccept: q.beforeAccept, grace: q.grace });
    });

  const run = () =>
    start(async () => {
      // 💸09-18 밤 QA(G-05) — 팝업이 «보여 준» 금액을 같이 넘긴다. 서버가 다시 계산한 값이 이보다 적으면
      //   환불하지 않고 「금액이 바뀌었어요」로 돌아온다(경계 시각이 지난 경우). 그 값을 지우기 전에 집어 둔다.
      const quoted = quote?.refund;
      setQuote(null);
      setErr("");
      const r = await cancelBookingAction(bookingId, quoted);
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
        {/* 🔁09-17 「신청」 → 「예약」 — 이 버튼은 결제를 마친 건(paid·confirmed)에만 뜬다. 결제 뒤는 「예약」이다(대표). */}
        {pending && !quote ? "확인하는 중…" : "예약 취소하기"}
      </button>
      {err && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
      <ConfirmDialog
        open={quote !== null}
        title="예약을 취소할까요?"
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
        {/* 💬09-17 QA — 「왜 그 %인지」 한 줄. 수수료 0%만 보면 서둘러야 하는지 알 수 없다.
            ⚠️숫자는 서버가 준 `rate`·`daysBefore`·`beforeAccept`·`grace`로만 말한다. 구간표를 화면에 다시 적지 않는다. */}
        {quote && <p className="text-[15px] leading-relaxed break-keep text-mute">{cancelReason(quote)}</p>}
      </ConfirmDialog>
    </div>
  );
}

/** 검토 통과 → 공개. 대표에게만 보이는 버튼이다(진짜 관문은 `publishSpaceAction` 안에 있다).
 *  🧾09-18 검토 화면(`/rent/review`)도 같이 쓴다. 이미 열린 공간엔 「확인 표시 붙이기」로 이름만 바꿔 단다.
 *  결과 한 줄을 띄운다 — 국세청 조회 전이면 공개는 됐는데 표시는 안 붙는다는 걸 관리자가 알아야 한다. */
export function PublishButton({
  slug,
  label = "공개하기",
  refresh = true,
}: {
  slug: string;
  label?: string;
  /** 누른 뒤 화면을 다시 읽을지. 검토 화면은 안 읽는다 — 다시 읽으면 그 줄이 목록에서 빠져 결과 한 줄도 같이 사라진다. */
  refresh?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  if (done && !refresh) {
    return <p role="status" className="mt-3 text-[15px] leading-relaxed break-keep text-mint-on">{done}</p>;
  }
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr("");
            setDone("");
            const r = await publishSpaceAction(slug);
            if (!r.ok) {
              setErr(r.message);
              return;
            }
            setDone(r.message);
            if (refresh) router.refresh();
          })
        }
        className={`${secondaryBtnCls} text-[15px]`}
      >
        {pending ? "처리하는 중…" : label}
      </button>
      {err && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
      {done && <p role="status" className="mt-2 text-[15px] leading-relaxed break-keep text-mint-on">{done}</p>}
    </div>
  );
}

/** 🙋사장님 사정으로 확정 예약을 무를 때 — 바로 환불하지 않고 관리자에게 신청한다(대표 09-16).
 *  우리가 사장님과 손님께 전화로 확인하고, 관리자가 승인하면 손님께 전액 환불된다(숙박업 방식).
 *  ⚠️누르기 전에 얼럿으로 그 절차를 먼저 말한다 — 누르는 순간 환불되는 줄 알면 안 된다. */
export function RefundRequest({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  // 🎨09-18 밤 QA(H-26) — 성공도 실패도 같은 회색 한 줄이었다. 「신청했어요」와 「이미 신청이 들어가 있어요」가
  //   같은 얼굴로 서면 사장님은 둘을 구별할 수 없고, 실패한 줄 모른 채 전화를 기다린다.
  //   ⭐다른 버튼들(`PublishButton`·`PauseToggle`)은 이미 성패를 색으로 가른다. 같은 결로 맞춘다.
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = () =>
    start(async () => {
      setOpen(false);
      const r = await requestRefundAction(bookingId, note);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        className="py-[12px] text-[15px] text-mute underline underline-offset-2"
      >
        관리자에게 환불 신청하기
      </button>
      {msg && (
        <p role="status" className={`text-[15px] leading-relaxed break-keep ${msg.ok ? "text-mute" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
      <ConfirmDialog
        open={open}
        title="관리자에게 환불을 신청할까요"
        confirmLabel="신청하기"
        busy={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      >
        <p>
          바로 환불되지는 않아요. 저희가 사장님과 손님께 전화로 사정을 확인하고, 관리자가 승인하면 손님께 전액
          환불돼요.
        </p>
        <textarea
          rows={3}
          className={`${rentTextareaCls} mt-4 resize-y`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="어떤 사정인지 짧게 남겨 주시면 전화드릴 때 도움이 돼요 (선택)"
          aria-label="환불 신청 사유"
        />
      </ConfirmDialog>
    </div>
  );
}

/** ⏸공간 잠시 쉬기 / 다시 열기 (09-17). 공개 중(`open`)·쉬는 중(`paused`)에만 뜬다 — 서버도 그 둘만 받는다.
 *  쉬기는 한 번 묻는다. 목록에서 빠지는 일이라 실수로 누르면 그동안 손님이 못 찾는다.
 *  다시 열기는 바로 한다. 잘못 눌러도 잃는 게 없다. */
export function PauseToggle({ slug, paused }: { slug: string; paused: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const run = (next: boolean) =>
    start(async () => {
      setAsk(false);
      setMsg(null);
      const r = await setSpacePausedAction(slug, next);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) router.refresh();
    });

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => (paused ? run(false) : setAsk(true))}
        disabled={pending}
        className={`${secondaryBtnCls} text-[15px]`}
      >
        {pending ? "바꾸는 중…" : paused ? "다시 열기" : "잠시 쉬기"}
      </button>
      {msg && (
        <p role="status" className={`mt-2 text-[15px] leading-relaxed break-keep ${msg.ok ? "text-mint-on" : "text-danger"}`}>
          {msg.text}
        </p>
      )}
      <ConfirmDialog
        open={ask}
        title="잠시 쉴까요?"
        confirmLabel="쉬기"
        busy={pending}
        onConfirm={() => run(true)}
        onCancel={() => setAsk(false)}
      >
        <p>쉬는 동안엔 하루 가게 목록에서 이 공간이 빠져서 새 예약이 안 들어와요.</p>
        <p className="text-mute">손님이 이미 결제한 예약은 그대로라 그날 손님은 오세요. 다시 열기를 누르면 바로 돌아와요.</p>
      </ConfirmDialog>
    </div>
  );
}
