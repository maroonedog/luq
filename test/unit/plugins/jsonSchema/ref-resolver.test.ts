import { describe, test, expect } from "@jest/globals";
import { 
  resolveRef,
  resolveSchemaRef,
  resolveAllRefs
} from "../../../../src/core/plugin/jsonSchema/ref-resolver";
import type { JSONSchema7 } from "json-schema";

describe("Schema Reference Resolver", () => {
  describe("resolveRef", () => {
    test("should resolve simple definition references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          User: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          }
        }
      };

      const resolved = resolveRef("#/definitions/User", rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          name: { type: "string" }
        }
      });
    });

    test("should resolve $defs references", () => {
      const rootSchema: JSONSchema7 = {
        $defs: {
          Product: {
            type: "object",
            properties: {
              id: { type: "string" },
              price: { type: "number" }
            }
          }
        }
      };

      const resolved = resolveRef("#/$defs/Product", rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          id: { type: "string" },
          price: { type: "number" }
        }
      });
    });

    test("should resolve nested path references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" }
            }
          }
        }
      };

      const resolved = resolveRef("#/definitions/Address/properties/street", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });

    test("should handle empty segments in path", () => {
      const rootSchema: JSONSchema7 = {
        type: "object",
        properties: {
          name: { type: "string" }
        }
      };

      const resolved = resolveRef("#/properties/name", rootSchema);
      expect(resolved).toEqual({ type: "string" });
    });

    test("should throw error for external references", () => {
      const rootSchema: JSONSchema7 = {};

      expect(() => {
        resolveRef("http://external.com/schema.json", rootSchema);
      }).toThrow("External $ref not supported");

      expect(() => {
        resolveRef("./relative-schema.json", rootSchema);
      }).toThrow("External $ref not supported");
    });

    test("should throw error for unresolvable references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          User: { type: "string" }
        }
      };

      expect(() => {
        resolveRef("#/definitions/NonExistent", rootSchema);
      }).toThrow("Cannot resolve $ref");

      expect(() => {
        resolveRef("#/definitions/User/nonExistentProperty", rootSchema);
      }).toThrow("Cannot resolve $ref");
    });

    test("should handle complex nested paths", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Order: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      };

      const resolved = resolveRef("#/definitions/Order/properties/items/items/properties/product", rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          name: { type: "string" },
          category: { type: "string" }
        }
      });
    });
  });

  describe("resolveSchemaRef", () => {
    test("should return schema as-is when no $ref", () => {
      const schema: JSONSchema7 = {
        type: "string",
        minLength: 5
      };

      const resolved = resolveSchemaRef(schema);
      expect(resolved).toBe(schema);
    });

    test("should resolve $ref when present", () => {
      const schema: JSONSchema7 = {
        $ref: "#/definitions/User"
      };

      const rootSchema: JSONSchema7 = {
        definitions: {
          User: {
            type: "object",
            properties: {
              id: { type: "string" }
            }
          }
        }
      };

      const resolved = resolveSchemaRef(schema, rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          id: { type: "string" }
        }
      });
    });

    test("should throw error when rootSchema is missing for $ref", () => {
      const schema: JSONSchema7 = {
        $ref: "#/definitions/User"
      };

      expect(() => {
        resolveSchemaRef(schema);
      }).toThrow("Root schema required for $ref resolution");
    });
  });

  describe("resolveAllRefs", () => {
    test("should resolve all $refs in nested schema", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          User: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          },
          Address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        type: "object",
        properties: {
          user: { $ref: "#/definitions/User" },
          address: { $ref: "#/definitions/Address" }
        }
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" }
            }
          }
        }
      });
    });

    test("should resolve $refs in array items", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Item: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        type: "array",
        items: { $ref: "#/definitions/Item" }
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved).toEqual({
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" }
          }
        }
      });
    });

    test("should resolve $refs in tuple items", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Coordinate: { type: "number" },
          Label: { type: "string" }
        }
      };

      const schema: JSONSchema7 = {
        type: "array",
        items: [
          { $ref: "#/definitions/Coordinate" },
          { $ref: "#/definitions/Coordinate" },
          { $ref: "#/definitions/Label" }
        ]
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved).toEqual({
        type: "array",
        items: [
          { type: "number" },
          { type: "number" },
          { type: "string" }
        ]
      });
    });

    test("should resolve $refs in schema composition", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Base: {
            type: "object",
            properties: {
              id: { type: "string" }
            }
          },
          Extended: {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        allOf: [
          { $ref: "#/definitions/Base" },
          { $ref: "#/definitions/Extended" }
        ]
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved).toEqual({
        allOf: [
          {
            type: "object",
            properties: {
              id: { type: "string" }
            }
          },
          {
            type: "object",
            properties: {
              name: { type: "string" }
            }
          }
        ]
      });
    });

    test("should resolve $refs in conditional schemas", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          UserType: {
            type: "string",
            enum: ["admin", "user"]
          },
          AdminProperties: {
            type: "object",
            properties: {
              permissions: { type: "array" }
            }
          },
          UserProperties: {
            type: "object",
            properties: {
              profile: { type: "object" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        type: "object",
        if: {
          properties: {
            type: { $ref: "#/definitions/UserType" }
          }
        },
        then: { $ref: "#/definitions/AdminProperties" },
        else: { $ref: "#/definitions/UserProperties" }
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect((resolved.if as any)?.properties?.type).toEqual({
        type: "string",
        enum: ["admin", "user"]
      });
      expect(resolved.then).toEqual({
        type: "object",
        properties: {
          permissions: { type: "array" }
        }
      });
      expect(resolved.else).toEqual({
        type: "object",
        properties: {
          profile: { type: "object" }
        }
      });
    });

    test("should detect circular references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Node: {
            type: "object",
            properties: {
              value: { type: "string" },
              next: { $ref: "#/definitions/Node" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        $ref: "#/definitions/Node"
      };

      expect(() => {
        resolveAllRefs(schema, rootSchema);
      }).toThrow("Circular reference detected");
    });

    test("should handle deeply nested references", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          Level1: {
            type: "object",
            properties: {
              level2: { $ref: "#/definitions/Level2" }
            }
          },
          Level2: {
            type: "object",
            properties: {
              level3: { $ref: "#/definitions/Level3" }
            }
          },
          Level3: {
            type: "object",
            properties: {
              value: { type: "string" }
            }
          }
        }
      };

      const schema: JSONSchema7 = {
        $ref: "#/definitions/Level1"
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved).toEqual({
        type: "object",
        properties: {
          level2: {
            type: "object",
            properties: {
              level3: {
                type: "object",
                properties: {
                  value: { type: "string" }
                }
              }
            }
          }
        }
      });
    });

    test("should preserve non-object items in arrays", () => {
      const schema: JSONSchema7 = {
        type: "array",
        items: true  // boolean schema
      };

      const resolved = resolveAllRefs(schema, {});
      expect(resolved.items).toBe(true);
    });

    test("should handle oneOf/anyOf/not schemas", () => {
      const rootSchema: JSONSchema7 = {
        definitions: {
          StringType: { type: "string" },
          NumberType: { type: "number" }
        }
      };

      const schema: JSONSchema7 = {
        oneOf: [
          { $ref: "#/definitions/StringType" },
          { $ref: "#/definitions/NumberType" }
        ],
        anyOf: [
          { $ref: "#/definitions/StringType" }
        ],
        not: { $ref: "#/definitions/NumberType" }
      };

      const resolved = resolveAllRefs(schema, rootSchema);
      expect(resolved.oneOf).toEqual([
        { type: "string" },
        { type: "number" }
      ]);
      expect(resolved.anyOf).toEqual([
        { type: "string" }
      ]);
      expect(resolved.not).toEqual({ type: "number" });
    });
  });
});