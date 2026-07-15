// 브라우저에서 이미지 파일을 리사이즈·압축해 data URL로. (Storage 없이 DB 저장용 MVP)
// 큰 원본을 그대로 DB에 넣으면 무겁기 때문에 긴 변 기준 축소 + JPEG 압축.
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1000,
  quality = 0.78
): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("decode failed"));
    image.src = dataUrl;
  });

  let { width, height } = img;
  const longest = Math.max(width, height);
  if (longest > maxDim) {
    const scale = maxDim / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  // 투명 PNG를 JPEG로 저장하면 투명 픽셀이 검정이 됨 → 흰 배경을 먼저 깔아 검정 배경 방지.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

// 리사이즈·압축 결과를 Blob으로 (Storage 업로드용)
export async function fileToResizedBlob(
  file: File,
  maxDim = 1000,
  quality = 0.78
): Promise<Blob> {
  const dataUrl = await fileToResizedDataUrl(file, maxDim, quality);
  const res = await fetch(dataUrl);
  return res.blob();
}
