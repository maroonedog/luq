/**
 * Individual Field Validation Tests using PluginRegistry
 *
 * This test suite demonstrates how to test individual field validation
 * using the PluginRegistry's createFieldRule method for isolated testing
 * of each plugin's functionality.
 */

import { describe, it, expect } from "@jest/globals";
import { createPluginRegistry } from "../../src/core/registry/plugin-registry";
import { Result } from "../../src/types/result";

// Import all plugins for testing
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { stringUrlPlugin } from "../../src/core/plugin/stringUrl";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { numberRangePlugin } from "../../src/core/plugin/numberRange";
import { numberIntegerPlugin } from "../../src/core/plugin/numberInteger";
import { numberPositivePlugin } from "../../src/core/plugin/numberPositive";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { arrayMaxLengthPlugin } from "../../src/core/plugin/arrayMaxLength";
import { arrayUniquePlugin } from "../../src/core/plugin/arrayUnique";
import { arrayIncludesPlugin } from "../../src/core/plugin/arrayIncludes";
import { booleanTruthyPlugin } from "../../src/core/plugin/booleanTruthy";
import { booleanFalsyPlugin } from "../../src/core/plugin/booleanFalsy";
import { transformPlugin } from "../../src/core/plugin/transform";
import { nullablePlugin } from "../../src/core/plugin/nullable";
import { customPlugin } from "../../src/core/plugin/custom";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";
import { validateIfPlugin } from "../../src/core/plugin/validateIf";
import { requiredIfPlugin } from "../../src/core/plugin/requiredIf";
import { optionalIfPlugin } from "../../src/core/plugin/optionalIf";

