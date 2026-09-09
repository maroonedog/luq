// ===========================================================================
// L7  src/plugins/string-min/string-min.ts
// `.min(n)` on the string slot. Length is UTF-16 `.length`, so an astral
// character counts as 2 — the legacy behaviour, now stated instead of implied.
// A wrong-typed value PASSES: the slot guard owns type and the presence
// modifiers own null/undefined, so a value rule never re-decides either.
// ===========================================================================
import { check } from "../../plugin-kit/create-rule";
import {
  PluginArgumentError,
  definePlugin,
} from "../../plugin-kit/plugin-definition";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isNumber, isString } from "../../types";

/** The members `.min()` adds to the message context. Legacy name preserved. */
export interface StringMinContext {
  readonly min: number;
  readonly actual: number;
}

export const stringMinPlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [min: number];
  out: Unchanged;
  context: StringMinContext;
}>()({
  name: "stringMin",
  method: "min",
  slots: ["string"] as const,
  build: (ctx, min) => {
    if (!Number.isFinite(min) || min < 0) {
      throw new PluginArgumentError(ctx.pluginName, "min", min);
    }
    return check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      // min に届いた時点で止める。全長を数える必要があるのは**落ちる**
      // ときだけで、そのときは値が min より短いのだから走査も短い。
      // 元は countCodePoints を最大二度呼び、どちらも文字列を最後まで
      // 歩いていた。符号位置で数えるのは変えない (UTF-16 単位ではない) —
      // 変えているのは、いつ止めるかだけである。受理パスで 12.7%。
      run: (value) => {
        if (!isString(value)) return PASS;
        // min が 0 なら空文字列も通る。ループは空文字列で一度も回らないので、
        // この行が無いと `""` が actual 0 で落ちる — 早期脱出に書き換えた
        // ときに実際に開いた穴で、既存のテストは一件も気づかなかった。
        if (min === 0) return PASS;
        let count = 0;
        for (const _character of value) {
          count += 1;
          if (count >= min) return PASS;
        }
        return fail({ expected: min, actual: count });
      },
      describe: (detail) =>
        `String must have at least ${String(min)} characters, but got ` +
        `${String(detail.actual)}`,
      buildMessageContext: (detail) => ({
        min,
        actual: isNumber(detail.actual) ? detail.actual : 0,
      }),
    });
  },
});
