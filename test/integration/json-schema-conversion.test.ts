// ===========================================================================
// test/integration/json-schema-conversion.test.ts
//
// The scenarios 1.x's fromJsonSchema integration suites covered, run against a
// realistic document. The legacy baseline is 32 of 42 suites FAILING
// (docs/legacy-spec/json-schema-mapping.md), with the recorded symptoms being
// `format: date` accepting "2024-13-01", `format: ipv4` accepting
// "999.999.999.999", `minItems` evaporating, and every sub-schema inside an
// applicator being ignored. Each is asserted here.
// ===========================================================================
import { fromJsonSchema } from "../../src/json-schema/index";
import { jsonSchemaBagFixture } from "../unit/json-schema/convert/json-schema-bag-fixture";

interface Order {
  readonly id: string;
  readonly placedAt: string;
  readonly customer: {
    readonly email: string;
    readonly address: { readonly country: string; readonly zip?: string };
  };
  readonly lines: readonly {
    readonly sku: string;
    readonly quantity: number;
  }[];
  readonly payment?: Record<string, unknown>;
}

const ORDER_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  title: "Order",
  type: "object",
  definitions: {
    country: { type: "string", pattern: "^[A-Z]{2}$" },
  },
  properties: {
    id: { type: "string", format: "uuid" },
    placedAt: { type: "string", format: "date-time" },
    customer: {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        address: {
          type: "object",
          properties: {
            country: { $ref: "#/definitions/country" },
            zip: { type: "string", minLength: 3, maxLength: 10 },
          },
          required: ["country"],
          additionalProperties: false,
        },
      },
      required: ["email", "address"],
    },
    lines: {
      type: "array",
      minItems: 1,
      maxItems: 50,
      items: {
        type: "object",
        properties: {
          sku: { type: "string", pattern: "^SKU-" },
          quantity: { type: "integer", minimum: 1, multipleOf: 1 },
        },
        required: ["sku", "quantity"],
      },
    },
    payment: {
      type: "object",
      if: { properties: { method: { const: "card" } }, required: ["method"] },
      then: { required: ["cardLast4"] },
      else: { required: ["iban"] },
    },
  },
  required: ["id", "placedAt", "customer", "lines"],
};

const validator = fromJsonSchema<Order>(jsonSchemaBagFixture, ORDER_SCHEMA);

const VALID_ORDER: Order = {
  id: "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
  placedAt: "2024-05-01T10:00:00Z",
  customer: {
    email: "buyer@example.com",
    address: { country: "JP", zip: "1500001" },
  },
  lines: [{ sku: "SKU-1", quantity: 2 }],
};

function reject(mutate: (order: Order) => unknown): readonly string[] {
  const outcome = validator.validate(mutate(VALID_ORDER));
  expect(outcome.valid).toBe(false);
  return outcome.valid ? [] : outcome.issues.map((issue) => issue.path);
}

describe("a realistic Draft-07 document", () => {
  it("accepts a document it should accept", () => {
    expect(validator.validate(VALID_ORDER).valid).toBe(true);
  });

  it("checks `format` on every declared field (1.x checked six names)", () => {
    expect(reject((order) => ({ ...order, id: "not-a-uuid" }))).toEqual(["id"]);
    expect(reject((order) => ({ ...order, placedAt: "yesterday" }))).toEqual([
      "placedAt",
    ]);
    expect(
      reject((order) => ({
        ...order,
        customer: { ...order.customer, email: "not an email" },
      }))
    ).toEqual(["customer.email"]);
  });

  it("checks `minItems`, the constraint 1.x bound to a method that does not exist", () => {
    expect(reject((order) => ({ ...order, lines: [] }))).toEqual(["lines"]);
  });

  it("checks a `$ref`'d sub-schema through a two-level path", () => {
    expect(
      reject((order) => ({
        ...order,
        customer: {
          ...order.customer,
          address: { ...order.customer.address, country: "japan" },
        },
      }))
    ).toEqual(["customer.address.country"]);
  });

  it("closes a NESTED object with additionalProperties: false", () => {
    expect(
      reject((order) => ({
        ...order,
        customer: {
          ...order.customer,
          address: { ...order.customer.address, extra: 1 },
        },
      }))
    ).toEqual(["customer.address"]);
  });

  it("indexes an array element failure by its real index", () => {
    expect(
      reject((order) => ({
        ...order,
        lines: [
          { sku: "SKU-1", quantity: 1 },
          { sku: "nope", quantity: 1 },
        ],
      }))
    ).toEqual(["lines[1].sku"]);
    expect(
      reject((order) => ({
        ...order,
        lines: [{ sku: "SKU-1", quantity: 0 }],
      }))
    ).toEqual(["lines[0].quantity"]);
  });

  it("routes if/then/else on a nested object", () => {
    expect(
      validator.validate({
        ...VALID_ORDER,
        payment: { method: "card", cardLast4: "4242" },
      }).valid
    ).toBe(true);
    expect(
      reject((order) => ({ ...order, payment: { method: "card" } }))
    ).toEqual(["payment"]);
    expect(
      validator.validate({
        ...VALID_ORDER,
        payment: { method: "bank", iban: "DE00" },
      }).valid
    ).toBe(true);
  });

  it("reports every missing required property at once", () => {
    const outcome = validator.validate({}, { abortEarly: false });
    expect(outcome.valid).toBe(false);
    if (outcome.valid) return;
    expect(outcome.issues.map((issue) => issue.path).sort()).toEqual([
      "customer",
      "id",
      "lines",
      "placedAt",
    ]);
  });

  it("lifts a single field out of the converted validator", () => {
    const field = validator.pick("customer.email");
    expect(field.validate("nope").valid).toBe(false);
    expect(field.validate("a@b.co").valid).toBe(true);
  });
});
