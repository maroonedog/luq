import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { objectAdditionalPropertiesPlugin } from "../../../../src/core/plugin/objectAdditionalProperties";
import { requiredPlugin } from "../../../../src/core/plugin/required";

describe("Object Additional Properties Validation", () => {
  describe("additionalProperties: false (strict mode)", () => {
    test("should reject additional properties when strict", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) =>
          (b.object as any).additionalProperties(false, {
            allowedProperties: ["name", "age"],
          })
        )
        .build();

      // Valid: only allowed properties
      expect(
        builder.validate({
          config: { name: "John", age: 30 },
        }).valid
      ).toBe(true);

      // Valid: subset of allowed properties
      expect(
        builder.validate({
          config: { name: "John" },
        }).valid
      ).toBe(true);

      // Valid: empty object
      expect(
        builder.validate({
          config: {},
        }).valid
      ).toBe(true);

      // Invalid: additional property
      expect(
        builder.validate({
          config: { name: "John", age: 30, extra: "field" },
        }).valid
      ).toBe(false);

      // Invalid: multiple additional properties
      expect(
        builder.validate({
          config: { name: "John", age: 30, extra1: "field1", extra2: "field2" },
        }).valid
      ).toBe(false);
    });

    test("should provide meaningful error messages for additional properties", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ user: object }>()
        .v("user", (b) =>
          (b.object as any).additionalProperties(false, {
            allowedProperties: ["name", "email"],
            messageFactory: ({ path, extraProperties }) =>
              `${path} has forbidden properties: ${extraProperties.join(", ")}`,
          })
        )
        .build();

      const result = builder.validate({
        user: {
          name: "John",
          email: "john@example.com",
          age: 30,
          role: "admin",
        },
      });

      expect(result.isValid()).toBe(false);
      if (!result.isValid()) {
        expect(result.errors[0].message).toBe(
          "user has forbidden properties: age, role"
        );
      }
    });
  });

  describe("additionalProperties: <schema>", () => {
    test("should validate additional properties against string schema", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ data: object }>()
        .v("data", (b) =>
          (b.object as any).additionalProperties(
            {
              type: "string",
              minLength: 3,
            },
            {
              allowedProperties: ["id", "name"],
            }
          )
        )
        .build();

      // Valid: allowed properties + valid additional string properties
      expect(
        builder.validate({
          data: {
            id: 1,
            name: "test",
            description: "valid description",
            category: "electronics",
          },
        }).valid
      ).toBe(true);

      // Invalid: additional property is not string
      expect(
        builder.validate({
          data: {
            id: 1,
            name: "test",
            count: 123, // should be string
          },
        }).valid
      ).toBe(false);

      // Invalid: additional string property too short
      expect(
        builder.validate({
          data: {
            id: 1,
            name: "test",
            tag: "ab", // less than minLength: 3
          },
        }).valid
      ).toBe(false);
    });

    test("should validate additional properties against number schema", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ metrics: object }>()
        .v("metrics", (b) =>
          (b.object as any).additionalProperties(
            {
              type: "number",
              minimum: 0,
              maximum: 100,
            },
            {
              allowedProperties: ["id"],
            }
          )
        )
        .build();

      // Valid: additional properties are numbers within range
      expect(
        builder.validate({
          metrics: {
            id: "test123",
            cpu: 45.5,
            memory: 78,
            disk: 0,
          },
        }).valid
      ).toBe(true);

      // Invalid: additional property is not number
      expect(
        builder.validate({
          metrics: {
            id: "test123",
            status: "active", // should be number
          },
        }).valid
      ).toBe(false);

      // Invalid: additional number property out of range
      expect(
        builder.validate({
          metrics: {
            id: "test123",
            temperature: 150, // above maximum: 100
          },
        }).valid
      ).toBe(false);

      // Invalid: additional number property below minimum
      expect(
        builder.validate({
          metrics: {
            id: "test123",
            score: -10, // below minimum: 0
          },
        }).valid
      ).toBe(false);
    });
  });

  describe("additionalProperties: true (permissive mode)", () => {
    test("should allow any additional properties", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) =>
          (b.object as any).additionalProperties(true, {
            allowedProperties: ["name"],
          })
        )
        .build();

      // All should be valid - any additional properties allowed
      expect(
        builder.validate({
          config: { name: "John" },
        }).valid
      ).toBe(true);

      expect(
        builder.validate({
          config: {
            name: "John",
            age: 30,
            active: true,
            tags: ["user", "admin"],
          },
        }).valid
      ).toBe(true);

      expect(
        builder.validate({
          config: { completely: "different", properties: 123 },
        }).valid
      ).toBe(true);
    });
  });

  describe("Edge cases", () => {
    test("should handle null and non-object values gracefully", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ data: any }>()
        .v("data", (b) =>
          (b.object as any).additionalProperties(false, {
            allowedProperties: ["name"],
          })
        )
        .build();

      // null should be handled gracefully (passes object type check upstream)
      expect(builder.validate({ data: null }).valid).toBe(true);

      // Non-object values should be handled gracefully
      expect(builder.validate({ data: "string" }).valid).toBe(true);
      expect(builder.validate({ data: 123 }).valid).toBe(true);
      expect(builder.validate({ data: [] }).valid).toBe(true);
    });

    test("should handle objects with no allowed properties", () => {
      const builder = Builder()
        .use(objectAdditionalPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: object }>()
        .v("config", (b) =>
          (b.object as any).additionalProperties(false, {
            allowedProperties: [],
          })
        )
        .build();

      // Empty object should be valid
      expect(builder.validate({ config: {} }).valid).toBe(true);

      // Any properties should be invalid when none are allowed
      expect(builder.validate({ config: { any: "property" } }).valid).toBe(
        false
      );
    });
  });
});
