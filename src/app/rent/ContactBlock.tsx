// 하루 가게 — 확정 뒤에만 열리는 연락처 블록 (2026-09-14)
//
// 🚨**이 컴포넌트는 판정을 안 한다.** 열어도 되는지는 호출부가 `isRevealed(booking)`으로 정하고, 여기는
//   받은 값을 그리기만 한다. 두 군데(`/rent/my`·`/rent/done`)가 같은 얼굴이어야 해서 한 파일로 뺐다.
//   훅이 없어 서버 컴포넌트에서 바로 부른다(`"use client"` 없음이 그 계약).
//
// 🎨16px 본문, 상단 15px faint 안내 한 줄. 상자 없이 — 확정 화면에 민트 상자를 두면 「성공」이 색으로 말해
//   버려서 브랜드색 희소성 규율(ui.tsx)과 부딪힌다.
import type { Profile } from "@/lib/profiles";

export function ContactBlock({
  who,
  profile,
  address,
  accessNote,
}: {
  /** 「사장님」 또는 「신청하신 분」 */
  who: string;
  profile: Profile | null;
  /** 손님 쪽에만 — 사장님은 자기 주소를 안 봐도 된다. */
  address?: string;
  /** 「들어오는 법」 — 주소와 같은 급의 비밀. 손님 쪽에만. */
  accessNote?: string;
}) {
  const name = profile?.brandName?.trim() || "이름을 안 적으셨어요";
  const phone = profile?.phone?.trim() ?? "";
  const email = profile?.email?.trim() ?? "";
  const line = "text-[16px] leading-relaxed break-keep text-body";
  return (
    <div className="mt-3">
      <p className="text-[15px] text-faint">확정된 분끼리만 보여요</p>
      <p className={`mt-1 ${line}`}>
        <span className="text-mute">{who} · </span>
        <span className="font-medium text-ink">{name}</span>
      </p>
      {phone ? (
        <p className={line}>
          <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="underline underline-offset-2">
            {phone}
          </a>
        </p>
      ) : (
        <p className={`${line} text-mute`}>전화번호를 안 적으셨어요. 이메일로 연락해 주세요.</p>
      )}
      {email && (
        <p className={line}>
          <a href={`mailto:${email}`} className="underline underline-offset-2">
            {email}
          </a>
        </p>
      )}
      {address && <p className={`mt-2 ${line}`}>{address}</p>}
      {accessNote && (
        <p className={`whitespace-pre-line ${line}`}>
          <span className="text-mute">들어오는 법 · </span>
          {accessNote}
        </p>
      )}
    </div>
  );
}
