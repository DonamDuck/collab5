"use client";

import { useState } from "react";

// 비밀번호 입력 공용 — 우측 눈 아이콘으로 표시/숨김 토글.
// 앱의 모든 비번 input은 이걸 쓴다(등록 관리비번·로그인·가입·재설정·점유 모달 등).
// className은 호출부의 기존 입력 스타일을 그대로 받고, 아이콘 자리(pr-11)만 뒤에 덧붙여 보정한다.
export function PasswordInput({
  className = "",
  wrapperClassName = "",
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & {
  // 바깥 여백(mt-4 등)은 여기로 — input에 두면 래퍼가 여백만큼 커져서 눈 아이콘(inset-y-0)이 아래로 밀린다
  wrapperClassName?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className={`relative ${wrapperClassName}`}>
      <input type={show ? "text" : "password"} className={`${className} pr-11`} {...props} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
        tabIndex={-1} // 탭 이동은 비번→다음 필드로. 토글은 마우스/터치용
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-faint hover:text-body"
      >
        {show ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
            <line x1="2" y1="2" x2="22" y2="22" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
