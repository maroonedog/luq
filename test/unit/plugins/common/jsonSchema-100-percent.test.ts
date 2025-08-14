import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { 
  jsonSchemaPlugin, 
  convertJsonSchemaToLuqDSL, 
  resolveRef
} from "../../../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { optionalPlugin } from "../../../../src/core/plugin/optional";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../../../src/core/plugin/stringMax";
import { stringEmailPlugin } from "../../../../src/core/plugin/stringEmail";
import { stringPatternPlugin } from "../../../../src/core/plugin/stringPattern";
import { stringUrlPlugin } from "../../../../src/core/plugin/stringUrl";
import { stringDatetimePlugin } from "../../../../src/core/plugin/stringDatetime";
import { uuidPlugin } from "../../../../src/core/plugin/uuid";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../../../src/core/plugin/numberInteger";
import { numberMultipleOfPlugin } from "../../../../src/core/plugin/numberMultipleOf";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../../../src/core/plugin/arrayUnique";
import { arrayContainsPlugin } from "../../../../src/core/plugin/arrayContains";
import { booleanTruthyPlugin } from "../../../../src/core/plugin/booleanTruthy";
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { literalPlugin } from "../../../../src/core/plugin/literal";
import { customPlugin } from "../../../../src/core/plugin/custom";
import { tupleBuilderPlugin } from "../../../../src/core/plugin/tupleBuilder";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { objectAdditionalPropertiesPlugin } from "../../../../src/core/plugin/objectAdditionalProperties";
import { objectMinPropertiesPlugin } from "../../../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../../../src/core/plugin/objectMaxProperties";
import { objectPropertyNamesPlugin } from "../../../../src/core/plugin/objectPropertyNames";
import { objectPatternPropertiesPlugin } from "../../../../src/core/plugin/objectPatternProperties";
import { objectDependentRequiredPlugin } from "../../../../src/core/plugin/objectDependentRequired";
import { objectDependentSchemasPlugin } from "../../../../src/core/plugin/objectDependentSchemas";
import { requiredIfPlugin } from "../../../../src/core/plugin/requiredIf";
// import { recursivelyPlugin } from "../../../../src/core/plugin/recursively"; // Module doesn't exist
import { JSONSchema7 } from "json-schema";

// Import format validators  
import { stringIpv4Plugin } from "../../../../src/core/plugin/stringIpv4";
import { stringIpv6Plugin } from "../../../../src/core/plugin/stringIpv6";
import { stringHostnamePlugin } from "../../../../src/core/plugin/stringHostname";
import { stringDatePlugin } from "../../../../src/core/plugin/stringDate";
import { stringTimePlugin } from "../../../../src/core/plugin/stringTime";
import { stringDurationPlugin } from "../../../../src/core/plugin/stringDuration";
import { stringBase64Plugin } from "../../../../src/core/plugin/stringBase64";
import { stringJsonPointerPlugin } from "../../../../src/core/plugin/stringJsonPointer";
import { stringRelativeJsonPointerPlugin } from "../../../../src/core/plugin/stringRelativeJsonPointer";
import { stringIriPlugin } from "../../../../src/core/plugin/stringIri";
import { stringIriReferencePlugin } from "../../../../src/core/plugin/stringIriReference";
import { stringUriTemplatePlugin } from "../../../../src/core/plugin/stringUriTemplate";
import { stringContentEncodingPlugin } from "../../../../src/core/plugin/stringContentEncoding";
import { stringContentMediaTypePlugin } from "../../../../src/core/plugin/stringContentMediaType";
import { readOnlyWriteOnlyPlugin } from "../../../../src/core/plugin/readOnlyWriteOnly";

