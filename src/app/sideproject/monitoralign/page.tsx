// 한국어 상세. 화면·문안은 view.tsx에 있다(영어판 /sideproject/monitoralign/en과 같은 틀).
import { MonitorAlignView, monitorAlignMetadata } from "./view";

export const metadata = monitorAlignMetadata("ko");

export default function MonitorAlignPage() {
  return <MonitorAlignView lang="ko" />;
}
