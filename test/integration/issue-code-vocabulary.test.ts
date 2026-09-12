// ===========================================================================
// test/integration/issue-code-vocabulary.test.ts
//
// README documents `issue.code` as "which rule, stable across messages".
// config/issue-code.lock.json is what makes "stable" mean something, and this
// file is the evidence that the lock is about the RUNNING library rather than
// about a text scan that happens to agree with itself:
//
//   1. the lock matches what the source says today (the gate, run here too);
//   2. codes the library really emits, driven through the public API, are all
//      in the lock;
//   3. the three kinds of code the lock deliberately EXCLUDES cannot be
//      emitted — a gate's code, the open presence policy's code, and the
//      transform plugin's name.
// ===========================================================================
import { Builder } from "../../src/index";
import { requiredPlugin } from "../../src/plugins/required";
import { optionalPlugin } from "../../src/plugins/optional";
import { stringMinPlugin } from "../../src/plugins/string-min";
import { skipPlugin } from "../../src/plugins/skip";
import { transformPlugin } from "../../src/plugins/transform";
import { fromJsonSchema } from "../../src/json-schema/extensions/json-schema-full-feature";
import { findIssueCodeDrift } from "../../scripts/check-issue-code-lock";
import { buildIssueCodeLock } from "../../scripts/generate-issue-code-catalog";
import { REPOSITORY_ROOT } from "../../scripts/catalog/plugin-source-roots";

const lock = buildIssueCodeLock(REPOSITORY_ROOT);
const vocabulary = new Set(lock.codes.map((entry) => entry.code));

const ALL_ISSUES = { abortEarly: false, abortEarlyOnEachField: false } as const;

type Model = { name: string; age: number; flag: boolean };

/** Every code one validation reported, de-duplicated. */
function codesFrom(issues: readonly { code: string }[]): readonly string[] {
  return [...new Set(issues.map((issue) => issue.code))].sort();
}

describe("the locked vocabulary", () => {
  it("matches what the source emits", () => {
    expect(findIssueCodeDrift(REPOSITORY_ROOT)).toEqual([]);
  });

  it("records the count it lists, so neither can move alone", () => {
    expect(lock.codeCount).toBe(lock.codes.length);
  });

  it("holds every slot's type-guard code", () => {
    // These are emitted from one table in src/chain/slot-type-guard.ts. They
    // were built by interpolation — `${slot}Type` — which no reader of the
    // source could enumerate, so the vocabulary could not contain them.
    for (const code of [
      "stringType",
      "numberType",
      "booleanType",
      "dateType",
      "arrayType",
      "objectType",
    ]) {
      expect(vocabulary.has(code)).toBe(true);
    }
  });

  it("names an owner for every code", () => {
    for (const entry of lock.codes) {
      expect(entry.owners.length).toBeGreaterThan(0);
    }
  });
});

describe("codes the running library reports are in the vocabulary", () => {
  it("covers a chain's presence, type and value rules", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required().min(3))
      .v("age", (b) => b.number.required())
      .v("flag", (b) => b.boolean.required())
      .build();

    const reported = codesFrom(
      validator.validate({ name: "Jo", age: "old", flag: 1 }, ALL_ISSUES).issues
    );
    expect(reported).toEqual(["booleanType", "numberType", "stringMin"]);
    for (const code of reported) expect(vocabulary.has(code)).toBe(true);
  });

  it("covers the missing-root rejection", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required())
      .build();

    const reported = codesFrom(validator.validate(null).issues);
    expect(reported).toEqual(["required"]);
    expect(vocabulary.has("required")).toBe(true);
  });

  it("covers the JSON Schema keywords that report under their own name", () => {
    const validator = fromJsonSchema<Record<string, unknown>>({
      type: "object",
      required: ["a"],
      properties: {
        a: { type: "string" },
        b: { oneOf: [{ type: "string" }, { type: "number" }] },
        c: { allOf: [{ type: "number" }] },
      },
    });

    const reported = codesFrom(
      validator.validate({ b: true, c: "no" }, ALL_ISSUES).issues
    );
    expect(reported).toEqual(["allOf", "oneOf", "required"]);
    for (const code of reported) expect(vocabulary.has(code)).toBe(true);
  });
});

describe("codes the vocabulary deliberately leaves out", () => {
  it("leaves out a gate's code, which no issue can carry", () => {
    // `skip` is accepted from a caller's `{ code }` option and stored on the
    // rule, but a closed gate ends the field with no issue at all. The lock
    // records it under gateOnlyCodes so the two states stay distinguishable.
    const validator = Builder()
      .use(requiredPlugin)
      .use(skipPlugin)
      .use(stringMinPlugin)
      .for<Model>()
      .v("name", (b) =>
        b.string
          .required()
          .min(8)
          .skip(() => true)
      )
      .build();

    expect(validator.validate({ name: "Jo" }, ALL_ISSUES).issues).toEqual([]);
    expect(vocabulary.has("skip")).toBe(false);
    expect(lock.gateOnlyCodes.map((entry) => entry.code)).toContain("skip");
  });

  it("leaves out the open presence policy's code", () => {
    // A field with no presence rule carries OPEN_PRESENCE, whose code is
    // "presence". It permits undefined and null both, so the reporting branch
    // of decidePresence is unreachable and the code can never be emitted.
    const validator = Builder()
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .for<Model>()
      .v("name", (b) => b.string.min(3))
      .build();

    expect(
      validator.validate({ age: 1, flag: true }, ALL_ISSUES).issues
    ).toEqual([]);
    expect(validator.validate({ name: null }, ALL_ISSUES).issues).toEqual([]);
    expect(vocabulary.has("presence")).toBe(false);
  });

  it("leaves out transform, whose rule carries no code at all", () => {
    // A TransformRule has no `code` member. A throwing map propagates out of
    // parse() rather than becoming an issue, so there is nothing to name.
    const validator = Builder()
      .use(requiredPlugin)
      .use(transformPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required().transform((value) => value.trim()))
      .build();

    expect(validator.parse({ name: " ada " }, ALL_ISSUES).valid).toBe(true);
    expect(vocabulary.has("transform")).toBe(false);
    expect(lock.gateOnlyCodes.map((entry) => entry.code)).not.toContain(
      "transform"
    );
  });
});
