// ===========================================================================
// bench/competitors/zod-subjects.ts — zod で書いた同じ規則。
//
// 「同じ規則」であることが全てなので、Luq 側の宣言と一行ずつ対応させてある。
// 食い違いが出た場合はそれを消さず、agreement の報告に出す — 例えば
// email の厳しさはライブラリごとに違い、それは速度の差ではなく仕様の差である。
// ===========================================================================
import { z } from "zod";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("zod");

function toSubject(schema: z.ZodType): CompetitorSubject {
  return { check: (value) => schema.safeParse(value).success };
}

/** `.v("name", f => f.string.required().min(3))` に対応。 */
const singleField = z.object({
  name: z.string().min(3),
});

/** multiField: name 3..50 / email / age 18..120。 */
const multiField = z.object({
  name: z.string().min(3).max(50),
  email: z.email(),
  age: z.number().min(18).max(120),
});

const nested = z.object({
  customer: z.object({
    name: z.string().min(2).max(80),
    address: z.object({
      country: z.string().regex(/^[A-Z]{2}$/),
      zip: z.string().min(3).max(10),
      city: z.string().min(1),
    }),
  }),
});

const array = z.object({
  lines: z
    .array(
      z.object({
        sku: z.string().regex(/^SKU-\d+$/),
        label: z.string().min(3),
        quantity: z.number().int().min(1),
      })
    )
    .min(1)
    .max(500),
});

export const ZOD_COMPETITOR: Competitor = {
  name: "zod",
  version,
  subjects: {
    singleField: toSubject(singleField),
    multiField: toSubject(multiField),
    nested: toSubject(nested),
    array: toSubject(array),
  },
};
