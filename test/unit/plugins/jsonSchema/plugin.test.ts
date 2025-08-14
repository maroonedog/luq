import { jsonSchemaPlugin } from "../../../../src/core/plugin/jsonSchema/plugin";
import type { JSONSchema7 } from "json-schema";

describe("jsonSchemaPlugin", () => {
  test("should have correct metadata", () => {
    expect(jsonSchemaPlugin.name).toBe("jsonSchema");
    expect(jsonSchemaPlugin.category).toBe("builder-extension");
    expect(typeof jsonSchemaPlugin.extendBuilder).toBe("function");
  });

  test("should extend builder with fromJsonSchema method", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    expect(typeof mockBuilder.fromJsonSchema).toBe("function");
  });

  test("should convert simple JSON Schema to Luq validator", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string", minLength: 3 },
        age: { type: "number", minimum: 18 }
      },
      required: ["name"]
    };
    
    // Mock the v method
    let capturedFields: any[] = [];
    mockBuilder.v = jest.fn((path, definition) => {
      capturedFields.push({ path, definition });
      return mockBuilder;
    });
    
    const result = mockBuilder.fromJsonSchema(schema);
    
    expect(result).toBe(mockBuilder);
    expect(capturedFields.length).toBeGreaterThan(0);
    expect(capturedFields.some(f => f.path === "name")).toBe(true);
    expect(capturedFields.some(f => f.path === "age")).toBe(true);
  });

  test("should handle schema with additionalProperties false", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        name: { type: "string" }
      },
      additionalProperties: false
    };
    
    mockBuilder.v = jest.fn(() => mockBuilder);
    mockBuilder.strict = jest.fn(() => mockBuilder);
    
    mockBuilder.fromJsonSchema(schema);
    
    expect(mockBuilder.strict).toHaveBeenCalled();
  });

  test("should handle schema with dependentRequired", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        creditCard: { type: "string" },
        billingAddress: { type: "string" }
      },
      // Use 'as any' to test draft-2019-09 feature
      ...{ dependentRequired: { creditCard: ["billingAddress"] } } as any
    };
    
    let capturedFields: any[] = [];
    mockBuilder.v = jest.fn((path, definition) => {
      capturedFields.push({ path, definition });
      return mockBuilder;
    });
    mockBuilder.strict = jest.fn(() => mockBuilder);
    
    mockBuilder.fromJsonSchema(schema);
    
    // Should add conditional requirement for billingAddress
    expect(capturedFields.some(f => f.path === "billingAddress")).toBe(true);
  });

  test("should handle custom formats", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    const schema: JSONSchema7 = {
      type: "object",
      properties: {
        customField: { type: "string", format: "custom-format" }
      }
    };
    
    const customFormats = {
      "custom-format": (value: string) => value.startsWith("CUSTOM-")
    };
    
    mockBuilder.v = jest.fn(() => mockBuilder);
    
    mockBuilder.fromJsonSchema(schema, { customFormats });
    
    expect(mockBuilder.v).toHaveBeenCalled();
  });

  test("should skip root object constraints when path is empty", () => {
    const mockBuilder: any = {};
    jsonSchemaPlugin.extendBuilder(mockBuilder);
    
    const schema: JSONSchema7 = {
      type: "object",
      minProperties: 2,
      maxProperties: 5
    };
    
    let capturedFields: any[] = [];
    mockBuilder.v = jest.fn((path, definition) => {
      capturedFields.push({ path, definition });
      return mockBuilder;
    });
    
    mockBuilder.fromJsonSchema(schema);
    
    // Root constraints (path === "") should be skipped in v() calls
    expect(capturedFields.every(f => f.path !== "")).toBe(true);
  });
});