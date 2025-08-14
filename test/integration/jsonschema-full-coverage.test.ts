import { describe, test, expect } from "@jest/globals";
import { 
  jsonSchemaPlugin,
  validateValueAgainstSchema,
  resolveRef
} from "../../src/core/plugin/jsonSchema";
import { JSONSchema7 } from "json-schema";

describe("JsonSchema Plugin - Full Coverage", () => {
  describe("validateValueAgainstSchema - Complete Coverage", () => {
    describe("$ref resolution", () => {
      test("should resolve internal references", () => {
        const schema: JSONSchema7 = {
          $ref: "#/definitions/user"
        };
        const rootSchema: JSONSchema7 = {
          definitions: {
            user: {
              type: "object",
              properties: {
                name: { type: "string" }
              }
            }
          }
        };
        
        expect(validateValueAgainstSchema(
          { name: "John" },
          schema,
          undefined,
          rootSchema
        )).toBe(true);
        
        expect(validateValueAgainstSchema(
          { name: 123 },
          schema,
          undefined,
          rootSchema
        )).toBe(false);
      });

      test("should resolve $defs references", () => {
        const schema: JSONSchema7 = {
          $ref: "#/$defs/address"
        };
        const rootSchema: JSONSchema7 = {
          $defs: {
            address: {
              type: "object",
              properties: {
                street: { type: "string" }
              }
            }
          }
        };
        
        expect(validateValueAgainstSchema(
          { street: "Main St" },
          schema,
          undefined,
          rootSchema
        )).toBe(true);
      });
    });

    describe("Type validation - all primitive types", () => {
      test("should validate string type", () => {
        const schema: JSONSchema7 = { type: "string" };
        expect(validateValueAgainstSchema("test", schema)).toBe(true);
        expect(validateValueAgainstSchema(123, schema)).toBe(false);
        expect(validateValueAgainstSchema(null, schema)).toBe(false);
      });

      test("should validate number type", () => {
        const schema: JSONSchema7 = { type: "number" };
        expect(validateValueAgainstSchema(42, schema)).toBe(true);
        expect(validateValueAgainstSchema(3.14, schema)).toBe(true);
        expect(validateValueAgainstSchema(NaN, schema)).toBe(false);
        expect(validateValueAgainstSchema("42", schema)).toBe(false);
      });

      test("should validate integer type", () => {
        const schema: JSONSchema7 = { type: "integer" };
        expect(validateValueAgainstSchema(42, schema)).toBe(true);
        expect(validateValueAgainstSchema(3.14, schema)).toBe(false);
        expect(validateValueAgainstSchema("42", schema)).toBe(false);
      });

      test("should validate boolean type", () => {
        const schema: JSONSchema7 = { type: "boolean" };
        expect(validateValueAgainstSchema(true, schema)).toBe(true);
        expect(validateValueAgainstSchema(false, schema)).toBe(true);
        expect(validateValueAgainstSchema(1, schema)).toBe(false);
        expect(validateValueAgainstSchema("true", schema)).toBe(false);
      });

      test("should validate null type", () => {
        const schema: JSONSchema7 = { type: "null" };
        expect(validateValueAgainstSchema(null, schema)).toBe(true);
        expect(validateValueAgainstSchema(undefined, schema)).toBe(false);
        expect(validateValueAgainstSchema(0, schema)).toBe(false);
      });

      test("should validate array type", () => {
        const schema: JSONSchema7 = { type: "array" };
        expect(validateValueAgainstSchema([], schema)).toBe(true);
        expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
        expect(validateValueAgainstSchema({}, schema)).toBe(false);
        expect(validateValueAgainstSchema("array", schema)).toBe(false);
      });

      test("should validate object type", () => {
        const schema: JSONSchema7 = { type: "object" };
        expect(validateValueAgainstSchema({}, schema)).toBe(true);
        expect(validateValueAgainstSchema({ key: "value" }, schema)).toBe(true);
        expect(validateValueAgainstSchema([], schema)).toBe(false);
        expect(validateValueAgainstSchema(null, schema)).toBe(false);
      });

      test("should validate multiple types (union)", () => {
        const schema: JSONSchema7 = { type: ["string", "number", "null"] };
        expect(validateValueAgainstSchema("test", schema)).toBe(true);
        expect(validateValueAgainstSchema(42, schema)).toBe(true);
        expect(validateValueAgainstSchema(null, schema)).toBe(true);
        expect(validateValueAgainstSchema(true, schema)).toBe(false);
        expect(validateValueAgainstSchema([], schema)).toBe(false);
      });
    });

    describe("String constraints and formats", () => {
      test("should validate minLength and maxLength", () => {
        const schema: JSONSchema7 = {
          type: "string",
          minLength: 3,
          maxLength: 10
        };
        expect(validateValueAgainstSchema("test", schema)).toBe(true);
        expect(validateValueAgainstSchema("ab", schema)).toBe(false);
        expect(validateValueAgainstSchema("verylongstring", schema)).toBe(false);
      });

      test("should validate pattern", () => {
        const schema: JSONSchema7 = {
          type: "string",
          pattern: "^[A-Z][a-z]+$"
        };
        expect(validateValueAgainstSchema("Hello", schema)).toBe(true);
        expect(validateValueAgainstSchema("hello", schema)).toBe(false);
        expect(validateValueAgainstSchema("HELLO", schema)).toBe(false);
      });

      test("should validate email format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "email"
        };
        expect(validateValueAgainstSchema("test@example.com", schema)).toBe(true);
        expect(validateValueAgainstSchema("invalid.email", schema)).toBe(false);
      });

      test("should validate url/uri format", () => {
        const schemaUrl: JSONSchema7 = {
          type: "string",
          format: "url"
        };
        const schemaUri: JSONSchema7 = {
          type: "string",
          format: "uri"
        };
        
        expect(validateValueAgainstSchema("https://example.com", schemaUrl)).toBe(true);
        expect(validateValueAgainstSchema("https://example.com", schemaUri)).toBe(true);
        expect(validateValueAgainstSchema("not-a-url", schemaUrl)).toBe(false);
        expect(validateValueAgainstSchema("not-a-uri", schemaUri)).toBe(false);
      });

      test("should validate uuid format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "uuid"
        };
        expect(validateValueAgainstSchema("550e8400-e29b-41d4-a716-446655440000", schema)).toBe(true);
        expect(validateValueAgainstSchema("550e8400-e29b-41d4-a716", schema)).toBe(false);
      });

      test("should validate date format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "date"
        };
        expect(validateValueAgainstSchema("2024-01-15", schema)).toBe(true);
        expect(validateValueAgainstSchema("2024-13-01", schema)).toBe(false);
        expect(validateValueAgainstSchema("01-15-2024", schema)).toBe(false);
      });

      test("should validate date-time format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "date-time"
        };
        expect(validateValueAgainstSchema("2024-01-15T10:30:00Z", schema)).toBe(true);
        expect(validateValueAgainstSchema("2024-01-15T10:30:00.123Z", schema)).toBe(true);
        expect(validateValueAgainstSchema("2024-01-15T10:30:00+09:00", schema)).toBe(true);
        expect(validateValueAgainstSchema("2024-01-15", schema)).toBe(false);
      });

      test("should validate ipv4 format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "ipv4"
        };
        expect(validateValueAgainstSchema("192.168.1.1", schema)).toBe(true);
        expect(validateValueAgainstSchema("255.255.255.255", schema)).toBe(true);
        expect(validateValueAgainstSchema("256.256.256.256", schema)).toBe(false);
        expect(validateValueAgainstSchema("192.168.1", schema)).toBe(false);
      });

      test("should validate ipv6 format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "ipv6"
        };
        expect(validateValueAgainstSchema("2001:0db8:85a3:0000:0000:8a2e:0370:7334", schema)).toBe(true);
        expect(validateValueAgainstSchema("::1", schema)).toBe(true);
        expect(validateValueAgainstSchema("fe80::1%eth0", schema)).toBe(true);
        expect(validateValueAgainstSchema("not-an-ipv6", schema)).toBe(false);
      });

      test("should validate hostname format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "hostname"
        };
        expect(validateValueAgainstSchema("example.com", schema)).toBe(true);
        expect(validateValueAgainstSchema("sub.example.com", schema)).toBe(true);
        expect(validateValueAgainstSchema("a".repeat(254), schema)).toBe(false); // Too long
        expect(validateValueAgainstSchema("-invalid.com", schema)).toBe(false);
      });

      test("should validate time format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "time"
        };
        expect(validateValueAgainstSchema("10:30:00", schema)).toBe(true);
        expect(validateValueAgainstSchema("23:59:59.999", schema)).toBe(true);
        expect(validateValueAgainstSchema("24:00:00", schema)).toBe(false);
        expect(validateValueAgainstSchema("10:60:00", schema)).toBe(false);
      });

      test("should validate duration format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "duration"
        };
        expect(validateValueAgainstSchema("P1Y2M3DT4H5M6S", schema)).toBe(true);
        expect(validateValueAgainstSchema("PT1H30M", schema)).toBe(true);
        expect(validateValueAgainstSchema("P", schema)).toBe(false); // Empty duration
        expect(validateValueAgainstSchema("1Y2M", schema)).toBe(false); // Missing P prefix
      });

      test("should validate json-pointer format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "json-pointer"
        };
        expect(validateValueAgainstSchema("/foo/bar", schema)).toBe(true);
        expect(validateValueAgainstSchema("/foo/0", schema)).toBe(true);
        expect(validateValueAgainstSchema("", schema)).toBe(true); // Empty pointer is valid
        expect(validateValueAgainstSchema("/~0/~1", schema)).toBe(true); // Escaped ~ and /
        expect(validateValueAgainstSchema("foo/bar", schema)).toBe(false); // Missing leading /
      });

      test("should validate relative-json-pointer format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "relative-json-pointer"
        };
        expect(validateValueAgainstSchema("0", schema)).toBe(true);
        expect(validateValueAgainstSchema("1/foo", schema)).toBe(true);
        expect(validateValueAgainstSchema("2#", schema)).toBe(true);
        expect(validateValueAgainstSchema("/foo", schema)).toBe(false); // Not relative
      });

      test("should validate iri format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "iri"
        };
        expect(validateValueAgainstSchema("https://example.com/path", schema)).toBe(true);
        expect(validateValueAgainstSchema("urn:isbn:0451450523", schema)).toBe(true);
        expect(validateValueAgainstSchema("https://例え.jp", schema)).toBe(true);
        expect(validateValueAgainstSchema("not a valid iri", schema)).toBe(false); // Contains spaces
        expect(validateValueAgainstSchema("https://example.com/\x00", schema)).toBe(false); // Control char
      });

      test("should validate iri-reference format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "iri-reference"
        };
        expect(validateValueAgainstSchema("", schema)).toBe(true); // Empty is valid
        expect(validateValueAgainstSchema("/relative/path", schema)).toBe(true);
        expect(validateValueAgainstSchema("https://example.com", schema)).toBe(true);
        expect(validateValueAgainstSchema("#fragment", schema)).toBe(true);
        expect(validateValueAgainstSchema("path with spaces", schema)).toBe(false);
        expect(validateValueAgainstSchema("path\x00", schema)).toBe(false); // Control char
      });

      test("should validate uri-template format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "uri-template"
        };
        expect(validateValueAgainstSchema("/users/{id}", schema)).toBe(true);
        expect(validateValueAgainstSchema("/search{?q,page}", schema)).toBe(true);
        expect(validateValueAgainstSchema("no-template", schema)).toBe(true);
        expect(validateValueAgainstSchema("/users/{id", schema)).toBe(false); // Unclosed
        expect(validateValueAgainstSchema("/users/}id", schema)).toBe(false); // Unopened
        expect(validateValueAgainstSchema("/users/{id{nested}}", schema)).toBe(false); // Nested
      });

      test("should validate with custom format", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "custom"
        };
        const customFormats = {
          custom: (value: string) => value.startsWith("CUSTOM-")
        };
        
        expect(validateValueAgainstSchema("CUSTOM-123", schema, customFormats)).toBe(true);
        expect(validateValueAgainstSchema("INVALID-123", schema, customFormats)).toBe(false);
      });

      test("should validate date format with custom handler", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "date"
        };
        const customFormats = {
          date: (value: string) => {
            const regex = /^\d{4}-\d{2}-\d{2}$/;
            if (!regex.test(value)) return false;
            const date = new Date(value);
            return !isNaN(date.getTime());
          }
        };
        
        expect(validateValueAgainstSchema("2024-02-29", schema, customFormats)).toBe(true);
        expect(validateValueAgainstSchema("2023-02-29", schema, customFormats)).toBe(false); // Invalid leap year
      });

      test("should validate date-time format with custom handler", () => {
        const schema: JSONSchema7 = {
          type: "string",
          format: "date-time"
        };
        const customFormats = {
          "date-time": (value: string) => {
            try {
              const date = new Date(value);
              return !isNaN(date.getTime()) && value.includes("T");
            } catch {
              return false;
            }
          }
        };
        
        expect(validateValueAgainstSchema("2024-01-15T10:30:00Z", schema, customFormats)).toBe(true);
        expect(validateValueAgainstSchema("invalid-datetime", schema, customFormats)).toBe(false);
      });
    });

    describe("Number constraints", () => {
      test("should validate minimum and maximum", () => {
        const schema: JSONSchema7 = {
          type: "number",
          minimum: 0,
          maximum: 100
        };
        expect(validateValueAgainstSchema(50, schema)).toBe(true);
        expect(validateValueAgainstSchema(0, schema)).toBe(true);
        expect(validateValueAgainstSchema(100, schema)).toBe(true);
        expect(validateValueAgainstSchema(-1, schema)).toBe(false);
        expect(validateValueAgainstSchema(101, schema)).toBe(false);
      });

      // Skip boolean exclusive tests since JSONSchema7 only supports number for exclusiveMinimum/Maximum

      test("should validate exclusiveMinimum (number)", () => {
        const schema: JSONSchema7 = {
          type: "number",
          exclusiveMinimum: 0
        };
        expect(validateValueAgainstSchema(0.1, schema)).toBe(true);
        expect(validateValueAgainstSchema(0, schema)).toBe(false);
      });

      test("should validate exclusiveMaximum (number)", () => {
        const schema: JSONSchema7 = {
          type: "number",
          exclusiveMaximum: 100
        };
        expect(validateValueAgainstSchema(99.9, schema)).toBe(true);
        expect(validateValueAgainstSchema(100, schema)).toBe(false);
      });

      test("should validate multipleOf", () => {
        const schema: JSONSchema7 = {
          type: "number",
          multipleOf: 0.5
        };
        expect(validateValueAgainstSchema(1, schema)).toBe(true);
        expect(validateValueAgainstSchema(1.5, schema)).toBe(true);
        expect(validateValueAgainstSchema(1.3, schema)).toBe(false);
      });

      test("should validate integer with constraints", () => {
        const schema: JSONSchema7 = {
          type: "integer",
          minimum: 0,
          maximum: 10,
          multipleOf: 2
        };
        expect(validateValueAgainstSchema(4, schema)).toBe(true);
        expect(validateValueAgainstSchema(3, schema)).toBe(false); // Not multiple of 2
        expect(validateValueAgainstSchema(4.5, schema)).toBe(false); // Not integer
      });
    });

    describe("Array constraints", () => {
      test("should validate items schema", () => {
        const schema: JSONSchema7 = {
          type: "array",
          items: { type: "string" }
        };
        expect(validateValueAgainstSchema(["a", "b", "c"], schema)).toBe(true);
        expect(validateValueAgainstSchema(["a", 1, "c"], schema)).toBe(false);
      });

      test("should validate tuple items", () => {
        const schema: JSONSchema7 = {
          type: "array",
          items: [
            { type: "string" },
            { type: "number" },
            { type: "boolean" }
          ]
        };
        expect(validateValueAgainstSchema(["test", 42, true], schema)).toBe(true);
        expect(validateValueAgainstSchema(["test", 42], schema)).toBe(true); // Shorter is ok
        expect(validateValueAgainstSchema(["test", "42", true], schema)).toBe(false); // Wrong type
      });

      test("should validate additionalItems with tuple", () => {
        const schema: JSONSchema7 = {
          type: "array",
          items: [
            { type: "string" },
            { type: "number" }
          ],
          additionalItems: { type: "boolean" }
        };
        expect(validateValueAgainstSchema(["test", 42, true, false], schema)).toBe(true);
        expect(validateValueAgainstSchema(["test", 42, "extra"], schema)).toBe(false);
      });

      test("should validate additionalItems false", () => {
        const schema: JSONSchema7 = {
          type: "array",
          items: [
            { type: "string" }
          ],
          additionalItems: false
        };
        expect(validateValueAgainstSchema(["test"], schema)).toBe(true);
        expect(validateValueAgainstSchema(["test", "extra"], schema)).toBe(false);
      });

      test("should validate minItems and maxItems", () => {
        const schema: JSONSchema7 = {
          type: "array",
          minItems: 2,
          maxItems: 5
        };
        expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
        expect(validateValueAgainstSchema([1], schema)).toBe(false);
        expect(validateValueAgainstSchema([1, 2, 3, 4, 5, 6], schema)).toBe(false);
      });

      test("should validate uniqueItems", () => {
        const schema: JSONSchema7 = {
          type: "array",
          uniqueItems: true
        };
        expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(true);
        expect(validateValueAgainstSchema([1, 2, 1], schema)).toBe(false);
        expect(validateValueAgainstSchema([{a: 1}, {a: 1}], schema)).toBe(false);
      });

      test("should validate contains", () => {
        const schema: JSONSchema7 = {
          type: "array",
          contains: {
            type: "number",
            minimum: 10
          }
        };
        expect(validateValueAgainstSchema([5, 15, 8], schema)).toBe(true); // 15 matches
        expect(validateValueAgainstSchema([1, 2, 3], schema)).toBe(false); // None match
      });

      // Skip minContains/maxContains test since they're draft 2019-09 features not in JSONSchema7
    });

    describe("Object constraints", () => {
      test("should validate properties", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" }
          }
        };
        expect(validateValueAgainstSchema({ name: "John", age: 30 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ name: 123, age: 30 }, schema)).toBe(false);
      });

      test("should validate required properties", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            name: { type: "string" },
            age: { type: "number" }
          },
          required: ["name"]
        };
        expect(validateValueAgainstSchema({ name: "John" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ age: 30 }, schema)).toBe(false);
      });

      test("should validate additionalProperties boolean", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            name: { type: "string" }
          },
          additionalProperties: false
        };
        expect(validateValueAgainstSchema({ name: "John" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ name: "John", extra: "value" }, schema)).toBe(false);
      });

      test("should validate additionalProperties schema", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            name: { type: "string" }
          },
          additionalProperties: { type: "number" }
        };
        expect(validateValueAgainstSchema({ name: "John", extra: 123 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ name: "John", extra: "string" }, schema)).toBe(false);
      });

      test("should validate patternProperties", () => {
        const schema: JSONSchema7 = {
          type: "object",
          patternProperties: {
            "^str_": { type: "string" },
            "^num_": { type: "number" }
          }
        };
        expect(validateValueAgainstSchema({ str_field: "value", num_field: 42 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ str_field: 123 }, schema)).toBe(false);
      });

      test("should validate minProperties and maxProperties", () => {
        const schema: JSONSchema7 = {
          type: "object",
          minProperties: 2,
          maxProperties: 4
        };
        expect(validateValueAgainstSchema({ a: 1, b: 2, c: 3 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ a: 1 }, schema)).toBe(false);
        expect(validateValueAgainstSchema({ a: 1, b: 2, c: 3, d: 4, e: 5 }, schema)).toBe(false);
      });

      test("should validate propertyNames", () => {
        const schema: JSONSchema7 = {
          type: "object",
          propertyNames: {
            pattern: "^[a-z]+$"
          }
        };
        expect(validateValueAgainstSchema({ name: "value", age: 30 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ Name: "value" }, schema)).toBe(false);
        expect(validateValueAgainstSchema({ "123": "value" }, schema)).toBe(false);
      });

      test("should validate dependencies (array)", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            creditCard: { type: "string" },
            cardNumber: { type: "string" }
          },
          dependencies: {
            creditCard: ["cardNumber"]
          }
        };
        expect(validateValueAgainstSchema({ creditCard: "yes", cardNumber: "1234" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ creditCard: "yes" }, schema)).toBe(false);
        expect(validateValueAgainstSchema({ cardNumber: "1234" }, schema)).toBe(true); // Ok without creditCard
      });

      test("should validate dependencies (schema)", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            creditCard: { type: "string" }
          },
          dependencies: {
            creditCard: {
              properties: {
                cardNumber: { type: "string", minLength: 16 }
              },
              required: ["cardNumber"]
            }
          }
        };
        expect(validateValueAgainstSchema({ creditCard: "yes", cardNumber: "1234567890123456" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ creditCard: "yes", cardNumber: "1234" }, schema)).toBe(false);
      });

      // Note: dependentRequired and dependentSchemas are draft 2019-09, using dependencies in JSONSchema7
    });

    describe("Schema composition", () => {
      test("should validate allOf", () => {
        const schema: JSONSchema7 = {
          allOf: [
            { type: "string" },
            { minLength: 5 },
            { maxLength: 10 }
          ]
        };
        expect(validateValueAgainstSchema("hello", schema)).toBe(true);
        expect(validateValueAgainstSchema("hi", schema)).toBe(false);
        expect(validateValueAgainstSchema("verylongstring", schema)).toBe(false);
      });

      test("should validate anyOf", () => {
        const schema: JSONSchema7 = {
          anyOf: [
            { type: "string", minLength: 5 },
            { type: "number", minimum: 10 }
          ]
        };
        expect(validateValueAgainstSchema("hello", schema)).toBe(true);
        expect(validateValueAgainstSchema(15, schema)).toBe(true);
        expect(validateValueAgainstSchema("hi", schema)).toBe(false);
        expect(validateValueAgainstSchema(5, schema)).toBe(false);
      });

      test("should validate oneOf", () => {
        const schema: JSONSchema7 = {
          oneOf: [
            { type: "string", maxLength: 5 },
            { type: "string", minLength: 3 }
          ]
        };
        expect(validateValueAgainstSchema("ab", schema)).toBe(true); // Only matches first
        expect(validateValueAgainstSchema("abcdef", schema)).toBe(true); // Only matches second
        expect(validateValueAgainstSchema("abcd", schema)).toBe(false); // Matches both
      });

      test("should validate not", () => {
        const schema: JSONSchema7 = {
          not: { type: "string" }
        };
        expect(validateValueAgainstSchema(123, schema)).toBe(true);
        expect(validateValueAgainstSchema(true, schema)).toBe(true);
        expect(validateValueAgainstSchema("string", schema)).toBe(false);
      });
    });

    describe("Conditional schemas", () => {
      test("should validate if/then/else", () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            type: { type: "string" },
            value: {}
          },
          if: {
            properties: {
              type: { const: "number" }
            }
          },
          then: {
            properties: {
              value: { type: "number" }
            }
          },
          else: {
            properties: {
              value: { type: "string" }
            }
          }
        };
        
        expect(validateValueAgainstSchema({ type: "number", value: 42 }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ type: "number", value: "42" }, schema)).toBe(false);
        expect(validateValueAgainstSchema({ type: "string", value: "text" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ type: "string", value: 42 }, schema)).toBe(false);
      });

      test("should validate if/then without else", () => {
        const schema: JSONSchema7 = {
          type: "object",
          if: {
            properties: {
              foo: { const: "bar" }
            }
          },
          then: {
            required: ["baz"]
          }
        };
        
        expect(validateValueAgainstSchema({ foo: "bar", baz: "value" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ foo: "bar" }, schema)).toBe(false);
        expect(validateValueAgainstSchema({ foo: "other" }, schema)).toBe(true); // No then applies
      });
    });

    describe("Enum and const", () => {
      test("should validate enum", () => {
        const schema: JSONSchema7 = {
          enum: ["red", "green", "blue", 42, null, true]
        };
        expect(validateValueAgainstSchema("red", schema)).toBe(true);
        expect(validateValueAgainstSchema(42, schema)).toBe(true);
        expect(validateValueAgainstSchema(null, schema)).toBe(true);
        expect(validateValueAgainstSchema(true, schema)).toBe(true);
        expect(validateValueAgainstSchema("yellow", schema)).toBe(false);
        expect(validateValueAgainstSchema(false, schema)).toBe(false);
      });

      test("should validate const", () => {
        const schema: JSONSchema7 = {
          const: "exactValue"
        };
        expect(validateValueAgainstSchema("exactValue", schema)).toBe(true);
        expect(validateValueAgainstSchema("otherValue", schema)).toBe(false);
      });

      test("should validate const with different types", () => {
        const schemaNumber: JSONSchema7 = { const: 42 };
        const schemaNull: JSONSchema7 = { const: null };
        const schemaObject: JSONSchema7 = { const: { key: "value" } };
        
        expect(validateValueAgainstSchema(42, schemaNumber)).toBe(true);
        expect(validateValueAgainstSchema(null, schemaNull)).toBe(true);
        expect(validateValueAgainstSchema({ key: "value" }, schemaObject)).toBe(true);
        expect(validateValueAgainstSchema({ key: "other" }, schemaObject)).toBe(false);
      });
    });

    describe("Edge cases and special scenarios", () => {
      test("should handle empty schema (always valid)", () => {
        const schema: JSONSchema7 = {};
        expect(validateValueAgainstSchema("anything", schema)).toBe(true);
        expect(validateValueAgainstSchema(123, schema)).toBe(true);
        expect(validateValueAgainstSchema(null, schema)).toBe(true);
      });

      test("should handle schema with only additionalProperties", () => {
        const schema: JSONSchema7 = {
          type: "object",
          additionalProperties: { type: "string" }
        };
        expect(validateValueAgainstSchema({ any: "string", key: "value" }, schema)).toBe(true);
        expect(validateValueAgainstSchema({ any: 123 }, schema)).toBe(false);
      });

      test("should handle string constraints without type specified", () => {
        const schema: JSONSchema7 = {
          minLength: 5,
          maxLength: 10
        };
        expect(validateValueAgainstSchema("hello", schema)).toBe(true);
        expect(validateValueAgainstSchema("hi", schema)).toBe(false);
        expect(validateValueAgainstSchema(123, schema)).toBe(true); // Not a string, constraints don't apply
      });

      test("should handle number constraints without type specified", () => {
        const schema: JSONSchema7 = {
          minimum: 0,
          maximum: 100
        };
        expect(validateValueAgainstSchema(50, schema)).toBe(true);
        expect(validateValueAgainstSchema(-1, schema)).toBe(false);
        expect(validateValueAgainstSchema("string", schema)).toBe(true); // Not a number, constraints don't apply
      });
    });
  });

  describe("resolveRef function error cases", () => {
    test("should throw error for external references", () => {
      expect(() => {
        resolveRef("http://example.com/schema", {});
      }).toThrow("External $ref not supported");
    });

    test("should throw error for unresolvable references", () => {
      expect(() => {
        resolveRef("#/definitions/nonexistent", {});
      }).toThrow("Cannot resolve $ref");
    });

    test("should resolve complex path references", () => {
      const rootSchema: JSONSchema7 = {
        properties: {
          user: {
            properties: {
              name: { type: "string" }
            }
          }
        }
      };
      
      const resolved = resolveRef("#/properties/user/properties/name", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });
  });
});