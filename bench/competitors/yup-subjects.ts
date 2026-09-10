// ===========================================================================
// bench/competitors/yup-subjects.ts — the same rules, written in yup.
//
// yup's `isValidSync` coerces by default, so `strict: true` is passed.
// Without it the string "34" is accepted as a number, and the rules being
// measured are no longer the same rules.
// ===========================================================================
import * as yup from "yup";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("yup");

function toSubject(schema: yup.AnySchema): CompetitorSubject {
  return {
    check: (value) => schema.isValidSync(value, { strict: true }),
  };
}

const singleField = yup.object({
  name: yup.string().required().min(3),
});

const multiField = yup.object({
  name: yup.string().required().min(3).max(50),
  email: yup.string().required().email(),
  age: yup.number().required().min(18).max(120),
});

const nested = yup.object({
  customer: yup
    .object({
      name: yup.string().required().min(2).max(80),
      address: yup
        .object({
          country: yup
            .string()
            .required()
            .matches(/^[A-Z]{2}$/),
          zip: yup.string().required().min(3).max(10),
          city: yup.string().required().min(1),
        })
        .required(),
    })
    .required(),
});

const array = yup.object({
  lines: yup
    .array()
    .required()
    .min(1)
    .max(500)
    .of(
      yup.object({
        sku: yup
          .string()
          .required()
          .matches(/^SKU-\d+$/),
        label: yup.string().required().min(3),
        quantity: yup.number().required().integer().min(1),
      })
    ),
});

export const YUP_COMPETITOR: Competitor = {
  name: "yup",
  version,
  subjects: {
    singleField: toSubject(singleField),
    multiField: toSubject(multiField),
    nested: toSubject(nested),
    array: toSubject(array),
  },
};
