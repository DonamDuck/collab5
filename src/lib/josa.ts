// 한글 받침 유무에 따라 조사를 고른다 (을/를, 은/는, 이/가 …).
// 한글 음절이면 유니코드로 받침 계산, 숫자로 끝나면 발음(영·일·이·삼…) 기준,
// 그 외 비한글(영문 등)은 판별 불가라 받침 없음(를/는/가)으로 처리한다.
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  if (!word) return withoutBatchim;
  const last = word[word.length - 1];
  const code = last.charCodeAt(0);
  let hasBatchim: boolean;
  if (code >= 0xac00 && code <= 0xd7a3) {
    // 한글 음절: (코드-0xAC00) % 28 이 0이면 받침 없음
    hasBatchim = (code - 0xac00) % 28 !== 0;
  } else if (/[0-9]/.test(last)) {
    // 0영 1일 2이 3삼 4사 5오 6육 7칠 8팔 9구 — 받침으로 끝나는 발음만 true
    hasBatchim = [true, true, false, true, false, false, true, true, true, false][Number(last)];
  } else {
    hasBatchim = false;
  }
  return hasBatchim ? withBatchim : withoutBatchim;
}
