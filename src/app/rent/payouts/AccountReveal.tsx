"use client";

// 하루 팝업 — 정산 화면의 계좌 한 줄 (09-27 대표 D9)
//
// 🙈기본은 가린다. 검토 화면(`/rent/review`의 `AccountValue`)과 같은 규칙으로 끝 네 자리만 보인다.
//   전엔 이 화면만 「카카오뱅크 3333012345678 · 예금주 김느린 (개인사업자 1234567890)」처럼 원문을 그렸다.
// 👆「번호 보기」를 누르면 원문이 펼쳐진다(대표 결정). 송금할 때 옮겨 적어야 해서 펼친 뒤엔 번호마다 복사 버튼을 둔다.
// 🔒가리는 건 화면 표시뿐이다. 이 화면은 관리자만 열리고(`page.tsx` 첫 줄), 원문은 지금도 서버가 내려보낸다.
//   원문을 누를 때 따로 받아 오게 바꾸는 건 권한 설계를 바꾸는 일이라 여기서 안 했다.
// 📋복사는 세 단계다. 클립보드 API → 옛 방식(`execCommand`) → 둘 다 막히면 번호를 선택해 두고 한 줄로 알린다.
//   조용히 실패하면 복사된 줄 알고 틀린 번호를 붙여 넣는다. 번호 글자엔 `select-all`을 걸어 한 번 누르면 통째로 잡힌다.
import { useRef, useState } from "react";

type Props = {
  bank: string;
  holderName: string;
  holderTypeLabel: string;
  /** 계좌번호 원문(숫자만)과 끝 네 자리. 끝자리는 서버가 `toMasked`로 만든 것을 받는다. */
  account: { raw: string; last4: string };
  /** 사업자등록번호. 개인 계좌면 없다. `shown`은 펼쳤을 때 보일 모양(123-45-67890). */
  biz: { raw: string; shown: string; last4: string } | null;
};

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 권한·iframe 정책으로 막히면 아래 옛 방식으로 한 번 더
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function selectText(el: HTMLElement | null) {
  if (!el) return;
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

const numCls = "select-all tabular-nums text-body";
const copyBtnCls =
  "inline-flex h-[36px] items-center rounded-md border border-border-strong bg-surface px-3 text-[14px] text-ink hover:bg-surface-soft";

export function AccountReveal({ bank, holderName, holderTypeLabel, account, biz }: Props) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const accRef = useRef<HTMLSpanElement>(null);
  const bizRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = (m: string, clearAfter?: number) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    if (clearAfter) timer.current = setTimeout(() => setMsg(""), clearAfter);
  };

  const copy = async (text: string, el: HTMLElement | null, what: string) => {
    if (await copyText(text)) {
      say(`${what}를 복사했어요`, 2500);
    } else {
      selectText(el);
      say("자동 복사가 막혀 있어요. 번호를 선택해 뒀으니 직접 복사해 주세요.");
    }
  };

  return (
    <>
      <p className="mt-0.5 text-[15px] break-all text-mute">
        {bank}{" "}
        {open ? (
          <span ref={accRef} className={numCls}>
            {account.raw}
          </span>
        ) : (
          <span className="tabular-nums text-body">끝자리 {account.last4}</span>
        )}
        {" · "}예금주 {holderName} ({holderTypeLabel}
        {biz &&
          (open ? (
            <>
              {" "}
              <span ref={bizRef} className={numCls}>
                {biz.shown}
              </span>
            </>
          ) : (
            <span className="tabular-nums"> · 사업자번호 끝자리 {biz.last4}</span>
          ))}
        )
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            say("");
          }}
          aria-expanded={open}
          className="inline-flex h-[36px] items-center text-[14px] text-mute underline underline-offset-2"
        >
          {open ? "가리기" : "번호 보기"}
        </button>
        {open && (
          <button type="button" onClick={() => copy(account.raw, accRef.current, "계좌번호")} className={copyBtnCls}>
            계좌번호 복사
          </button>
        )}
        {open && biz && (
          <button type="button" onClick={() => copy(biz.raw, bizRef.current, "사업자번호")} className={copyBtnCls}>
            사업자번호 복사
          </button>
        )}
      </div>
      <p aria-live="polite" className="text-[14px] leading-relaxed break-keep text-mute">
        {msg}
      </p>
    </>
  );
}
