import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaFullFeaturePlugin } from "../../src/core/plugin/jsonSchemaFullFeature";
import type { JSONSchema7 } from "json-schema";

describe("JSON Schema Content Validation", () => {
  test("should validate contentMediaType with contentEncoding", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        jsonData: {
          type: "string",
          contentEncoding: "base64",
          contentMediaType: "application/json"
        } as any,
        htmlContent: {
          type: "string",
          contentMediaType: "text/html"
        } as any
      },
      required: ["jsonData", "htmlContent"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid: base64-encoded JSON and HTML content
    const validData = {
      jsonData: "eyJrZXkiOiJ2YWx1ZSJ9", // {"key":"value"}
      htmlContent: "<html><body>Hello</body></html>"
    };
    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // Invalid: base64-encoded plain text (not JSON)
    const invalidData = {
      jsonData: "aGVsbG8gd29ybGQ=", // "hello world" - not valid JSON
      htmlContent: "Not HTML content"
    };
    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate various media types", () => {
    const schema: JSONSchema7 = {
      type: "object", 
      properties: {
        xmlData: {
          type: "string",
          contentMediaType: "text/xml"
        } as any,
        cssData: {
          type: "string",
          contentMediaType: "text/css"
        } as any,
        jsData: {
          type: "string",
          contentMediaType: "text/javascript"
        } as any,
        plainText: {
          type: "string",
          contentMediaType: "text/plain"
        } as any
      }
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid data for each media type
    const validData = {
      xmlData: '<?xml version="1.0"?><root><item>test</item></root>',
      cssData: 'body { margin: 0; }',
      jsData: 'const x = 10;',
      plainText: 'Any plain text'
    };
    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // Invalid XML (but valid for other types)
    const invalidXmlData = {
      xmlData: 'not xml',
      cssData: 'body { margin: 0; }',
      jsData: 'const x = 10;',
      plainText: 'Any plain text'
    };
    const invalidResult = validator.validate(invalidXmlData);
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should handle contentEncoding without contentMediaType", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        encodedData: {
          type: "string",
          contentEncoding: "base64"
        } as any
      },
      required: ["encodedData"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid base64
    const validData = {
      encodedData: "SGVsbG8gV29ybGQ=" // "Hello World"
    };
    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // Invalid base64
    const invalidData = {
      encodedData: "Not valid base64!@#"
    };
    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should work with nested objects containing content validation", () => {
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        metadata: {
          type: "object",
          properties: {
            config: {
              type: "string",
              contentMediaType: "application/json"
            } as any,
            template: {
              type: "string",
              contentMediaType: "text/html"
            } as any
          },
          required: ["config"]
        }
      },
      required: ["metadata"]
    };

    const validator = Builder()
      .use(jsonSchemaFullFeaturePlugin)
      .fromJsonSchema(schema)
      .build();

    // Valid nested content
    const validData = {
      metadata: {
        config: '{"setting": "value"}',
        template: "<div>Template</div>"
      }
    };
    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // Invalid JSON in config
    const invalidData = {
      metadata: {
        config: 'not json',
        template: "<div>Template</div>"
      }
    };
    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
  });
});