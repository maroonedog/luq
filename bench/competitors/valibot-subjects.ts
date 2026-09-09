// ===========================================================================
// bench/competitors/valibot-subjects.ts — valibot で書いた同じ規則。
// ===========================================================================
import * as v from "valibot";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("valibot");

function toSubject(schema: v.GenericSchema): CompetitorSubject {
  return { check: (value) => v.safeParse(schema, value).success };
}

const singleField = v.object({
  name: v.pipe(v.string(), v.minLength(3)),
});

const multiField = v.object({
  name: v.pipe(v.string(), v.minLength(3), v.maxLength(50)),
  email: v.pipe(v.string(), v.email()),
  age: v.pipe(v.number(), v.minValue(18), v.maxValue(120)),
});

const nested = v.object({
  customer: v.object({
    name: v.pipe(v.string(), v.minLength(2), v.maxLength(80)),
    address: v.object({
      country: v.pipe(v.string(), v.regex(/^[A-Z]{2}$/)),
      zip: v.pipe(v.string(), v.minLength(3), v.maxLength(10)),
      city: v.pipe(v.string(), v.minLength(1)),
    }),
  }),
});

const array = v.object({
  lines: v.pipe(
    v.array(
      v.object({
        sku: v.pipe(v.string(), v.regex(/^SKU-\d+$/)),
        label: v.pipe(v.string(), v.minLength(3)),
        quantity: v.pipe(v.number(), v.integer(), v.minValue(1)),
      })
    ),
    v.minLength(1),
    v.maxLength(500)
  ),
});

export const VALIBOT_COMPETITOR: Competitor = {
  name: "valibot",
  version,
  subjects: {
    singleField: toSubject(singleField),
    multiField: toSubject(multiField),
    nested: toSubject(nested),
    array: toSubject(array),
  },
};
