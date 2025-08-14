/**
 * Test for new JSON Schema extensions plugins
 * Tests contains, propertyNames, patternProperties, dependentRequired, and tuple support
 */

import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../src/core/builder/core/builder";
import { 
  arrayContainsPlugin, 
  objectPropertyNamesPlugin,
  objectPatternPropertiesPlugin,
  objectDependentRequiredPlugin,
  jsonSchemaPlugin,
  tupleBuilderPlugin,
  requiredPlugin,
  stringMinPlugin,
  numberMinPlugin,
  stringEmailPlugin
} from "../../../src/core/plugin";

describe("JSON Schema Extensions", () => {
  describe("arrayContains Plugin", () => {
    test("should validate array contains specific value", () => {
      const validator = Builder()
        .use(arrayContainsPlugin)
        .use(requiredPlugin)
        .for<{ tags: string[] }>()
        .v("tags", (b) => b.array.required().contains("important"))
        .build();

      const validResult = validator.validate({
        tags: ["normal", "important", "urgent"]
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        tags: ["normal", "urgent"]
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should validate array contains matching schema", () => {
      const validator = Builder()
        .use(arrayContainsPlugin)
        .use(requiredPlugin)
        .for<{ numbers: number[] }>()
        .v("numbers", (b) => b.array.required().contains({
          validator: (value: any) => typeof value === "number" && value > 10,
          message: "Array must contain at least one number greater than 10"
        }))
        .build();

      const validResult = validator.validate({
        numbers: [1, 5, 15, 3]
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        numbers: [1, 5, 8, 3]
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors[0].message).toContain("number greater than 10");
    });
  });

  describe("objectPropertyNames Plugin", () => {
    test("should validate property names with RegExp", () => {
      const validator = Builder()
        .use(objectPropertyNamesPlugin)
        .use(requiredPlugin)
        .for<{ config: Record<string, any> }>()
        .v("config", (b) => b.object.required().propertyNames(/^[a-zA-Z_][a-zA-Z0-9_]*$/))
        .build();

      const validResult = validator.validate({
        config: { validName: "value", _private: "test", camelCase: "ok" }
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        config: { "invalid-name": "value", "123invalid": "test" }
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should validate property names with custom validator", () => {
      const validator = Builder()
        .use(objectPropertyNamesPlugin)
        .use(requiredPlugin)
        .for<{ data: Record<string, any> }>()
        .v("data", (b) => b.object.required().propertyNames({
          validator: (name: string) => name.length >= 3 && !name.startsWith("_"),
          message: "Property names must be at least 3 characters and not start with underscore"
        }))
        .build();

      const validResult = validator.validate({
        data: { goodName: "value", another: "test" }
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        data: { "ab": "short", "_private": "underscore" }
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors[0].message).toContain("at least 3 characters");
    });
  });

  describe("objectPatternProperties Plugin", () => {
    test("should validate pattern properties", () => {
      const validator = Builder()
        .use(objectPatternPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ config: Record<string, any> }>()
        .v("config", (b) => b.object.required().patternProperties({
          "^str_": (value: any) => typeof value === "string",
          "^num_": (value: any) => typeof value === "number"
        }))
        .build();

      const validResult = validator.validate({
        config: {
          str_name: "hello",
          str_value: "world",
          num_count: 42,
          num_size: 100,
          other: "ignored" // Doesn't match any pattern, so ignored
        }
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        config: {
          str_name: 123, // Should be string
          num_count: "invalid", // Should be number
        }
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should validate pattern properties with custom messages", () => {
      const validator = Builder()
        .use(objectPatternPropertiesPlugin)
        .use(requiredPlugin)
        .for<{ data: Record<string, any> }>()
        .v("data", (b) => b.object.required().patternProperties({
          "^email_": {
            validator: (value: any) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            message: "Email properties must be valid email addresses"
          }
        }))
        .build();

      const validResult = validator.validate({
        data: { email_primary: "test@example.com", email_secondary: "user@domain.org" }
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        data: { email_primary: "invalid-email" }
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors[0].message).toContain("valid email addresses");
    });
  });

  describe("objectDependentRequired Plugin", () => {
    test("should validate dependent required fields", () => {
      type TestData = { billing_address?: string; credit_card?: string; name?: string; first?: string; last?: string; };
      
      const validator = Builder()
        .use(objectDependentRequiredPlugin)
        .use(requiredPlugin)
        .for<TestData>()
        .field("" as any, (b: any) => b.object.dependentRequired({
          credit_card: ["billing_address"],
          name: ["first", "last"]
        }))
        .build();

      // Valid case: credit_card with billing_address
      const validResult1 = validator.validate({
        credit_card: "1234-5678-9012-3456",
        billing_address: "123 Main St"
      });
      expect(validResult1.isValid()).toBe(true);

      // Valid case: name with first and last
      const validResult2 = validator.validate({
        name: "John Doe",
        first: "John",
        last: "Doe"
      });
      expect(validResult2.isValid()).toBe(true);

      // Invalid case: credit_card without billing_address
      const invalidResult1 = validator.validate({
        credit_card: "1234-5678-9012-3456"
      });
      expect(invalidResult1.isValid()).toBe(false);
      expect(invalidResult1.errors[0].message).toContain("billing_address");

      // Invalid case: name without first
      const invalidResult2 = validator.validate({
        name: "John Doe",
        last: "Doe"
      });
      expect(invalidResult2.isValid()).toBe(false);
      expect(invalidResult2.errors[0].message).toContain("first");
    });

    test("should validate dependent required with custom messages", () => {
      type EmailData = { email?: string; email_verified?: boolean; };
      
      const validator = Builder()
        .use(objectDependentRequiredPlugin)
        .use(requiredPlugin)
        .for<EmailData>()
        .field("" as any, (b: any) => b.object.dependentRequired({
          email: { 
            required: ["email_verified"],
            message: "When email is provided, email_verified is required"
          }
        }))
        .build();

      const validResult = validator.validate({
        email: "test@example.com",
        email_verified: true
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        email: "test@example.com"
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors[0].message).toContain("email_verified is required");
    });
  });

  describe("JSON Schema Integration", () => {
    test("should support contains in JSON Schema", () => {
      interface Data {
        items: number[];
      }

      const validator = (Builder()
        .use(jsonSchemaPlugin)
        .use(arrayContainsPlugin)
        .use(requiredPlugin)
        .for<Data>() as any)
        .fromJsonSchema({
          type: "object",
          properties: {
            items: {
              type: "array",
              contains: {
                type: "number",
                minimum: 10
              }
            }
          },
          required: ["items"]
        })
        .build();

      const validResult = validator.validate({
        items: [1, 5, 15, 3]
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        items: [1, 5, 8, 3]
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should support tuple items in JSON Schema", () => {
      interface Coordinates {
        location: [number, number, number];
      }

      const validator = (Builder()
        .use(jsonSchemaPlugin)
        .use(tupleBuilderPlugin)
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<Coordinates>() as any)
        .fromJsonSchema({
          type: "object",
          properties: {
            location: {
              type: "array",
              items: [
                { type: "number", minimum: -180, maximum: 180 },
                { type: "number", minimum: -90, maximum: 90 },
                { type: "number", minimum: 0 }
              ]
            }
          },
          required: ["location"]
        })
        .build();

      const validResult = validator.validate({
        location: [120.5, 35.2, 100]
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        location: [200, 35.2, 100] // Longitude out of range
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should support propertyNames in JSON Schema", () => {
      interface Config {
        settings: Record<string, any>;
      }

      const validator = (Builder()
        .use(jsonSchemaPlugin)
        .use(objectPropertyNamesPlugin)
        .use(requiredPlugin)
        .for<Config>() as any)
        .fromJsonSchema({
          type: "object",
          properties: {
            settings: {
              type: "object",
              propertyNames: {
                pattern: "^[a-zA-Z_][a-zA-Z0-9_]*$"
              }
            }
          },
          required: ["settings"]
        })
        .build();

      const validResult = validator.validate({
        settings: { validName: "value", _private: "test" }
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        settings: { "invalid-name": "value" }
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should support dependentRequired in JSON Schema", () => {
      interface UserData {
        name?: string;
        first?: string;
        last?: string;
        credit_card?: string;
        billing_address?: string;
      }

      const validator = (Builder()
        .use(jsonSchemaPlugin)
        .use(objectDependentRequiredPlugin)
        .use(requiredPlugin)
        .for<UserData>() as any)
        .fromJsonSchema({
          type: "object",
          properties: {
            name: { type: "string" },
            first: { type: "string" },
            last: { type: "string" },
            credit_card: { type: "string" },
            billing_address: { type: "string" }
          },
          dependentRequired: {
            name: ["first", "last"],
            credit_card: ["billing_address"]
          }
        })
        .build();

      const validResult = validator.validate({
        name: "John Doe",
        first: "John",
        last: "Doe"
      });
      expect(validResult.isValid()).toBe(true);

      const invalidResult = validator.validate({
        name: "John Doe",
        last: "Doe" // Missing "first"
      });
      expect(invalidResult.isValid()).toBe(false);
    });
  });
});