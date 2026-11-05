// 딴짓 아래 모든 페이지에 열림 기록을 붙이는 자리. 화면에는 아무것도 더하지 않는다.
import { SideTrack } from "./SideTrack";

export default function SideProjectLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <SideTrack />
    </>
  );
}
