import {
  detectFieldType,
  detectFieldTypes,
  FieldType,
} from "../../../../../src/core/builder/context/field-type-detector";

describe("field-type-detector", () => {
  describe("detectFieldType", () => {
    describe("basic type detection", () => {
      it("should detect string type", () => {
        const fieldDef = {
          path: "name",
          builderFunction: (b: any) => b.string.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should detect number type", () => {
        const fieldDef = {
          path: "age",
          builderFunction: (b: any) => b.number.min(0),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("number");
      });

      it("should detect boolean type", () => {
        const fieldDef = {
          path: "isActive",
          builderFunction: (b: any) => b.boolean.optional(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("boolean");
      });

      it("should detect date type", () => {
        const fieldDef = {
          path: "createdAt",
          builderFunction: (b: any) => b.date.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("date");
      });

      it("should detect array type", () => {
        const fieldDef = {
          path: "items",
          builderFunction: (b: any) => b.array.minLength(1),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("array");
      });

      it("should detect object type", () => {
        const fieldDef = {
          path: "metadata",
          builderFunction: (b: any) => b.object.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("object");
      });

      it("should detect tuple type", () => {
        const fieldDef = {
          path: "coordinates",
          builderFunction: (b: any) => b.tuple.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("tuple");
      });

      it("should detect union type", () => {
        const fieldDef = {
          path: "value",
          builderFunction: (b: any) => b.union.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("union");
      });
    });

    describe("method chaining", () => {
      it("should detect type with multiple chained methods", () => {
        const fieldDef = {
          path: "email",
          builderFunction: (b: any) => b.string.required().email().min(5).max(100),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should detect type with nested method calls", () => {
        const fieldDef = {
          path: "score",
          builderFunction: (b: any) => b.number.min(0).max(100).integer().positive(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("number");
      });

      it("should detect type with transform chains", () => {
        const fieldDef = {
          path: "username",
          builderFunction: (b: any) => b.string.transform((v: string) => v.toLowerCase()).required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should detect type with conditional chains", () => {
        const fieldDef = {
          path: "conditionalField",
          builderFunction: (b: any) => b.string.when("otherField", (v: any) => v === true).required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });
    });

    describe("error handling", () => {
      it("should return null when builder function throws", () => {
        const fieldDef = {
          path: "error",
          builderFunction: () => {
            throw new Error("Builder error");
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should return null when builder function accesses undefined property", () => {
        const fieldDef = {
          path: "undefined",
          builderFunction: (b: any) => b.undefinedType.required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should return null when builder function is null", () => {
        const fieldDef = {
          path: "null",
          builderFunction: null as any,
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should return null when builder function is undefined", () => {
        const fieldDef = {
          path: "undefined",
          builderFunction: undefined as any,
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should handle recursive builder calls", () => {
        const fieldDef = {
          path: "recursive",
          builderFunction: (b: any) => {
            const result = b.string;
            // Try to access the same type again
            b.string.required();
            return result;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });
    });

    describe("edge cases", () => {
      it("should detect last accessed type when multiple types are accessed", () => {
        const fieldDef = {
          path: "multi",
          builderFunction: (b: any) => {
            b.string;
            b.number;
            return b.boolean;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("boolean"); // Last accessed type
      });

      it("should handle empty builder function", () => {
        const fieldDef = {
          path: "empty",
          builderFunction: (b: any) => {},
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should handle builder function that returns immediately", () => {
        const fieldDef = {
          path: "immediate",
          builderFunction: (b: any) => {
            return;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBeNull();
      });

      it("should handle builder accessing non-type properties", () => {
        const fieldDef = {
          path: "nonType",
          builderFunction: (b: any) => {
            b.customProperty;
            b.anotherCustom;
            return b.string;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should handle builder with complex property access", () => {
        const fieldDef = {
          path: "complex",
          builderFunction: (b: any) => b["string"]["required"](),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should handle builder with computed property access", () => {
        const fieldType = "number";
        const fieldDef = {
          path: "computed",
          builderFunction: (b: any) => b[fieldType].required(),
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("number");
      });
    });

    describe("proxy behavior", () => {
      it("should track property access through proxy", () => {
        let accessedProps: string[] = [];
        const fieldDef = {
          path: "tracking",
          builderFunction: (b: any) => {
            // Access multiple properties to verify proxy tracking
            const stringBuilder = b.string;
            accessedProps.push("string");
            return stringBuilder.required();
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
        expect(accessedProps).toContain("string");
      });

      it("should return chainable mock builder", () => {
        const fieldDef = {
          path: "chain",
          builderFunction: (b: any) => {
            const builder = b.string;
            // Verify that mock builder supports chaining
            expect(builder.required).toBeDefined();
            expect(builder.required().min).toBeDefined();
            expect(builder.required().min(5).max).toBeDefined();
            return builder;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("string");
      });

      it("should handle function calls on mock builder", () => {
        const fieldDef = {
          path: "function",
          builderFunction: (b: any) => {
            const builder = b.number;
            // Mock builder should be callable
            builder();
            builder(123);
            builder("arg1", "arg2");
            return builder;
          },
        };
        const result = detectFieldType(fieldDef, {});
        expect(result).toBe("number");
      });
    });
  });

  describe("detectFieldTypes", () => {
    it("should detect types for multiple fields", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: (b: any) => b.string.required(),
        },
        {
          path: "age",
          builderFunction: (b: any) => b.number.min(0),
        },
        {
          path: "isActive",
          builderFunction: (b: any) => b.boolean.optional(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, {});
      
      expect(result.size).toBe(3);
      expect(result.get("name")).toBe("string");
      expect(result.get("age")).toBe("number");
      expect(result.get("isActive")).toBe("boolean");
    });

    it("should handle empty field definitions", () => {
      const result = detectFieldTypes([], {});
      expect(result.size).toBe(0);
    });

    it("should skip fields that fail detection", () => {
      const fieldDefinitions = [
        {
          path: "valid",
          builderFunction: (b: any) => b.string.required(),
        },
        {
          path: "error",
          builderFunction: () => {
            throw new Error("Failed");
          },
        },
        {
          path: "valid2",
          builderFunction: (b: any) => b.number.required(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, {});
      
      expect(result.size).toBe(2);
      expect(result.get("valid")).toBe("string");
      expect(result.get("valid2")).toBe("number");
      expect(result.has("error")).toBe(false);
    });

    it("should handle duplicate paths", () => {
      const fieldDefinitions = [
        {
          path: "field",
          builderFunction: (b: any) => b.string.required(),
        },
        {
          path: "field",
          builderFunction: (b: any) => b.number.required(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, {});
      
      expect(result.size).toBe(1);
      // Last one wins
      expect(result.get("field")).toBe("number");
    });

    it("should handle nested paths", () => {
      const fieldDefinitions = [
        {
          path: "user.name",
          builderFunction: (b: any) => b.string.required(),
        },
        {
          path: "user.age",
          builderFunction: (b: any) => b.number.required(),
        },
        {
          path: "user.address.street",
          builderFunction: (b: any) => b.string.required(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, {});
      
      expect(result.size).toBe(3);
      expect(result.get("user.name")).toBe("string");
      expect(result.get("user.age")).toBe("number");
      expect(result.get("user.address.street")).toBe("string");
    });

    it("should handle all field types", () => {
      const allTypes: FieldType[] = [
        "string",
        "number",
        "boolean",
        "date",
        "array",
        "object",
        "tuple",
        "union",
      ];

      const fieldDefinitions = allTypes.map((type) => ({
        path: type,
        builderFunction: (b: any) => b[type].required(),
      }));

      const result = detectFieldTypes(fieldDefinitions, {});
      
      expect(result.size).toBe(allTypes.length);
      allTypes.forEach((type) => {
        expect(result.get(type)).toBe(type);
      });
    });

    it("should maintain order of successful detections", () => {
      const fieldDefinitions = [
        {
          path: "first",
          builderFunction: (b: any) => b.string.required(),
        },
        {
          path: "error",
          builderFunction: () => {
            throw new Error("Skip");
          },
        },
        {
          path: "second",
          builderFunction: (b: any) => b.number.required(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, {});
      const keys = Array.from(result.keys());
      
      expect(keys).toEqual(["first", "second"]);
    });

    it("should detect types with plugins context", () => {
      const plugins = { customPlugin: {} };
      const fieldDefinitions = [
        {
          path: "field",
          builderFunction: (b: any) => b.string.required(),
        },
      ];

      const result = detectFieldTypes(fieldDefinitions, plugins);
      
      expect(result.size).toBe(1);
      expect(result.get("field")).toBe("string");
    });
  });
});