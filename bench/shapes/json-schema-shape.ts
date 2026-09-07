// ===========================================================================
// bench/shapes/json-schema-shape.ts
//
// The same Draft-07 document test/integration/json-schema-conversion.test.ts
// asserts against, driven through `fromJsonSchema` from the full-feature
// bundle. This is the route a consumer takes when the schema arrives at run
// time (fetched JSON), so its BUILD cost is the interesting half: conversion
// walks the document, resolves $ref, and produces field declarations, all of
// it once. If validate() on this shape is close to validate() on the
// hand-declared nested shape, then conversion really is a build-time cost and
// not a per-call one.
// ===========================================================================
import { fromJsonSchema } from "../../src/json-schema/extensions/json-schema-full-feature/index";
import type { BenchShape } from "./bench-shape.types";

export interface JsonSchemaSubject {
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
}

export const ORDER_SCHEMA = {
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
  },
  required: ["id", "placedAt", "customer", "lines"],
};

export const JSON_SCHEMA_VALUE: JsonSchemaSubject = {
  id: "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
  placedAt: "2024-05-01T10:00:00Z",
  customer: {
    email: "buyer@example.com",
    address: { country: "JP", zip: "1500001" },
  },
  lines: [
    { sku: "SKU-1", quantity: 2 },
    { sku: "SKU-2", quantity: 7 },
  ],
};

export const jsonSchemaShape: BenchShape = {
  name: "jsonSchema",
  declares:
    "Draft-07 document (9 properties, $ref, nested object, array of objects) via fromJsonSchema",
  buildValidator: () => fromJsonSchema<JsonSchemaSubject>(ORDER_SCHEMA),
  acceptedValue: JSON_SCHEMA_VALUE,
};
