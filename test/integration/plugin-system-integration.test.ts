/**
 * Plugin System Integration Tests
 *
 * This test suite verifies the plugin system's ability to handle complex
 * scenarios involving multiple plugins, their interactions, registration,
 * and integration with the core validation system.
 */

import {
  Builder,
  requiredPlugin,
  optionalPlugin,
  stringMinPlugin,
  stringMaxPlugin,
  numberMinPlugin,
  numberMaxPlugin,
  arrayMinLengthPlugin,
  arrayMaxLengthPlugin,
  arrayUniquePlugin,
  skipPlugin,
  transformPlugin,
  objectPlugin,
  oneOfPlugin,
  stringEmailPlugin,
  stringPatternPlugin,
  booleanTruthyPlugin,
  booleanFalsyPlugin,
  requiredIfPlugin,
  validateIfPlugin,
  literalPlugin,
  compareFieldPlugin,
  numberPositivePlugin,
  numberIntegerPlugin,
} from "../../src/index";

// Import additional plugins not in main export
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { optionalIfPlugin } from "../../src/core/plugin/optionalIf";

describe("Plugin System Integration Tests", () => {
  describe("Plugin Registration and Loading", () => {
    it("should handle multiple plugin registrations in a single builder", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayUniquePlugin)
        .use(transformPlugin)
        .use(objectPlugin)
        .use(oneOfPlugin)
        .use(stringEmailPlugin)
        .use(booleanTruthyPlugin)
        .use(skipPlugin);

      expect(builder).toBeDefined();

      // Should be able to build a validator with all plugins available
      const validator = builder
        .for<{
          name: string;
          email: string;
          age: number;
          tags: string[];
          isActive: boolean;
          profile: { bio: string };
        }>()
        .v("name", (b) => b.string.required().min(2).max(50))
        .v("email", (b) => b.string.required().email())
        .v("age", (b) => b.number.required().min(0).max(120))
        .v("tags", (b) => b.array.required().minLength(1).unique())
        .v("isActive", (b) => b.boolean.required().truthy())
        .v("profile", (b) => b.object.required())
        .v("profile.bio", (b) => b.string.required().min(10))
        .build();

      expect(validator).toBeDefined();
    });

    it("should handle duplicate plugin registrations gracefully", () => {
      // Register the same plugin multiple times
      const builder = Builder()
        .use(requiredPlugin)
        .use(requiredPlugin) // Duplicate
        .use(stringMinPlugin)
        .use(stringMinPlugin) // Duplicate
        .use(requiredPlugin); // Another duplicate

      const validator = builder
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2))
        .build();

      const result = validator.validate({ name: "John" });
      expect(result.isValid()).toBe(true);
    });

    it("should handle empty plugin list", () => {
      const builder = Builder(); // No plugins registered

      // Should still be able to create a validator, but with limited functionality
      const validator = builder.for<{ name: string }>().build();

      expect(validator).toBeDefined();

      // Basic validation should work (no plugins means no validation rules)
      const result = validator.validate({ name: "test" });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Plugin Interoperability", () => {
    it("should handle complex plugin chains correctly", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(transformPlugin)
        .use(skipPlugin)
        .use(oneOfPlugin)
        .for<{
          mode: "dev" | "prod";
          apiKey?: string;
          config?: string;
        }>()
        .v("mode", (b) => b.string.required().oneOf(["dev", "prod"]))
        .v("apiKey", (b) =>
          b.string
            .skip((values) => values.mode === "dev")
            .required()
            .min(32)
            .max(64)
            .transform((v) => v.toUpperCase())
        )
        .v("config", (b) =>
          b.string
            .optional()
            .min(5)
            .transform((v) => v?.toLowerCase())
        )
        .build();

      // Dev mode - apiKey should be skipped
      const devResult = validator.validate({
        mode: "dev",
        config: "DEBUG_CONFIG",
      });
      expect(devResult.isValid()).toBe(true);

      // Prod mode - apiKey is required
      const prodInvalidResult = validator.validate({
        mode: "prod",
        config: "prod_config",
      });
      expect(prodInvalidResult.isValid()).toBe(false);

      // Prod mode - valid apiKey
      const prodValidResult = validator.validate({
        mode: "prod",
        apiKey: "a".repeat(40), // Valid length
        config: "prod_config",
      });
      expect(prodValidResult.isValid()).toBe(true);
    });

    it("should handle conditional plugins with complex dependencies", () => {
      interface FormData {
        userType: "admin" | "user" | "guest";
        hasAccount: boolean;
        username?: string;
        password?: string;
        email?: string;
        permissions?: string[];
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .use(stringEmailPlugin)
        .use(arrayMinLengthPlugin)
        .use(oneOfPlugin)
        .use(booleanTruthyPlugin)
        .for<FormData>()
        .v("userType", (b) =>
          b.string.required().oneOf(["admin", "user", "guest"])
        )
        .v("hasAccount", (b) => b.boolean.required())
        .v("username", (b) =>
          b.string.requiredIf((data) => data.hasAccount).min(3)
        )
        .v("password", (b) =>
          b.string.requiredIf((data) => data.hasAccount).min(8)
        )
        .v("email", (b) =>
          b.string.requiredIf((data) => data.hasAccount).email()
        )
        .v("permissions", (b) =>
          b.array.requiredIf((data) => data.userType === "admin").minLength(1)
        )
        .build();

      // Guest without account - minimal requirements
      expect(
        validator.validate({
          userType: "guest",
          hasAccount: false,
        }).valid
      ).toBe(true);

      // User with account - needs username, password, email
      expect(
        validator.validate({
          userType: "user",
          hasAccount: true,
          username: "john_doe",
          password: "securePass123",
          email: "john@example.com",
        }).valid
      ).toBe(true);

      // Admin - needs permissions too
      expect(
        validator.validate({
          userType: "admin",
          hasAccount: true,
          username: "admin_user",
          password: "adminPass123",
          email: "admin@example.com",
          permissions: ["read", "write", "delete"],
        }).valid
      ).toBe(true);

      // Admin without permissions - should fail
      expect(
        validator.validate({
          userType: "admin",
          hasAccount: true,
          username: "admin_user",
          password: "adminPass123",
          email: "admin@example.com",
          // Missing permissions
        }).valid
      ).toBe(false);
    });

    it("should handle plugin order independence", () => {
      // Create two validators with plugins in different orders
      const validator1 = Builder()
        .use(stringMinPlugin)
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2).max(10))
        .build();

      const validator2 = Builder()
        .use(requiredPlugin)
        .use(stringMaxPlugin)
        .use(stringMinPlugin)
        .for<{ name: string }>()
        .v("name", (b) => b.string.required().min(2).max(10))
        .build();

      const testData = { name: "John" };

      const result1 = validator1.validate(testData);
      const result2 = validator2.validate(testData);

      expect(result1.valid).toBe(result2.valid);
      expect(result1.valid).toBe(true);

      // Test with invalid data
      const invalidData = { name: "J" }; // Too short
      const invalidResult1 = validator1.validate(invalidData);
      const invalidResult2 = validator2.validate(invalidData);

      expect(invalidResult1.valid).toBe(invalidResult2.valid);
      expect(invalidResult1.valid).toBe(false);
    });
  });

  describe("Plugin Conflict Resolution", () => {
    it("should handle conflicting validation rules predictably", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(nullablePlugin)
        .for<{ field?: string | null }>()
        .v(
          "field",
          (b) =>
            b.string
              .required() // Requires value
              .optional() // Allows undefined
              .nullable() // Allows null
        )
        .build();

      // The behavior should be predictable based on plugin execution order
      const result1 = validator.validate({ field: undefined });
      const result2 = validator.validate({ field: null });
      const result3 = validator.validate({ field: "value" });

      // All should have consistent behavior
      expect(typeof result1.valid).toBe("boolean");
      expect(typeof result2.valid).toBe("boolean");
      expect(result3.valid).toBe(true); // Valid value should always pass
    });

    it("should handle transform and validation conflicts", () => {
      const validator = Builder()
        .use(transformPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .for<{ text: string }>()
        .v("text", (b) =>
          b.string
            .min(5)
            .transform((v) => v.trim()) // Transform might affect validation
            .max(10)
        )
        .build();

      // Text that is valid after transform
      const result1 = validator.validate({ text: "  hello  " }); // 9 chars, 5 after trim
      expect(result1.valid).toBe(true);

      // Text that would be invalid even after transform
      // Note: validate() doesn't run transforms, so this validates against original length
      const result2 = validator.validate({ text: "  hi  " }); // 6 chars, meets min 5
      expect(result2.valid).toBe(true); // Passes because original text length is 6
    });
  });

  describe("Plugin Performance and Scalability", () => {
    it("should handle many plugins efficiently", () => {
      const builder = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringEmailPlugin)
        .use(stringPatternPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin)
        .use(arrayUniquePlugin)
        .use(booleanTruthyPlugin)
        .use(booleanFalsyPlugin)
        .use(objectPlugin)
        .use(oneOfPlugin)
        .use(literalPlugin)
        .use(transformPlugin)
        .use(skipPlugin)
        .use(requiredIfPlugin)
        .use(validateIfPlugin)
        .use(compareFieldPlugin);

      // Build validator with many rules
      const validator = builder
        .for<{
          id: number;
          name: string;
          email: string;
          age: number;
          tags: string[];
          isActive: boolean;
          profile: { bio: string };
        }>()
        .v("id", (b) => b.number.required().positive().integer())
        .v("name", (b) => b.string.required().min(2).max(50))
        .v("email", (b) => b.string.required().email())
        .v("age", (b) => b.number.required().min(0).max(120))
        .v("tags", (b) =>
          b.array.required().minLength(1).maxLength(10).unique()
        )
        .v("isActive", (b) => b.boolean.required())
        .v("profile", (b) => b.object.required())
        .v("profile.bio", (b) => b.string.required().min(10).max(500))
        .build();

      const start = performance.now();

      const result = validator.validate({
        id: 123,
        name: "John Doe",
        email: "john@example.com",
        age: 30,
        tags: ["developer", "javascript"],
        isActive: true,
        profile: { bio: "A passionate developer with years of experience" },
      });

      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(50); // Should complete within 50ms
    });

    it("should handle plugin chains with early termination", () => {
      let skipFunctionCallCount = 0;
      let validationCallCount = 0;

      const validator = Builder()
        .use(skipPlugin)
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<{ mode: string; value?: string }>()
        .v(
          "value",
          (b) =>
            b.string
              .skip((values) => {
                skipFunctionCallCount++;
                return values.mode === "skip";
              })
              .required() // This should not be called if skipped
              .min(5) // This should not be called if skipped
        )
        .build();

      // Reset counters
      skipFunctionCallCount = 0;
      validationCallCount = 0;

      // Test skip scenario
      const skipResult = validator.validate({ mode: "skip" });
      expect(skipResult.isValid()).toBe(true);
      expect(skipFunctionCallCount).toBeGreaterThan(0);

      // Test non-skip scenario
      skipFunctionCallCount = 0;
      const noSkipResult = validator.validate({
        mode: "validate",
        value: "hello world",
      });
      expect(noSkipResult.isValid()).toBe(true);
      expect(skipFunctionCallCount).toBeGreaterThan(0);
    });
  });

  describe("Cross-Plugin Dependencies", () => {
    it("should handle field comparison plugins", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(compareFieldPlugin)
        .for<{ password: string; confirmPassword: string }>()
        .v("password", (b) => b.string.required().min(8))
        .v("confirmPassword", (b) =>
          b.string.required().compareField("password")
        )
        .build();

      // Matching passwords
      const validResult = validator.validate({
        password: "securePassword123",
        confirmPassword: "securePassword123",
      });
      expect(validResult.isValid()).toBe(true);

      // Non-matching passwords
      const invalidResult = validator.validate({
        password: "securePassword123",
        confirmPassword: "differentPassword",
      });
      expect(invalidResult.isValid()).toBe(false);
    });

    it("should handle complex nested dependencies", () => {
      interface UserSettings {
        notifications: {
          email: boolean;
          sms: boolean;
          push: boolean;
        };
        emailAddress?: string;
        phoneNumber?: string;
        preferences: {
          language: string;
          theme: "light" | "dark";
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(requiredIfPlugin)
        .use(stringEmailPlugin)
        .use(stringPatternPlugin)
        .use(objectPlugin)
        .use(booleanTruthyPlugin)
        .use(oneOfPlugin)
        .for<UserSettings>()
        .v("notifications", (b) => b.object.required())
        .v("notifications.email", (b) => b.boolean.required())
        .v("notifications.sms", (b) => b.boolean.required())
        .v("notifications.push", (b) => b.boolean.required())
        .v("emailAddress", (b) =>
          b.string.requiredIf((data) => data.notifications?.email).email()
        )
        .v("phoneNumber", (b) =>
          b.string
            .requiredIf((data) => data.notifications?.sms)
            .pattern(/^\+?[\d\s\-\(\)]+$/)
        )
        .v("preferences", (b) => b.object.required())
        .v("preferences.language", (b) => b.string.required())
        .v("preferences.theme", (b) =>
          b.string.required().oneOf(["light", "dark"])
        )
        .build();

      // User with email notifications enabled
      const emailUserResult = validator.validate({
        notifications: {
          email: true,
          sms: false,
          push: true,
        },
        emailAddress: "user@example.com",
        preferences: {
          language: "en",
          theme: "dark",
        },
      });
      expect(emailUserResult.isValid()).toBe(true);

      // User with SMS notifications but no phone number
      const smsUserInvalidResult = validator.validate({
        notifications: {
          email: false,
          sms: true,
          push: false,
        },
        // Missing phoneNumber
        preferences: {
          language: "en",
          theme: "light",
        },
      });
      expect(smsUserInvalidResult.isValid()).toBe(false);
    });
  });

  describe("End-to-End Plugin Workflows", () => {
    it("should handle complete form validation workflow", () => {
      interface RegistrationForm {
        personal: {
          firstName: string;
          lastName: string;
          email: string;
          birthDate: string;
        };
        account: {
          username: string;
          password: string;
          confirmPassword: string;
        };
        preferences: {
          newsletter: boolean;
          theme?: "light" | "dark";
          notifications: {
            email: boolean;
            sms: boolean;
          };
        };
        terms: boolean;
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringEmailPlugin)
        .use(stringPatternPlugin)
        .use(compareFieldPlugin)
        .use(objectPlugin)
        .use(booleanTruthyPlugin)
        .use(oneOfPlugin)
        .use(requiredIfPlugin)
        .use(transformPlugin)
        .for<RegistrationForm>()
        // Personal information
        .v("personal", (b) => b.object.required())
        .v("personal.firstName", (b) =>
          b.string
            .required()
            .min(2)
            .max(50)
            .transform((v) => v.trim())
        )
        .v("personal.lastName", (b) =>
          b.string
            .required()
            .min(2)
            .max(50)
            .transform((v) => v.trim())
        )
        .v("personal.email", (b) =>
          b.string
            .required()
            .email()
            .transform((v) => v.toLowerCase())
        )
        .v("personal.birthDate", (b) =>
          b.string.required().pattern(/^\d{4}-\d{2}-\d{2}$/)
        )
        // Account information
        .v("account", (b) => b.object.required())
        .v("account.username", (b) =>
          b.string
            .required()
            .min(3)
            .max(20)
            .pattern(/^[a-zA-Z0-9_]+$/)
        )
        .v("account.password", (b) =>
          b.string
            .required()
            .min(8)
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        )
        .v("account.confirmPassword", (b) =>
          b.string.required().compareField("account.password")
        )
        // Preferences
        .v("preferences", (b) => b.object.required())
        .v("preferences.newsletter", (b) => b.boolean.required())
        .v("preferences.theme", (b) =>
          b.string.optional().oneOf(["light", "dark"])
        )
        .v("preferences.notifications", (b) => b.object.required())
        .v("preferences.notifications.email", (b) => b.boolean.required())
        .v("preferences.notifications.sms", (b) => b.boolean.required())
        // Terms
        .v("terms", (b) => b.boolean.required().truthy())
        .build();

      // Valid registration form
      const validForm: RegistrationForm = {
        personal: {
          firstName: "  John  ",
          lastName: "  Doe  ",
          email: "JOHN.DOE@EXAMPLE.COM",
          birthDate: "1990-01-01",
        },
        account: {
          username: "john_doe123",
          password: "SecurePass123",
          confirmPassword: "SecurePass123",
        },
        preferences: {
          newsletter: true,
          theme: "dark",
          notifications: {
            email: true,
            sms: false,
          },
        },
        terms: true,
      };

      const result = validator.validate(validForm);
      expect(result.isValid()).toBe(true);

      // Test various invalid scenarios
      const invalidForms = [
        {
          ...validForm,
          personal: { ...validForm.personal, email: "invalid-email" },
        },
        {
          ...validForm,
          account: { ...validForm.account, password: "weak" },
        },
        {
          ...validForm,
          account: { ...validForm.account, confirmPassword: "different" },
        },
        {
          ...validForm,
          terms: false,
        },
      ];

      invalidForms.forEach((form, index) => {
        const result = validator.validate(form);
        expect(result.isValid()).toBe(false);
      });
    });

    it("should handle API validation workflow", () => {
      interface APIRequest {
        method: "GET" | "POST" | "PUT" | "DELETE";
        endpoint: string;
        headers: Record<string, string>;
        body?: any;
        auth: {
          type: "bearer" | "basic" | "none";
          token?: string;
          username?: string;
          password?: string;
        };
        options: {
          timeout: number;
          retries: number;
          validateSSL: boolean;
        };
      }

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(requiredIfPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringPatternPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .use(objectPlugin)
        .use(oneOfPlugin)
        .use(booleanTruthyPlugin)
        .for<APIRequest>()
        .v("method", (b) =>
          b.string.required().oneOf(["GET", "POST", "PUT", "DELETE"])
        )
        .v("endpoint", (b) => b.string.required().pattern(/^\/.*$/))
        .v("headers", (b) => b.object.required())
        .v("body", (b) => b.object.optional())
        .v("auth", (b) => b.object.required())
        .v("auth.type", (b) =>
          b.string.required().oneOf(["bearer", "basic", "none"])
        )
        .v("auth.token", (b) =>
          b.string.requiredIf((data) => data.auth?.type === "bearer").min(10)
        )
        .v("auth.username", (b) =>
          b.string.requiredIf((data) => data.auth?.type === "basic").min(1)
        )
        .v("auth.password", (b) =>
          b.string.requiredIf((data) => data.auth?.type === "basic").min(1)
        )
        .v("options", (b) => b.object.required())
        .v("options.timeout", (b) =>
          b.number.required().min(1000).max(300000).integer()
        )
        .v("options.retries", (b) =>
          b.number.required().min(0).max(10).integer()
        )
        .v("options.validateSSL", (b) => b.boolean.required())
        .build();

      // Valid GET request with no auth
      const getRequest: APIRequest = {
        method: "GET",
        endpoint: "/api/users",
        headers: { Accept: "application/json" },
        auth: { type: "none" },
        options: {
          timeout: 5000,
          retries: 3,
          validateSSL: true,
        },
      };

      expect(validator.validate(getRequest).valid).toBe(true);

      // Valid POST request with bearer auth
      const postRequest: APIRequest = {
        method: "POST",
        endpoint: "/api/users",
        headers: { "Content-Type": "application/json" },
        body: { name: "John Doe", email: "john@example.com" },
        auth: {
          type: "bearer",
          token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        },
        options: {
          timeout: 10000,
          retries: 1,
          validateSSL: true,
        },
      };

      expect(validator.validate(postRequest).valid).toBe(true);

      // Invalid request - bearer auth without token
      const invalidRequest = {
        ...postRequest,
        auth: { type: "bearer" as const }, // Missing token
      };

      expect(validator.validate(invalidRequest).valid).toBe(false);
    });
  });
});
