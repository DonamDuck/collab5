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

/** 「로/으로」 (09-20 등록증 한 줄 「등록증에는 ○○○로 적혀 있어요」). 위 `josa`와 달리 ㄹ 받침은 「로」다(「서울로」·「15일로」).
 *  끝의 괄호·마침표 같은 기호는 건너뛰고 마지막 글자를 본다. 숫자는 발음으로(0영·3삼·6육만 「으로」. 10·100처럼 0으로 끝나는 수도 십·백이라 「으로」).
 *  영문 등 판별할 수 없는 글자는 「로」. */
export function josaRo(word: string): string {
  const w = (word ?? "").replace(/[^0-9A-Za-z\uac00-\ud7a3]+$/, "");
  const last = w[w.length - 1];
  if (!last) return "로";
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return jong === 0 || jong === 8 ? "로" : "으로"; // 8 = ㄹ
  }
  if (/[0-9]/.test(last)) return "036".includes(last) ? "으로" : "로";
  return "로";
}
