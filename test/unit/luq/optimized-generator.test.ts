/**
 * @jest-environment node
 */

import { LuqOptimizedGenerator, GeneratorConfig } from "../../../src/luq/optimized-generator";
import { LuqAst, LuqInterface, LuqField, LuqAnnotation } from "../../../src/luq/parser";

describe("LuqOptimizedGenerator", () => {
  let generator: LuqOptimizedGenerator;

  beforeEach(() => {
    generator = new LuqOptimizedGenerator();
  });

  describe("constructor", () => {
    it("should create generator with default config", () => {
      const gen = new LuqOptimizedGenerator();
      expect(gen).toBeInstanceOf(LuqOptimizedGenerator);
    });

    it("should create generator with custom config", () => {
      const config: GeneratorConfig = { usePresets: true };
      const gen = new LuqOptimizedGenerator(config);
      expect(gen).toBeInstanceOf(LuqOptimizedGenerator);
    });
  });

  describe("generate", () => {
    it("should generate basic validator for simple interface", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('import { Builder } from "luq/core"');
      expect(result).toContain('import { requiredPlugin } from "luq/plugins/requiredPlugin"');
      expect(result).toContain('import { numberPositivePlugin } from "luq/plugins/numberPositivePlugin"');
      expect(result).toContain("// Validator for User");
      expect(result).toContain("const userBuilder = Builder()");
      expect(result).toContain(".use(requiredPlugin)");
      expect(result).toContain(".use(numberPositivePlugin)");
      expect(result).toContain(".for<User>();");
      expect(result).toContain('export const userValidator = userBuilder');
      expect(result).toContain('.v("name", (b) => b.string.required())');
      expect(result).toContain('.v("age", (b) => b.number.positive())');
      expect(result).toContain(".build();");
      expect(result).toContain("export type User = {");
      expect(result).toContain("  name: string;");
      expect(result).toContain("  age: number;");
      expect(result).toContain("};");
    });

    it("should generate validator with optional fields", () => {
      const ast: LuqAst = {
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
      const ast: LuqAst = {
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

      expect(result).toContain('.v("name", (b) => b.string.required().min(3).max(50))');
      expect(result).toContain('.v("category", (b) => b.string.oneOf("electronics", "books", "clothing"))');
    });

    it("should generate imports only for used plugins", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('import { stringEmailPlugin } from "luq/plugins/stringEmailPlugin"');
      expect(result).not.toContain("requiredPlugin");
      expect(result).not.toContain("numberPositivePlugin");
    });

    it("should generate multiple interface validators", () => {
      const ast: LuqAst = {
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
      const ast: LuqAst = {
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

      expect(result).toContain('import { Builder } from "luq/core"');
      expect(result).toContain('.v("name", (b) => b.string)');
      expect(result).not.toContain('Plugin } from');
      expect(result).not.toContain(".use(");
    });

    it("should handle empty interface", () => {
      const ast: LuqAst = {
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
      const ast: LuqAst = {
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

      expect(result).toContain('.v("range", (b) => b.number.between(1, 100))');
      expect(result).toContain('.v("choices", (b) => b.string.oneOf("option1", "option2", "option3"))');
    });

    it("should escape string parameters correctly", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('.v("pattern", (b) => b.string.pattern("^[a-zA-Z]+$"))');
      expect(result).toContain('.v("equals", (b) => b.string.equals("test value"))');
    });

    it("should handle mixed parameter types", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('.v("field", (b) => b.any.custom(42, "string", true))');
    });

    it("should use luq-specific import paths", () => {
      const ast: LuqAst = {
        interfaces: [
          {
            name: "LuqSpecific",
            fields: [
              {
                name: "field",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain('import { Builder } from "luq/core"');
      expect(result).toContain('import { requiredPlugin } from "luq/plugins/requiredPlugin"');
      expect(result).not.toContain("formtailor");
    });
  });

  describe("plugin name mapping", () => {
    it("should map common annotation names to plugin names", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('import { requiredPlugin } from "luq/plugins/requiredPlugin"');
      expect(result).toContain('import { optionalPlugin } from "luq/plugins/optionalPlugin"');
      expect(result).toContain('import { stringEmailPlugin } from "luq/plugins/stringEmailPlugin"');
    });

    it("should handle unknown annotation names", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('import { customValidationPlugin } from "luq/plugins/customValidationPlugin"');
      expect(result).toContain(".use(customValidationPlugin)");
      expect(result).toContain("b.string.customValidation()");
    });

    it("should map all known plugin types correctly", () => {
      const pluginMappings = [
        { annotation: "required", plugin: "requiredPlugin" },
        { annotation: "optional", plugin: "optionalPlugin" },
        { annotation: "min", plugin: "stringMinPlugin" },
        { annotation: "max", plugin: "stringMaxPlugin" },
        { annotation: "email", plugin: "stringEmailPlugin" },
        { annotation: "url", plugin: "stringUrlPlugin" },
        { annotation: "positive", plugin: "numberPositivePlugin" },
        { annotation: "negative", plugin: "numberNegativePlugin" },
        { annotation: "integer", plugin: "numberIntegerPlugin" },
        { annotation: "finite", plugin: "numberFinitePlugin" },
        { annotation: "minLength", plugin: "arrayMinLengthPlugin" },
        { annotation: "maxLength", plugin: "arrayMaxLengthPlugin" },
        { annotation: "unique", plugin: "arrayUniquePlugin" },
        { annotation: "includes", plugin: "arrayIncludesPlugin" },
        { annotation: "truthy", plugin: "booleanTruthyPlugin" },
        { annotation: "falsy", plugin: "booleanFalsyPlugin" },
        { annotation: "pattern", plugin: "stringPatternPlugin" },
        { annotation: "startsWith", plugin: "stringStartsWithPlugin" },
        { annotation: "endsWith", plugin: "stringEndsWithPlugin" },
        { annotation: "alphanumeric", plugin: "stringAlphanumericPlugin" },
        { annotation: "nullable", plugin: "nullablePlugin" },
        { annotation: "oneOf", plugin: "oneOfPlugin" },
        { annotation: "equals", plugin: "literalPlugin" },
        { annotation: "compareField", plugin: "compareFieldPlugin" },
        { annotation: "literal", plugin: "literalPlugin" },
        { annotation: "transform", plugin: "transformPlugin" },
        { annotation: "skip", plugin: "skipPlugin" },
        { annotation: "validateIf", plugin: "validateIfPlugin" },
        { annotation: "requiredIf", plugin: "requiredIfPlugin" },
        { annotation: "optionalIf", plugin: "optionalIfPlugin" },
      ];

      const ast: LuqAst = {
        interfaces: [
          {
            name: "AllPlugins",
            fields: pluginMappings.map((mapping, index) => ({
              name: `field${index}`,
              type: "string",
              optional: false,
              annotations: [{ name: mapping.annotation }],
            })),
          },
        ],
      };

      const result = generator.generate(ast);

      // Check that all plugins are imported correctly
      for (const mapping of pluginMappings) {
        expect(result).toContain(`import { ${mapping.plugin} } from "luq/plugins/${mapping.plugin}"`);
        expect(result).toContain(`.use(${mapping.plugin})`);
      }
    });
  });

  describe("edge cases", () => {
    it("should handle AST with no interfaces", () => {
      const ast: LuqAst = {
        interfaces: [],
      };

      const result = generator.generate(ast);

      expect(result).toBe('import { Builder } from "luq/core";\n');
    });

    it("should handle interface with complex field names", () => {
      const ast: LuqAst = {
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

      expect(result).toContain('.v("field_with_underscore", (b) => b.string.required())');
      expect(result).toContain('.v("fieldWithCamelCase", (b) => b.number.positive())');
      expect(result).toContain("field_with_underscore: string;");
      expect(result).toContain("fieldWithCamelCase?: number;");
    });

    it("should handle annotations without parameters consistently", () => {
      const ast: LuqAst = {
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
      const ast: LuqAst = {
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

    it("should handle various TypeScript primitive types", () => {
      const ast: LuqAst = {
        interfaces: [
          {
            name: "TypeTest",
            fields: [
              {
                name: "stringField",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "numberField",
                type: "number",
                optional: false,
                annotations: [{ name: "positive" }],
              },
              {
                name: "booleanField",
                type: "boolean",
                optional: false,
                annotations: [{ name: "truthy" }],
              },
              {
                name: "anyField",
                type: "any",
                optional: true,
                annotations: [],
              },
              {
                name: "arrayField",
                type: "array",
                optional: false,
                annotations: [{ name: "minLength", params: [1] }],
              },
              {
                name: "objectField",
                type: "object",
                optional: true,
                annotations: [{ name: "nullable" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      expect(result).toContain("b.string.required()");
      expect(result).toContain("b.number.positive()");
      expect(result).toContain("b.boolean.truthy()");
      expect(result).toContain("b.any");
      expect(result).toContain("b.array.minLength(1)");
      expect(result).toContain("b.object.nullable()");

      expect(result).toContain("stringField: string;");
      expect(result).toContain("numberField: number;");
      expect(result).toContain("booleanField: boolean;");
      expect(result).toContain("anyField?: any;");
      expect(result).toContain("arrayField: array;");
      expect(result).toContain("objectField?: object;");
    });

    it("should maintain proper code structure and formatting", () => {
      const ast: LuqAst = {
        interfaces: [
          {
            name: "WellFormatted",
            fields: [
              {
                name: "field1",
                type: "string",
                optional: false,
                annotations: [{ name: "required" }],
              },
              {
                name: "field2",
                type: "number",
                optional: true,
                annotations: [{ name: "positive" }],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      // Check for proper structure
      expect(result).toMatch(/import.*\n\n\/\/ Validator for WellFormatted/);
      expect(result).toMatch(/const wellformattedBuilder = Builder\(\)\s*\n\s*\.use/);
      expect(result).toMatch(/export const wellformattedValidator = wellformattedBuilder\s*\n\s*\.v/);
      expect(result).toMatch(/\.build\(\);\s*\n\s*\nexport type WellFormatted = \{/);
    });
  });

  describe("integration scenarios", () => {
    it("should generate complex real-world validator", () => {
      const ast: LuqAst = {
        interfaces: [
          {
            name: "UserRegistration",
            fields: [
              {
                name: "email",
                type: "string",
                optional: false,
                annotations: [
                  { name: "required" },
                  { name: "email" },
                  { name: "max", params: [100] },
                ],
              },
              {
                name: "password",
                type: "string",
                optional: false,
                annotations: [
                  { name: "required" },
                  { name: "min", params: [8] },
                  { name: "pattern", params: ["^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"] },
                ],
              },
              {
                name: "age",
                type: "number",
                optional: true,
                annotations: [
                  { name: "positive" },
                  { name: "max", params: [120] },
                ],
              },
              {
                name: "terms",
                type: "boolean",
                optional: false,
                annotations: [
                  { name: "required" },
                  { name: "truthy" },
                ],
              },
            ],
          },
        ],
      };

      const result = generator.generate(ast);

      // Should include all necessary imports
      expect(result).toContain('import { Builder } from "luq/core"');
      expect(result).toContain('import { requiredPlugin }');
      expect(result).toContain('import { stringEmailPlugin }');
      expect(result).toContain('import { stringMaxPlugin }');
      expect(result).toContain('import { stringMinPlugin }');
      expect(result).toContain('import { stringPatternPlugin }');
      expect(result).toContain('import { numberPositivePlugin }');
      expect(result).toContain('import { booleanTruthyPlugin }');

      // Should generate proper field validations
      expect(result).toContain('.v("email", (b) => b.string.required().email().max(100))');
      expect(result).toContain('.v("password", (b) => b.string.required().min(8).pattern("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)"))');
      expect(result).toContain('.v("age", (b) => b.number.positive().max(120))');
      expect(result).toContain('.v("terms", (b) => b.boolean.required().truthy())');

      // Should generate proper TypeScript types
      expect(result).toContain("export type UserRegistration = {");
      expect(result).toContain("  email: string;");
      expect(result).toContain("  password: string;");
      expect(result).toContain("  age?: number;");
      expect(result).toContain("  terms: boolean;");
      expect(result).toContain("};");
    });
  });
});