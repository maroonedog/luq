import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaFullFeaturePlugin } from "../../src/core/plugin/jsonSchemaFullFeature";
import type { JSONSchema7 } from "json-schema";

describe("JSON Schema Format Validators", () => {
  test("should validate email format", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        email: { type: "string", format: "email" }
      },
      required: ["email"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid email
    const validResult = validator.validate({ email: "test@example.com" });
    console.log("Valid email result:", validResult.isValid());
    expect(validResult.isValid()).toBe(true);

    // Invalid email
    const invalidResult = validator.validate({ email: "not-an-email" });
    console.log("Invalid email result:", invalidResult.isValid());
    if (!invalidResult.isValid()) {
      console.log("Errors:", invalidResult.errors);
    }
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate date format", () => {
    const schema: JSONSchema7 = {
      type: "object", 
      properties: {
        date: { type: "string", format: "date" }
      },
      required: ["date"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid date
    const validResult = validator.validate({ date: "2024-01-15" });
    expect(validResult.isValid()).toBe(true);

    // Invalid date
    const invalidResult = validator.validate({ date: "2024-13-01" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate datetime format", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        datetime: { type: "string", format: "date-time" }
      },
      required: ["datetime"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid datetime with timezone
    const validResult = validator.validate({ datetime: "2024-01-15T10:30:00Z" });
    console.log("Valid datetime result:", validResult.isValid());
    expect(validResult.isValid()).toBe(true);

    // Valid datetime with offset
    const validResult2 = validator.validate({ datetime: "2024-01-15T10:30:00+09:00" });
    console.log("Valid datetime with offset result:", validResult2.isValid());
    expect(validResult2.isValid()).toBe(true);

    // Invalid datetime
    const invalidResult = validator.validate({ datetime: "not-a-datetime" });
    console.log("Invalid datetime result:", invalidResult.isValid());
    if (!invalidResult.isValid()) {
      console.log("Errors:", invalidResult.errors);
    } else {
      console.log("WARNING: Invalid datetime was accepted!");
    }
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate ipv4 format", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        ip: { type: "string", format: "ipv4" }
      },
      required: ["ip"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid IP
    const validResult = validator.validate({ ip: "192.168.1.1" });
    expect(validResult.isValid()).toBe(true);

    // Invalid IP
    const invalidResult = validator.validate({ ip: "999.999.999.999" });
    expect(invalidResult.isValid()).toBe(false);
  });
});