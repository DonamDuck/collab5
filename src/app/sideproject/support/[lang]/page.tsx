// 한국어를 뺀 언어(지금은 en)의 후원하기. 화면·문안은 ../view.tsx·../_copy/에 있다.
// 빌드 때 미리 굽고(generateStaticParams), 목록에 없는 주소(/ko 포함)는 404로 끝낸다(dynamicParams=false).
// 아직 문을 안 연 언어(창구 주소가 없는 언어)도 404다(../langs.ts OPEN_LANGS).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUB_LANGS, isLang, isOpen, type Lang } from "../langs";
import { SupportView, supportMetadata } from "../view";

export const dynamicParams = false;

export function generateStaticParams() {
  // 안 연 언어는 굽지 않는다 — 구워 두면 notFound()여도 200으로 나간다(11-05 빌드 실측).
  return SUB_LANGS.filter(isOpen).map((lang) => ({ lang }));
}

type Props = { params: Promise<{ lang: string }> };

function subLang(x: string): Exclude<Lang, "ko"> {
  if (!isLang(x) || x === "ko" || !isOpen(x)) notFound();
  return x;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return supportMetadata(subLang((await params).lang));
}

export default async function SupportLangPage({ params }: Props) {
  return <SupportView lang={subLang((await params).lang)} />;
}
