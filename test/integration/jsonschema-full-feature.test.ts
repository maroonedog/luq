import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaFullFeaturePlugin } from "../../src/core/plugin/jsonSchemaFullFeature";
import type { JSONSchema7 } from "json-schema";

describe("JSON Schema Full Feature Plugin", () => {
  test("should work with single plugin import", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        email: { type: "string", format: "email" },
        ipAddress: { type: "string", format: "ipv4" },
        age: { type: "integer", minimum: 18, maximum: 120 },
        website: { type: "string", format: "uri" },
        roles: {
          type: "array",
          items: { type: "string", enum: ["admin", "user", "guest"] },
          uniqueItems: true,
          minItems: 1
        },
        metadata: {
          type: "object",
          patternProperties: {
            "^pref_": { type: "boolean" }
          },
          additionalProperties: false
        }
      },
      required: ["email", "age"],
      additionalProperties: false
    };

    // Use the single composite plugin
    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    const validData = {
      email: "test@example.com",
      ipAddress: "192.168.1.1",
      age: 25,
      website: "https://example.com",
      roles: ["admin", "user"],
      metadata: {
        pref_notifications: true,
        pref_darkMode: false
      }
    };

    const result = validator.validate(validData);
    expect(result.isValid()).toBe(true);

    const invalidData = {
      email: "not-an-email",
      ipAddress: "999.999.999.999",
      age: 15, // Below minimum
      website: "not a url",
      roles: ["admin", "admin"], // Not unique
      metadata: {
        pref_notifications: true,
        pref_darkMode: false
      }
    };

    const invalidResult = validator.validate(invalidData);
    if (invalidResult.isValid()) {
      console.log("Expected validation to fail but it passed");
      console.log("Data:", JSON.stringify(invalidData, null, 2));
    } else {
      console.log("Validation correctly failed with errors:", invalidResult.errors);
    }
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should work with builder and composite plugin", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        created: { type: "string", format: "date-time" },
        ipv6: { type: "string", format: "ipv6" },
        duration: { type: "string", format: "duration" },
        base64Data: {
          type: "string",
          contentEncoding: "base64"
        } as any
      },
      required: ["id"],
      if: {
        properties: {
          created: { type: "string" }
        }
      },
      then: {
        required: ["duration"]
      }
    };

    // Using the builder with composite plugin
    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    const validData = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      created: "2024-01-15T10:30:00Z",
      ipv6: "2001:db8::8a2e:370:7334",
      duration: "P1Y2M3DT4H5M6S",
      base64Data: "SGVsbG8gV29ybGQ="
    };

    const result = validator.validate(validData);
    expect(result.isValid()).toBe(true);
  });

  test("should handle complex nested schemas with all features", () => {
    const schema: JSONSchema7 = {
      type: "object",
      definitions: {
        address: {
          type: "object",
          properties: {
            street: { type: "string", minLength: 1 },
            city: { type: "string", minLength: 1 },
            zipCode: { type: "string", pattern: "^\\d{5}$" }
          },
          required: ["street", "city"]
        }
      },
      properties: {
        user: {
          type: "object",
          properties: {
            name: { type: "string" },
            email: { type: "string", format: "email" },
            age: { type: "integer", minimum: 0, maximum: 150 },
            addresses: {
              type: "array",
              items: { $ref: "#/definitions/address" },
              minItems: 1
            }
          },
          required: ["name", "email"],
          dependentRequired: {
            age: ["email"]
          }
        } as any,
        settings: {
          oneOf: [
            {
              type: "object",
              properties: {
                theme: { type: "string", enum: ["light", "dark"] }
              },
              required: ["theme"]
            },
            {
              type: "object",
              properties: {
                customColors: {
                  type: "object",
                  patternProperties: {
                    "^#[0-9a-fA-F]{6}$": { type: "string" }
                  }
                }
              },
              required: ["customColors"]
            }
          ]
        }
      },
      required: ["user", "settings"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    const validData = {
      user: {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        addresses: [
          {
            street: "123 Main St",
            city: "New York",
            zipCode: "12345"
          }
        ]
      },
      settings: {
        theme: "dark"
      }
    };

    const result = validator.validate(validData);
    expect(result.isValid()).toBe(true);
  });
});