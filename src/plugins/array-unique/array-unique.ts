// ===========================================================================
// L7  src/plugins/array-unique/array-unique.ts
//
// Legacy semantics (docs/legacy-spec/plugin-catalog-structural.md#arrayUniquePlugin):
// a non-array PASSES, and the default message names no value. What is NOT
// carried over is the equality: see ./deep-equal.ts for the two defects that
// replaced it.
//
// The bucket key below is a PERFORMANCE filter, never a decision: it is
// derived so that two equal values always land in the same bucket, and the
// answer inside a bucket is isDeepEqual and nothing else. That is what keeps
// one equality definition at every array length.
// ===========================================================================
import type { MessageContextExtra } from "../../types";
import type { Unchanged } from "../../plugin-kit/marker.types";
import { PASS, fail, isArray } from "../../types";
import { check } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import { isDeepEqual } from "./deep-equal";

/** Equal values always share a key; unequal values may too, which is harmless. */
function toBucketKey(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `array:${String(value.length)}`;
  if (typeof value === "object") {
    return `object:${String(Object.keys(value).length)}`;
  }
  return `${typeof value}:${String(value)}`;
}

function findDuplicate(
  values: readonly unknown[]
): { readonly at: number } | null {
  const buckets = new Map<string, unknown[]>();
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const key = toBucketKey(value);
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [value]);
      continue;
    }
    if (bucket.some((seen) => isDeepEqual(seen, value))) return { at: index };
    bucket.push(value);
  }
  return null;
}

export const arrayUniquePlugin = /*#__PURE__*/ definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "arrayUnique",
  method: "unique",
  slots: ["array", "tuple"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (value) => {
        if (!isArray(value)) return PASS;
        const duplicate = findDuplicate(value);
        return duplicate === null
          ? PASS
          : fail({ index: duplicate.at, actual: value[duplicate.at] });
      },
      describe: () => "Array must contain unique values",
      buildMessageContext: () => ({}),
    }),
});
