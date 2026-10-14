// 한국어 상세. 화면·문안은 view.tsx·_copy/에 있다(영어는 [lang]/page.tsx가 같은 틀로 그린다).
import { LimitGlanceView, limitGlanceMetadata } from "./view";

export const metadata = limitGlanceMetadata("ko");

export default function LimitGlancePage() {
  return <LimitGlanceView lang="ko" />;
}
