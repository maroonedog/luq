// The generator's tests.
//
// What matters most is not whether the emitted string looks right but whether
// the emitted code compiles and runs, which the companion suite checks. Watch
// only the string and it is possible to build a broken generator that emits
// beautiful strings.
import { generateValidatorModule } from "../src/generate/generate-validator-module";
import type { Draft07Schema } from "../../src/json-schema/draft07.types";

const ORDER_SCHEMA: Draft07Schema = {
  type: "object",
  required: ["id", "customer"],
  properties: {
    id: { type: "string", format: "uuid" },
    customer: {
      type: "object",
      required: ["email"],
      properties: {
        name: { type: "string", minLength: 2, maxLength: 50 },
        email: { type: "string", format: "email" },
      },
    },
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["sku"],
        properties: {
          sku: { type: "string", pattern: "^SKU-" },
          quantity: { type: "integer", minimum: 1 },
        },
      },
    },
  },
};

function generate(schema: Draft07Schema = ORDER_SCHEMA) {
  return generateValidatorModule(schema, {
    validatorName: "validateOrder",
    typeExpression: "Order",
  });
}

describe("generateValidatorModule", () => {
  it("emits a builder chain", () => {
    const { source } = generate();
    expect(source).toContain("export const validateOrder = Builder()");
    expect(source).toContain(".for<Order>()");
    expect(source).toContain(".build();");
  });

  it("emits required for a required field and optional otherwise", () => {
    const { source } = generate();
    expect(source).toContain('.v("id", (b) => b.string.required()');
    expect(source).toContain('.v("customer.name", (b) => b.string.optional()');
  });

  it("emits required for a nested field whose ancestors are all required", () => {
    // customer is in the root's required set, so customer.email cannot be
    // absent because its parent is. .required() then matches run time.
    const { source } = generate();
    expect(source).toContain('.v("customer.email", (b) => b.string.required()');
  });

  it("falls back to optional when an ancestor is not required, and says why", () => {
    // At run time required is a rule on the object. Writing .required() on
    // the child would wrongly reject a document missing the parent, against
    // Draft-07 applying a subschema only to a value that exists.
    const { source, skipped } = generateValidatorModule(
      {
        type: "object",
        properties: {
          profile: {
            type: "object",
            required: ["nickname"],
            properties: { nickname: { type: "string" } },
          },
        },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).toContain('.v("profile.nickname", (b) => b.string.optional()');
    const reported = skipped.find(
      (entry) => entry.path === "profile.nickname" && entry.keyword === "required"
    );
    expect(reported?.reason).toContain("missing that ancestor");
  });

  it("lowers format to a method", () => {
    const { source } = generate();
    expect(source).toContain(".uuid()");
    expect(source).toContain(".email()");
  });

  it("lowers number, string and array constraints to methods", () => {
    const { source } = generate();
    expect(source).toContain(".min(2)");
    expect(source).toContain(".max(50)");
    expect(source).toContain('.pattern("^SKU-")');
    expect(source).toContain(".min(1)");
    expect(source).toContain(".minLength(1)");
  });

  it("gives array elements a wildcard path", () => {
    const { source } = generate();
    expect(source).toContain('.v("items[*].sku"');
    expect(source).toContain('.v("items[*].quantity"');
  });

  it("puts integer in the number slot", () => {
    const { source } = generate();
    expect(source).toContain('.v("items[*].quantity", (b) => b.number');
  });

  it("imports and uses only the plugins it actually used", () => {
    const { source, pluginExports } = generate();
    for (const name of pluginExports) {
      expect(source).toContain(`import { ${name} } from`);
      expect(source).toContain(`.use(${name})`);
    }
    // Nothing unused gets in. Loosen this and the output becomes everything.
    expect(source).not.toContain("stringIpv4Plugin");
    expect(source).not.toContain("arrayUniquePlugin");
  });

  it("imports from the package's own subpaths", () => {
    const { source } = generate();
    expect(source).toContain('from "@maroonedog/luq/plugins/required"');
    expect(source).toContain('from "@maroonedog/luq/plugins/stringEmail"');
    expect(source).not.toContain('from "@maroonedog/luq/plugins"');
  });

  it("emits the same output whatever order the keywords were written in", () => {
    // Stops how the schema was written from filling the diff with noise.
    const reordered: Draft07Schema = {
      properties: (ORDER_SCHEMA as { properties: unknown }).properties,
      required: ["id", "customer"],
      type: "object",
    } as Draft07Schema;
    expect(generate(reordered).source).toBe(generate().source);
  });

  it("is idempotent: the same input gives the same output", () => {
    expect(generate().source).toBe(generate().source);
  });
});

describe("a dropped keyword is never silent", () => {
  it("returns an unmapped keyword as skipped", () => {
    const { skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", contentEncoding: "base64" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    const encodings = skipped.filter((entry) => entry.keyword === "contentEncoding");
    expect(encodings).toHaveLength(1);
    expect(encodings[0]?.reason).toContain("no chain method");
  });

  it("also writes what was dropped into a comment in the output", () => {
    const { source } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", contentEncoding: "base64" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).toContain("did not become rules");
    expect(source).toContain("contentEncoding");
  });

  it("drops an annotation keyword, giving 'not validated' as the reason", () => {
    const { skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { name: { type: "string", description: "the name" } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    const described = skipped.find((entry) => entry.keyword === "description");
    expect(described?.reason).toContain("not validated");
  });

  it("does not emit uniqueItems: false as a constraint", () => {
    const { source, skipped } = generateValidatorModule(
      {
        type: "object",
        properties: { tags: { type: "array", uniqueItems: false } },
      },
      { validatorName: "v", typeExpression: "T" }
    );
    expect(source).not.toContain(".unique()");
    expect(skipped.some((entry) => entry.keyword === "uniqueItems")).toBe(true);
  });
});
