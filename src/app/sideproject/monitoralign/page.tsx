// 한국어 상세. 화면·문안은 view.tsx·_copy/에 있다(다른 여덟 언어는 [lang]/page.tsx가 같은 틀로 그린다).
import { MonitorAlignView, monitorAlignMetadata } from "./view";

export const metadata = monitorAlignMetadata("ko");

export default function MonitorAlignPage() {
  return <MonitorAlignView lang="ko" />;
}