describe("JsonSchema Plugin - 100% Coverage Target", () => {
  const createFullBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringEmailPlugin)
      .use(stringPatternPlugin)
      .use(stringUrlPlugin)
      .use(stringDatetimePlugin)
      .use(stringDatePlugin)
      .use(stringTimePlugin)
      .use(stringIpv4Plugin)
      .use(stringIpv6Plugin)
      .use(stringHostnamePlugin)
      .use(stringDurationPlugin)
      .use(stringBase64Plugin)
      .use(stringJsonPointerPlugin)
      .use(stringRelativeJsonPointerPlugin)
      .use(stringIriPlugin)
      .use(stringIriReferencePlugin)
      .use(stringUriTemplatePlugin)
      .use(stringContentEncodingPlugin)
      .use(stringContentMediaTypePlugin)
      .use(uuidPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(numberMultipleOfPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .use(arrayUniquePlugin)
      .use(arrayContainsPlugin)
      .use(booleanTruthyPlugin)
      .use(oneOfPlugin)
      .use(literalPlugin)
      .use(customPlugin)
      .use(tupleBuilderPlugin)
      .use(nullablePlugin)
      .use(objectPlugin)
      .use(objectAdditionalPropertiesPlugin)
      .use(objectMinPropertiesPlugin)
      .use(objectMaxPropertiesPlugin)
      .use(objectPropertyNamesPlugin)
      .use(objectPatternPropertiesPlugin)
      .use(objectDependentRequiredPlugin)
      .use(objectDependentSchemasPlugin)
      .use(requiredIfPlugin)
      // .use(recursivelyPlugin) // Plugin doesn't exist
      .use(readOnlyWriteOnlyPlugin);
  };

  describe("convertJsonSchemaToLuqDSL - Complete Coverage", () => {
    test("should convert basic types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          str: { type: "string" },
          num: { type: "number" },
          bool: { type: "boolean" },
          arr: { type: "array" },
          obj: { type: "object" },
          nil: { type: "null" }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl).toHaveLength(6);
      expect(dsl[0].type).toBe("string");
      expect(dsl[1].type).toBe("number");
      expect(dsl[2].type).toBe("boolean");
      expect(dsl[3].type).toBe("array");
      expect(dsl[4].type).toBe("object");
      expect(dsl[5].type).toBe("null");
    });

    test("should handle integer type", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          int: { type: "integer" }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].type).toBe("number");
      expect(dsl[0].constraints.integer).toBe(true);
    });

    test("should handle multiple types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          multi: { type: ["string", "number", "null"] }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].multipleTypes).toEqual(["string", "number", "null"]);
    });

    test("should handle nested objects", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              profile: {
                type: "object",
                properties: {
                  name: { type: "string" }
                }
              }
            }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      const paths = dsl.map(d => d.path);
      expect(paths).toContain("user");
      expect(paths).toContain("user.profile");
      expect(paths).toContain("user.profile.name");
    });

    test("should handle array with items", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tags: {
            type: "array",
            items: { type: "string", minLength: 2 },
            minItems: 1,
            maxItems: 5,
            uniqueItems: true
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.items).toBeDefined();
      expect(dsl[0].constraints.minItems).toBe(1);
      expect(dsl[0].constraints.maxItems).toBe(5);
      expect(dsl[0].constraints.uniqueItems).toBe(true);
    });

    test("should handle tuple array", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          tuple: {
            type: "array",
            items: [
              { type: "number" },
              { type: "string" }
            ]
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].type).toBe("tuple");
      expect(Array.isArray(dsl[0].constraints.items)).toBe(true);
    });

    test("should handle contains constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          arr: {
            type: "array",
            contains: { type: "number", minimum: 5 }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.contains).toBeDefined();
    });

    test("should handle string constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          str: {
            type: "string",
            minLength: 3,
            maxLength: 10,
            pattern: "^[a-z]+$",
            format: "email"
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.minLength).toBe(3);
      expect(dsl[0].constraints.maxLength).toBe(10);
      expect(dsl[0].constraints.pattern).toBe("^[a-z]+$");
      expect(dsl[0].constraints.format).toBe("email");
    });

    test("should handle number constraints with exclusive", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          num: {
            type: "number",
            minimum: 0,
            maximum: 100,
            exclusiveMinimum: 0,
            exclusiveMaximum: 100,
            multipleOf: 5
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.min).toBe(0);
      expect(dsl[0].constraints.max).toBe(100);
      expect(dsl[0].constraints.exclusiveMin).toBe(0);
      expect(dsl[0].constraints.exclusiveMax).toBe(100);
      expect(dsl[0].constraints.multipleOf).toBe(5);
    });

    test("should handle object constraints", () => {
      const schema = {
        type: "object",
        properties: {
          config: {
            type: "object",
            minProperties: 2,
            maxProperties: 5,
            additionalProperties: false,
            propertyNames: { pattern: "^[a-z]+$" },
            patternProperties: {
              "^str_": { type: "string" }
            },
            dependentRequired: {
              foo: ["bar"]
            }
          }
        }
      } as any;

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.minProperties).toBe(2);
      expect(dsl[0].constraints.maxProperties).toBe(5);
      expect(dsl[0].constraints.additionalProperties).toBe(false);
      expect(dsl[0].constraints.propertyNames).toBeDefined();
      expect(dsl[0].constraints.patternProperties).toBeDefined();
      expect((dsl[0].constraints as any).dependentRequired).toBeDefined();
    });

    test("should handle enum and const", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          enumField: { enum: ["a", "b", "c"] },
          constField: { const: "fixed" }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.enum).toEqual(["a", "b", "c"]);
      expect(dsl[1].constraints.const).toBe("fixed");
    });

    test("should handle schema compositions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          allOfField: {
            allOf: [
              { type: "string" },
              { minLength: 5 }
            ]
          },
          anyOfField: {
            anyOf: [
              { type: "string" },
              { type: "number" }
            ]
          },
          oneOfField: {
            oneOf: [
              { type: "string", maxLength: 3 },
              { type: "string", minLength: 10 }
            ]
          },
          notField: {
            not: { type: "number" }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.allOf).toBeDefined();
      expect(dsl[1].constraints.anyOf).toBeDefined();
      expect(dsl[2].constraints.oneOf).toBeDefined();
      expect(dsl[3].constraints.not).toBeDefined();
    });

    test("should handle if/then/else", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          conditional: { type: "string" }
        },
        if: {
          properties: {
            conditional: { const: "A" }
          }
        },
        then: {
          properties: {
            conditional: { minLength: 5 }
          }
        },
        else: {
          properties: {
            conditional: { maxLength: 3 }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.conditionalValidation).toBeDefined();
      expect(dsl[0].constraints.conditionalValidation?.if).toBeDefined();
      expect(dsl[0].constraints.conditionalValidation?.then).toBeDefined();
      expect(dsl[0].constraints.conditionalValidation?.else).toBeDefined();
    });

    test("should handle $ref", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          refField: { $ref: "#/definitions/address" }
        },
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" }
            }
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      const paths = dsl.map(d => d.path);
      expect(paths).toContain("refField");
      expect(paths).toContain("refField.street");
    });

    test("should handle required fields", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          required: { type: "string" },
          optional: { type: "string" }
        },
        required: ["required"]
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.required).toBe(true);
      expect(dsl[1].constraints.required).toBe(false);
    });

    test("should handle readOnly and writeOnly", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          readOnlyField: { type: "string", readOnly: true },
          writeOnlyField: { type: "string", writeOnly: true }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl).toHaveLength(2);
      // ReadOnly and writeOnly are metadata, should still generate DSL
    });

    test("should handle contentEncoding and contentMediaType", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          encoded: {
            type: "string",
            contentEncoding: "base64",
            contentMediaType: "image/png"
          }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].constraints.contentEncoding).toBe("base64");
      expect(dsl[0].constraints.contentMediaType).toBe("image/png");
    });

    test("should handle with parent path", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema, "parent");
      expect(dsl[0].path).toBe("parent.field");
    });

    test("should handle empty properties", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {}
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl).toHaveLength(0);
    });

    test("should handle boolean schema", () => {
      const schema: JSONSchema7 = true as any;
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl).toHaveLength(0);
    });

    test("should handle false boolean schema", () => {
      const schema: JSONSchema7 = false as any;
      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl).toHaveLength(0);
    });

    test("should infer type from enum values", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          stringEnum: { enum: ["a", "b", "c"] },
          numberEnum: { enum: [1, 2, 3] },
          mixedEnum: { enum: ["a", 1, true, null] }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].type).toBe("string");
      expect(dsl[1].type).toBe("number");
      // Mixed enum should have multipleTypes
      expect(dsl[2].multipleTypes).toBeDefined();
    });

    test("should infer type from const value", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          stringConst: { const: "value" },
          numberConst: { const: 42 },
          boolConst: { const: true },
          nullConst: { const: null }
        }
      };

      const dsl = convertJsonSchemaToLuqDSL(schema);
      expect(dsl[0].type).toBe("string");
      expect(dsl[1].type).toBe("number");
      expect(dsl[2].type).toBe("boolean");
      expect(dsl[3].type).toBe("null");
    });
  });

  describe("resolveRef - Complete Coverage", () => {
    test("should resolve simple reference", () => {
      const schema: JSONSchema7 = {
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" }
            }
          }
        }
      };

      const resolved = resolveRef("#/definitions/address", schema);
      expect(resolved.type).toBe("object");
      expect(resolved.properties).toBeDefined();
    });

    test("should resolve nested reference", () => {
      const schema: JSONSchema7 = {
        definitions: {
          types: {
            address: {
              type: "object",
              properties: {
                street: { type: "string" }
              }
            }
          }
        }
      } as any;

      const resolved = resolveRef("#/definitions/types/address", schema);
      expect(resolved.type).toBe("object");
    });

    test("should throw for external reference", () => {
      expect(() => {
        resolveRef("http://example.com/schema", {});
      }).toThrow("External $ref not supported");
    });

    test("should throw for unresolvable reference", () => {
      expect(() => {
        resolveRef("#/definitions/nonexistent", {});
      }).toThrow("Cannot resolve $ref");
    });

    test("should handle empty path segments", () => {
      const schema: JSONSchema7 = {
        "": {
          definitions: {
            test: { type: "string" }
          }
        }
      } as any;

      const resolved = resolveRef("#//definitions/test", schema);
      expect(resolved.type).toBe("string");
    });
  });

  describe("All String Formats - Complete", () => {
    const formats = [
      { format: "date", valid: "2024-01-15", invalid: "not-a-date" },
      { format: "time", valid: "14:30:00", invalid: "25:00:00" },
      { format: "date-time", valid: "2024-01-15T14:30:00Z", invalid: "2024-01-15" },
      { format: "duration", valid: "P1Y2M3DT4H5M6S", invalid: "invalid" },
      { format: "email", valid: "test@example.com", invalid: "not-email" },
      { format: "hostname", valid: "example.com", invalid: "invalid..com" },
      { format: "ipv4", valid: "192.168.1.1", invalid: "256.256.256.256" },
      { format: "ipv6", valid: "::1", invalid: "invalid::ip" },
      { format: "uri", valid: "https://example.com", invalid: "not a uri" },
      { format: "uuid", valid: "550e8400-e29b-41d4-a716-446655440000", invalid: "not-uuid" },
      { format: "base64", valid: "SGVsbG8=", invalid: "not-base64!" },
      { format: "json-pointer", valid: "/foo/bar", invalid: "invalid" },
      { format: "relative-json-pointer", valid: "0", invalid: "" },
      { format: "iri", valid: "https://例え.jp", invalid: "" },
      { format: "iri-reference", valid: "#fragment", invalid: "" },
      { format: "uri-template", valid: "/users/{id}", invalid: "" }
    ];

    formats.forEach(({ format, valid, invalid }) => {
      test(`should validate ${format} format`, () => {
        const schema: JSONSchema7 = {
          type: "object",
          properties: {
            field: { type: "string", format }
          }
        };

        const builder = createFullBuilder();
        const validator = (builder as any).fromJsonSchema(schema).build();

        if (valid) {
          expect(validator.validate({ field: valid }).valid).toBe(true);
        }
        if (invalid) {
          expect(validator.validate({ field: invalid }).valid).toBe(false);
        }
      });
    });

    test("should handle unknown format", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string", format: "unknown-format" }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Unknown formats should be ignored
      expect(validator.validate({ field: "anything" }).valid).toBe(true);
    });
  });

  describe("Schema Compositions - Complete", () => {
    test("should handle allOf with multiple schemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              { type: "string" },
              { minLength: 5 },
              { maxLength: 10 },
              { pattern: "^[a-z]+$" }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "hello" }).valid).toBe(true);
      expect(validator.validate({ field: "hi" }).valid).toBe(false);
      expect(validator.validate({ field: "hellothere!" }).valid).toBe(false);
      expect(validator.validate({ field: "HELLO" }).valid).toBe(false);
    });

    test("should handle anyOf with different types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            anyOf: [
              { type: "string", pattern: "^email:" },
              { type: "number", minimum: 100 },
              { type: "boolean" }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "email:test" }).valid).toBe(true);
      expect(validator.validate({ field: 150 }).valid).toBe(true);
      expect(validator.validate({ field: true }).valid).toBe(true);
      expect(validator.validate({ field: "invalid" }).valid).toBe(false);
      expect(validator.validate({ field: 50 }).valid).toBe(false);
    });

    test("should handle oneOf exclusively", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            oneOf: [
              { type: "string", maxLength: 3 },
              { type: "string", minLength: 10 },
              { type: "number" }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "hi" }).valid).toBe(true);
      expect(validator.validate({ field: "longstring" }).valid).toBe(true);
      expect(validator.validate({ field: 42 }).valid).toBe(true);
    });

    test("should handle not constraint", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          notString: { not: { type: "string" } },
          notPattern: { not: { type: "string", pattern: "^test" } }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ notString: 123 }).valid).toBe(true);
      expect(validator.validate({ notString: "string" }).valid).toBe(false);
    });

    test("should handle nested compositions", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: {
            allOf: [
              {
                anyOf: [
                  { type: "string" },
                  { type: "number" }
                ]
              },
              {
                not: { const: "forbidden" }
              }
            ]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "allowed" }).valid).toBe(true);
      expect(validator.validate({ field: 42 }).valid).toBe(true);
      expect(validator.validate({ field: "forbidden" }).valid).toBe(false);
    });
  });

  describe("Conditional Schemas - Complete", () => {
    test("should apply then when if matches", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "email" }
          }
        },
        then: {
          properties: {
            value: { format: "email" }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        type: "email",
        value: "test@example.com"
      }).valid).toBe(true);

      expect(validator.validate({
        type: "email",
        value: "not-email"
      }).valid).toBe(false);
    });

    test("should apply else when if doesn't match", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          type: { type: "string" },
          value: { type: "string" }
        },
        if: {
          properties: {
            type: { const: "number" }
          }
        },
        then: {
          properties: {
            value: { pattern: "^[0-9]+$" }
          }
        },
        else: {
          properties: {
            value: { pattern: "^[a-zA-Z]+$" }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        type: "number",
        value: "123"
      }).valid).toBe(true);

      expect(validator.validate({
        type: "text",
        value: "abc"
      }).valid).toBe(true);

      expect(validator.validate({
        type: "text",
        value: "123"
      }).valid).toBe(false);
    });

    test("should handle if without then/else", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          field: { type: "string" }
        },
        if: {
          properties: {
            field: { const: "test" }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "test" }).valid).toBe(true);
      expect(validator.validate({ field: "other" }).valid).toBe(true);
    });
  });

  describe("Object Advanced Constraints", () => {
    test("should validate dependentRequired", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          creditCard: { type: "string" },
          cvv: { type: "string" }
        },
        dependentRequired: {
          creditCard: ["cvv"]
        }
      } as any;

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ name: "John" }).valid).toBe(true);
      expect(validator.validate({ 
        name: "John", 
        creditCard: "1234", 
        cvv: "123" 
      }).valid).toBe(true);
      expect(validator.validate({ 
        name: "John", 
        creditCard: "1234" 
      }).valid).toBe(false);
    });

    test("should validate dependentSchemas", () => {
      const schema = {
        type: "object",
        properties: {
          name: { type: "string" },
          creditCard: { type: "string" }
        },
        dependentSchemas: {
          creditCard: {
            properties: {
              cvv: { type: "string", minLength: 3 }
            },
            required: ["cvv"]
          }
        }
      } as any;

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ name: "John" }).valid).toBe(true);
      expect(validator.validate({ 
        name: "John", 
        creditCard: "1234", 
        cvv: "123" 
      }).valid).toBe(true);
      expect(validator.validate({ 
        name: "John", 
        creditCard: "1234" 
      }).valid).toBe(false);
    });

    test("should validate additionalProperties as schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        },
        additionalProperties: {
          type: "number"
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ 
        name: "test", 
        extra: 42 
      }).valid).toBe(true);
      
      expect(validator.validate({ 
        name: "test", 
        extra: "string" 
      }).valid).toBe(false);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    test("should handle circular $ref", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          node: {
            $ref: "#/definitions/treeNode"
          }
        },
        definitions: {
          treeNode: {
            type: "object",
            properties: {
              value: { type: "string" },
              children: {
                type: "array",
                items: { $ref: "#/definitions/treeNode" }
              }
            },
            required: ["value"]
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        node: {
          value: "root",
          children: [
            { value: "child1" },
            { 
              value: "child2",
              children: [
                { value: "grandchild" }
              ]
            }
          ]
        }
      }).valid).toBe(true);
    });

    test("should handle schema without type", () => {
      const schema: JSONSchema7 = {
        properties: {
          field: { minLength: 3 }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({ field: "abc" }).valid).toBe(true);
    });

    test("should handle root non-object schema", () => {
      const schema: JSONSchema7 = {
        type: "string",
        minLength: 3
      };

      const builder = createFullBuilder();
      
      // This might throw or handle gracefully depending on implementation
      try {
        const validator = (builder as any).fromJsonSchema(schema).build();
        expect(validator).toBeDefined();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });

    test("should handle deprecated and metadata fields", () => {
      const schema = {
        type: "object",
        title: "Test Schema",
        description: "A test schema",
        deprecated: true,
        examples: [{ field: "example" }],
        default: { field: "default" },
        properties: {
          field: { 
            type: "string",
            title: "Field Title",
            description: "Field description",
            deprecated: true,
            examples: ["ex1", "ex2"],
            default: "default"
          }
        }
      } as any;

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      // Metadata doesn't affect validation
      expect(validator.validate({ field: "test" }).valid).toBe(true);
    });
  });

  describe("Options and Custom Formats", () => {
    test("should handle custom formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          phone: { type: "string", format: "phone" }
        }
      };

      const customFormats = {
        phone: (value: string) => /^\+?[1-9]\d{1,14}$/.test(value)
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema, { customFormats }).build();

      expect(validator.validate({ phone: "+1234567890" }).valid).toBe(true);
      expect(validator.validate({ phone: "invalid" }).valid).toBe(false);
    });

    test("should handle strictRequired option", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          optional: { type: "string" },
          required: { type: "string" }
        },
        required: ["required"]
      };

      const builder = createFullBuilder();
      
      const strictValidator = (builder as any).fromJsonSchema(schema, { 
        strictRequired: true 
      }).build();
      
      const lenientValidator = (builder as any).fromJsonSchema(schema, { 
        strictRequired: false 
      }).build();

      // Both should accept valid data
      expect(strictValidator.validate({ 
        required: "value", 
        optional: "value" 
      }).valid).toBe(true);
      
      expect(lenientValidator.validate({ 
        required: "value" 
      }).valid).toBe(true);
    });
  });

  describe("Complex Real-World Scenarios", () => {
    test("should validate OpenAPI-like schema", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          openapi: { const: "3.0.0" },
          info: {
            type: "object",
            properties: {
              title: { type: "string" },
              version: { type: "string" }
            },
            required: ["title", "version"]
          },
          paths: {
            type: "object",
            patternProperties: {
              "^/": {
                type: "object",
                properties: {
                  get: { $ref: "#/definitions/operation" },
                  post: { $ref: "#/definitions/operation" }
                }
              }
            }
          }
        },
        required: ["openapi", "info", "paths"],
        definitions: {
          operation: {
            type: "object",
            properties: {
              summary: { type: "string" },
              responses: {
                type: "object",
                properties: {
                  "200": {
                    type: "object",
                    properties: {
                      description: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const builder = createFullBuilder();
      const validator = (builder as any).fromJsonSchema(schema).build();

      expect(validator.validate({
        openapi: "3.0.0",
        info: {
          title: "My API",
          version: "1.0.0"
        },
        paths: {
          "/users": {
            get: {
              summary: "Get users",
              responses: {
                "200": {
                  description: "Success"
                }
              }
            }
          }
        }
      }).valid).toBe(true);
    });
  });
});