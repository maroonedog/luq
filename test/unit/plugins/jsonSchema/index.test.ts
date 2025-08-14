import * as jsonSchemaExports from "../../../../src/core/plugin/jsonSchema/index";

describe("JsonSchema index exports", () => {
  test("should export jsonSchemaPlugin", () => {
    expect(jsonSchemaExports.jsonSchemaPlugin).toBeDefined();
    expect(jsonSchemaExports.jsonSchemaPlugin.name).toBe("jsonSchema");
    expect(jsonSchemaExports.jsonSchemaPlugin.category).toBe("builder-extension");
  });

  // jsonSchemaFullFeaturePlugin is not exported from index

  test("should export all validation functions", () => {
    expect(typeof jsonSchemaExports.validateValueAgainstSchema).toBe("function");
    expect(typeof jsonSchemaExports.getDetailedValidationErrors).toBe("function");
    expect(typeof jsonSchemaExports.getSpecificValidationErrors).toBe("function");
  });

  test("should export DSL conversion functions", () => {
    expect(typeof jsonSchemaExports.convertJsonSchemaToLuqDSL).toBe("function");
    expect(typeof jsonSchemaExports.convertDSLToFieldDefinition).toBe("function");
  });

  test("should export ref resolver", () => {
    expect(typeof jsonSchemaExports.resolveRef).toBe("function");
  });

  test("should export types", () => {
    // Types are not available at runtime, but we can check if the exports object has the expected shape
    const expectedExports = [
      'jsonSchemaPlugin',
      'validateValueAgainstSchema',
      'getDetailedValidationErrors',
      'getSpecificValidationErrors',
      'convertJsonSchemaToLuqDSL',
      'convertDSLToFieldDefinition',
      'resolveRef'
    ];
    
    const actualExports = Object.keys(jsonSchemaExports);
    
    expectedExports.forEach(exportName => {
      expect(actualExports).toContain(exportName);
    });
  });

  test("should have all exported functions be callable", () => {
    // Test that functions can be called without throwing
    
    // validateValueAgainstSchema
    expect(() => {
      jsonSchemaExports.validateValueAgainstSchema("test", { type: "string" });
    }).not.toThrow();
    
    // getDetailedValidationErrors
    expect(() => {
      jsonSchemaExports.getDetailedValidationErrors("test", { type: "string" });
    }).not.toThrow();
    
    // getSpecificValidationErrors
    expect(() => {
      jsonSchemaExports.getSpecificValidationErrors({ test: "value" }, { type: "object" }, "test");
    }).not.toThrow();
    
    // convertJsonSchemaToLuqDSL
    expect(() => {
      jsonSchemaExports.convertJsonSchemaToLuqDSL({ type: "string" });
    }).not.toThrow();
    
    // convertDSLToFieldDefinition
    expect(() => {
      const dsl = {
        path: "test",
        type: "string" as const,
        constraints: {}
      };
      jsonSchemaExports.convertDSLToFieldDefinition(dsl);
    }).not.toThrow();
    
    // resolveRef
    expect(() => {
      jsonSchemaExports.resolveRef("#/definitions/test", { 
        definitions: { 
          test: { type: "string" } 
        } 
      });
    }).not.toThrow();
  });
});