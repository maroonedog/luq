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
//
// The rejected pool is chosen to pin the hand-written reference to the SAME
// format semantics the plugins implement: a UUID whose version nibble is 0, a
// 29th of February in a non-leap year, and an e-mail whose local part starts
// with a dot are each accepted by the loose regexes the reference used to
// carry and rejected by src/plugins/{uuid,string-datetime,string-email}. With
// them in the pool the two sides cannot drift apart without the agreement
// check saying so.
// ===========================================================================
import { fromJsonSchema } from "../../src/json-schema/extensions/json-schema-full-feature/index";
import type { ValuePool } from "../rotate-over-values";
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

function orderValue(
  id: string,
  placedAt: string,
  email: string,
  country: string,
  zip: string
): JsonSchemaSubject {
  return {
    id,
    placedAt,
    customer: { email, address: { country, zip } },
    lines: [
      { sku: "SKU-1", quantity: 2 },
      { sku: "SKU-2", quantity: 7 },
    ],
  };
}

export const JSON_SCHEMA_VALUES: readonly [
  JsonSchemaSubject,
  JsonSchemaSubject,
  JsonSchemaSubject,
  JsonSchemaSubject,
] = [
  orderValue(
    "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
    "2024-05-01T10:00:00Z",
    "buyer@example.com",
    "JP",
    "1500001"
  ),
  orderValue(
    "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
    "2024-02-29T23:59:59.500Z",
    "second.buyer@example.co.uk",
    "GB",
    "SW1A1AA"
  ),
  orderValue(
    "c0ffee00-dead-4bee-af00-123456789abc",
    "2023-11-07T08:15:00+09:00",
    "third-buyer@mail.example.jp",
    "US",
    "94103"
  ),
  orderValue(
    "9e107d9d-372b-4174-b0fd-0d5f5cb1c8e1",
    "2024-12-31T00:00:01Z",
    "fourth_buyer@example.org",
    "GR",
    "10431"
  ),
];

export const JSON_SCHEMA_VALUE: JsonSchemaSubject = JSON_SCHEMA_VALUES[0];

function orderWithLastLineQuantity(quantity: number): unknown {
  const source = JSON_SCHEMA_VALUES[3];
  return {
    ...source,
    lines: [
      { sku: "SKU-1", quantity: 2 },
      { sku: "SKU-2", quantity },
    ],
  };
}

export const JSON_SCHEMA_REJECTED: ValuePool = [
  orderValue(
    "7f1d3b6e-2f6a-0e2b-9a2b-0f2a5c9e1d3b",
    "2024-05-01T10:00:00Z",
    "buyer@example.com",
    "JP",
    "1500001"
  ),
  orderValue(
    "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
    "2023-02-29T10:00:00Z",
    "buyer@example.com",
    "JP",
    "1500001"
  ),
  orderValue(
    "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
    "2024-05-01T10:00:00Z",
    ".buyer@example.com",
    "JP",
    "1500001"
  ),
  orderValue(
    "7f1d3b6e-2f6a-4e2b-9a2b-0f2a5c9e1d3b",
    "2024-05-01T10:00:00Z",
    "buyer@example.com",
    "jp",
    "1500001"
  ),
  orderWithLastLineQuantity(0),
];

export const jsonSchemaShape: BenchShape = {
  name: "jsonSchema",
  declares:
    "Draft-07 document (9 properties, $ref, nested object, array of objects) via fromJsonSchema",
  buildValidator: () => fromJsonSchema<JsonSchemaSubject>(ORDER_SCHEMA),
  acceptedValue: JSON_SCHEMA_VALUE,
  acceptedValues: JSON_SCHEMA_VALUES,
  rejectedValues: JSON_SCHEMA_REJECTED,
};
