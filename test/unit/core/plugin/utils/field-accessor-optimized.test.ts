/**
 * @jest-environment node
 */

import {
  getPathSegments,
  createAccessor,
  createFieldAccessor,
  createBatchAccessors,
  createFieldSetter,
  createNestedValueAccessor,
  prewarmCache,
  clearAllCaches,
} from "../../../../../src/core/plugin/utils/field-accessor-optimized";

describe("Field Accessor Optimized", () => {
  beforeEach(() => {
    clearAllCaches();
  });

  describe("getPathSegments", () => {
    it("should split simple paths", () => {
      const segments = getPathSegments("name");
      expect(segments).toEqual(["name"]);
    });

    it("should split nested paths", () => {
      const segments = getPathSegments("user.name");
      expect(segments).toEqual(["user", "name"]);
    });

    it("should split deeply nested paths", () => {
      const segments = getPathSegments("user.profile.address.street");
      expect(segments).toEqual(["user", "profile", "address", "street"]);
    });

    it("should handle empty path", () => {
      const segments = getPathSegments("");
      expect(segments).toEqual([""]);
    });

    it("should cache path segments", () => {
      const segments1 = getPathSegments("user.name");
      const segments2 = getPathSegments("user.name");
      
      // Should return the same reference due to caching
      expect(segments1).toBe(segments2);
    });

    it("should freeze path segments", () => {
      const segments = getPathSegments("user.name");
      expect(Object.isFrozen(segments)).toBe(true);
    });

    it("should handle paths with consecutive dots", () => {
      const segments = getPathSegments("user..name");
      expect(segments).toEqual(["user", "", "name"]);
    });
  });

  describe("createAccessor", () => {
    it("should create accessor for empty path", () => {
      const accessor = createAccessor([]);
      const obj = { name: "test" };
      expect(accessor(obj)).toBe(obj);
    });

    it("should create accessor for single property", () => {
      const accessor = createAccessor(["name"]);
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
    });

    it("should handle undefined for single property", () => {
      const accessor = createAccessor(["missing"]);
      const obj = { name: "John" };
      expect(accessor(obj)).toBeUndefined();
    });

    it("should create accessor for two properties", () => {
      const accessor = createAccessor(["user", "name"]);
      const obj = { user: { name: "John", age: 30 } };
      expect(accessor(obj)).toBe("John");
    });

    it("should handle undefined in two-level access", () => {
      const accessor = createAccessor(["user", "name"]);
      expect(accessor({})).toBeUndefined();
      expect(accessor({ user: null })).toBeUndefined();
      expect(accessor({ user: {} })).toBeUndefined();
    });

    it("should create accessor for three properties", () => {
      const accessor = createAccessor(["user", "profile", "name"]);
      const obj = { user: { profile: { name: "John" } } };
      expect(accessor(obj)).toBe("John");
    });

    it("should create accessor for four properties", () => {
      const accessor = createAccessor(["a", "b", "c", "d"]);
      const obj = { a: { b: { c: { d: "value" } } } };
      expect(accessor(obj)).toBe("value");
    });

    it("should create accessor for five properties", () => {
      const accessor = createAccessor(["a", "b", "c", "d", "e"]);
      const obj = { a: { b: { c: { d: { e: "deep value" } } } } };
      expect(accessor(obj)).toBe("deep value");
    });

    it("should create accessor for deep paths (6+ levels)", () => {
      const accessor = createAccessor(["a", "b", "c", "d", "e", "f", "g"]);
      const obj = { a: { b: { c: { d: { e: { f: { g: "very deep" } } } } } } };
      expect(accessor(obj)).toBe("very deep");
    });

    it("should handle null/undefined in deep paths", () => {
      const accessor = createAccessor(["a", "b", "c", "d", "e", "f"]);
      const obj = { a: { b: { c: null } } };
      expect(accessor(obj)).toBeUndefined();
    });

    it("should handle arrays in nested access", () => {
      const accessor = createAccessor(["users", "0", "name"]);
      const obj = { users: [{ name: "John" }, { name: "Jane" }] };
      expect(accessor(obj)).toBe("John");
    });

    it("should return undefined when intermediate value is undefined in deep path", () => {
      const accessor = createAccessor(["a", "b", "c", "d", "e", "f"]);
      const obj = { a: { b: { c: { d: undefined } } } };
      expect(accessor(obj)).toBeUndefined();
    });
  });

  describe("createFieldAccessor", () => {
    it("should create and cache field accessors", () => {
      const accessor1 = createFieldAccessor("user.name");
      const accessor2 = createFieldAccessor("user.name");
      
      // Should return the same function reference due to caching
      expect(accessor1).toBe(accessor2);
    });

    it("should work with created accessor", () => {
      const accessor = createFieldAccessor("user.profile.email");
      const obj = { user: { profile: { email: "test@example.com" } } };
      expect(accessor(obj)).toBe("test@example.com");
    });

    it("should handle simple field paths", () => {
      const accessor = createFieldAccessor("name");
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
    });
  });

  describe("createBatchAccessors", () => {
    it("should create accessors for multiple fields", () => {
      const accessors = createBatchAccessors(["name", "email", "user.age"]);
      
      expect(accessors).toHaveLength(3);
      expect(accessors[0].fieldName).toBe("name");
      expect(accessors[1].fieldName).toBe("email");
      expect(accessors[2].fieldName).toBe("user.age");
      
      expect(typeof accessors[0].accessor).toBe("function");
      expect(typeof accessors[1].accessor).toBe("function");
      expect(typeof accessors[2].accessor).toBe("function");
    });

    it("should create working accessors in batch", () => {
      const accessors = createBatchAccessors(["name", "user.email"]);
      const obj = { name: "John", user: { email: "john@test.com" } };
      
      expect(accessors[0].accessor(obj)).toBe("John");
      expect(accessors[1].accessor(obj)).toBe("john@test.com");
    });

    it("should handle empty field paths array", () => {
      const accessors = createBatchAccessors([]);
      expect(accessors).toHaveLength(0);
    });

    it("should pre-allocate array for performance", () => {
      const fields = ["a", "b", "c"];
      const accessors = createBatchAccessors(fields);
      
      expect(accessors).toHaveLength(fields.length);
      expect(Array.isArray(accessors)).toBe(true);
    });
  });

  describe("createFieldSetter", () => {
    it("should create and cache field setters", () => {
      const setter1 = createFieldSetter("user.name");
      const setter2 = createFieldSetter("user.name");
      
      // Should return the same function reference due to caching
      expect(setter1).toBe(setter2);
    });

    it("should set single-level property", () => {
      const setter = createFieldSetter("name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.name).toBe("John");
    });

    it("should set two-level property", () => {
      const setter = createFieldSetter("user.name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.user.name).toBe("John");
    });

    it("should set three-level property", () => {
      const setter = createFieldSetter("user.profile.name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.user.profile.name).toBe("John");
    });

    it("should set deep property (4+ levels)", () => {
      const setter = createFieldSetter("a.b.c.d.e");
      const obj: any = {};
      
      setter(obj, "deep value");
      expect(obj.a.b.c.d.e).toBe("deep value");
    });

    it("should not overwrite existing intermediate objects", () => {
      const setter = createFieldSetter("user.profile.name");
      const obj: any = { user: { age: 30 } };
      
      setter(obj, "John");
      expect(obj.user.age).toBe(30);
      expect(obj.user.profile.name).toBe("John");
    });

    it("should overwrite existing values", () => {
      const setter = createFieldSetter("user.name");
      const obj: any = { user: { name: "Jane" } };
      
      setter(obj, "John");
      expect(obj.user.name).toBe("John");
    });

    it("should handle setting to null/undefined", () => {
      const setter = createFieldSetter("user.name");
      const obj: any = {};
      
      setter(obj, null);
      expect(obj.user.name).toBeNull();
      
      setter(obj, undefined);
      expect(obj.user.name).toBeUndefined();
    });
  });

  describe("createNestedValueAccessor", () => {
    it("should handle simple property access", () => {
      const accessor = createNestedValueAccessor("name");
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
    });

    it("should handle two-level nested access", () => {
      const accessor = createNestedValueAccessor("user.name");
      const obj = { user: { name: "John", age: 30 } };
      expect(accessor(obj)).toBe("John");
    });

    it("should return undefined for null intermediate values", () => {
      const accessor = createNestedValueAccessor("user.name");
      const obj = { user: null };
      expect(accessor(obj)).toBeUndefined();
    });

    it("should handle array elements", () => {
      const accessor = createNestedValueAccessor("users.name");
      const obj = { users: [{ name: "John" }, { name: "Jane" }] };
      
      const result = accessor(obj);
      expect(result).toEqual({
        __isArrayElementField: true,
        values: ["John", "Jane"],
        arrayPath: "users"
      });
    });

    it("should handle nested array element access", () => {
      const accessor = createNestedValueAccessor("teams.members.name");
      const obj = {
        teams: [
          { members: [{ name: "John" }, { name: "Jane" }] },
          { members: [{ name: "Bob" }] }
        ]
      };
      
      const result = accessor(obj);
      expect(result).toEqual({
        __isArrayElementField: true,
        values: [
          [{ name: "John" }, { name: "Jane" }],
          [{ name: "Bob" }]
        ],
        arrayPath: "teams"
      });
    });

    it("should handle deep array element property access", () => {
      const accessor = createNestedValueAccessor("users.profile.email");
      const obj = {
        users: [
          { profile: { email: "john@test.com" } },
          { profile: { email: "jane@test.com" } },
          { profile: null }
        ]
      };
      
      const result = accessor(obj);
      expect(result).toEqual({
        __isArrayElementField: true,
        values: ["john@test.com", "jane@test.com", undefined],
        arrayPath: "users"
      });
    });

    it("should handle single property in array elements", () => {
      const accessor = createNestedValueAccessor("items.value");
      const obj = {
        items: [
          { value: "a" },
          { value: "b" },
          null,
          { value: "c" }
        ]
      };
      
      const result = accessor(obj);
      expect(result).toEqual({
        __isArrayElementField: true,
        values: ["a", "b", undefined, "c"],
        arrayPath: "items"
      });
    });

    it("should handle multiple property levels in array elements", () => {
      const accessor = createNestedValueAccessor("products.details.specs.weight");
      const obj = {
        products: [
          { details: { specs: { weight: "1kg" } } },
          { details: { specs: { weight: "2kg" } } },
          { details: null },
          { details: { specs: null } }
        ]
      };
      
      const result = accessor(obj);
      expect(result).toEqual({
        __isArrayElementField: true,
        values: ["1kg", "2kg", undefined, undefined],
        arrayPath: "products"
      });
    });

    it("should handle standard nested object for non-array intermediate values", () => {
      const accessor = createNestedValueAccessor("user.profile.email");
      const obj = { user: { profile: { email: "test@example.com" } } };
      expect(accessor(obj)).toBe("test@example.com");
    });

    it("should return undefined for missing nested properties", () => {
      const accessor = createNestedValueAccessor("user.profile.missing");
      const obj = { user: { profile: { email: "test@example.com" } } };
      expect(accessor(obj)).toBeUndefined();
    });

    it("should handle path with non-object intermediate values", () => {
      const accessor = createNestedValueAccessor("user.name.length");
      const obj = { user: { name: "John" } };
      expect(accessor(obj)).toBeUndefined();
    });
  });

  describe("prewarmCache", () => {
    it("should populate caches with common paths", () => {
      const commonPaths = ["user.name", "user.email", "profile.address"];
      
      prewarmCache(commonPaths);
      
      // Verify that accessors are cached
      const accessor1 = createFieldAccessor("user.name");
      const accessor2 = createFieldAccessor("user.name");
      expect(accessor1).toBe(accessor2);
      
      // Verify that path segments are cached
      const segments1 = getPathSegments("user.email");
      const segments2 = getPathSegments("user.email");
      expect(segments1).toBe(segments2);
    });

    it("should handle empty common paths array", () => {
      expect(() => prewarmCache([])).not.toThrow();
    });

    it("should improve performance for pre-warmed paths", () => {
      const testPath = "very.deep.nested.property.path";
      
      // Pre-warm the cache
      prewarmCache([testPath]);
      
      // These should be faster due to caching
      const accessor = createFieldAccessor(testPath);
      const segments = getPathSegments(testPath);
      const setter = createFieldSetter(testPath);
      
      expect(typeof accessor).toBe("function");
      expect(Array.isArray(segments)).toBe(true);
      expect(typeof setter).toBe("function");
    });
  });

  describe("clearAllCaches", () => {
    it("should clear all caches", () => {
      // Populate caches
      getPathSegments("user.name");
      createFieldAccessor("user.email");
      createFieldSetter("user.age");
      
      clearAllCaches();
      
      // After clearing, new instances should be created
      const accessor1 = createFieldAccessor("user.name");
      const accessor2 = createFieldAccessor("user.name");
      expect(accessor1).toBe(accessor2); // Should still cache after creation
      
      const segments1 = getPathSegments("user.email");
      const segments2 = getPathSegments("user.email");
      expect(segments1).toBe(segments2); // Should still cache after creation
    });

    it("should not affect functionality after clearing", () => {
      // Use some functions to populate cache
      const initialAccessor = createFieldAccessor("test.field");
      const initialSegments = getPathSegments("test.path");
      
      clearAllCaches();
      
      // Functions should still work correctly
      const newAccessor = createFieldAccessor("test.field");
      const newSegments = getPathSegments("test.path");
      
      expect(typeof newAccessor).toBe("function");
      expect(Array.isArray(newSegments)).toBe(true);
      
      // Test functionality
      const obj = { test: { field: "value" } };
      expect(newAccessor(obj)).toBe("value");
    });
  });

  describe("integration and performance", () => {
    it("should handle complex object structures", () => {
      const complexObj = {
        company: {
          departments: [
            {
              name: "Engineering",
              employees: [
                { name: "John", role: "Developer", skills: ["JS", "TS"] },
                { name: "Jane", role: "Manager", skills: ["Leadership"] }
              ]
            },
            {
              name: "Marketing",
              employees: [
                { name: "Bob", role: "Designer", skills: ["Photoshop"] }
              ]
            }
          ]
        }
      };
      
      const deptAccessor = createFieldAccessor("company.departments");
      const empAccessor = createNestedValueAccessor("company.departments.employees");
      
      expect(deptAccessor(complexObj)).toBe(complexObj.company.departments);
      
      const empResult = empAccessor(complexObj);
      expect(empResult).toEqual({
        __isArrayElementField: true,
        values: [
          complexObj.company.departments[0].employees,
          complexObj.company.departments[1].employees
        ],
        arrayPath: "company.departments"
      });
    });

    it("should maintain performance with repeated access", () => {
      const obj = { user: { profile: { name: "John" } } };
      const accessor = createFieldAccessor("user.profile.name");
      
      // Multiple accesses should be fast due to caching
      for (let i = 0; i < 100; i++) {
        expect(accessor(obj)).toBe("John");
      }
    });

    it("should handle edge cases with special property names", () => {
      const obj = {
        "special-name": {
          "with.dots": {
            "weird@name": "value"
          }
        }
      };
      
      // Note: This tests the current limitation - special characters in property names
      // need to be handled by the calling code, not the path splitting logic
      const accessor = createFieldAccessor("special-name");
      expect(accessor(obj)).toBe(obj["special-name"]);
    });
  });
});