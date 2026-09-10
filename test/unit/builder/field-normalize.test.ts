// ===========================================================================
// `normalize`, the third argument of `.v()`: the layer that tidies a value
// before anything judges it.
//
// **It was implemented and had no test at all.** The whole behaviour rested on
// three lines of the field runner and a comment, and deleting or shortening
// either rang no bell. This makes it ring.
//
// Five things get pinned, each by running it rather than by reading it.
//
//   order        straight after default, before presence. Any other order and
//                "a whitespace-only string fails required" stops holding.
//   absence      never called for undefined or null. Called, a normalizer
//                like `(v) => String(v).trim()` turns a missing field into
//                the string "undefined" and walks it past required.
//   one value    validate() and parse() judge the same tidied value, so
//                "validate passes but parse fails" cannot happen.
//   only parse writes  validate() does not touch the caller's object.
//   subsets      pick() and pickAll() receive the same tidying.
// ===========================================================================
import { Builder } from "../../../src/index";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { numberMinPlugin } from "../../../src/plugins/number-min";

interface Form {
  readonly name: string;
  readonly quantity: number;
}

const trim = (value: unknown): unknown =>
  typeof value === "string" ? value.trim() : value;

function buildForm(normalizeQuantity = (value: unknown): unknown => value) {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .use(numberMinPlugin)
    .for<Form>()
    .v("name", (field) => field.string.required().min(2), { normalize: trim })
    .v("quantity", (field) => field.number.required().min(1), {
      normalize: normalizeQuantity,
    })
    .build();
}

describe("normalize runs before the rules judge", () => {
  it("judges the normalized value, not the one that arrived", () => {
    const validator = buildForm();
    // "  ab  " looks like it would sail past min(2); what is judged is "ab".
    expect(validator.validate({ name: "  ab  ", quantity: 1 }).valid).toBe(
      true
    );
    expect(validator.validate({ name: "  a  ", quantity: 1 }).valid).toBe(
      false
    );
  });

  // A form puts a string in a numeric field. That is why a normalizer is
  // unknown to unknown: typed (TValue) => TValue, this becomes unwritable.
  it("lets a string from a form become the number the rules expect", () => {
    const validator = buildForm((value) =>
      typeof value === "string" && value.trim() !== "" ? Number(value) : value
    );
    const asTyped = { name: "ada", quantity: "42" } as unknown as Form;
    const result = validator.validate(asTyped);
    expect(result.valid).toBe(true);
    // Not only judged as valid: parse really does produce a number.
    const parsed = validator.parse(asTyped);
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ name: "ada", quantity: 42 });
  });

  // The behaviour that only holds in this order. Failing whitespace-only
  // input with required is the most common use there is for a normalizer.
  it("lets whitespace-only input fall through to required", () => {
    const validator = buildForm();
    const result = validator.validate({ name: "   ", quantity: 1 });
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.path)).toEqual(["name"]);
    expect(result.issues[0]?.code).toBe("required");
  });
});

describe("normalize is never handed an absent value", () => {
  it("is not called for undefined", () => {
    const seen: unknown[] = [];
    const validator = Builder()
      .use(optionalPlugin)
      .for<{ readonly note?: string }>()
      .v("note", (field) => field.string.optional(), {
        normalize: (value) => {
          seen.push(value);
          return value;
        },
      })
      .build();
    expect(validator.validate({}).valid).toBe(true);
    expect(seen).toEqual([]);
  });

  it("is not called for null", () => {
    const seen: unknown[] = [];
    const validator = Builder()
      .use(nullablePlugin)
      .for<{ readonly note: string | null }>()
      .v("note", (field) => field.string.nullable(), {
        normalize: (value) => {
          seen.push(value);
          return value;
        },
      })
      .build();
    expect(validator.validate({ note: null }).valid).toBe(true);
    expect(seen).toEqual([]);
  });

  // Break this and `(v) => String(v).trim()` turns undefined into the string
  // "undefined" and walks it past required. Written the way it is actually hit.
  it("does not let String(value) turn a missing field into a present one", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<{ readonly name: string }>()
      .v("name", (field) => field.string.required(), {
        normalize: (value) => String(value).trim(),
      })
      .build();
    const result = validator.validate({} as { readonly name: string });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe("required");
  });
});

describe("normalize keeps default's write-back contract", () => {
  it("does not touch the caller's object on validate()", () => {
    const validator = buildForm();
    const subject = { name: "  ada  ", quantity: 1 };
    expect(validator.validate(subject).valid).toBe(true);
    expect(subject.name).toBe("  ada  ");
  });

  it("writes the normalized value back on parse(), and only there", () => {
    const validator = buildForm();
    const subject = { name: "  ada  ", quantity: 1 };
    const parsed = validator.parse(subject);
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ name: "ada", quantity: 1 });
    // The original object is untouched: this is copy-on-write.
    expect(subject.name).toBe("  ada  ");
  });

  it("runs after default, so a substituted value is normalized too", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ readonly tag: string }>()
      .v("tag", (field) => field.string.required().min(2), {
        default: "  fallback  ",
        normalize: trim,
      })
      .build();
    const parsed = validator.parse({} as { readonly tag: string });
    if (!parsed.valid) throw new Error("expected the parse to succeed");
    expect(parsed.data).toEqual({ tag: "fallback" });
  });
});

describe("normalize reaches the subset validators", () => {
  it("applies through pick()", () => {
    const name = buildForm().pick("name");
    expect(name.validate("  ab  ").valid).toBe(true);
    expect(name.validate("  a  ").valid).toBe(false);
  });

  it("applies through pickAll()", () => {
    const subset = buildForm().pickAll(["name"]);
    expect(subset.validate({ name: "  ab  " }).valid).toBe(true);
    expect(subset.validate({ name: "  a  " }).valid).toBe(false);
  });
});
