// 영어 상세(10-06 대표: 해외 노출). 화면·문안은 ../view.tsx — 한국어판과 같은 틀을 쓴다.
// ⚠️루트 레이아웃의 <html lang="ko">는 서버에서 못 바꾼다(루트 레이아웃이 하나라서).
//   대신 <main lang="en"> + 클라이언트에서 <html lang>을 en으로 바꾼다(HtmlLang).
import { MonitorAlignView, monitorAlignMetadata } from "../view";

export const metadata = monitorAlignMetadata("en");

export default function MonitorAlignEnPage() {
  return <MonitorAlignView lang="en" />;
}
