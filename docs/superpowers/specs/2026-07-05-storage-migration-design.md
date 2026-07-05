# Storage 이전 — 사진 base64 → Supabase Storage URL

Date: 2026-07-05
관련 백로그: `~/Desktop/collab5-Obsidian/1_Projects/사진-Storage-이전.md`

## Goal
사진(브랜드/활동/콜라보/프로필)을 DB 행 안 base64 저장에서 Supabase Storage 파일+URL로 전환해, 수정 진입·저장·소개서 페이지 렌더 속도를 근본적으로 개선한다.

## 문제 (Why)
현재 사진은 클라에서 리사이즈한 JPEG base64 문자열로 DB `photos`/`activities[].photos`/`collab_history[].photos` 컬럼에 그대로 저장된다. 사진 1장이 수백 KB~1MB짜리 텍스트가 되어:
- **수정 진입 느림 + 빈 input 깜빡임**: `getEditDataAction`이 base64 전체(수 MB)를 서버→클라 전송.
- **저장 느림**: base64 전체를 서버액션으로 업로드 → 이어서 `/m` 페이지가 그 base64를 다시 다운로드해 렌더.
- **Flight 배열 한도 회피 로직**(`{u}` PhotoWire 래핑)이라는 부채도 base64 때문에 생김.

코드 튜닝으로 없앨 수 없고 저장 구조를 바꿔야 한다.

## Architecture — A안: 클라 직접 업로드 (서명 URL)

```
[Before] 파일 → 클라 리사이즈 → base64 → 서버액션(무거움) → DB에 base64
[After]  파일 → 클라 리사이즈 → Blob → (서명URL) Storage 직접 업로드 → DB엔 public URL만
```

- 서버액션은 "업로드 자리 하나 내줘" 요청만 받아 **서명된 업로드 URL**(가벼운 텍스트)을 service_role로 발급.
- 브라우저가 그 URL로 Storage에 사진 파일을 **직접** 업로드(서버 경유 X).
- 저장 시 서버액션엔 **짧은 public URL 문자열만** 전달 → base64가 서버액션 경로에서 완전히 사라짐.
- 비회원도 안전: 업로드 권한은 서버가 발급한 1회용 서명 토큰으로만.

### 업로드 시점 = "사진 고르는 순간"
저장 버튼이 아니라 파일 선택 즉시 리사이즈→업로드한다. 미리보기 썸네일 = 이미 올라간 실제 URL. 저장은 URL만 보내므로 순식간. 업로드 진행 중엔 썸네일에 스피너.

## Storage 버킷 (사용자가 콘솔에서 생성)
- 이름: **`maker-photos`**
- **Public bucket** (읽기 공개 — 소개서/카드는 공개 페이지).
- 업로드는 서명 URL 경유만(공개 insert 정책 열지 않음). 서명 URL은 서버 service_role로 발급.
- 파일 경로: `p/{crypto.randomUUID()}.jpg` (등록 시점엔 slug가 없으므로 slug 비의존 랜덤 경로).

## 컴포넌트 (단위와 경계)

### `src/lib/image.ts` — `fileToResizedBlob(file, maxDim, quality): Promise<Blob>`
기존 `fileToResizedDataUrl`과 동일 리사이즈 로직이되 `canvas.toBlob`으로 **Blob** 반환. 기존 함수는 폴백용으로 유지(당장 참조 없어지면 제거).

### `src/lib/actions.ts` — `createUploadUrlAction(): Promise<{ path, token, publicUrl } | { error }>`
service_role 스토리지 클라이언트로 `maker-photos` 버킷에 `p/{uuid}.jpg` 경로의 **서명 업로드 URL**(`createSignedUploadUrl`)과 그 경로의 **public URL**(`getPublicUrl`)을 발급. env(Storage) 미설정 시 `{ error }` 반환(우아한 무력화).

### `src/lib/upload.ts` (신설) — `uploadPhoto(file, maxDim): Promise<string>`
1. `fileToResizedBlob(file, maxDim)` 2. `createUploadUrlAction()`로 path·token·publicUrl 확보 3. 브라우저 supabase 클라의 `storage.from('maker-photos').uploadToSignedUrl(path, token, blob)` 4. 성공 시 `publicUrl` 문자열 반환. 실패 시 throw.

### `src/app/register/PhotoGrid.tsx`
`onAdd`에서 base64 생성 대신 `uploadPhoto` 호출. 업로드 중 항목별 스피너 상태. 성공 시 URL을 `urls`에 추가. 실패 시 에러 표시 + 항목 미추가.

### `src/app/register/page.tsx`
submit에서 리사이즈/`fileToResizedDataUrl`/`{u}` 래핑 제거 — 이미 URL이므로 그대로 payload에 전송. edit 진입 시 기존 URL(또는 잔존 base64)을 그대로 `url`로 로드.

### `src/app/signup/page.tsx`
프로필 이미지도 `uploadPhoto(file, 400)`으로 Storage 업로드 → `profileImage`에 URL 저장.

### `src/lib/actions.ts` 배선 정리
`PhotoWire`/`{u}` 래핑은 유지 — 로컬(mock) base64 폴백 경로가 Flight 배열 한도에 다시 걸리지 않도록. URL엔 무해. repo·types는 이미 `string[]`이라 변경 최소.

## 데이터 흐름
1. 사용자가 PhotoGrid에서 파일 선택
2. `uploadPhoto` → 리사이즈 Blob → `createUploadUrlAction`(서버) → `uploadToSignedUrl`(클라) → Storage
3. public URL을 폼 상태에 저장, 썸네일 표시
4. 저장 → `createMakerAction`/`updateMakerAction`에 URL 배열 전송 → DB에 URL 저장
5. `/m`·`/c` 렌더 → `<img src={url}>`로 CDN에서 lazy 로드

## Error Handling
- **업로드 실패**: `uploadPhoto` throw → PhotoGrid에서 catch, 항목 스피너 제거·에러 문구, 재시도 가능.
- **Storage env 미설정(로컬 mock)**: `createUploadUrlAction`이 `{ error }` → PhotoGrid는 기존 base64 경로로 폴백(로컬 개발 유지) 또는 안내. (로컬은 mock repo라 base64 폴백 유지.)
- **기존 base64 데이터**: URL 대신 base64가 `url`에 들어와도 `<img>`가 정상 렌더 → 공존. 마이그레이션 불필요(캔가 1건은 수정화면 재업로드로 자연 이전).

## 엣지 케이스 / 범위 밖
- **고아 파일**: 사진 삭제·등록 포기 시 Storage 파일 잔존 → MVP는 방치(1GB 무료). 정리 배치 = 백로그.
- **백필 스크립트**: 실데이터 1~2건뿐이라 작성 안 함(A안 — 수동 재업로드).
- **이미지 최적화(WebP/여러 해상도)**: 범위 밖. 현행 JPEG 단일 해상도 유지.

## Testing / 검증
- 로컬(mock): PhotoGrid가 Storage env 없을 때 base64 폴백으로 깨지지 않는지.
- prod: 신규 등록에서 사진 업로드→저장→`/m` 렌더가 base64 때보다 빠른지, DB 행에 URL만 들어가는지(base64 없음) 확인.
- 수정 진입 즉시 폼이 뜨는지(빈 input 깜빡임 소멸), 저장 즉시 `/m` 이동하는지.
- 캔가 record 수정화면 재업로드 후 해당 record도 빨라지는지.

## 부가 효과
회원가입 프로필 이미지도 같은 파이프 → [[간편가입-등록분리]] 프로필 이미지 항목 동시 해결.
