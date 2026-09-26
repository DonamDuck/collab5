import { OG_IMAGE } from "@/lib/site";

// 하루 팝업 — 공간 링크 카드의 그림 (09-27 대표 D3: 「공간 링크를 카톡에 붙이면 가게 사진이 떠야 한다」)
//
// 공간 상세(`/rent/{slug}`)와 판매자 정보(`./seller`)가 같이 쓴다. 규칙을 두 벌로 적지 않으려고 뺐다.
//
// 📸사진 첫 장을 그대로 싣는다. 주소는 이미 절대 주소다. 등록 폼의 `uploadPhoto`가 저장소에 올린 뒤
//   supabase-js `getPublicUrl`이 준 공개 주소(`…/storage/v1/object/public/maker-photos/rent/p/{uuid}.jpg`)를
//   저장하고, 저장 액션도 그 모양만 받는다(`rentPhotoOk`). Next 이미지 변환 경로(`/_next/image`)를 거치지 않으니
//   카카오·페북 크롤러가 그 주소를 바로 받는다. 09-27 실측으로 공개 공간 셋의 첫 장이 모두 200·image/jpeg였다.
// 📐사진의 가로세로는 안 적는다. 올릴 때 긴 변을 1200px로 줄이지만 비율은 사진마다 달라서, 알려면 파일을 열어 봐야 한다.
//   크기 값이 없어도 카톡은 그림을 직접 읽어서 카드를 만든다(소개서 `/m`도 같은 방식이다).
// 🧪사진이 http 주소가 아니면 기본 카드로 간다. 크롤러는 data URL을 못 읽는다.
//   목 데이터의 사진이 전부 data URL이라, 목 공간은 늘 기본 카드가 뜬다. 진짜 공간으로 확인할 것.
export function spaceShareImage(photos: string[]): { url: string; width?: number; height?: number } {
  const photo = photos.find((p) => /^https?:\/\//.test(p));
  if (photo) return { url: photo };
  // 기본 카드는 크기를 안다(`public/og-image.png`, 루트 레이아웃과 같은 값).
  return { url: OG_IMAGE, width: 1200, height: 630 };
}
