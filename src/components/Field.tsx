// 라벨 + 입력칸 한 벌. 인증 4화면(로그인·가입·비번찾기·새비밀번호)이 공유한다.
//
// ⚠️ 왜 placeholder만으론 안 되나 (디자인팀 QA #19)
//    placeholder는 **글자를 치는 순간 사라진다.** 라벨이 없으면 그때부터 이 칸이 뭐였는지 화면에
//    남지 않는다. 새 비밀번호 화면은 똑같이 생긴 칸이 둘이라 특히 위험하다(어느 쪽이 '확인'인지).
//    스크린리더도 placeholder를 이름으로 읽어주는 걸 보장하지 않는다.
//
// ⚠️ `htmlFor`를 꼭 넘길 것 — 라벨과 입력칸을 잇는 유일한 끈이다.
//    없으면 라벨을 눌러도 커서가 안 가고, 스크린리더가 둘을 한 벌로 못 읽는다.
//    (children으로 감싸는 방식은 못 쓴다 — 가입 폼은 한 Field 안에 <label>·안내문·에러가 섞여 있어
//     통째로 감싸면 안내문까지 라벨로 읽힌다.)
import type { ReactNode } from "react";

export function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  /** 짝지을 입력칸의 id. 호출부에서 같은 값을 input에 붙인다. */
  htmlFor?: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-medium text-body">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">· 선택</span>}
      </label>
      {children}
    </div>
  );
}

/** 인증 화면 공용 입력칸 스타일 — 4화면이 같은 얼굴이어야 한다. */
export const authInputCls =
  "h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus";
