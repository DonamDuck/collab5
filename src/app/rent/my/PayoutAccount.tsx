"use client";

// 내 하루 팝업 — 정산 받을 계좌 (2026-09-17, 대표: 「오늘 다 구현」)
//
// 🔒이 컴포넌트는 계좌번호 «원문»을 받지 않는다. 서버가 뒷자리만 남긴 모양(`PayoutAccountMasked`)을 주고,
//   저장 뒤에도 액션이 같은 모양만 돌려준다. 입력칸에 쳤던 값은 저장이 끝나면 바로 비운다.
// ⏳정산 «날짜»는 말하지 않는다. 토스 지급대행 계약 뒤 대표가 정한다.
// 🧾팝업 대신 펼침 폼 — 칸이 다섯이라 팝업 안에서 스크롤이 생기고, 폰 키보드가 올라오면 버튼이 가린다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePayoutAccountAction } from "@/lib/rent-actions";
import { BANKS, HOLDER_TYPE_LABEL, type PayoutHolderType } from "@/lib/banks";
import type { PayoutAccountMasked } from "@/lib/payout-accounts";
import { RentSelect, primaryBtnCls, rentInputCls, secondaryBtnCls } from "../ui";

const HOLDER_TYPES: PayoutHolderType[] = ["individual", "sole_proprietor", "corporation"];
const labelCls = "block text-[15px] font-medium text-ink";
const hintCls = "mt-1 text-[14px] leading-relaxed break-keep text-mute";

export function PayoutAccount({ initial }: { initial: PayoutAccountMasked | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [account, setAccount] = useState<PayoutAccountMasked | null>(initial);
  const [editing, setEditing] = useState(false);
  const [holderType, setHolderType] = useState<PayoutHolderType>(initial?.holderType ?? "individual");
  const [holderName, setHolderName] = useState(initial?.holderName ?? "");
  const [businessNumber, setBusinessNumber] = useState("");
  const [bankCode, setBankCode] = useState(initial?.bankCode ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState("");

  const save = () =>
    start(async () => {
      setErr("");
      setDone("");
      const r = await savePayoutAccountAction({ holderType, holderName, businessNumber, bankCode, accountNumber });
      if (!r.ok) {
        setErr(r.message);
        return;
      }
      // 원문을 화면 상태에 남겨 두지 않는다.
      setAccountNumber("");
      setBusinessNumber("");
      if (r.account) setAccount(r.account);
      setEditing(false);
      setDone(r.message);
      router.refresh();
    });

  return (
    <div className="mt-5">
      {!editing && account && (
        <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-4">
          <div className="min-w-0">
            <p className="text-[17px] font-medium text-ink">
              {account.bankName} <span className="tabular-nums">{account.accountMasked}</span>
            </p>
            <p className="mt-1 text-[15px] text-mute">
              예금주 {account.holderName} · {HOLDER_TYPE_LABEL[account.holderType]}
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setDone(""); setEditing(true); }}
            className="shrink-0 py-[12px] text-[15px] text-mute underline underline-offset-2"
          >
            바꾸기
          </button>
        </div>
      )}

      {!editing && !account && (
        <>
          <p className="text-[15px] leading-relaxed break-keep text-mute">
            아직 등록한 계좌가 없어요. 손님이 이용한 날이 지나면 받으실 돈을 여기 등록한 계좌로 보내 드려요.
          </p>
          <button type="button" onClick={() => setEditing(true)} className={`${secondaryBtnCls} mt-4 text-[15px]`}>
            계좌 등록하기
          </button>
        </>
      )}

      {done && !editing && (
        <p role="status" className="mt-3 text-[15px] leading-relaxed break-keep text-mint-on">{done}</p>
      )}

      {editing && (
        <div className="space-y-5 rounded-lg border border-hairline bg-surface px-4 py-5 sm:px-5">
          <div>
            <p className={labelCls}>누구 이름의 계좌인가요?</p>
            <div role="radiogroup" aria-label="예금주 유형" className="mt-2 flex flex-wrap gap-2">
              {HOLDER_TYPES.map((v) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={holderType === v}
                  onClick={() => setHolderType(v)}
                  className={`h-[44px] rounded-md border px-4 text-[15px] transition-colors ${
                    holderType === v
                      ? "border-primary-tint bg-primary-pale font-medium text-ink"
                      : "border-hairline bg-surface text-body hover:bg-surface-soft"
                  }`}
                >
                  {HOLDER_TYPE_LABEL[v]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="pa-holder" className={labelCls}>예금주</label>
            <p className={hintCls}>통장에 찍힌 이름과 한 글자도 다르지 않게 적어 주세요. 다르면 돈이 못 들어가요.</p>
            <input
              id="pa-holder"
              className={`${rentInputCls} mt-2`}
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              autoComplete="off"
            />
          </div>

          {holderType !== "individual" && (
            <div>
              <label htmlFor="pa-biz" className={labelCls}>사업자등록번호</label>
              {account?.hasBusinessNumber && (
                <p className={hintCls}>바꾸실 때도 한 번 더 적어 주셔야 해요.</p>
              )}
              <input
                id="pa-biz"
                className={`${rentInputCls} mt-2 tabular-nums`}
                inputMode="numeric"
                placeholder="숫자 10자리"
                value={businessNumber}
                onChange={(e) => setBusinessNumber(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label htmlFor="pa-bank" className={labelCls}>은행</label>
            <RentSelect id="pa-bank" wrapClassName="mt-2 w-full" value={bankCode} onChange={(e) => setBankCode(e.target.value)}>
              <option value="" disabled>
                은행 고르기
              </option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </RentSelect>
          </div>

          <div>
            <label htmlFor="pa-account" className={labelCls}>계좌번호</label>
            {account && <p className={hintCls}>지금 등록된 번호는 {account.accountMasked}예요. 바꾸려면 새 번호를 통째로 적어 주세요.</p>}
            <input
              id="pa-account"
              className={`${rentInputCls} mt-2 tabular-nums`}
              inputMode="numeric"
              placeholder="하이픈은 넣어도 괜찮아요"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              autoComplete="off"
            />
          </div>

          {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={pending} className={`${primaryBtnCls} h-[44px] px-5 text-[15px]`}>
              {pending ? "저장하는 중…" : "저장하기"}
            </button>
            <button
              type="button"
              onClick={() => { setErr(""); setAccountNumber(""); setBusinessNumber(""); setEditing(false); }}
              disabled={pending}
              className={`${secondaryBtnCls} text-[15px]`}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
