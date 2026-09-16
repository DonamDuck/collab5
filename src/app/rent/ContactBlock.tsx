// 하루 가게 — 확정 뒤에만 열리는 연락처 블록 (2026-09-14)
//
// 🚨**이 컴포넌트는 판정을 안 한다.** 열어도 되는지는 호출부가 `isRevealed(booking)`으로 정하고, 여기는
//   받은 값을 그리기만 한다. 두 군데(`/rent/my`·`/rent/done`)가 같은 얼굴이어야 해서 한 파일로 뺐다.
//   훅이 없어 서버 컴포넌트에서 바로 부른다(`"use client"` 없음이 그 계약).
//
// 🎨16px 본문, 상단 15px faint 안내 한 줄. 상자 없이 — 확정 화면에 민트 상자를 두면 「성공」이 색으로 말해
//   버려서 브랜드색 희소성 규율(ui.tsx)과 부딪힌다.
//
// 🔁09-15 대표 — *「가게 정보 타이틀 하나 섹션 만들고 하단에 전화번호: 이메일: 주소: 이런 식으로 깔끔하게」*.
//   전엔 이름·전화·이메일·주소가 **각자 다른 모양의 줄**로 흘러서 무엇이 무엇인지 라벨이 없었다.
//   이제 화면 셋(확정·신청 완료·내 하루 가게)이 쓰는 그 항목 문법(`InfoRow`)을 여기서도 쓴다.
import type { Profile } from "@/lib/profiles";
import type { AccessHow } from "@/lib/types";
import { accessHowLine } from "@/lib/rent-copy";
import { InfoList, InfoRow } from "./ui";

export function ContactBlock({
  who,
  profile,
  address,
  accessNote,
  shopPhone,
  accessHow,
  title = "가게 정보",
  masked = false,
}: {
  /** 「사장님」 또는 「신청하신 분」 */
  who: string;
  profile: Profile | null;
  /** 손님 쪽에만 — 사장님은 자기 주소를 안 봐도 된다. */
  address?: string;
  /** 「들어오는 법」 — 주소와 같은 급의 비밀. 손님 쪽에만. ⚠️옛 칸이라 새 공간은 비어 있다. */
  accessNote?: string;
  /** ☎️매장 전화. 개인 번호보다 이쪽을 먼저 보여 준다 — 호스트 약관 제6조가 여는 번호가 그것이고,
   *  받는 사람도 가게 번호가 편하다. 손님 쪽에만 넘긴다. */
  shopPhone?: string;
  /** 📨이용 안내를 어떻게 받게 되는지. 「들어오는 법」 칸을 대신한다(09-16). */
  accessHow?: AccessHow;
  /** 절 제목. 손님이 보면 「가게 정보」, 사장님이 보면 「신청하신 분 정보」다. */
  title?: string;
  /** 🙈이용일이 지난 예약이면 연락처를 「-」로 가린다(대표 09-16).
   *  다녀온 뒤까지 번호·메일이 열려 있을 이유가 없고, 옛 공간의 「들어오는 법」엔 출입 비밀번호가 남아 있을 수 있다.
   *  줄은 지우지 않고 「-」로 둔다 — 줄이 통째로 사라지면 «원래 없던 정보»로 읽힌다. */
  masked?: boolean;
}) {
  const name = profile?.brandName?.trim() || "이름을 안 적으셨어요";
  const phone = masked ? "" : profile?.phone?.trim() ?? "";
  const email = masked ? "" : profile?.email?.trim() ?? "";
  return (
    <section className="mt-8 border-t border-hairline pt-7">
      <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
      <p className="mt-1 mb-4 text-[15px] text-faint">
        {masked ? "이용일이 지나 연락처는 가려 두었어요" : "예약한 분끼리만 보여요"}
      </p>
      <InfoList>
        <InfoRow label={who} value={<span className="font-medium text-ink">{name}</span>} />
        {masked ? (
          <InfoRow label="가게 전화" value={<span className="text-mute">-</span>} />
        ) : shopPhone?.trim() && (
          <InfoRow
            label="가게 전화"
            value={
              <a href={`tel:${shopPhone.replace(/[^0-9+]/g, "")}`} className="underline underline-offset-2">
                {shopPhone}
              </a>
            }
          />
        )}
        <InfoRow
          label="전화번호"
          value={
            masked ? (
              <span className="text-mute">-</span>
            ) : phone ? (
              // 눌러서 바로 걸 수 있게. 확정된 뒤의 연락은 대개 「지금」 해야 하는 일이다.
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="underline underline-offset-2">
                {phone}
              </a>
            ) : (
              <span className="text-mute">안 적으셨어요. 이메일로 연락해 주세요.</span>
            )
          }
        />
        {masked && <InfoRow label="이메일" value={<span className="text-mute">-</span>} />}
        {email && (
          <InfoRow
            label="이메일"
            value={
              <a href={`mailto:${email}`} className="break-all underline underline-offset-2">
                {email}
              </a>
            }
          />
        )}
        {address && <InfoRow label="주소" value={address} />}
        {!masked && accessNote && (
          <InfoRow label="들어오는 법" value={<span className="whitespace-pre-line">{accessNote}</span>} />
        )}
        {accessHow && <InfoRow label="이용 안내" value={accessHowLine(accessHow)} />}
      </InfoList>
    </section>
  );
}
