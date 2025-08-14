/**
 * @jest-environment node
 */

import { FtvOptimizedGenerator, GeneratorConfig } from "../../../src/ftv/optimized-generator";
import { FtvAst, FtvInterface, FtvField, FtvAnnotation } from "../../../src/ftv/parser";

describe("FtvOptimizedGenerator", () => {
  let generator: FtvOptimizedGenerator;

  beforeEach(() => {
    generator = new FtvOptimizedGenerator();
  });

  describe("constructor", () => {
    it("should create generator with default config", () => {
      const gen = new FtvOptimizedGenerator();
      expect(gen).toBeInstanceOf(FtvOptimizedGenerator);
    });

    it("should create generator with custom config", () => {
      const config: GeneratorConfig = { usePresets: true };
      const gen = new FtvOptimizedGenerator(config);
      expect(gen).toBeInstanceOf(FtvOptimizedGenerator);
    });
  });

  describe("generate", () => {
    it("should generate basic validator for simple interface", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "User",
            fields: [
              {
                name: "name",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "age",
                type: "number",
                optional: false,
                annotations: [{ name: "positive" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { Builder } from "formtailor/core"');
      expect(result).toContain('import { requiredPlugin } from "formtailor/plugins/requiredPlugin"');
      expect(result).toContain('import { numberPositivePlugin } from "formtailor/plugins/numberPositivePlugin"');
      expect(result).toContain("// Validator for User");
      expect(result).toContain("const userBuilder = Builder()");
      expect(result).toContain(".use(requiredPlugin)");
      expect(result).toContain(".use(numberPositivePlugin)");
      expect(result).toContain(".for<User>();");
      expect(result).toContain('export const userValidator = userBuilder');
      expect(result).toContain('.field("name", (b) => b.string.required())');
      expect(result).toContain('.field("age", (b) => b.number.positive())');
      expect(result).toContain(".build();");
      expect(result).toContain("export type User = {");
      expect(result).toContain("  name: string;");
      expect(result).toContain("  age: number;");
      expect(result).toContain("};");
    });

    it("should generate validator with optional fields", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Profile",
            fields: [
              {
                name: "id",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "bio",
                type: "string",
                optional: true,
                annotations: [{ name: "optional" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("export type Profile = {");
      expect(result).toContain("  id: string;");
      expect(result).toContain("  bio?: string;");
      expect(result).toContain("};");
    });

    it("should generate validator with annotations with parameters", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Product",
            fields: [
              {
                name: "name",
                type: "string",
                optional: false,
                annotations: [
                  { name: "required" },
                  { name: "min", params: [3] },
                  { name: "max", params: [50] },
                ],
              },
              {
                name: "category",
                type: "string",
                optional: false,
                annotations: [
                  { name: "oneOf", params: ["electronics", "books", "clothing"] },
                ],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('.field("name", (b) => b.string.required().min(3).max(50))');
      expect(result).toContain('.field("category", (b) => b.string.oneOf("electronics", "books", "clothing"))');
    });

    it("should generate imports only for used plugins", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Simple",
            fields: [
              {
                name: "email",
                type: "string",
                optional: false,
                annotations: [{ name: "email" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { stringEmailPlugin } from "formtailor/plugins/stringEmailPlugin"');
      expect(result).not.toContain("requiredPlugin");
      expect(result).not.toContain("numberPositivePlugin");
    });

    it("should generate multiple interface validators", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "User",
            fields: [
              {
                name: "name",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
            ],
          },
          {
            name: "Product",
            fields: [
              {
                name: "price",
                type: "number",
                optional: false,
                annotations: [{ name: "positive" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("// Validator for User");
      expect(result).toContain("const userBuilder = Builder()");
      expect(result).toContain("export const userValidator = userBuilder");
      expect(result).toContain("export type User = {");

      expect(result).toContain("// Validator for Product");
      expect(result).toContain("const productBuilder = Builder()");
      expect(result).toContain("export const productValidator = productBuilder");
      expect(result).toContain("export type Product = {");
    });

    it("should handle interface with no annotations", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Simple",
            fields: [
              {
                name: "name",
                type: "string",
                optional: false,
                annotations: [],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { Builder } from "formtailor/core"');
      expect(result).toContain('.field("name", (b) => b.string)');
      expect(result).not.toContain("Plugin");
      expect(result).not.toContain(".use(");
    });

    it("should handle empty interface", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Empty",
            fields: [],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("// Validator for Empty");
      expect(result).toContain("const emptyBuilder = Builder()");
      expect(result).toContain(".for<Empty>();");
      expect(result).toContain("export const emptyValidator = emptyBuilder");
      expect(result).toContain(".build();");
      expect(result).toContain("export type Empty = {");
      expect(result).toContain("};");
    });

    it("should handle complex annotations with multiple parameters", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Complex",
            fields: [
              {
                name: "range",
                type: "number",
                optional: false,
                annotations: [
                  { name: "between", params: [1, 100] },
                ],
              },
              {
                name: "choices",
                type: "string",
                optional: false,
                annotations: [
                  { name: "oneOf", params: ["option1", "option2", "option3"] },
                ],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('.field("range", (b) => b.number.between(1, 100))');
      expect(result).toContain('.field("choices", (b) => b.string.oneOf("option1", "option2", "option3"))');
    });

    it("should escape string parameters correctly", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "StringEscape",
            fields: [
              {
                name: "pattern",
                type: "string",
                optional: false,
                annotations: [
                  { name: "pattern", params: ["^[a-zA-Z]+$"] },
                ],
              },
              {
                name: "equals",
                type: "string",
                optional: false,
                annotations: [
                  { name: "equals", params: ["test value"] },
                ],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('.field("pattern", (b) => b.string.pattern("^[a-zA-Z]+$"))');
      expect(result).toContain('.field("equals", (b) => b.string.equals("test value"))');
    });

    it("should handle mixed parameter types", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Mixed",
            fields: [
              {
                name: "field",
                type: "any",
                optional: false,
                annotations: [
                  { name: "custom", params: [42, "string", true] },
                ],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('.field("field", (b) => b.any.custom(42, "string", true))');
    });
  });

  describe("plugin name mapping", () => {
    it("should map common annotation names to plugin names", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Mapping",
            fields: [
              {
                name: "field1",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "field2",
                type: "string",
                optional: true,
                annotations: [{ name: "optional" }],
              },
              {
                name: "field3",
                type: "string",
                optional: false,
                annotations: [{ name: "email" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { requiredPlugin } from "formtailor/plugins/requiredPlugin"');
      expect(result).toContain('import { optionalPlugin } from "formtailor/plugins/optionalPlugin"');
      expect(result).toContain('import { stringEmailPlugin } from "formtailor/plugins/stringEmailPlugin"');
    });

    it("should handle unknown annotation names", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "Unknown",
            fields: [
              {
                name: "field",
                type: "string",
                optional: false,
                annotations: [{ name: "customValidation" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { customValidationPlugin } from "formtailor/plugins/customValidationPlugin"');
      expect(result).toContain(".use(customValidationPlugin)");
      expect(result).toContain("b.string.customValidation()");
    });
  });

  describe("edge cases", () => {
    it("should handle AST with no interfaces", () => {
      const ast: FtvAst = {
        interfaces: [],
      };

      const result = generator.generate(ast);

      expect(result).toBe('import { Builder } from "formtailor/core";\n');
    });

    it("should handle interface with complex field names", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "ComplexNames",
            fields: [
              {
                name: "field_with_underscore",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "fieldWithCamelCase",
                type: "number",
                optional: true,
                annotations: [{ name: "positive" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('.field("field_with_underscore", (b) => b.string.required())');
      expect(result).toContain('.field("fieldWithCamelCase", (b) => b.number.positive())');
      expect(result).toContain("field_with_underscore: string;");
      expect(result).toContain("fieldWithCamelCase?: number;");
    });

    it("should handle annotations without parameters consistently", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "NoParams",
            fields: [
              {
                name: "field1",
                type: "string",
                optional: false,
                annotations: [{ name: "required", params: undefined }],
              },
              {
                name: "field2",
                type: "string",
                optional: false,
                annotations: [{ name: "email", params: [] }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("b.string.required()");
      expect(result).toContain("b.string.email()");
    });

    it("should generate unique builder and validator names for different interfaces", () => {
      const ast: FtvAst = {
        interfaces: [
          {
            name: "UserProfile",
            fields: [
              {
                name: "name",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
            ],
          },
          {
            name: "AdminSettings",
            fields: [
              {
                name: "level",
                type: "number",
                optional: false,
                annotations: [{ name: "positive" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("const userprofileBuilder = Builder()");
      expect(result).toContain("export const userprofileValidator = userprofileBuilder");
      expect(result).toContain("const adminsettingsBuilder = Builder()");
      expect(result).toContain("export const adminsettingsValidator = adminsettingsBuilder");
    });

    it("should handle all mapped plugin types", () => {
      const annotations = [
        "required", "optional", "min", "max", "email", "url",
        "positive", "negative", "integer", "finite",
        "minLength", "maxLength", "unique", "includes",
        "truthy", "falsy", "pattern", "startsWith", "endsWith",
        "alphanumeric", "nullable", "oneOf", "equals",
        "compareField", "literal", "transform", "skip",
        "validateIf", "requiredIf", "optionalIf"
      ];

      const ast: FtvAst = {
        interfaces: [
          {
            name: "AllPlugins",
            fields: annotations.map((annotation, index) => ({
              name: `field${index}`,
              type: "string",
              optional: false,
              annotations: [{ name: annotation }],
            })),
          },
        ],
      };

      const result = generator.generate(ast);

      // Should import all plugin types
      expect(result).toContain("requiredPlugin");
      expect(result).toContain("optionalPlugin");
      expect(result).toContain("stringEmailPlugin");
      expect(result).toContain("numberPositivePlugin");
      expect(result).toContain("arrayMinLengthPlugin");
      expect(result).toContain("booleanTruthyPlugin");
      expect(result).toContain("stringPatternPlugin");
      expect(result).toContain("nullablePlugin");
      expect(result).toContain("oneOfPlugin");
      expect(result).toContain("compareFieldPlugin");
      expect(result).toContain("literalPlugin");
      expect(result).toContain("transformPlugin");
      expect(result).toContain("skipPlugin");
      expect(result).toContain("validateIfPlugin");
      expect(result).toContain("requiredIfPlugin");
      expect(result).toContain("optionalIfPlugin");
    });
  });
});