import { describe, test, expect } from "@jest/globals";
import {
  createAccessor,
  createFieldAccessor,
  getCachedAccessor,
  createAccessorCacheFactory,
  createBatchAccessors,
  createMultiFieldGetter,
  createFieldExistenceChecker,
  createFieldSetter,
  createNestedValueAccessor,
} from "../../../../../src/core/plugin/utils/field-accessor";

describe("Field Accessor Utilities", () => {
  describe("createAccessor", () => {
    test("handles empty path segments", () => {
      const accessor = createAccessor([]);
      const obj = { name: "test" };
      expect(accessor(obj)).toBe(obj);
    });

    test("handles single-level access", () => {
      const accessor = createAccessor(["name"]);
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
      expect(accessor({})).toBeUndefined();
    });

    test("handles two-level access", () => {
      const accessor = createAccessor(["user", "name"]);
      const obj = { user: { name: "John", age: 30 } };
      expect(accessor(obj)).toBe("John");
      expect(accessor({ user: null })).toBeUndefined();
      expect(accessor({})).toBeUndefined();
    });

    test("handles three-level access", () => {
      const accessor = createAccessor(["user", "profile", "name"]);
      const obj = { user: { profile: { name: "John", email: "john@test.com" } } };
      expect(accessor(obj)).toBe("John");
      expect(accessor({ user: { profile: null } })).toBeUndefined();
      expect(accessor({ user: {} })).toBeUndefined();
      expect(accessor({})).toBeUndefined();
    });

    test("handles four-level access", () => {
      const accessor = createAccessor(["user", "profile", "contact", "email"]);
      const obj = { 
        user: { 
          profile: { 
            contact: { 
              email: "john@test.com",
              phone: "123-456-7890" 
            } 
          } 
        } 
      };
      expect(accessor(obj)).toBe("john@test.com");
      expect(accessor({ user: { profile: { contact: null } } })).toBeUndefined();
    });

    test("handles five-level access", () => {
      const accessor = createAccessor(["app", "user", "profile", "contact", "email"]);
      const obj = { 
        app: {
          user: { 
            profile: { 
              contact: { 
                email: "john@test.com",
                phone: "123-456-7890" 
              } 
            } 
          } 
        }
      };
      expect(accessor(obj)).toBe("john@test.com");
      expect(accessor({ app: { user: { profile: { contact: null } } } })).toBeUndefined();
    });

    test("handles deep nesting with loop fallback", () => {
      const accessor = createAccessor(["a", "b", "c", "d", "e", "f", "g"]);
      const obj = { 
        a: { 
          b: { 
            c: { 
              d: { 
                e: { 
                  f: { 
                    g: "deep value" 
                  } 
                } 
              } 
            } 
          } 
        } 
      };
      expect(accessor(obj)).toBe("deep value");
      
      // Test early termination on undefined
      const partialObj = { a: { b: { c: undefined } } };
      expect(accessor(partialObj)).toBeUndefined();
    });

    test("handles null and undefined values gracefully", () => {
      const accessor = createAccessor(["user", "name"]);
      expect(accessor(null)).toBeUndefined();
      expect(accessor(undefined)).toBeUndefined();
      expect(accessor({ user: null })).toBeUndefined();
      expect(accessor({ user: undefined })).toBeUndefined();
    });
  });

  describe("createFieldAccessor", () => {
    test("creates accessor from dot notation", () => {
      const accessor = createFieldAccessor("user.profile.name");
      const obj = { user: { profile: { name: "John" } } };
      expect(accessor(obj)).toBe("John");
    });

    test("handles simple field path", () => {
      const accessor = createFieldAccessor("name");
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
    });
  });

  describe("getCachedAccessor", () => {
    test("caches accessor functions", () => {
      const cache = new Map<string, (obj: any) => any>();
      const accessor1 = getCachedAccessor("user.name", cache);
      const accessor2 = getCachedAccessor("user.name", cache);
      
      // Should return the same cached function
      expect(accessor1).toBe(accessor2);
      
      const obj = { user: { name: "John" } };
      expect(accessor1(obj)).toBe("John");
    });

    test("creates new accessor for different paths", () => {
      const cache = new Map<string, (obj: any) => any>();
      const accessor1 = getCachedAccessor("user.name", cache);
      const accessor2 = getCachedAccessor("user.email", cache);
      
      // Should return different functions for different paths
      expect(accessor1).not.toBe(accessor2);
      
      const obj = { user: { name: "John", email: "john@test.com" } };
      expect(accessor1(obj)).toBe("John");
      expect(accessor2(obj)).toBe("john@test.com");
    });

    test("separate caches maintain separate functions", () => {
      const cache1 = new Map<string, (obj: any) => any>();
      const cache2 = new Map<string, (obj: any) => any>();
      
      const accessor1 = getCachedAccessor("user.name", cache1);
      const accessor2 = getCachedAccessor("user.name", cache2);
      
      // Different caches should have different function instances
      expect(accessor1).not.toBe(accessor2);
      
      // But they should work the same way
      const obj = { user: { name: "John" } };
      expect(accessor1(obj)).toBe("John");
      expect(accessor2(obj)).toBe("John");
    });
  });

  describe("createAccessorCacheFactory", () => {
    test("creates a factory with its own cache", () => {
      const getAccessor = createAccessorCacheFactory();
      
      const accessor1 = getAccessor("user.name");
      const accessor2 = getAccessor("user.name");
      
      // Should return the same cached function
      expect(accessor1).toBe(accessor2);
      
      const obj = { user: { name: "John" } };
      expect(accessor1(obj)).toBe("John");
    });

    test("different factories have independent caches", () => {
      const getAccessor1 = createAccessorCacheFactory();
      const getAccessor2 = createAccessorCacheFactory();
      
      const accessor1 = getAccessor1("user.name");
      const accessor2 = getAccessor2("user.name");
      
      // Different factories should have different function instances
      expect(accessor1).not.toBe(accessor2);
      
      // But they should work the same way
      const obj = { user: { name: "John" } };
      expect(accessor1(obj)).toBe("John");
      expect(accessor2(obj)).toBe("John");
    });

    test("factory handles multiple different paths", () => {
      const getAccessor = createAccessorCacheFactory();
      
      const nameAccessor = getAccessor("user.name");
      const emailAccessor = getAccessor("user.email");
      const ageAccessor = getAccessor("user.age");
      
      // Should be different functions for different paths
      expect(nameAccessor).not.toBe(emailAccessor);
      expect(nameAccessor).not.toBe(ageAccessor);
      expect(emailAccessor).not.toBe(ageAccessor);
      
      const obj = { user: { name: "John", email: "john@test.com", age: 30 } };
      expect(nameAccessor(obj)).toBe("John");
      expect(emailAccessor(obj)).toBe("john@test.com");
      expect(ageAccessor(obj)).toBe(30);
      
      // Getting the same path again should return cached version
      const nameAccessor2 = getAccessor("user.name");
      expect(nameAccessor2).toBe(nameAccessor);
    });
  });

  describe("createBatchAccessors", () => {
    test("creates multiple accessors", () => {
      const accessors = createBatchAccessors(["user.name", "user.email", "user.age"]);
      
      expect(accessors).toHaveLength(3);
      expect(accessors[0].fieldName).toBe("user.name");
      expect(accessors[1].fieldName).toBe("user.email");
      expect(accessors[2].fieldName).toBe("user.age");
      
      const obj = { user: { name: "John", email: "john@test.com", age: 30 } };
      expect(accessors[0].accessor(obj)).toBe("John");
      expect(accessors[1].accessor(obj)).toBe("john@test.com");
      expect(accessors[2].accessor(obj)).toBe(30);
    });

    test("handles empty field paths array", () => {
      const accessors = createBatchAccessors([]);
      expect(accessors).toHaveLength(0);
    });
  });

  describe("createMultiFieldGetter", () => {
    test("extracts values for multiple fields", () => {
      const getter = createMultiFieldGetter(["user.name", "user.email", "settings.theme"]);
      const obj = {
        user: { name: "John", email: "john@test.com" },
        settings: { theme: "dark" }
      };
      
      const result = getter(obj);
      expect(result).toEqual({
        "user.name": "John",
        "user.email": "john@test.com",
        "settings.theme": "dark"
      });
    });

    test("handles missing fields", () => {
      const getter = createMultiFieldGetter(["user.name", "user.missing", "missing.field"]);
      const obj = { user: { name: "John" } };
      
      const result = getter(obj);
      expect(result).toEqual({
        "user.name": "John",
        "user.missing": undefined,
        "missing.field": undefined
      });
    });

    test("handles empty field paths", () => {
      const getter = createMultiFieldGetter([]);
      const obj = { user: { name: "John" } };
      
      const result = getter(obj);
      expect(result).toEqual({});
    });
  });

  describe("createFieldExistenceChecker", () => {
    test("checks field existence", () => {
      const checker = createFieldExistenceChecker("user.name");
      
      expect(checker({ user: { name: "John" } })).toBe(true);
      expect(checker({ user: { name: null } })).toBe(true); // null is considered existing
      expect(checker({ user: { name: "" } })).toBe(true); // empty string is considered existing
      expect(checker({ user: { name: 0 } })).toBe(true); // 0 is considered existing
      expect(checker({ user: { name: false } })).toBe(true); // false is considered existing
      expect(checker({ user: {} })).toBe(false);
      expect(checker({ user: { name: undefined } })).toBe(false);
      expect(checker({})).toBe(false);
    });

    test("handles deep field paths", () => {
      const checker = createFieldExistenceChecker("user.profile.contact.email");
      
      expect(checker({ 
        user: { 
          profile: { 
            contact: { 
              email: "john@test.com" 
            } 
          } 
        } 
      })).toBe(true);
      
      expect(checker({ 
        user: { 
          profile: { 
            contact: {} 
          } 
        } 
      })).toBe(false);
    });
  });

  describe("createFieldSetter", () => {
    test("sets single-level field", () => {
      const setter = createFieldSetter("name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.name).toBe("John");
    });

    test("sets two-level field", () => {
      const setter = createFieldSetter("user.name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.user.name).toBe("John");
      
      // Test with existing parent object
      const obj2: any = { user: { age: 30 } };
      setter(obj2, "Jane");
      expect(obj2.user.name).toBe("Jane");
      expect(obj2.user.age).toBe(30);
    });

    test("sets three-level field", () => {
      const setter = createFieldSetter("user.profile.name");
      const obj: any = {};
      
      setter(obj, "John");
      expect(obj.user.profile.name).toBe("John");
      
      // Test with partial existing structure
      const obj2: any = { user: {} };
      setter(obj2, "Jane");
      expect(obj2.user.profile.name).toBe("Jane");
    });

    test("sets deep field with generic approach", () => {
      const setter = createFieldSetter("a.b.c.d.e.f");
      const obj: any = {};
      
      setter(obj, "deep value");
      expect(obj.a.b.c.d.e.f).toBe("deep value");
      
      // Test with partial existing structure
      const obj2: any = { a: { b: { existing: "value" } } };
      setter(obj2, "new deep value");
      expect(obj2.a.b.c.d.e.f).toBe("new deep value");
      expect(obj2.a.b.existing).toBe("value");
    });
  });

  describe("createNestedValueAccessor", () => {
    test("handles simple property access", () => {
      const accessor = createNestedValueAccessor("name");
      const obj = { name: "John", age: 30 };
      expect(accessor(obj)).toBe("John");
    });

    test("handles two-level standard access", () => {
      const accessor = createNestedValueAccessor("user.name");
      const obj = { user: { name: "John" } };
      expect(accessor(obj)).toBe("John");
      
      // Test with null/undefined intermediate values
      expect(accessor({ user: null })).toBeUndefined();
      expect(accessor({ user: undefined })).toBeUndefined();
      expect(accessor({})).toBeUndefined();
    });

    test("handles two-level array access", () => {
      const accessor = createNestedValueAccessor("users.name");
      const obj = { users: [{ name: "John" }, { name: "Jane" }] };
      const result = accessor(obj);
      
      // Should return the array itself for array element validation
      expect(result).toEqual([{ name: "John" }, { name: "Jane" }]);
    });

    test("handles deep nesting", () => {
      const accessor = createNestedValueAccessor("user.profile.contact.email");
      const obj = { 
        user: { 
          profile: { 
            contact: { 
              email: "john@test.com" 
            } 
          } 
        } 
      };
      expect(accessor(obj)).toBe("john@test.com");
    });

    test("handles array element field access", () => {
      const accessor = createNestedValueAccessor("users.profile.name");
      const obj = { 
        users: [
          { profile: { name: "John", age: 30 } },
          { profile: { name: "Jane", age: 25 } },
          { profile: null },
          null
        ]
      };
      
      const result = accessor(obj) as any;
      expect(result.__isArrayElementField).toBe(true);
      expect(result.values).toEqual(["John", "Jane", undefined, undefined]);
      expect(result.arrayPath).toBe("users");
    });

    test("handles array element simple property access", () => {
      const accessor = createNestedValueAccessor("users.name");
      const obj = { 
        users: [
          { name: "John", age: 30 },
          { name: "Jane", age: 25 },
          null,
          { age: 40 }
        ]
      };
      
      const result = accessor(obj);
      // For two-level access with array, it returns the array itself
      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual([
        { name: "John", age: 30 },
        { name: "Jane", age: 25 },
        null,
        { age: 40 }
      ]);
    });

    test("handles null and undefined gracefully", () => {
      const accessor = createNestedValueAccessor("user.profile.name");
      
      expect(accessor({ user: null })).toBeUndefined();
      expect(accessor({ user: { profile: null } })).toBeUndefined();
      expect(accessor({})).toBeUndefined();
    });

    test("handles non-object intermediate values", () => {
      const accessor = createNestedValueAccessor("user.profile.name");
      
      expect(accessor({ user: "string" })).toBeUndefined();
      expect(accessor({ user: 123 })).toBeUndefined();
      expect(accessor({ user: true })).toBeUndefined();
    });

    test("handles complex nested array scenarios", () => {
      const accessor = createNestedValueAccessor("company.departments.employees.name");
      const obj = { 
        company: {
          departments: [
            { 
              employees: [
                { name: "John", role: "dev" },
                { name: "Jane", role: "designer" }
              ]
            },
            { 
              employees: [
                { name: "Bob", role: "manager" }
              ]
            }
          ]
        }
      };
      
      const result = accessor(obj) as any;
      expect(result.__isArrayElementField).toBe(true);
      expect(result.arrayPath).toBe("company.departments");
      // Should extract employees array from each department
      expect(result.values).toHaveLength(2);
    });
  });

  describe("Performance and Edge Cases", () => {
    test("handles very deep nesting efficiently", () => {
      const deepPath = Array.from({ length: 20 }, (_, i) => `level${i}`).join(".");
      const accessor = createFieldAccessor(deepPath);
      
      // Create deep nested object
      let obj: any = {};
      let current = obj;
      for (let i = 0; i < 19; i++) {
        current[`level${i}`] = {};
        current = current[`level${i}`];
      }
      current.level19 = "deep value";
      
      expect(accessor(obj)).toBe("deep value");
    });

    test("handles special characters in field names", () => {
      const accessor = createFieldAccessor("user-info.email_address");
      const obj = { 
        "user-info": { 
          "email_address": "john@test.com" 
        } 
      };
      expect(accessor(obj)).toBe("john@test.com");
    });

    test("maintains object references correctly", () => {
      const getter = createMultiFieldGetter(["user", "settings"]);
      const userRef = { name: "John" };
      const settingsRef = { theme: "dark" };
      const obj = { user: userRef, settings: settingsRef };
      
      const result = getter(obj);
      expect(result.user).toBe(userRef);
      expect(result.settings).toBe(settingsRef);
    });
  });
});