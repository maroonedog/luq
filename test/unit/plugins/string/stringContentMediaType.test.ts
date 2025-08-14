import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { stringContentMediaTypePlugin } from "../../../../src/core/plugin/stringContentMediaType";

describe("stringContentMediaType plugin", () => {
  test("should validate JSON media type", () => {
    type TestData = {
      data: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("data", (b) => b.string.contentMediaType("application/json"))
      .build();

    // Valid JSON
    const validResult = validator.validate({ data: '{"key":"value"}' });
    expect(validResult.isValid()).toBe(true);

    // Invalid JSON
    const invalidResult = validator.validate({ data: "not json" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate base64-encoded JSON", () => {
    type TestData = {
      data: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("data", (b) => b.string.contentMediaType("application/json", { encoding: "base64" }))
      .build();

    // Base64-encoded JSON: {"key":"value"}
    const validResult = validator.validate({ data: "eyJrZXkiOiJ2YWx1ZSJ9" });
    expect(validResult.isValid()).toBe(true);

    // Base64-encoded plain text: "hello world"
    const invalidResult = validator.validate({ data: "aGVsbG8gd29ybGQ=" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate HTML media type", () => {
    type TestData = {
      content: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("content", (b) => b.string.contentMediaType("text/html"))
      .build();

    // Valid HTML
    const validResult = validator.validate({ content: "<html><body>Hello</body></html>" });
    expect(validResult.isValid()).toBe(true);

    // Plain text (no HTML tags)
    const invalidResult = validator.validate({ content: "Just plain text" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate XML media type", () => {
    type TestData = {
      content: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("content", (b) => b.string.contentMediaType("text/xml"))
      .build();

    // Valid XML
    const validResult = validator.validate({ 
      content: '<?xml version="1.0"?><root><item>test</item></root>' 
    });
    expect(validResult.isValid()).toBe(true);

    // Invalid XML
    const invalidResult = validator.validate({ content: "not xml content" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate plain text (always valid)", () => {
    type TestData = {
      content: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("content", (b) => b.string.contentMediaType("text/plain"))
      .build();

    // Any text is valid
    const result1 = validator.validate({ content: "Any text content" });
    expect(result1.isValid()).toBe(true);

    const result2 = validator.validate({ content: '{"json": true}' });
    expect(result2.isValid()).toBe(true);

    const result3 = validator.validate({ content: "<html></html>" });
    expect(result3.isValid()).toBe(true);
  });

  test("should validate CSS media type", () => {
    type TestData = {
      style: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("style", (b) => b.string.contentMediaType("text/css"))
      .build();

    // Valid CSS
    const validResult = validator.validate({ 
      style: "body { margin: 0; padding: 0; }" 
    });
    expect(validResult.isValid()).toBe(true);

    // Not CSS
    const invalidResult = validator.validate({ style: "not css content" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should validate JavaScript media type", () => {
    type TestData = {
      script: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("script", (b) => b.string.contentMediaType("text/javascript"))
      .build();

    // Valid JavaScript
    const validResult = validator.validate({ 
      script: "const x = 10; function test() { return x; }" 
    });
    expect(validResult.isValid()).toBe(true);

    // Not JavaScript
    const invalidResult = validator.validate({ script: "not javascript" });
    expect(invalidResult.isValid()).toBe(false);
  });

  test("should be permissive for unknown media types", () => {
    type TestData = {
      content: string;
    };

    const validator = Builder()
      .use(stringContentMediaTypePlugin)
      .for<TestData>()
      .v("content", (b) => b.string.contentMediaType("application/custom-type"))
      .build();

    // Unknown media types should be accepted
    const result = validator.validate({ content: "any content" });
    expect(result.isValid()).toBe(true);
  });
});