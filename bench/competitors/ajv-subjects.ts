// ===========================================================================
// bench/competitors/ajv-subjects.ts — the same rules written as JSON Schema
// and compiled by ajv.
//
// ajv compiles a schema into JavaScript, which makes it fast by an order of
// magnitude. That is a difference of method, not of implementation quality, so
// the numbers alone tell a reader nothing.
//
// "Which is why it does not work under a strict CSP" was once written here.
// **That is wrong.** Compiled ahead of time through ajv's standalone build,
// the output contains no dynamic code — generated and checked, not assumed. If
// the schema is fixed at build time, ajv is fine under CSP.
//
// The difference appears only when the schema arrives at run time: from a
// server, from a database, written by the user. Compiling ahead of time is
// then impossible in principle. A narrower claim is the stronger one.
// ===========================================================================
import ajvConstructor from "ajv";
import addFormats from "ajv-formats";
import type { Competitor, CompetitorSubject } from "./competitor.types";
import { readInstalledVersion } from "./read-installed-version";

const version = readInstalledVersion("ajv");

// A JSON Schema pattern is a string, so a backslash in the regular expression
// goes through **string** escaping first. Written one level short, "^SKU-\\d+$"
// becomes "^SKU-d+$", a schema demanding a literal "d". Done exactly that once,
// and ajv alone rejected all four accepted array values — our mistake, not a
// difference between the libraries. String.raw removes that level.
const SKU_PATTERN = String.raw`^SKU-\d+$`;

const ajv = new ajvConstructor({ allErrors: false, strict: false });
addFormats(ajv);

function toSubject(schema: object): CompetitorSubject {
  const validate = ajv.compile(schema);
  return { check: (value) => validate(value) === true };
}

const singleField = {
  type: "object",
  properties: { name: { type: "string", minLength: 3 } },
  required: ["name"],
};

const multiField = {
  type: "object",
  properties: {
    name: { type: "string", minLength: 3, maxLength: 50 },
    email: { type: "string", format: "email" },
    age: { type: "number", minimum: 18, maximum: 120 },
  },
  required: ["name", "email", "age"],
};

const nested = {
  type: "object",
  properties: {
    customer: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 2, maxLength: 80 },
        address: {
          type: "object",
          properties: {
            country: { type: "string", pattern: "^[A-Z]{2}$" },
            zip: { type: "string", minLength: 3, maxLength: 10 },
            city: { type: "string", minLength: 1 },
          },
          required: ["country", "zip", "city"],
        },
      },
      required: ["name", "address"],
    },
  },
  required: ["customer"],
};

const array = {
  type: "object",
  properties: {
    lines: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        properties: {
          sku: { type: "string", pattern: SKU_PATTERN },
          label: { type: "string", minLength: 3 },
          quantity: { type: "integer", minimum: 1 },
        },
        required: ["sku", "label", "quantity"],
      },
    },
  },
  required: ["lines"],
};

export const AJV_COMPETITOR: Competitor = {
  name: "ajv",
  version,
  subjects: {
    singleField: toSubject(singleField),
    multiField: toSubject(multiField),
    nested: toSubject(nested),
    array: toSubject(array),
  },
};
