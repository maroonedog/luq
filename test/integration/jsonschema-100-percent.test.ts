import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { jsonSchemaPlugin } from "../../src/core/plugin/jsonSchema";
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { stringUrlPlugin } from "../../src/core/plugin/stringUrl";
import { uuidPlugin } from "../../src/core/plugin/uuid";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { numberIntegerPlugin } from "../../src/core/plugin/numberInteger";
import { numberMultipleOfPlugin } from "../../src/core/plugin/numberMultipleOf";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../src/core/plugin/arrayUnique";
import { arrayContainsPlugin } from "../../src/core/plugin/arrayContains";
import { objectMinPropertiesPlugin } from "../../src/core/plugin/objectMinProperties";
import { objectMaxPropertiesPlugin } from "../../src/core/plugin/objectMaxProperties";
import { objectAdditionalPropertiesPlugin } from "../../src/core/plugin/objectAdditionalProperties";
import { objectPropertyNamesPlugin } from "../../src/core/plugin/objectPropertyNames";
import { objectPatternPropertiesPlugin } from "../../src/core/plugin/objectPatternProperties";
import { objectDependentRequiredPlugin } from "../../src/core/plugin/objectDependentRequired";
import { objectDependentSchemasPlugin } from "../../src/core/plugin/objectDependentSchemas";
import { readOnlyWriteOnlyPlugin } from "../../src/core/plugin/readOnlyWriteOnly";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { literalPlugin } from "../../src/core/plugin/literal";
import { customPlugin } from "../../src/core/plugin/custom";
import { requiredIfPlugin } from "../../src/core/plugin/requiredIf";
import { tupleBuilderPlugin } from "../../src/core/plugin/tupleBuilder";
import { nullablePlugin } from "../../src/core/plugin/nullable";

// Import all format validators
import { stringIpv4Plugin } from "../../src/core/plugin/stringIpv4";
import { stringIpv6Plugin } from "../../src/core/plugin/stringIpv6";
import { stringHostnamePlugin } from "../../src/core/plugin/stringHostname";
import { stringTimePlugin } from "../../src/core/plugin/stringTime";
import { stringDurationPlugin } from "../../src/core/plugin/stringDuration";
import { stringJsonPointerPlugin } from "../../src/core/plugin/stringJsonPointer";
import { stringBase64Plugin } from "../../src/core/plugin/stringBase64";
import { stringIriPlugin } from "../../src/core/plugin/stringIri";
import { stringIriReferencePlugin } from "../../src/core/plugin/stringIriReference";
import { stringUriTemplatePlugin } from "../../src/core/plugin/stringUriTemplate";
import { stringRelativeJsonPointerPlugin } from "../../src/core/plugin/stringRelativeJsonPointer";
import { stringContentEncodingPlugin } from "../../src/core/plugin/stringContentEncoding";

import type { JSONSchema7 } from "json-schema";

