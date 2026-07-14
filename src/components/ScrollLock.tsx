"use client";

import { useEffect } from "react";

// 오버레이(모달·바텀시트) 안에 <ScrollLock /> 한 줄 넣으면, 열려있는 동안 배경 페이지 스크롤을 잠근다.
// 오버레이가 조건부 렌더(열릴 때만 마운트)라 마운트=잠금 / 언마운트=복원. 스크롤바 폭만큼 패딩을 보정해 레이아웃 밀림 방지.
export function ScrollLock() {
  useEffect(() => {
    const { body, documentElement: html } = document;
    const scrollbarW = window.innerWidth - html.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, []);
  return null;
}
