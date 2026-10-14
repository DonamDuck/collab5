// 한국어를 뺀 언어(지금은 en)의 상세. 화면·문안은 ../view.tsx·../_copy/에 있다.
// 빌드 때 미리 굽고(generateStaticParams), 목록에 없는 주소(/ko 포함)는 404로 끝낸다(dynamicParams=false).
// ⚠️public/sideproject/limitglance/ 아래 파일(version.json·zip·og 이미지)은 이 동적 경로보다 먼저 잡힌다.
//   깔린 앱의 업데이터가 version.json을 읽으므로, 그 파일 이름과 겹치는 언어 세그먼트를 만들지 말 것.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SUB_LANGS, isLang, type Lang } from "../langs";
import { LimitGlanceView, limitGlanceMetadata } from "../view";

export const dynamicParams = false;

export function generateStaticParams() {
  return SUB_LANGS.map((lang) => ({ lang }));
}

type Props = { params: Promise<{ lang: string }> };

function subLang(x: string): Exclude<Lang, "ko"> {
  if (!isLang(x) || x === "ko") notFound();
  return x;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return limitGlanceMetadata(subLang((await params).lang));
}

export default async function LimitGlanceLangPage({ params }: Props) {
  return <LimitGlanceView lang={subLang((await params).lang)} />;
}