describe("JSON Schema 100% Support", () => {
  // Create a builder with all necessary plugins
  const createFullBuilder = () => {
    return Builder()
      .use(jsonSchemaPlugin)
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringPatternPlugin)
      .use(stringEmailPlugin)
      .use(stringUrlPlugin)
      .use(uuidPlugin)
      .use(numberMinPlugin)
      .use(numberMaxPlugin)
      .use(numberIntegerPlugin)
      .use(numberMultipleOfPlugin)
      .use(arrayMinLengthPlugin)
      .use(arrayMaxLengthPlugin)
      .use(arrayUniquePlugin)
      .use(arrayContainsPlugin)
      .use(objectMinPropertiesPlugin)
      .use(objectMaxPropertiesPlugin)
      .use(objectAdditionalPropertiesPlugin)
      .use(objectPropertyNamesPlugin)
      .use(objectPatternPropertiesPlugin)
      .use(objectDependentRequiredPlugin)
      .use(objectDependentSchemasPlugin)
      .use(readOnlyWriteOnlyPlugin)
      .use(oneOfPlugin)
      .use(literalPlugin)
      .use(customPlugin)
      .use(requiredIfPlugin)
      .use(tupleBuilderPlugin)
      .use(nullablePlugin)
      // Format validators
      .use(stringIpv4Plugin)
      .use(stringIpv6Plugin)
      .use(stringHostnamePlugin)
      .use(stringTimePlugin)
      .use(stringDurationPlugin)
      .use(stringJsonPointerPlugin)
      .use(stringBase64Plugin)
      .use(stringIriPlugin)
      .use(stringIriReferencePlugin)
      .use(stringUriTemplatePlugin)
      .use(stringRelativeJsonPointerPlugin)
      .use(stringContentEncodingPlugin);
  };

  describe("Core Schema Types", () => {
    test("should validate all primitive types", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          stringField: { type: "string" },
          numberField: { type: "number" },
          integerField: { type: "integer" },
          booleanField: { type: "boolean" },
          nullField: { type: "null" },
          arrayField: { type: "array" },
          objectField: { type: "object" }
        },
        required: ["stringField", "numberField", "integerField", "booleanField"]
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        stringField: "test",
        numberField: 42.5,
        integerField: 42,
        booleanField: true,
        nullField: null,
        arrayField: [1, 2, 3],
        objectField: { key: "value" }
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("String Constraints", () => {
    test("should validate all string constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          minLength: { type: "string", minLength: 3 },
          maxLength: { type: "string", maxLength: 10 },
          pattern: { type: "string", pattern: "^[A-Z][a-z]+$" },
          enum: { type: "string", enum: ["red", "green", "blue"] },
          const: { type: "string", const: "constant" }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        minLength: "abc",
        maxLength: "short",
        pattern: "Hello",
        enum: "red",
        const: "constant"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("String Formats", () => {
    test("should validate all standard formats", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          email: { type: "string", format: "email" },
          url: { type: "string", format: "url" },
          uri: { type: "string", format: "uri" },
          uuid: { type: "string", format: "uuid" },
          ipv4: { type: "string", format: "ipv4" },
          ipv6: { type: "string", format: "ipv6" },
          hostname: { type: "string", format: "hostname" },
          time: { type: "string", format: "time" },
          duration: { type: "string", format: "duration" },
          jsonPointer: { type: "string", format: "json-pointer" },
          relativeJsonPointer: { type: "string", format: "relative-json-pointer" },
          iri: { type: "string", format: "iri" },
          iriReference: { type: "string", format: "iri-reference" },
          uriTemplate: { type: "string", format: "uri-template" }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        email: "test@example.com",
        url: "https://example.com",
        uri: "https://example.com/path",
        uuid: "550e8400-e29b-41d4-a716-446655440000",
        ipv4: "192.168.1.1",
        ipv6: "2001:db8::8a2e:370:7334",
        hostname: "example.com",
        time: "12:34:56",
        duration: "P1Y2M3DT4H5M6S",
        jsonPointer: "/foo/bar/0",
        relativeJsonPointer: "1/foo/bar",
        iri: "https://例え.jp/パス",
        iriReference: "/relative/path",
        uriTemplate: "/users/{id}/posts/{postId}"
      };

      const result = validator.validate(validData);
      if (!result.isValid()) {
        console.log("Format validation failed");
        console.log("Result:", result);
        console.log("Errors:", result.errors);
        console.log("Issues:", result.issues);
      }
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Number Constraints", () => {
    test("should validate all number constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          minimum: { type: "number", minimum: 0 },
          maximum: { type: "number", maximum: 100 },
          exclusiveMinimum: { type: "number", exclusiveMinimum: 0 },
          exclusiveMaximum: { type: "number", exclusiveMaximum: 100 },
          multipleOf: { type: "number", multipleOf: 5 },
          integer: { type: "integer" }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        minimum: 0,
        maximum: 100,
        exclusiveMinimum: 0.1,
        exclusiveMaximum: 99.9,
        multipleOf: 25,
        integer: 42
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Array Constraints", () => {
    test("should validate all array constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          minItems: { type: "array", minItems: 2 },
          maxItems: { type: "array", maxItems: 5 },
          uniqueItems: { type: "array", uniqueItems: true },
          contains: {
            type: "array",
            contains: { type: "number", minimum: 10 }
          },
          tuple: {
            type: "array",
            items: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" }
            ]
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        minItems: [1, 2, 3],
        maxItems: [1, 2, 3],
        uniqueItems: [1, 2, 3, 4],
        contains: [5, 8, 15, 20],
        tuple: ["test", 42, true]
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Object Constraints", () => {
    test("should validate all object constraints", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          limited: {
            type: "object",
            minProperties: 2,
            maxProperties: 4,
            properties: {
              a: { type: "string" },
              b: { type: "number" }
            }
          },
          strict: {
            type: "object",
            properties: {
              allowed: { type: "string" }
            },
            additionalProperties: false
          },
          patternProps: {
            type: "object",
            patternProperties: {
              "^str_": { type: "string" },
              "^num_": { type: "number" }
            }
          },
          propertyNames: {
            type: "object",
            propertyNames: {
              pattern: "^[a-z]+$"
            }
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        limited: { a: "test", b: 42 },
        strict: { allowed: "value" },
        patternProps: {
          str_field: "text",
          num_field: 123
        },
        propertyNames: {
          abc: "value",
          def: "another"
        }
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Schema Composition", () => {
    test("should validate allOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          combined: {
            allOf: [
              { type: "object", properties: { a: { type: "string" } } },
              { type: "object", properties: { b: { type: "number" } } }
            ]
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        combined: { a: "test", b: 42 }
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });

    test("should validate anyOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          flexible: {
            anyOf: [
              { type: "string", minLength: 5 },
              { type: "number", minimum: 10 }
            ]
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        flexible: "hello"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });

    test("should validate oneOf", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          exclusive: {
            oneOf: [
              { type: "string", pattern: "^[A-Z]+$" },
              { type: "string", pattern: "^[a-z]+$" }
            ]
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        exclusive: "hello"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });

    test("should validate not", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          notString: {
            not: { type: "string" }
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        notString: 42
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Conditional Validation", () => {
    test("should validate if/then/else", () => {
      const schema: JSONSchema7 = {
        type: "object",
        if: {
          properties: {
            country: { const: "US" }
          }
        },
        then: {
          properties: {
            postalCode: { type: "string", pattern: "^\\d{5}$" }
          },
          required: ["postalCode"]
        },
        else: {
          properties: {
            postalCode: { type: "string" }
          }
        },
        properties: {
          country: { type: "string" },
          postalCode: { type: "string" }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        country: "US",
        postalCode: "12345"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Dependencies", () => {
    test("should validate dependentRequired", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          credit_card: { type: "string" },
          billing_address: { type: "string" }
        },
        dependentRequired: {
          credit_card: ["billing_address"]
        }
      } as any;

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        name: "John",
        credit_card: "1234-5678-9012-3456",
        billing_address: "123 Main St"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);

      const invalidData = {
        name: "John",
        credit_card: "1234-5678-9012-3456"
        // Missing billing_address
      };

      const invalidResult = validator.validate(invalidData);
      expect(invalidResult.isValid()).toBe(false);
    });

    test("should validate dependentSchemas", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" },
          credit_card: { type: "string" }
        },
        dependentSchemas: {
          credit_card: {
            properties: {
              billing_address: { type: "string" }
            },
            required: ["billing_address"]
          }
        }
      } as any;

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        name: "John",
        credit_card: "1234-5678-9012-3456",
        billing_address: "123 Main St"
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("References", () => {
    test("should validate $ref", () => {
      const schema: JSONSchema7 = {
        definitions: {
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" }
            },
            required: ["street", "city"]
          }
        },
        type: "object",
        properties: {
          billingAddress: { $ref: "#/definitions/address" },
          shippingAddress: { $ref: "#/definitions/address" }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        billingAddress: {
          street: "123 Main St",
          city: "New York"
        },
        shippingAddress: {
          street: "456 Oak Ave",
          city: "Los Angeles"
        }
      };

      const result = validator.validate(validData);
      if (!result.isValid()) {
        console.log("$ref validation failed");
        console.log("Errors:", result.errors);
      }
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Content Encoding", () => {
    test("should validate contentEncoding", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          base64Data: {
            type: "string",
            contentEncoding: "base64"
          } as any
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        base64Data: "SGVsbG8gV29ybGQ=" // "Hello World" in base64
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);

      const invalidData = {
        base64Data: "Not valid base64!@#"
      };

      const invalidResult = validator.validate(invalidData);
      expect(invalidResult.isValid()).toBe(false);
    });
  });

  describe("Read-Only and Write-Only", () => {
    test("should validate readOnly and writeOnly in context", () => {
      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          id: {
            type: "string",
            readOnly: true
          } as any,
          password: {
            type: "string",
            writeOnly: true
          } as any,
          username: {
            type: "string"
          }
        }
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      // For read context, writeOnly fields should be ignored
      const readData = {
        id: "123",
        username: "john"
        // password not included in read context
      };

      const readResult = validator.validate(readData, { context: "read" });
      expect(readResult.isValid()).toBe(true);

      // For write context, readOnly fields should be ignored
      const writeData = {
        password: "secret",
        username: "john"
        // id not included in write context
      };

      const writeResult = validator.validate(writeData, { context: "write" });
      expect(writeResult.isValid()).toBe(true);
    });
  });

  describe("Complete Feature Matrix", () => {
    test("should handle complex nested schema with all features", () => {
      const schema: JSONSchema7 = {
        $schema: "http://json-schema.org/draft-07/schema#",
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              email: { type: "string", format: "email" },
              age: { type: "integer", minimum: 18, maximum: 120 },
              roles: {
                type: "array",
                items: { type: "string", enum: ["admin", "user", "guest"] },
                uniqueItems: true
              },
              metadata: {
                type: "object",
                patternProperties: {
                  "^pref_": { type: "boolean" }
                },
                additionalProperties: false
              }
            },
            required: ["id", "email"],
            if: {
              properties: {
                age: { minimum: 65 }
              }
            },
            then: {
              properties: {
                seniorDiscount: { type: "boolean", const: true }
              }
            }
          },
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
                  customTheme: {
                    type: "object",
                    properties: {
                      primary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                      secondary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }
                    },
                    required: ["primary", "secondary"]
                  }
                },
                required: ["customTheme"]
              }
            ]
          }
        },
        required: ["user", "settings"]
      };

      const validator = createFullBuilder()
        .fromJsonSchema(schema)
        .build();

      const validData = {
        user: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          email: "test@example.com",
          age: 70,
          roles: ["admin", "user"],
          metadata: {
            pref_notifications: true,
            pref_darkMode: false
          },
          seniorDiscount: true
        },
        settings: {
          theme: "dark"
        }
      };

      const result = validator.validate(validData);
      if (!result.isValid()) {
        console.log("Complex schema validation failed");
        console.log("Errors:", JSON.stringify(result.errors, null, 2));
      }
      expect(result.isValid()).toBe(true);
    });
  });
});