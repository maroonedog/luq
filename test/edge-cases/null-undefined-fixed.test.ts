import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src";
import * as plugins from "../../src/core/plugin";

describe("Edge cases for null/undefined handling (fixed version)", () => {
  const createBuilder = () => {
    return Builder()
      .use(plugins.requiredPlugin)
      .use(plugins.optionalPlugin)
      .use(plugins.nullablePlugin)
      .use(plugins.stringMinPlugin)
      .use(plugins.numberMinPlugin)
      .use(plugins.arrayMinLengthPlugin)
      .use(plugins.booleanTruthyPlugin)
      .use(plugins.objectPlugin);
  };

  describe("null/undefined with required plugin", () => {
    test("validates when value exists", () => {
      const validator = createBuilder()
        .for<{ value: string }>()
        .v("value", (b) => b.string.required())
        .build();

      expect(validator.validate({ value: "test" }).valid).toBe(true);
      expect(validator.validate({ value: "" }).valid).toBe(false); // Empty string is treated as invalid
    });

    test("null is rejected", () => {
      const validator = createBuilder()
        .for<{ value: any }>() // Use any to avoid type errors
        .v("value", (b) => b.string.required())
        .build();

      expect(validator.validate({ value: null }).valid).toBe(false);
    });

    test("undefined is rejected", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.required())
        .build();

      expect(validator.validate({ value: undefined }).valid).toBe(false);
    });
  });

  describe("null/undefined with optional plugin", () => {
    test("skips subsequent validation when undefined", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.optional().min(3))
        .build();

      // Skip when undefined
      expect(validator.validate({ value: undefined }).valid).toBe(true);

      // normal validation when value exists
      expect(validator.validate({ value: "ab" }).valid).toBe(false);
      expect(validator.validate({ value: "abc" }).valid).toBe(true);
    });

    test("null is treated as a normal value", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.optional())
        .build();

      // null is not a string so it's an error
      expect(validator.validate({ value: null }).valid).toBe(false);
    });
  });

  describe("null/undefined with nullable plugin", () => {
    test("subsequent validations are skipped for null", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.nullable().min(3))
        .build();

      // skipped for null
      expect(validator.validate({ value: null }).valid).toBe(true);

      // normal validation when value exists
      expect(validator.validate({ value: "ab" }).valid).toBe(false);
      expect(validator.validate({ value: "abc" }).valid).toBe(true);
    });

    test("undefined is treated as a normal value", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.nullable())
        .build();

      // nullable doesn't perform type validation, so it accepts undefined too
      expect(validator.validate({ value: undefined }).valid).toBe(true);
    });
  });

  describe("combination of optional and nullable", () => {
    test("both undefined and null are allowed", () => {
      const validator = createBuilder()
        .for<{ value: any }>()
        .v("value", (b) => b.string.optional().nullable().min(3))
        .build();

      // undefined is skipped by optional
      expect(validator.validate({ value: undefined }).valid).toBe(true);
      // null is rejected by the optional plugin
      expect(validator.validate({ value: null }).valid).toBe(false);

      // normal validation when value exists
      expect(validator.validate({ value: "ab" }).valid).toBe(false);
      expect(validator.validate({ value: "abc" }).valid).toBe(true);
    });
  });

  describe("null/undefined in arrays", () => {
    test("null/undefined of array itself", () => {
      const validator1 = createBuilder()
        .for<{ items: any }>()
        .v("items", (b) => b.array.required())
        .build();

      expect(validator1.validate({ items: [] }).valid).toBe(true);
      expect(validator1.validate({ items: null }).valid).toBe(false);
      expect(validator1.validate({ items: undefined }).valid).toBe(false);

      // using nullable
      const validator2 = createBuilder()
        .for<{ items: any }>()
        .v("items", (b) => b.array.nullable().minLength(1))
        .build();

      expect(validator2.validate({ items: null }).valid).toBe(true);
      expect(validator2.validate({ items: [] }).valid).toBe(false); // empty array fails minLength
      expect(validator2.validate({ items: [1] }).valid).toBe(true);
    });
  });

  describe("null/undefined in objects", () => {
    test("null/undefined of object itself", () => {
      const validator1 = createBuilder()
        .for<{ data: any }>()
        .v("data", (b) => b.object.required().object())
        .build();

      expect(validator1.validate({ data: {} }).valid).toBe(true);
      expect(validator1.validate({ data: null }).valid).toBe(false);
      expect(validator1.validate({ data: undefined }).valid).toBe(false);

      // using nullable
      const validator2 = createBuilder()
        .for<{ data: any }>()
        .v("data", (b) => b.object.nullable().object())
        .build();

      // even if nullable runs first, the object plugin rejects null
      expect(validator2.validate({ data: null }).valid).toBe(false);
      expect(validator2.validate({ data: {} }).valid).toBe(true);
      expect(validator2.validate({ data: "not object" }).valid).toBe(false);
    });
  });
});
