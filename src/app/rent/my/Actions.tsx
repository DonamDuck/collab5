"use client";

// 내 하루 가게 — 버튼 세 종류 (2026-09-13)
//
// ⚠️화면에서 버튼을 숨기는 건 UX일 뿐이다. 권한은 세 액션이 전부 **자기 첫 줄에서** 다시 검사한다
//   (`lib/rent-actions.ts` 머리말). 그러니 여기서 할 일은 「막기」가 아니라
//   **되돌릴 수 없는 행동을 실수로 누르지 않게 하는 것**이다 — 거절과 취소에 한 번 더 묻는 이유.
//
// 🎨09-13 재작업 — 버튼은 보조(흰 면 + border-strong) 44px 한 종류, 수락만 키위.
//   `rounded-sm` 각진 버튼을 `rounded-md`로, 13px 글자를 15로 올렸다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  decideBookingAction,
  cancelBookingAction,
  publishSpaceAction,
} from "@/lib/rent-actions";
import { primaryBtnCls, rentTextareaCls, secondaryBtnCls } from "../ui";

/** 받은 신청 — 수락 · 거절. 거절은 전액 환불이라 되돌릴 수 없다(대표 09-13). */
export function HostDecide({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const [confirmReject, setConfirmReject] = useState(false);

  const run = (accept: boolean) =>
    start(async () => {
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
      <div className="flex gap-2">
        {/* ⭐항목마다 키위가 하나씩 나올 수 있는 화면이라(받은 신청 여러 건) 예외로 허용하되 작게 —
            폭을 내용만큼만. 높이는 옆 보조 버튼과 같은 44px(한 줄에서 높이가 다르면 어긋나 보인다). */}
        <button
          type="button"
          onClick={() => run(true)}
          disabled={pending}
          className={`${primaryBtnCls} h-[44px] px-5 text-[15px]`}
        >
          수락
        </button>
        {confirmReject ? (
          <button
            type="button"
            onClick={() => run(false)}
            disabled={pending}
            className={`${secondaryBtnCls} border-danger text-[15px] text-danger hover:bg-surface`}
          >
            정말 거절할까요
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmReject(true)}
            disabled={pending}
            className={`${secondaryBtnCls} text-[15px]`}
          >
            거절
          </button>
        )}
      </div>
      {confirmReject && (
        <p className="text-[15px] leading-relaxed break-keep text-mute">
          거절하시면 신청하신 분께 전액 돌려드리고, 그날은 다시 빌려줄 수 있는 날로 돌아가요.
        </p>
      )}
    </div>
  );
}

/** 내가 보낸 신청 취소. 환불률은 우리 규정표가 정한다 — 그래서 **여기 숫자를 적지 않는다.**
 *  화면에 「전액 환불」이라고 박아 두면 당일 취소에도 그 말이 남아 거짓이 된다.
 *  실제 금액은 액션이 계산해서 메시지로 돌려준다. */
export function GuestCancel({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const run = () =>
    start(async () => {
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
      {confirming ? (
        <div className="space-y-3">
          <p className="text-[15px] leading-relaxed break-keep text-mute">
            취소하시면 되돌릴 수 없어요. 환불 금액은 취소 시점에 따라 달라져요.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className={`${secondaryBtnCls} border-danger text-[15px] text-danger hover:bg-surface`}
            >
              네, 취소할게요
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="h-[44px] px-4 text-[15px] text-mute disabled:opacity-60"
            >
              그냥 둘게요
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          // 배경 없는 글자 버튼은 세로 패딩으로 44px를 채운다(디자인-시스템 §터치 타깃).
          className="py-[12px] text-[15px] text-mute underline underline-offset-2"
        >
          신청 취소하기
        </button>
      )}
      {err && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
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
