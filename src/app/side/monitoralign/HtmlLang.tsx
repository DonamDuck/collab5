"use client";

// 영어 페이지에서만 <html lang>을 "en"으로 바꾼다(떠날 때 되돌린다).
// 루트 레이아웃이 <html lang="ko">를 박고 있고, 경로마다 바꾸려면 루트 레이아웃을 여러 벌로
// 쪼개야 해서(전 페이지 구조 변경) 그 대신 고른 방법이다. 서버 HTML의 본문은 <main lang="en">이 맡는다.
import { useEffect } from "react";

export function HtmlLang({ lang }: { lang: string }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = el.lang;
    el.lang = lang;
    return () => {
      el.lang = prev;
    };
  }, [lang]);
  return null;
}