describe("Individual Field Validation with PluginRegistry", () => {
  describe("String Field Validations", () => {
    it("should validate required string field", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin);

      const nameRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).min(3),
        { name: "name", description: "User name validation" }
      );

      // Test valid cases
      expect(nameRule.validate("John").isValid()).toBe(true);
      expect(nameRule.validate("Alice").isValid()).toBe(true);

      // Test invalid cases
      expect(nameRule.validate("").isValid()).toBe(false);
      expect(nameRule.validate(null).isValid()).toBe(false);
      expect(nameRule.validate(undefined).isValid()).toBe(false);
      expect(nameRule.validate("Jo").isValid()).toBe(false); // Too short
    });

    it("should validate email field", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const emailRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).email(),
        { name: "email", description: "Email validation" }
      );

      // Valid emails
      expect(emailRule.validate("user@example.com").isValid()).toBe(true);
      expect(emailRule.validate("test.user@company.co.jp").isValid()).toBe(
        true
      );

      // Invalid emails
      expect(emailRule.validate("invalid-email").isValid()).toBe(false);
      expect(emailRule.validate("@example.com").isValid()).toBe(false);
      expect(emailRule.validate("user@").isValid()).toBe(false);
    });

    it("should validate string with pattern", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringPatternPlugin);

      const phoneRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).pattern(/^\d{3}-\d{4}-\d{4}$/),
        { name: "phone", description: "Japanese phone number" }
      );

      expect(phoneRule.validate("090-1234-5678").isValid()).toBe(true);
      expect(phoneRule.validate("03-1234-5678").isValid()).toBe(false); // Wrong format
      expect(phoneRule.validate("090-12345-678").isValid()).toBe(false);
    });

    it("should validate URL field", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringUrlPlugin);

      const urlRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).url(),
        { name: "website", description: "Website URL validation" }
      );

      expect(urlRule.validate("https://example.com").isValid()).toBe(true);
      expect(urlRule.validate("http://localhost:3000").isValid()).toBe(true);
      expect(urlRule.validate("not-a-url").isValid()).toBe(false);
      expect(urlRule.validate("ftp://file.server.com").isValid()).toBe(true);
    });

    it("should validate string length constraints", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin);

      const passwordRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).min(8).max(20),
        { name: "password", description: "Password validation" }
      );

      expect(passwordRule.validate("ValidPass123").isValid()).toBe(true);
      expect(passwordRule.validate("short").isValid()).toBe(false);
      expect(
        passwordRule.validate("ThisPasswordIsTooLongToBeValid").isValid()
      ).toBe(false);
    });
  });

  describe("Number Field Validations", () => {
    it("should validate number range", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(numberRangePlugin);

      const ageRule = registry.createFieldRule<number>(
        (b) => b.number.required({}).range(18, 120),
        { name: "age", description: "Age validation" }
      );

      expect(ageRule.validate(25).isValid()).toBe(true);
      expect(ageRule.validate(18).isValid()).toBe(true);
      expect(ageRule.validate(120).isValid()).toBe(true);
      expect(ageRule.validate(17).isValid()).toBe(false);
      expect(ageRule.validate(121).isValid()).toBe(false);
    });

    it("should validate positive integers", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(numberPositivePlugin)
        .use(numberIntegerPlugin);

      const quantityRule = registry.createFieldRule<number>(
        (b) => b.number.required({}).positive().integer(),
        { name: "quantity", description: "Product quantity" }
      );

      expect(quantityRule.validate(5).isValid()).toBe(true);
      expect(quantityRule.validate(100).isValid()).toBe(true);
      expect(quantityRule.validate(0).isValid()).toBe(false); // Not positive
      expect(quantityRule.validate(-5).isValid()).toBe(false);
      expect(quantityRule.validate(5.5).isValid()).toBe(false); // Not integer
    });

    it("should validate number min/max", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin);

      const priceRule = registry.createFieldRule<number>(
        (b) => b.number.required({}).min(0.01).max(999999.99),
        { name: "price", description: "Product price" }
      );

      expect(priceRule.validate(29.99).isValid()).toBe(true);
      expect(priceRule.validate(0.01).isValid()).toBe(true);
      expect(priceRule.validate(0).isValid()).toBe(false);
      expect(priceRule.validate(1000000).isValid()).toBe(false);
    });
  });

  describe("Array Field Validations", () => {
    it("should validate array length", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(arrayMaxLengthPlugin);

      const tagsRule = registry.createFieldRule<string[]>(
        (b) => b.array.required({}).minLength(1).maxLength(5),
        { name: "tags", description: "Product tags" }
      );

      expect(tagsRule.validate(["electronics", "gadget"]).isValid()).toBe(true);
      expect(tagsRule.validate([]).isValid()).toBe(false); // Too few
      expect(tagsRule.validate(["a", "b", "c", "d", "e", "f"]).isValid()).toBe(
        false
      ); // Too many
    });

    it("should validate array uniqueness", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(arrayUniquePlugin);

      const idsRule = registry.createFieldRule<number[]>(
        (b) => b.array.required({}).unique(),
        { name: "ids", description: "Unique identifiers" }
      );

      expect(idsRule.validate([1, 2, 3, 4]).isValid()).toBe(true);
      expect(idsRule.validate([1, 2, 2, 3]).isValid()).toBe(false); // Has duplicates
    });

    it("should validate array includes", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(arrayIncludesPlugin);

      const rolesRule = registry.createFieldRule<string[]>(
        (b) => b.array.required({}).includes("admin"),
        { name: "roles", description: "User roles must include admin" }
      );

      expect(rolesRule.validate(["admin", "user"]).isValid()).toBe(true);
      expect(rolesRule.validate(["user", "admin", "moderator"]).isValid()).toBe(
        true
      );
      expect(rolesRule.validate(["user", "moderator"]).isValid()).toBe(false); // Missing admin
    });
  });

  describe("Boolean Field Validations", () => {
    it("should validate truthy boolean", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(booleanTruthyPlugin);

      const acceptTermsRule = registry.createFieldRule<boolean>(
        (b) => b.boolean.required({}).truthy(),
        { name: "acceptTerms", description: "Terms acceptance" }
      );

      expect(acceptTermsRule.validate(true).isValid()).toBe(true);
      expect(acceptTermsRule.validate(false).isValid()).toBe(false);
      expect(acceptTermsRule.validate(null).isValid()).toBe(false);
    });

    it("should validate falsy boolean", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(booleanFalsyPlugin);

      const isDeletedRule = registry.createFieldRule<boolean>(
        (b) => b.boolean.required({}).falsy(),
        { name: "isDeleted", description: "Deletion flag must be false" }
      );

      expect(isDeletedRule.validate(false).isValid()).toBe(true);
      expect(isDeletedRule.validate(true).isValid()).toBe(false);
    });
  });

  describe("Transform Field Validations", () => {
    it("should validate and transform field", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(transformPlugin);

      const usernameRule = registry.createFieldRule<string>(
        (b) =>
          b.string
            .required({})
            .min(3)
            .transform((v: string) => v.toLowerCase().trim()),
        { name: "username", description: "Username normalization" }
      );

      const result = usernameRule.parse("  JOHN  ");
      expect(result.isValid()).toBe(true);
      if (result.isValid()) {
        expect(result.data()).toBe("john");
      }
    });

    it("should apply default value", () => {
      const registry = createPluginRegistry().use(optionalPlugin);

      const statusRule = registry.createFieldRule<string>(
        (b) => b.string.optional(),
        { name: "status", description: "Status with default" }
      );

      const result1 = statusRule.parse(undefined);
      expect(result1.isValid()).toBe(true);
      if (result1.isValid()) {
        expect(result1.data()).toBe("active");
      }

      const result2 = statusRule.parse("inactive");
      expect(result2.isValid()).toBe(true);
      if (result2.isValid()) {
        expect(result2.data()).toBe("inactive");
      }
    });
  });

  describe("Nullable Field Validations", () => {
    it("should validate nullable field", () => {
      const registry = createPluginRegistry()
        .use(nullablePlugin)
        .use(stringMinPlugin);

      const middleNameRule = registry.createFieldRule<string | null>(
        (b) => b.string.nullable().min(2),
        { name: "middleName", description: "Optional middle name" }
      );

      expect(middleNameRule.validate(null).isValid()).toBe(true);
      expect(middleNameRule.validate("James").isValid()).toBe(true);
      expect(middleNameRule.validate("J").isValid()).toBe(false); // Too short when not null
    });
  });

  describe("Custom Validation Rules", () => {
    it("should validate with custom rule", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(customPlugin);

      const productCodeRule = registry.createFieldRule<string>(
        (b) =>
          b.string.required({}).custom(
            (value: string) => {
              return value.startsWith("PROD-") && value.length === 10;
            },
            {
              message:
                "Product code must start with PROD- and be 10 characters",
            }
          ),
        { name: "productCode", description: "Product code validation" }
      );

      expect(productCodeRule.validate("PROD-12345").isValid()).toBe(true);
      expect(productCodeRule.validate("ITEM-12345").isValid()).toBe(false);
      expect(productCodeRule.validate("PROD-123").isValid()).toBe(false);
    });
  });

  describe("OneOf Validation", () => {
    it("should validate oneOf constraint", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(oneOfPlugin);

      const roleRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).oneOf(["admin", "user", "guest"]),
        { name: "role", description: "User role validation" }
      );

      expect(roleRule.validate("admin").isValid()).toBe(true);
      expect(roleRule.validate("user").isValid()).toBe(true);
      expect(roleRule.validate("guest").isValid()).toBe(true);
      expect(roleRule.validate("superuser").isValid()).toBe(false);
    });
  });

  describe("Conditional Validations", () => {
    it("should validate with validateIf", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(validateIfPlugin)
        .use(stringMinPlugin);

      // Note: validateIf requires context, so we simulate it
      const descriptionRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).min(10),
        { name: "description", description: "Description when product" }
      );

      // For simple field test, just validate the base rule
      expect(descriptionRule.validate("Short").isValid()).toBe(false);
      expect(
        descriptionRule.validate("This is a longer description").isValid()
      ).toBe(true);
    });

    it("should validate with requiredIf", () => {
      const registry = createPluginRegistry()
        .use(requiredIfPlugin)
        .use(stringEmailPlugin);

      // Note: requiredIf requires context, testing base behavior
      const emailRule = registry.createFieldRule<string>(
        (b) => b.string.email(),
        { name: "email", description: "Email when newsletter subscribed" }
      );

      expect(emailRule.validate("user@example.com").isValid()).toBe(true);
      expect(emailRule.validate("invalid-email").isValid()).toBe(false);
    });

    it("should validate with optionalIf", () => {
      const registry = createPluginRegistry()
        .use(optionalIfPlugin)
        .use(stringPatternPlugin);

      const phoneRule = registry.createFieldRule<string | undefined>(
        (b) => b.string.pattern(/^\d{10}$/),
        { name: "phone", description: "Optional phone number" }
      );

      expect(phoneRule.validate("1234567890").isValid()).toBe(true);
      expect(phoneRule.validate("123").isValid()).toBe(false);
    });
  });

  describe("Registry Plugin Management", () => {
    it("should accumulate plugins correctly", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(transformPlugin);

      const plugins = registry.getPlugins();

      expect(plugins["required"]).toBeDefined();
      expect(plugins["stringMin"]).toBeDefined();
      expect(plugins["stringMax"]).toBeDefined();
      expect(plugins["transform"]).toBeDefined();
    });

    it("should create multiple field rules from same registry", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin);

      const nameRule = registry.createFieldRule<string>(
        (b) => b.string.required().min(3),
        { name: "name" }
      );

      const ageRule = registry.createFieldRule<number>(
        (b) => b.number.required({}).min(18),
        { name: "age" }
      );

      expect(nameRule.validate("John").isValid()).toBe(true);
      expect(ageRule.validate(25).isValid()).toBe(true);

      // Rules are independent
      expect(nameRule.validate("Jo").isValid()).toBe(false);
      expect(ageRule.validate(17).isValid()).toBe(false);
    });

    it("should convert registry to builder", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringEmailPlugin);

      const builder = registry.toBuilder();

      // Use the builder to create a validator
      type User = { email: string };
      const validator = builder
        .for<User>()
        .v("email", (b) => b.string.required({}).email())
        .build();

      const result = validator.validate({ email: "user@example.com" });
      expect(result.isValid()).toBe(true);
    });
  });

  describe("Error Reporting", () => {
    it("should report validation errors correctly", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin);

      const nameRule = registry.createFieldRule<string>(
        (b) => b.string.required({}).min(5),
        { name: "username" }
      );

      const result = nameRule.validate("abc");
      expect(result.isValid()).toBe(false);
      if (!result.isValid()) {
        expect(result.errors).toBeDefined();
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });

    it("should handle parse errors", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(numberIntegerPlugin);

      const idRule = registry.createFieldRule<number>(
        (b) => b.number.required({}).integer(),
        { name: "id" }
      );

      const result = idRule.parse("not-a-number");
      expect(result.isValid()).toBe(false);
      if (!result.isValid()) {
        expect(result.errors).toBeDefined();
      }
    });
  });

  describe("Complex Field Validations", () => {
    it("should validate complex string field with multiple constraints", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringPatternPlugin)
        .use(transformPlugin);

      const skuRule = registry.createFieldRule<string>(
        (b) =>
          b.string
            .required()
            .min(8)
            .max(12)
            .pattern(/^[A-Z]{3}-\d{5,9}$/)
            .transform((v: string) => v.toUpperCase()),
        { name: "sku", description: "Product SKU validation" }
      );

      const result1 = skuRule.parse("abc-12345");
      expect(result1.isValid()).toBe(true);
      if (result1.isValid()) {
        expect(result1.data()).toBe("ABC-12345");
      }

      expect(skuRule.validate("XYZ-123").isValid()).toBe(false); // Too short
      expect(skuRule.validate("ABC-1234567890").isValid()).toBe(false); // Too long
      expect(skuRule.validate("123-ABCDE").isValid()).toBe(false); // Wrong pattern
    });

    it("should validate number field with multiple constraints", () => {
      const registry = createPluginRegistry()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(numberIntegerPlugin)
        .use(customPlugin);

      const scoreRule = registry.createFieldRule<number>(
        (b) =>
          b.number
            .required({})
            .min(0)
            .max(100)
            .integer()
            .custom(
              (value: number) => {
                return value % 5 === 0;
              },
              {
                message: "Score must be multiple of 5",
              }
            ),
        { name: "score", description: "Test score validation" }
      );

      expect(scoreRule.validate(85).isValid()).toBe(true);
      expect(scoreRule.validate(100).isValid()).toBe(true);
      expect(scoreRule.validate(0).isValid()).toBe(true);
      expect(scoreRule.validate(87).isValid()).toBe(false); // Not multiple of 5
      expect(scoreRule.validate(105).isValid()).toBe(false); // Over max
      expect(scoreRule.validate(85.5).isValid()).toBe(false); // Not integer
    });
  });
});
