import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import {
  fromContextPlugin,
  passwordConfirmation,
} from "../../../../src/core/plugin/fromContext";
import { requiredPlugin } from "../../../../src/core/plugin/required";

describe("fromContext Plugin", () => {
  describe("Basic behavior", () => {
    test("Cross-field validation using allValues", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(fromContextPlugin)
        .for<{ password: string; confirmPassword: string }>()
        .v("password", (b) => b.string.required())
        .v("confirmPassword", (b) =>
          (b as any).string.required().fromContext({
            validate: (
              confirmPassword: string,
              context: any,
              allValues: { password: string }
            ) => ({
              valid: allValues.password === confirmPassword,
              message: "Password confirmation does not match",
            }),
            required: false, // Async context not needed when using allValues
          })
        )
        .build();

      // When passwords match
      const validResult = validator.validate({
        password: "securePass123",
        confirmPassword: "securePass123",
      });
      expect(validResult.isValid()).toBe(true);

      // When passwords don't match
      const invalidResult = validator.validate({
        password: "securePass123",
        confirmPassword: "differentPass",
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0].message).toBe(
        "Password confirmation does not match"
      );
    });

    test("Optional context with fallback enabled", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          (b as any).string.fromContext({
            validate: (email: string, context: { hasEmail: boolean }) => ({
              valid: !context.hasEmail,
              message: "Email already exists",
            }),
            required: false,
            fallbackToValid: true,
          })
        )
        .build();

      const result = validator.validate({ email: "test@example.com" });
      expect(result.isValid()).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test("Optional context with fallback disabled", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          (b as any).string.fromContext({
            validate: (email: string, context: { hasEmail: boolean }) => ({
              valid: !context.hasEmail,
              message: "Email already exists",
            }),
            required: true, // Make context required to avoid using allValues
            fallbackToValid: false,
          })
        )
        .build();

      const result = validator.validate({ email: "test@example.com" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain("Context data is required");
    });

    test("Required context not available", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          (b as any).string.fromContext({
            validate: (email: string, context: { hasEmail: boolean }) => ({
              valid: !context.hasEmail,
              message: "Email already exists",
            }),
            required: true,
          })
        )
        .build();

      const result = validator.validate({ email: "test@example.com" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe(
        "Context data is required for validation"
      );
    });
  });

  describe("Conditional validation", () => {
    test("Conditional validation based on other fields", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ accountType: string; businessName: string }>()
        .v("accountType", (b) => b.string)
        .v("businessName", (b) =>
          (b as any).string.fromContext({
            validate: (
              businessName: string,
              context: any,
              allValues: { accountType: string }
            ) => {
              if (
                allValues.accountType === "business" &&
                (!businessName || businessName.trim() === "")
              ) {
                return {
                  valid: false,
                  message: "Business name is required for business accounts",
                };
              }
              return { valid: true };
            },
            required: false,
          })
        )
        .build();

      // Business account with company name
      const validBusinessResult = validator.validate({
        accountType: "business",
        businessName: "Acme Corp",
      });
      expect(validBusinessResult.isValid()).toBe(true);

      // Business account without company name
      const invalidBusinessResult = validator.validate({
        accountType: "business",
        businessName: "",
      });
      expect(invalidBusinessResult.isValid()).toBe(false);
      expect(invalidBusinessResult.errors).toHaveLength(1);
      expect(invalidBusinessResult.errors[0].message).toBe(
        "Business name is required for business accounts"
      );

      // Personal account without company name (OK)
      const validPersonalResult = validator.validate({
        accountType: "personal",
        businessName: "",
      });
      expect(validPersonalResult.isValid()).toBe(true);
    });

    test("Conditional validation based on numeric values", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(fromContextPlugin)
        .for<{ age: number; guardianConsent: string }>()
        .v("age", (b) => b.number.required())
        .v("guardianConsent", (b) =>
          (b as any).string.fromContext({
            validate: (
              guardianConsent: string,
              context: any,
              allValues: { age: number }
            ) => {
              if (
                allValues.age < 18 &&
                (!guardianConsent || guardianConsent.trim() === "")
              ) {
                return {
                  valid: false,
                  message: "Guardian consent is required for users under 18",
                };
              }
              return { valid: true };
            },
            required: false,
          })
        )
        .build();

      // Minor with guardian consent
      const validMinorResult = validator.validate({
        age: 16,
        guardianConsent: "I agree",
      });
      expect(validMinorResult.isValid()).toBe(true);

      // Minor without guardian consent
      const invalidMinorResult = validator.validate({
        age: 16,
        guardianConsent: "",
      });
      expect(invalidMinorResult.isValid()).toBe(false);
      expect(invalidMinorResult.errors[0].message).toBe(
        "Guardian consent is required for users under 18"
      );

      // Adult without guardian consent (OK)
      const validAdultResult = validator.validate({
        age: 25,
        guardianConsent: "",
      });
      expect(validAdultResult.isValid()).toBe(true);
    });
  });

  describe("Error handling", () => {
    test("Error occurs in validation function", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ value: string }>()
        .v("value", (b) =>
          (b as any).string.fromContext({
            validate: (value: string, context: any) => {
              throw new Error("Validation function error");
            },
            required: false,
            errorMessage: "Custom error message",
          })
        )
        .build();

      const result = validator.validate({ value: "test" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Custom error message");
    });

    test("Custom error message", () => {
      const validator = Builder()
        .use(fromContextPlugin)
        .for<{ email: string }>()
        .v("email", (b) =>
          (b as any).string.fromContext({
            validate: (email: string, context: { hasEmail: boolean }) => ({
              valid: !context.hasEmail,
              message: "Validation specific message",
            }),
            required: true,
            errorMessage: "Custom fallback message",
          })
        )
        .build();

      const result = validator.validate({ email: "test@example.com" });
      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe("Custom fallback message");
    });
  });

  describe("Helper function tests", () => {
    test("passwordConfirmation helper", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(fromContextPlugin)
        .for<{ password: string; confirmPassword: string }>()
        .v("password", (b) => b.string.required())
        .v("confirmPassword", (b) =>
          (b as any).string.required().fromContext(passwordConfirmation())
        )
        .build();

      // When passwords match
      const validResult = validator.validate({
        password: "secret123",
        confirmPassword: "secret123",
      });
      expect(validResult.isValid()).toBe(true);

      // When passwords don't match
      const invalidResult = validator.validate({
        password: "secret123",
        confirmPassword: "different456",
      });
      expect(invalidResult.isValid()).toBe(false);
      expect(invalidResult.errors).toHaveLength(1);
      expect(invalidResult.errors[0].message).toBe(
        "Password confirmation does not match"
      );
    });
  });

  describe("Multiple field coordination", () => {
    test("Validation combining multiple conditions", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(fromContextPlugin)
        .for<{
          userType: string;
          age: number;
          parentEmail: string;
          businessLicense: string;
        }>()
        .v("userType", (b) => b.string.required())
        .v("age", (b) => b.number.required())
        .v("parentEmail", (b) =>
          (b as any).string.fromContext({
            validate: (
              parentEmail: string,
              context: any,
              allValues: { userType: string; age: number }
            ) => {
              if (
                allValues.userType === "personal" &&
                allValues.age < 18 &&
                (!parentEmail || parentEmail.trim() === "")
              ) {
                return {
                  valid: false,
                  message: "Parent email is required for minors",
                };
              }
              return { valid: true };
            },
            required: false,
          })
        )
        .v("businessLicense", (b) =>
          (b as any).string.fromContext({
            validate: (
              businessLicense: string,
              context: any,
              allValues: { userType: string }
            ) => {
              if (
                allValues.userType === "business" &&
                (!businessLicense || businessLicense.trim() === "")
              ) {
                return {
                  valid: false,
                  message: "Business license is required for business accounts",
                };
              }
              return { valid: true };
            },
            required: false,
          })
        )
        .build();

      // Minor personal user (with parent email)
      const validMinorResult = validator.validate({
        userType: "personal",
        age: 16,
        parentEmail: "parent@example.com",
        businessLicense: "",
      });
      expect(validMinorResult.isValid()).toBe(true);

      // Minor personal user (without parent email)
      const invalidMinorResult = validator.validate({
        userType: "personal",
        age: 16,
        parentEmail: "",
        businessLicense: "",
      });
      expect(invalidMinorResult.isValid()).toBe(false);
      expect(invalidMinorResult.errors[0].message).toBe(
        "Parent email is required for minors"
      );

      // Business user (with license)
      const validBusinessResult = validator.validate({
        userType: "business",
        age: 30,
        parentEmail: "",
        businessLicense: "BL123456",
      });
      expect(validBusinessResult.isValid()).toBe(true);

      // Business user (without license)
      const invalidBusinessResult = validator.validate({
        userType: "business",
        age: 30,
        parentEmail: "",
        businessLicense: "",
      });
      expect(invalidBusinessResult.isValid()).toBe(false);
      expect(invalidBusinessResult.errors[0].message).toBe(
        "Business license is required for business accounts"
      );

      // Adult personal user
      const validAdultResult = validator.validate({
        userType: "personal",
        age: 25,
        parentEmail: "",
        businessLicense: "",
      });
      expect(validAdultResult.isValid()).toBe(true);
    });
  });
});
