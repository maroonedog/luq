// ===========================================================================
// bench/competitors/zod-subjects.ts — the same rules, written in zod.
//
// Being the SAME rules is the whole point, so this matches the Luq
// declarations line for line. Where the two disagree, the disagreement is
// reported rather than removed: how strict an email rule is differs between
// libraries, and that is a difference in specification, not in speed.
// ===========================================================================
import { z } from "zod";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("zod");

function toSubject(schema: z.ZodType): CompetitorSubject {
  return { check: (value) => schema.safeParse(value).success };
}

/** Corresponds to `.v("name", f => f.string.required().min(3))`. */
const singleField = z.object({
  name: z.string().min(3),
});

/** multiField: name 3..50 / email / age 18..120. */
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
