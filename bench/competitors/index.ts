export type { Competitor, CompetitorSubject } from "./competitor.types";
export { AJV_COMPETITOR } from "./ajv-subjects";
export { VALIBOT_COMPETITOR } from "./valibot-subjects";
export { YUP_COMPETITOR } from "./yup-subjects";
export { ZOD_COMPETITOR } from "./zod-subjects";

import { AJV_COMPETITOR } from "./ajv-subjects";
import { VALIBOT_COMPETITOR } from "./valibot-subjects";
import { YUP_COMPETITOR } from "./yup-subjects";
import { ZOD_COMPETITOR } from "./zod-subjects";
import type { Competitor } from "./competitor.types";

/** 比較に載せるライブラリ。増やすならここに足す。 */
export const COMPETITORS: readonly Competitor[] = Object.freeze([
  ZOD_COMPETITOR,
  VALIBOT_COMPETITOR,
  AJV_COMPETITOR,
  YUP_COMPETITOR,
]);
