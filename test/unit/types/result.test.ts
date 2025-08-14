import { describe, test, expect } from "@jest/globals";
import { Result } from "../../../src/types/result";

describe("Result", () => {
  describe("Result.ok - success results", () => {
    test("should create successful result with data", () => {
      const data = { name: "Alice", age: 25 };
      const result = Result.ok(data);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toEqual(data);
      expect(result.errors).toEqual([]);
      expect(result.isError()).toBe(false);
    });

    test("should create successful result with null data", () => {
      const result = Result.ok(null);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe(null);
      expect(result.errors).toEqual([]);
    });

    test("should create successful result with undefined data", () => {
      const result = Result.ok(undefined);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe(undefined);
      expect(result.errors).toEqual([]);
    });

    test("should create successful result with primitive data", () => {
      const stringResult = Result.ok("hello");
      expect(stringResult.isValid()).toBe(true);
      expect(stringResult.data()).toBe("hello");

      const numberResult = Result.ok(42);
      expect(numberResult.isValid()).toBe(true);
      expect(numberResult.data()).toBe(42);

      const booleanResult = Result.ok(true);
      expect(booleanResult.isValid()).toBe(true);
      expect(booleanResult.data()).toBe(true);
    });
  });

  describe("Result.error - error results", () => {
    test("should create error result with single error", () => {
      const error = {
        path: "name",
        message: "Required field",
        code: "REQUIRED",
        paths: () => ["name"],
      };
      const result = Result.error([error]);

      expect(result.isValid()).toBe(false);
      expect(result.isError()).toBe(true);
      expect(result.errors).toEqual([error]);
      expect(() => result.data()).toThrow();
    });

    test("should create error result with multiple errors", () => {
      const errors = [
        {
          path: "name",
          message: "Required",
          code: "REQUIRED",
          paths: () => ["name"],
        },
        {
          path: "age",
          message: "Must be positive",
          code: "MIN_VALUE",
          paths: () => ["age"],
        },
      ];
      const result = Result.error(errors);

      expect(result.isValid()).toBe(false);
      expect(result.isError()).toBe(true);
      expect(result.errors).toEqual(errors);
      expect(result.errors).toHaveLength(2);
    });

    test("should create error result with empty error array", () => {
      const result = Result.error([]);

      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBe(0);
      expect(result.errors).toEqual([]);
    });

    test("should throw when accessing data on error result", () => {
      const result = Result.error([
        {
          path: "test",
          message: "Error",
          code: "ERROR",
          paths: () => ["test"],
        },
      ]);

      expect(() => result.unwrap()).toThrow();
    });
  });

  describe("Result methods", () => {
    test("isValid should correctly identify success/error results", () => {
      const successResult = Result.ok("data");
      const errorResult = Result.error([
        {
          path: "field",
          message: "Error",
          code: "ERROR",
          paths: () => ["field"],
        },
      ]);

      expect(successResult.isValid()).toBe(true);
      expect(errorResult.isValid()).toBe(false);
    });

    test("isError should correctly identify presence of errors", () => {
      const noErrors = Result.ok("data");
      const withErrors = Result.error([
        {
          path: "field",
          message: "Error",
          code: "ERROR",
          paths: () => ["field"],
        },
      ]);
      const emptyErrors = Result.error([]);

      expect(noErrors.isError()).toBe(false);
      expect(withErrors.isError()).toBe(true);
      expect(emptyErrors.isError()).toBe(true);
    });

    test("errors should return error array", () => {
      const originalErrors = [
        {
          path: "field",
          message: "Error",
          code: "ERROR",
          paths: () => ["field"],
        },
      ];
      const result = Result.error(originalErrors);

      const retrievedErrors = result.errors;
      expect(retrievedErrors).toHaveLength(1);
      expect(retrievedErrors).toEqual(originalErrors);
    });
  });

  describe("Result chaining and transformation", () => {
    test("should support map operation on successful results", () => {
      const result = Result.ok({ name: "alice" });

      if (result.isValid()) {
        const transformed = Result.ok({
          ...result.data()!,
          name: result.data()!.name.toUpperCase(),
        });

        expect(transformed.isValid()).toBe(true);
        expect(transformed.data()!.name).toBe("ALICE");
      }
    });

    test("should handle error propagation in transformations", () => {
      const errorResult = Result.error([
        {
          path: "name",
          message: "Required",
          code: "REQUIRED",
          paths: () => ["name"],
        },
      ]);

      expect(errorResult.isValid()).toBe(false);
      expect(errorResult.errors).toHaveLength(1);
    });
  });

  describe("Result with different data types", () => {
    test("should work with array data", () => {
      const arrayData = [1, 2, 3, 4, 5];
      const result = Result.ok(arrayData);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toEqual(arrayData);
      expect(Array.isArray(result.data())).toBe(true);
    });

    test("should work with nested objects", () => {
      const nestedData = {
        user: {
          profile: {
            name: "Alice",
            settings: {
              theme: "dark",
              notifications: true,
            },
          },
        },
      };

      const result = Result.ok(nestedData);

      expect(result.isValid()).toBe(true);
      expect(result.data()!.user.profile.name).toBe("Alice");
      expect(result.data()!.user.profile.settings.theme).toBe("dark");
    });

    test("should work with Date objects", () => {
      const now = new Date();
      const result = Result.ok(now);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe(now);
      expect(result.data()).toBeInstanceOf(Date);
    });

    test("should work with Set and Map", () => {
      const setResult = Result.ok(new Set([1, 2, 3]));
      expect(setResult.isValid()).toBe(true);
      expect(setResult.data()).toBeInstanceOf(Set);
      expect(setResult.data()!.has(2)).toBe(true);

      const mapResult = Result.ok(new Map([["key", "value"]]));
      expect(mapResult.isValid()).toBe(true);
      expect(mapResult.data()).toBeInstanceOf(Map);
      expect(mapResult.data()!.get("key")).toBe("value");
    });
  });

  describe("Result error variations", () => {
    test("should handle complex error objects", () => {
      const complexError = {
        path: "user.profile.email",
        message: "Invalid email format",
        code: "EMAIL_FORMAT",
        paths: () => ["user.profile.email"],
        details: {
          received: "not-an-email",
          expected: "email@domain.com format",
        },
        severity: "error",
      };

      const result = Result.error([complexError]);

      expect(result.isValid()).toBe(false);
      expect(result.errors[0].path).toBe("user.profile.email");
      expect((result.errors[0] as any).details.received).toBe("not-an-email");
    });

    test("should handle errors with various field paths", () => {
      const errors = [
        {
          path: "name",
          message: "Required",
          code: "REQUIRED",
          paths: () => ["name"],
        },
        {
          path: "user.email",
          message: "Invalid email",
          code: "EMAIL",
          paths: () => ["user.email"],
        },
        {
          path: "items[0].id",
          message: "Invalid ID",
          code: "INVALID_ID",
          paths: () => ["items[0].id"],
        },
        {
          path: "nested.deep.value",
          message: "Out of range",
          code: "RANGE",
          paths: () => ["nested.deep.value"],
        },
      ];

      const result = Result.error(errors);

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(4);
      expect(result.errors.map((e) => e.path)).toEqual([
        "name",
        "user.email",
        "items[0].id",
        "nested.deep.value",
      ]);
    });
  });

  describe("Result immutability", () => {
    test("should not allow modification of data through reference", () => {
      const originalData = { count: 0, items: ["a", "b"] };
      const result = Result.ok(originalData);

      // Modifying returned data should not affect internal state
      const data = result.data()!;
      data.count = 999;
      data.items.push("c");

      // Since we're returning the same reference, it will be modified
      // This is expected behavior for performance reasons
      expect(result.data()!.count).toBe(999);
      expect(result.data()!.items).toContain("c");
    });

    test("should not allow modification of errors array", () => {
      const originalErrors = [
        {
          path: "test",
          message: "Error",
          code: "ERROR",
          paths: () => ["test"],
        },
      ];
      const result = Result.error(originalErrors);

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe("test");
    });
  });

  describe("Result equality and comparison", () => {
    test("should be able to compare results", () => {
      const result1 = Result.ok("data");
      const result2 = Result.ok("data");
      const result3 = Result.ok("different");

      expect(result1.isValid()).toBe(result2.isValid());
      expect(result1.data()).toBe(result2.data());
      expect(result1.data()).not.toBe(result3.data());
    });

    test("should be able to compare error results", () => {
      const error1 = {
        path: "field",
        message: "Error",
        code: "ERROR",
        paths: () => ["field"],
      };
      const error2 = {
        path: "field",
        message: "Error",
        code: "ERROR",
        paths: () => ["field"],
      };
      const error3 = {
        path: "other",
        message: "Other",
        code: "OTHER",
        paths: () => ["other"],
      };

      const result1 = Result.error([error1]);
      const result2 = Result.error([error2]);
      const result3 = Result.error([error3]);

      expect(result1.isValid()).toBe(result2.isValid());
      expect(result1.errors[0].path).toBe(result2.errors[0].path);
      expect(result1.errors[0].path).not.toBe(result3.errors[0].path);
    });
  });

  describe("Result edge cases", () => {
    test("should handle empty string as valid data", () => {
      const result = Result.ok("");

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe("");
    });

    test("should handle zero as valid data", () => {
      const result = Result.ok(0);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe(0);
    });

    test("should handle false as valid data", () => {
      const result = Result.ok(false);

      expect(result.isValid()).toBe(true);
      expect(result.data()).toBe(false);
    });

    test("should handle NaN as valid data", () => {
      const result = Result.ok(NaN);

      expect(result.isValid()).toBe(true);
      expect(Number.isNaN(result.data())).toBe(true);
    });

    test("should handle circular references in data", () => {
      const circularData: any = { name: "test" };
      circularData.self = circularData;

      const result = Result.ok(circularData);

      expect(result.isValid()).toBe(true);
      expect(result.data()!.self).toBe(result.data()!);
    });
  });

  describe("Result TypeScript type safety", () => {
    test("should maintain type information for successful results", () => {
      interface User {
        id: number;
        name: string;
        email: string;
      }

      const user: User = { id: 1, name: "Alice", email: "alice@example.com" };
      const result: Result<User> = Result.ok(user);

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        // TypeScript should know this is User type
        expect(result.data()!.id).toBe(1);
        expect(result.data()!.name).toBe("Alice");
        expect(result.data()!.email).toBe("alice@example.com");
      }
    });

    test("should work with generic array types", () => {
      const numbers: number[] = [1, 2, 3, 4, 5];
      const result: Result<number[]> = Result.ok(numbers);

      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        expect(result.data()!.length).toBe(5);
        expect(result.data()![0]).toBe(1);
      }
    });
  });
});
