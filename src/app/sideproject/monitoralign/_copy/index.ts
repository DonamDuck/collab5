// 언어별 문안 묶음. 폴더 이름의 `_`는 Next 라우팅에서 빼라는 표시다(주소가 생기지 않는다).
import type { Lang } from "../langs";
import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ja } from "./ja";
import { ko } from "./ko";
import { ptBR } from "./pt-br";
import type { Copy } from "./types";
import { zhCN } from "./zh-cn";
import { zhTW } from "./zh-tw";

export type { Copy, FigCopy, Step } from "./types";

export const COPY: Record<Lang, Copy> = {
  ko,
  en,
  ja,
  "zh-cn": zhCN,
  "zh-tw": zhTW,
  es,
  de,
  fr,
  "pt-br": ptBR,
};
