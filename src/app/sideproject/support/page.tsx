// 한국어 후원하기. 화면·문안은 view.tsx·_copy/에 있다(영어는 [lang]/page.tsx가 같은 틀로 그린다).
import { SupportView, supportMetadata } from "./view";

export const metadata = supportMetadata("ko");

export default function SupportPage() {
  return <SupportView lang="ko" />;
}
