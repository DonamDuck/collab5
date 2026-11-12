// 창구 주소를 QR 그림(SVG 경로 한 줄)으로 바꾼다. 서버에서 페이지를 만들 때 한 번 돈다.
// ⭐주소는 channels.ts에서 그대로 받는다. 창구가 바뀌면 QR도 같이 바뀐다(그림 파일을 따로 두지 않는 이유).
// 카카오페이 송금 링크(qr.kakaopay.com)는 데스크탑 브라우저에서 열면 「모바일에서 이용 가능해요」만 나온다(11-12 대표).
// 그래서 데스크탑에선 이 QR을 보여 주고 휴대폰 카메라로 찍게 한다.
import QRCode from "qrcode";

export type QrPath = { size: number; d: string };

export function qrPath(text: string): QrPath {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let d = "";
  // 한 줄에서 이어진 검은 칸은 사각형 하나로 묶는다(경로가 짧아지고 칸 사이 틈도 안 생긴다).
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!modules.data[y * n + x]) {
        x++;
        continue;
      }
      let len = 1;
      while (x + len < n && modules.data[y * n + x + len]) len++;
      d += `M${x} ${y}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return { size: n, d };
}
