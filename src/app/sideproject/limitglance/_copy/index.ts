// 언어별 문안 묶음. 폴더 이름의 `_`는 Next 라우팅에서 빼라는 표시다(주소가 생기지 않는다).
import type { Lang } from "../langs";
import { en } from "./en";
import { ko } from "./ko";
import type { Copy } from "./types";

export type { Copy, FigCopy } from "./types";

export const COPY: Record<Lang, Copy> = { ko, en };
