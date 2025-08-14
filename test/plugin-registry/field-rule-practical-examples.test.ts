/**
 * Practical Examples of Individual Field Validation
 *
 * This test suite demonstrates real-world usage patterns for individual
 * field validation using PluginRegistry, showing how to create reusable
 * field validators for common business scenarios.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  createPluginRegistry,
  FieldRule,
} from "../../src/core/registry/plugin-registry";

// Import commonly used plugins
import { requiredPlugin } from "../../src/core/plugin/required";
import { optionalPlugin } from "../../src/core/plugin/optional";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { stringPatternPlugin } from "../../src/core/plugin/stringPattern";
import { stringEmailPlugin } from "../../src/core/plugin/stringEmail";
import { numberRangePlugin } from "../../src/core/plugin/numberRange";
import { numberPositivePlugin } from "../../src/core/plugin/numberPositive";
import { transformPlugin } from "../../src/core/plugin/transform";
import { customPlugin } from "../../src/core/plugin/custom";
import { oneOfPlugin } from "../../src/core/plugin/oneOf";

describe("Practical Field Validation Examples", () => {
  // Create a shared registry with common plugins
  // Don't specify the type - let TypeScript infer it to preserve plugin types
  let commonRegistry: any;

  beforeEach(() => {
    commonRegistry = createPluginRegistry()
      .use(requiredPlugin)
      .use(optionalPlugin)
      .use(stringMinPlugin)
      .use(stringMaxPlugin)
      .use(stringPatternPlugin)
      .use(stringEmailPlugin)
      .use(numberRangePlugin)
      .use(numberPositivePlugin)
      .use(transformPlugin)
      .use(customPlugin)
      .use(oneOfPlugin);
  });

  describe("E-commerce Field Validators", () => {
    it("should create reusable product SKU validator", () => {
      // Create a reusable SKU validator
      const skuValidator: FieldRule<string> = commonRegistry.createFieldRule(
        (b) =>
          b.string
            .required()
            .pattern(/^SKU-[A-Z]{2}-\d{6}$/)
            .transform((v: string) => v.toUpperCase()),
        {
          name: "productSku",
          description: "Product SKU in format SKU-XX-000000",
        }
      );

      // Test valid SKUs
      expect(skuValidator.parse("sku-ab-123456").isValid()).toBe(true);
      expect(skuValidator.parse("SKU-CD-987654").isValid()).toBe(true);

      // Test invalid SKUs
      expect(skuValidator.validate("PROD-AB-123456").isValid()).toBe(false);
      expect(skuValidator.validate("SKU-A-123456").isValid()).toBe(false);
      expect(skuValidator.validate("SKU-AB-12345").isValid()).toBe(false);

      // Test transformation
      const result = skuValidator.parse("sku-ef-456789");
      if (result.isValid()) {
        expect(result.data()).toBe("SKU-EF-456789");
      }
    });

    it("should create price validator with business rules", () => {
      const priceValidator: FieldRule<number> = commonRegistry.createFieldRule(
        (b) =>
          b.number
            .required()
            .positive()
            .custom((value: number) => {
              // Check for two decimal places
              const decimalPlaces = (value.toString().split(".")[1] || "")
                .length;
              if (decimalPlaces > 2) {
                return {
                  valid: false,
                  message: "Price must have at most 2 decimal places",
                };
              }
              // Check minimum price
              if (value < 0.01) {
                return {
                  valid: false,
                  message: "Price must be at least $0.01",
                };
              }
              // Check maximum price
              if (value > 999999.99) {
                return {
                  valid: false,
                  message: "Price cannot exceed $999,999.99",
                };
              }
              return { valid: true };
            }),
        {
          name: "price",
          description: "Product price with 2 decimal places",
        }
      );

      // Valid prices
      expect(priceValidator.validate(19.99).isValid()).toBe(true);
      expect(priceValidator.validate(0.01).isValid()).toBe(true);
      expect(priceValidator.validate(100).isValid()).toBe(true);

      // Invalid prices
      expect(priceValidator.validate(19.999).isValid()).toBe(false); // Too many decimals
      expect(priceValidator.validate(0).isValid()).toBe(false); // Too low
      expect(priceValidator.validate(-10).isValid()).toBe(false); // Negative
      expect(priceValidator.validate(1000000).isValid()).toBe(false); // Too high
    });

    it("should create inventory status validator", () => {
      const inventoryStatusValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .optional()
              .default("in_stock")
              .oneOf(["in_stock", "out_of_stock", "pre_order", "discontinued"]),
          {
            name: "inventoryStatus",
            description: "Product inventory status",
          }
        );

      // Valid statuses
      expect(inventoryStatusValidator.validate("in_stock").isValid()).toBe(
        true
      );
      expect(inventoryStatusValidator.validate("out_of_stock").isValid()).toBe(
        true
      );

      // Default value when undefined
      const result = inventoryStatusValidator.parse(undefined);
      if (result.isValid()) {
        expect(result.data()).toBe("in_stock");
      }

      // Invalid status
      expect(inventoryStatusValidator.validate("available").isValid()).toBe(
        false
      );
    });
  });

  describe("User Registration Field Validators", () => {
    it("should create username validator with normalization", () => {
      const usernameValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .required()
              .min(3)
              .max(20)
              .pattern(/^[a-zA-Z0-9_]+$/)
              .transform((v: string) => v.toLowerCase())
              .custom((value: string) => {
                // Check for reserved usernames
                const reserved = ["admin", "root", "system", "api"];
                if (reserved.includes(value.toLowerCase())) {
                  return {
                    valid: false,
                    message: "This username is reserved",
                  };
                }
                return { valid: true };
              }),
          {
            name: "username",
            description: "Username with alphanumeric and underscore only",
          }
        );

      // Valid usernames
      expect(usernameValidator.parse("JohnDoe123").isValid()).toBe(true);
      expect(usernameValidator.parse("user_name").isValid()).toBe(true);

      // Check transformation
      const result = usernameValidator.parse("TestUser");
      if (result.isValid()) {
        expect(result.data()).toBe("testuser");
      }

      // Invalid usernames
      expect(usernameValidator.validate("ab").isValid()).toBe(false); // Too short
      expect(usernameValidator.validate("admin").isValid()).toBe(false); // Reserved
      expect(usernameValidator.validate("user@name").isValid()).toBe(false); // Invalid char
    });

    it("should create password strength validator", () => {
      const passwordValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .required()
              .min(8)
              .max(128)
              .custom((value: string) => {
                const checks = {
                  hasUpperCase: /[A-Z]/.test(value),
                  hasLowerCase: /[a-z]/.test(value),
                  hasNumber: /[0-9]/.test(value),
                  hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(value),
                };

                const strength = Object.values(checks).filter(Boolean).length;

                if (strength < 3) {
                  return {
                    valid: false,
                    message:
                      "Password must contain at least 3 of: uppercase, lowercase, number, special character",
                  };
                }

                // Check for common patterns
                if (/^(password|123456|qwerty)/i.test(value)) {
                  return {
                    valid: false,
                    message: "Password is too common",
                  };
                }

                return { valid: true };
              }),
          {
            name: "password",
            description: "Strong password validation",
          }
        );

      // Strong passwords
      expect(passwordValidator.validate("SecureP@ss123").isValid()).toBe(true);
      expect(passwordValidator.validate("MyStr0ng!Pass").isValid()).toBe(true);

      // Weak passwords
      expect(passwordValidator.validate("password123").isValid()).toBe(false); // Common
      expect(passwordValidator.validate("abcdefgh").isValid()).toBe(false); // Too simple
      expect(passwordValidator.validate("short").isValid()).toBe(false); // Too short
    });

    it("should create email validator with domain restrictions", () => {
      const corporateEmailValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .required()
              .email()
              .transform((v: string) => v.toLowerCase())
              .custom((value: string) => {
                // Check for corporate domains only
                const allowedDomains = [
                  "company.com",
                  "company.co.jp",
                  "company.eu",
                ];
                const domain = value.split("@")[1];

                if (!allowedDomains.includes(domain)) {
                  return {
                    valid: false,
                    message: `Email must be from one of: ${allowedDomains.join(", ")}`,
                  };
                }

                // Check for disposable email providers
                const disposableDomains = ["tempmail.com", "throwaway.email"];
                if (disposableDomains.includes(domain)) {
                  return {
                    valid: false,
                    message: "Disposable email addresses are not allowed",
                  };
                }

                return { valid: true };
              }),
          {
            name: "corporateEmail",
            description: "Corporate email validation",
          }
        );

      // Valid corporate emails
      expect(
        corporateEmailValidator.validate("john@company.com").isValid()
      ).toBe(true);
      expect(
        corporateEmailValidator.validate("user@company.co.jp").isValid()
      ).toBe(true);

      // Invalid emails
      expect(corporateEmailValidator.validate("user@gmail.com").isValid()).toBe(
        false
      );
      expect(
        corporateEmailValidator.validate("test@tempmail.com").isValid()
      ).toBe(false);
    });
  });

  describe("Financial Field Validators", () => {
    it("should create credit card number validator", () => {
      const creditCardValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .required()
              .pattern(/^\d{13,19}$/)
              .custom((value: string) => {
                // Remove spaces and dashes if any
                const cleanNumber = value.replace(/[\s-]/g, "");

                // Luhn algorithm validation
                let sum = 0;
                let isEven = false;

                for (let i = cleanNumber.length - 1; i >= 0; i--) {
                  let digit = parseInt(cleanNumber[i], 10);

                  if (isEven) {
                    digit *= 2;
                    if (digit > 9) {
                      digit -= 9;
                    }
                  }

                  sum += digit;
                  isEven = !isEven;
                }

                if (sum % 10 !== 0) {
                  return {
                    valid: false,
                    message: "Invalid credit card number",
                  };
                }

                return { valid: true };
              }),
          {
            name: "creditCard",
            description: "Credit card number with Luhn validation",
          }
        );

      // Valid credit card numbers (test numbers)
      expect(creditCardValidator.validate("4532015112830366").isValid()).toBe(
        true
      ); // Visa test
      expect(creditCardValidator.validate("5425233430109903").isValid()).toBe(
        true
      ); // Mastercard test

      // Invalid credit card numbers
      expect(creditCardValidator.validate("4532015112830367").isValid()).toBe(
        false
      ); // Invalid Luhn
      expect(creditCardValidator.validate("1234567890123456").isValid()).toBe(
        false
      ); // Invalid Luhn
    });

    it("should create IBAN validator", () => {
      const ibanValidator: FieldRule<string> = commonRegistry.createFieldRule(
        (b) =>
          b.string
            .required()
            .pattern(/^[A-Z]{2}\d{2}[A-Z0-9]+$/)
            .min(15)
            .max(34)
            .transform((v: string) => v.toUpperCase().replace(/\s/g, ""))
            .custom((value: string) => {
              // Basic IBAN format validation
              const countryCode = value.substring(0, 2);
              const checkDigits = value.substring(2, 4);

              // Validate country code (simplified list)
              const validCountries = [
                "DE",
                "FR",
                "GB",
                "ES",
                "IT",
                "NL",
                "BE",
                "CH",
              ];
              if (!validCountries.includes(countryCode)) {
                return {
                  valid: false,
                  message: `Unsupported country code: ${countryCode}`,
                };
              }

              // Validate check digits
              if (!/^\d{2}$/.test(checkDigits)) {
                return {
                  valid: false,
                  message: "Invalid check digits",
                };
              }

              return { valid: true };
            }),
        {
          name: "iban",
          description: "International Bank Account Number",
        }
      );

      // Valid IBANs
      expect(ibanValidator.parse("de89 3704 0044 0532 0130 00").isValid()).toBe(
        true
      );
      expect(ibanValidator.parse("FR1420041010050500013M02606").isValid()).toBe(
        true
      );

      // Invalid IBANs
      expect(ibanValidator.validate("US89370400440532013000").isValid()).toBe(
        false
      ); // Invalid country
      expect(ibanValidator.validate("DEXX370400440532013000").isValid()).toBe(
        false
      ); // Invalid check digits
    });
  });

  describe("Date and Time Field Validators", () => {
    it("should create future date validator", () => {
      const futureDateValidator: FieldRule<string> =
        commonRegistry.createFieldRule(
          (b) =>
            b.string
              .required()
              .pattern(/^\d{4}-\d{2}-\d{2}$/)
              .custom((value: string) => {
                const inputDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                if (isNaN(inputDate.getTime())) {
                  return {
                    valid: false,
                    message: "Invalid date format",
                  };
                }

                if (inputDate <= today) {
                  return {
                    valid: false,
                    message: "Date must be in the future",
                  };
                }

                // Max 1 year in the future
                const maxDate = new Date();
                maxDate.setFullYear(maxDate.getFullYear() + 1);
                if (inputDate > maxDate) {
                  return {
                    valid: false,
                    message: "Date cannot be more than 1 year in the future",
                  };
                }

                return { valid: true };
              }),
          {
            name: "futureDate",
            description: "Date must be in the future (max 1 year)",
          }
        );

      // Create test dates
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

      // Valid future dates
      expect(
        futureDateValidator
          .validate(tomorrow.toISOString().split("T")[0])
          .isValid()
      ).toBe(true);
      expect(
        futureDateValidator
          .validate(nextMonth.toISOString().split("T")[0])
          .isValid()
      ).toBe(true);

      // Invalid dates
      expect(futureDateValidator.validate("2020-01-01").isValid()).toBe(false); // Past
      expect(
        futureDateValidator
          .validate(twoYearsFromNow.toISOString().split("T")[0])
          .isValid()
      ).toBe(false); // Too far
    });
  });

  describe("Reusable Field Validator Factory", () => {
    it("should create a factory for common field validators", () => {
      // Create a factory function for common validators
      class FieldValidatorFactory {
        private registry: any; // Let TypeScript infer the type from the chained use() calls

        constructor() {
          this.registry = createPluginRegistry()
            .use(requiredPlugin)
            .use(optionalPlugin)
            .use(stringMinPlugin)
            .use(stringMaxPlugin)
            .use(stringPatternPlugin)
            .use(stringEmailPlugin)
            .use(transformPlugin)
            .use(customPlugin);
        }

        createEmailValidator(required = true): FieldRule<string> {
          return this.registry.createFieldRule(
            (b) => {
              const chain = b.string
                .email()
                .transform((v: string) => v.toLowerCase());
              return required ? chain : chain;
            },
            { name: "email", description: "Email address validation" }
          );
        }

        createPhoneValidator(pattern: RegExp): FieldRule<string> {
          return this.registry.createFieldRule(
            (b) => b.string.required().pattern(pattern),
            { name: "phone", description: "Phone number validation" }
          );
        }

        createPostalCodeValidator(
          country: "US" | "JP" | "UK"
        ): FieldRule<string> {
          const patterns = {
            US: /^\d{5}(-\d{4})?$/,
            JP: /^\d{3}-\d{4}$/,
            UK: /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i,
          };

          return this.registry.createFieldRule(
            (b) =>
              b.string
                .required()
                .pattern(patterns[country])
                .transform((v: string) => v.toUpperCase()),
            { name: "postalCode", description: `${country} postal code` }
          );
        }
      }

      const factory = new FieldValidatorFactory();

      // Test email validator
      const emailValidator = factory.createEmailValidator();
      expect(emailValidator.validate("user@example.com").isValid()).toBe(true);

      // Test phone validators for different countries
      const usPhoneValidator =
        factory.createPhoneValidator(/^\d{3}-\d{3}-\d{4}$/);
      expect(usPhoneValidator.validate("123-456-7890").isValid()).toBe(true);
      expect(usPhoneValidator.validate("1234567890").isValid()).toBe(false);

      // Test postal code validators
      const usPostalValidator = factory.createPostalCodeValidator("US");
      expect(usPostalValidator.validate("12345").isValid()).toBe(true);
      expect(usPostalValidator.validate("12345-6789").isValid()).toBe(true);

      const jpPostalValidator = factory.createPostalCodeValidator("JP");
      expect(jpPostalValidator.validate("123-4567").isValid()).toBe(true);
      expect(jpPostalValidator.validate("1234567").isValid()).toBe(false);
    });
  });
});
