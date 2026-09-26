"use client";

// 하루 팝업 — 검토 화면 한 줄의 손잡이 둘: [공개하기] · [보완 요청] (2026-09-19 저녁 대표)
//
// 대표 원문: 「주소 비교는 어드민에서 확인하고 사업자 거절(사람이 하되 너랑 같이 할 거야)되면 반려 처리되고,
//   보완해 달라는 이메일과, 사장님 입장에서 보완해서 재제출할 수 있는 환경을 만들어 주자!」
// ⭐[보완 요청]은 팝업에서 사유를 받는다. 칩(흔한 이유 넷)을 누르면 한 줄씩 붙고, 칸에 직접 고쳐 쓸 수 있다.
//   적은 글은 사장님 메일·내 하루 팝업·고치기 화면에 그대로 나간다. 그래서 칩 문장도 해요체다(`FIX_REASON_CHIPS`).
// 🔒관문은 서버다(`requestSpaceFixAction`·`publishSpaceAction`). 여기서 막는 건 헛걸음을 줄이려는 것뿐이다.
// ⚠️누른 뒤 화면을 다시 읽지 않는다. 다시 읽으면 그 줄이 목록에서 빠져 결과 한 줄도 같이 사라진다(`PublishButton`과 같은 이유).
import { useState, useTransition } from "react";
import { publishSpaceAction, requestSpaceFixAction } from "@/lib/rent-actions";
import { FIX_REASON_CHIPS, fixNoteProblem, REVIEW_NOTE_MAX } from "@/lib/rent-review";
import { ConfirmDialog } from "../ConfirmDialog";
import { rentTextareaCls, secondaryBtnCls } from "../ui";

const chipCls = (on: boolean) =>
  `inline-flex min-h-[44px] items-center rounded-pill px-4 py-2 text-left text-[15px] leading-snug break-keep transition-colors ${
    on ? "bg-primary-tint font-medium text-primary-on" : "border border-hairline bg-surface text-body hover:bg-surface-soft"
  }`;

export function ReviewActions({
  slug,
  spaceName,
  publishLabel,
  blocked,
  fixReady,
  fixLockedLine,
  listed,
}: {
  slug: string;
  spaceName: string;
  /** 「공개하기」 또는 「확인 표시 붙이기」. */
  publishLabel: string;
  /** 공개를 막는 이유(`blockReason`). 있으면 [공개하기] 대신 이 말이 선다. [보완 요청]은 그대로 — 막힌 공간일수록 사장님께 말해야 한다. */
  blocked: string;
  /** 보완 요청을 적을 칸이 있는 DB인가(`reviewReady`). 없으면 버튼을 잠그고 `fixLockedLine`을 띄운다. */
  fixReady: boolean;
  fixLockedLine: string;
  /** 지금 손님 목록에 서 있는 공간인가. 팝업이 「목록에서 내려가요」를 말할지 정한다. */
  listed: boolean;
}) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [dialogErr, setDialogErr] = useState("");

  if (done) return <p role="status" className="mt-4 text-[15px] leading-relaxed break-keep text-mint-on">{done}</p>;

  const lines = note.split("\n").map((l) => l.trim()).filter(Boolean);
  const toggleChip = (chip: string) => {
    setDialogErr("");
    setNote((prev) => {
      const cur = prev.split("\n").map((l) => l.trim()).filter(Boolean);
      const next = cur.includes(chip) ? cur.filter((l) => l !== chip) : [...cur, chip];
      return next.join("\n");
    });
  };

  const publish = () =>
    start(async () => {
      setErr("");
      const r = await publishSpaceAction(slug);
      if (!r.ok) setErr(r.message);
      else setDone(r.message);
    });

  const sendFix = () =>
    start(async () => {
      const problem = fixNoteProblem(note);
      if (problem) {
        setDialogErr(problem);
        return;
      }
      const r = await requestSpaceFixAction(slug, note);
      if (!r.ok) {
        setDialogErr(r.message);
        return;
      }
      setOpen(false);
      setDone(r.message);
    });

  return (
    <div className="mt-4">
      {blocked && <p className="mb-3 text-[15px] leading-relaxed break-keep text-danger">{blocked}</p>}
      <div className="flex flex-wrap gap-2">
        {!blocked && (
          <button type="button" disabled={pending} onClick={publish} className={`${secondaryBtnCls} text-[15px]`}>
            {pending && !open ? "처리하는 중…" : publishLabel}
          </button>
        )}
        <button
          type="button"
          disabled={pending || !fixReady}
          onClick={() => {
            setErr("");
            setDialogErr("");
            setOpen(true);
          }}
          className={`${secondaryBtnCls} text-[15px]`}
        >
          보완 요청
        </button>
      </div>
      {!fixReady && <p className="mt-2 text-[15px] leading-relaxed break-keep text-lemon-on">{fixLockedLine}</p>}
      {err && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      <ConfirmDialog
        open={open}
        title={`${spaceName}, 무엇을 고쳐 주시면 될까요?`}
        confirmLabel="보완 요청하기"
        busy={pending}
        error={dialogErr}
        onConfirm={sendFix}
        onCancel={() => setOpen(false)}
      >
        <p className="text-[15px] text-mute">
          적으신 글이 사장님 메일과 고치기 화면에 그대로 가요. 보내면 검토 대기에서 빠져 「보완을 기다리는 공간」으로 옮겨요.
          {listed ? " 지금 목록에 있는 공간이라 목록에서도 내려가요. 이미 잡힌 예약은 그대로예요." : ""}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {FIX_REASON_CHIPS.map((chip) => {
            const on = lines.includes(chip);
            return (
              <button key={chip} type="button" aria-pressed={on} onClick={() => toggleChip(chip)} className={chipCls(on)}>
                {chip}
              </button>
            );
          })}
        </div>
        <label htmlFor={`fix-note-${slug}`} className="block pt-2 text-[15px] font-medium text-ink">
          사장님께 보낼 말
        </label>
        <textarea
          id={`fix-note-${slug}`}
          rows={4}
          maxLength={REVIEW_NOTE_MAX}
          className={rentTextareaCls}
          value={note}
          onChange={(e) => {
            setDialogErr("");
            setNote(e.target.value);
          }}
          placeholder="위에서 고르시거나 직접 적어 주세요. 예) 등록증은 2층인데 공간 주소는 3층으로 적혀 있어요."
        />
        <p className="text-right text-[13px] tabular-nums text-faint">
          {note.trim().length} / {REVIEW_NOTE_MAX}
        </p>
      </ConfirmDialog>
    </div>
  );
}
