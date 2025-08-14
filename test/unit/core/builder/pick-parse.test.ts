import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { customPlugin } from "../../../../src/core/plugin/custom";

describe("Pick Function and Parse Method", () => {
  describe("Pick Function", () => {
    test("should validate a single field with pick", () => {
      type User = {
        name: string;
        age: number;
        email: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .for<User>()
        .v("name", (b) => b.string.required().min(3))
        .v("age", (b) => b.number.required().min(18))
        .v("email", (b) => b.string.required().min(5))
        .build();

      // Test pick function for name field
      const namePicker = validator.pick("name");
      
      // Valid name
      const validNameResult = namePicker.validate("John");
      expect(validNameResult.valid).toBe(true);
      expect(validNameResult.value).toBe("John");
      
      // Invalid name (too short)
      const invalidNameResult = namePicker.validate("Jo");
      expect(invalidNameResult.valid).toBe(false);
      expect(invalidNameResult.errors.length).toBeGreaterThan(0);
      
      // Test pick function for age field
      const agePicker = validator.pick("age");
      
      // Valid age
      const validAgeResult = agePicker.validate(25);
      expect(validAgeResult.valid).toBe(true);
      expect(validAgeResult.value).toBe(25);
      
      // Invalid age (too young)
      const invalidAgeResult = agePicker.validate(15);
      expect(invalidAgeResult.valid).toBe(false);
      expect(invalidAgeResult.errors.length).toBeGreaterThan(0);
    });

    test("should parse and transform a single field with pick", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<User>()
        .v("name", (b) => 
          b.string
            .required()
            .min(2)
            .transform((v) => v.toUpperCase())
        )
        .v("age", (b) =>
          b.number
            .required()
            .transform((v) => v * 2)
        )
        .build();

      // Test pick with parse for name field
      const namePicker = validator.pick("name");
      
      if (namePicker.parse) {
        const parseResult = namePicker.parse("john");
        expect(parseResult.valid).toBe(true);
        expect(parseResult.value).toBe("JOHN"); // Should be transformed
      }
      
      // Test pick with parse for age field
      const agePicker = validator.pick("age");
      
      if (agePicker.parse) {
        const parseResult = agePicker.parse(10);
        expect(parseResult.valid).toBe(true);
        expect(parseResult.value).toBe(20); // Should be doubled
      }
    });

    test("should handle nested field paths with pick", () => {
      type User = {
        profile: {
          name: string;
          age: number;
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<User>()
        .v("profile.name", (b) => b.string.required().min(3))
        .build();

      // Test pick for nested field
      const namePicker = validator.pick("profile.name");
      
      const validResult = namePicker.validate("John");
      expect(validResult.valid).toBe(true);
      expect(validResult.value).toBe("John");
      
      const invalidResult = namePicker.validate("Jo");
      expect(invalidResult.valid).toBe(false);
    });

    test("should handle non-existent field paths gracefully", () => {
      type User = {
        name: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<User>()
        .v("name", (b) => b.string.required())
        .build();

      // Test pick for non-existent field
      const unknownPicker = validator.pick("unknown" as any);
      
      const result = unknownPicker.validate("anything");
      expect(result.valid).toBe(true); // Should pass for unknown fields
      expect(result.value).toBeUndefined();
    });
  });

  describe("Parse Method", () => {
    test("should validate and parse entire object", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<User>()
        .v("name", (b) => 
          b.string
            .required()
            .transform((v) => v.trim().toLowerCase())
        )
        .v("age", (b) =>
          b.number
            .required()
            .transform((v) => Math.floor(v))
        )
        .build();

      // Test parse method
      const parseResult = validator.parse({
        name: "  JOHN  ",
        age: 25.7
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.name).toBe("john"); // Trimmed and lowercased
        expect(data?.age).toBe(25); // Floored
      }
    });

    test("should handle validation errors in parse", () => {
      type User = {
        name: string;
        age: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .for<User>()
        .v("name", (b) => b.string.required())
        .v("age", (b) => b.number.required().min(18))
        .build();

      // Test parse with invalid data
      const parseResult = validator.parse({
        name: "John",
        age: 15 // Too young
      });

      expect(parseResult.valid).toBe(false);
      if (!parseResult.valid) {
        expect(parseResult.errors.length).toBeGreaterThan(0);
        expect(parseResult.errors[0].path).toBe("age");
      }
    });

    test("should handle missing required fields in parse", () => {
      type User = {
        name: string;
        email: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .for<User>()
        .v("name", (b) => b.string.required())
        .v("email", (b) => b.string.required())
        .build();

      // Test parse with missing field
      const parseResult = validator.parse({
        name: "John"
        // email is missing
      });

      expect(parseResult.valid).toBe(false);
      if (!parseResult.valid) {
        expect(parseResult.errors.length).toBeGreaterThan(0);
        const emailError = parseResult.errors.find(e => e.path === "email");
        expect(emailError).toBeDefined();
      }
    });

    test("should apply transforms only in parse, not validate", () => {
      type User = {
        name: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<User>()
        .v("name", (b) => 
          b.string
            .required()
            .transform((v) => v.toUpperCase())
        )
        .build();

      // Test validate - should not transform
      const validateResult = validator.validate({
        name: "john"
      });
      expect(validateResult.valid).toBe(true);
      if (validateResult.valid) {
        const data = validateResult.data();
        expect(data?.name).toBe("john"); // Not transformed
      }

      // Test parse - should transform
      const parseResult = validator.parse({
        name: "john"
      });
      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.name).toBe("JOHN"); // Transformed
      }
    });

    test("should handle nested transforms in parse", () => {
      type User = {
        profile: {
          firstName: string;
          lastName: string;
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<User>()
        .v("profile.firstName", (b) => 
          b.string
            .required()
            .transform((v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase())
        )
        .v("profile.lastName", (b) => 
          b.string
            .required()
            .transform((v) => v.toUpperCase())
        )
        .build();

      const parseResult = validator.parse({
        profile: {
          firstName: "jOHN",
          lastName: "doe"
        }
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.profile.firstName).toBe("John"); // Capitalized
        expect(data?.profile.lastName).toBe("DOE"); // Uppercased
      }
    });

    test("should handle array transforms in parse", () => {
      type User = {
        tags: string[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<User>()
        .v("tags", (b) => 
          b.array
            .required()
            .transform((v: string[]) => v.map(tag => tag.toLowerCase()))
        )
        .build();

      const parseResult = validator.parse({
        tags: ["JavaScript", "TypeScript", "Node.js"]
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.tags).toEqual(["javascript", "typescript", "node.js"]);
      }
    });
  });

  describe("Pick with Parse Method", () => {
    test("should support both validate and parse in picked validator", () => {
      type User = {
        email: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .use(stringMinPlugin)
        .for<User>()
        .v("email", (b) => 
          b.string
            .required()
            .min(5)
            .transform((v) => v.toLowerCase().trim())
        )
        .build();

      const emailPicker = validator.pick("email");

      // Test validate on picked field
      const validateResult = emailPicker.validate("  TEST@EXAMPLE.COM  ");
      expect(validateResult.valid).toBe(true);
      expect(validateResult.value).toBe("  TEST@EXAMPLE.COM  "); // Not transformed

      // Test parse on picked field
      if (emailPicker.parse) {
        const parseResult = emailPicker.parse("  TEST@EXAMPLE.COM  ");
        expect(parseResult.valid).toBe(true);
        expect(parseResult.value).toBe("test@example.com"); // Transformed
      } else {
        throw new Error("Parse method should be available on picked validator");
      }
    });

    test("should maintain context when using pick with cross-field validation", () => {
      type Form = {
        password: string;
        confirmPassword: string;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(customPlugin)
        .for<Form>()
        .v("password", (b) => b.string.required().min(8))
        .v("confirmPassword", (b) => 
          b.string
            .required()
            .custom((value, rootData) => {
              return value === rootData?.password;
            }, { code: "PASSWORD_MISMATCH", messageFactory: () => "Passwords must match" })
        )
        .build();

      const confirmPicker = validator.pick("confirmPassword");

      // Test with context
      const validResult = confirmPicker.validate("password123", {
        password: "password123"
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = confirmPicker.validate("different", {
        password: "password123"
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors[0].message).toContain("Passwords must match");
    });
  });
});