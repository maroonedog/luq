import { Builder } from "../../src/core";
import {
  requiredPlugin,
  stringMinPlugin,
  stringMaxPlugin,
  stringEmailPlugin,
  stringPatternPlugin,
  numberMinPlugin,
  numberMaxPlugin,
  objectPlugin,
  arrayMinLengthPlugin,
  transformPlugin,
} from "../../src/core";

describe("Real-world abortEarly scenarios", () => {
  describe("User Registration Form", () => {
    type RegistrationForm = {
      username: string;
      email: string;
      password: string;
      confirmPassword: string;
      age: number;
      acceptTerms: boolean;
      country: string;
    };

    const createRegistrationValidator = () => {
      return Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(stringEmailPlugin)
        .use(stringPatternPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<RegistrationForm>()
        .v("username", (b) =>
          b.string
            .required()
            .min(3)
            .max(20)
            .pattern(/^[a-zA-Z0-9_]+$/)
        )
        .v("email", (b) => b.string.required().email())
        .v(
          "password",
          (b) =>
            b.string
              .required()
              .min(8)
              .pattern(/[A-Z]/) // At least one uppercase
              .pattern(/[a-z]/) // At least one lowercase
              .pattern(/[0-9]/) // At least one number
        )
        .v("age", (b) => b.number.required().min(13).max(120))
        .v(
          "country",
          (b) => b.string.required().pattern(/^(US|UK|CA|AU|DE|FR|JP)$/) // Use pattern instead of oneOf
        )
        .build();
    };

    it("should show all form errors for better UX with abortEarly: false", () => {
      const validator = createRegistrationValidator();

      // Typical form submission with multiple errors
      const formData = {
        username: "ab", // Too short
        email: "notanemail", // Invalid email
        password: "weak", // Too short, missing uppercase, missing number
        confirmPassword: "weak",
        age: 10, // Too young
        acceptTerms: false,
        country: "BR", // Not in allowed list
      };

      const result = validator.validate(formData, {
        abortEarly: false, // Show all field errors
        abortEarlyOnEachField: true, // But only first error per field
      });

      expect(result.isValid()).toBe(false);

      // Should have one error per invalid field
      const errorPaths = result.errors.map((e) => e.path);
      expect(errorPaths).toContain("username");
      expect(errorPaths).toContain("email");
      expect(errorPaths).toContain("password");
      expect(errorPaths).toContain("age");
      expect(errorPaths).toContain("country");

      // Useful for displaying all errors in the UI at once
      const errorsByField = result.errors.reduce(
        (acc, err) => {
          acc[err.path] = err.message;
          return acc;
        },
        {} as Record<string, string>
      );

      expect(Object.keys(errorsByField).length).toBe(5);
    });

    it("should show all password validation errors for detailed feedback", () => {
      const validator = createRegistrationValidator();

      const result = validator.validate(
        {
          username: "validuser",
          email: "user@example.com",
          password: "weak", // Multiple violations
          confirmPassword: "weak",
          age: 25,
          acceptTerms: true,
          country: "US",
        },
        {
          abortEarly: false,
          abortEarlyOnEachField: false, // Show ALL password errors
        }
      );

      expect(result.isValid()).toBe(false);

      // Should have multiple errors for password field
      const passwordErrors = result.errors.filter((e) => e.path === "password");
      expect(passwordErrors.length).toBeGreaterThan(1);
    });
  });

  describe("E-commerce Order Validation", () => {
    type Order = {
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
      }>;
      shipping: {
        address: string;
        city: string;
        postalCode: string;
        country: string;
      };
      billing: {
        cardNumber: string;
        expiryMonth: number;
        expiryYear: number;
        cvv: string;
      };
      couponCode?: string;
    };

    const createOrderValidator = () => {
      return Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(stringMinPlugin)
        .use(stringPatternPlugin)
        .use(objectPlugin)
        .for<Order>()
        .v("items", (b) => b.array.required().minLength(1))
        .v("shipping.address", (b) => b.string.required().min(10))
        .v("shipping.city", (b) => b.string.required().min(2))
        .v("shipping.postalCode", (b) => b.string.required().pattern(/^\d{5}$/))
        .v("billing.cardNumber", (b) => b.string.required().pattern(/^\d{16}$/))
        .v("billing.expiryMonth", (b) => b.number.required().min(1).max(12))
        .v("billing.expiryYear", (b) => b.number.required().min(2024))
        .v("billing.cvv", (b) => b.string.required().pattern(/^\d{3,4}$/))
        .build();
    };

    it("should use fast validation for API endpoints with default abortEarly", () => {
      const validator = createOrderValidator();

      // Invalid order - missing required fields
      const invalidOrder = {
        items: [], // Empty cart
        shipping: {
          address: "",
          city: "",
          postalCode: "",
          country: "",
        },
        billing: {
          cardNumber: "",
          expiryMonth: 0,
          expiryYear: 0,
          cvv: "",
        },
      };

      const startTime = Date.now();
      const result = validator.validate(invalidOrder);
      const duration = Date.now() - startTime;

      expect(result.isValid()).toBe(false);
      expect(result.errors).toHaveLength(1); // Only first error
      expect(duration).toBeLessThan(5); // Fast fail

      // Good for API responses - fail fast, save resources
    });

    it("should validate shipping and billing separately for wizard forms", () => {
      const validator = createOrderValidator();

      // Step 1: Validate shipping only
      const shippingData = {
        items: [{ productId: "123", quantity: 1, price: 99.99 }],
        shipping: {
          address: "123", // Too short
          city: "A", // Too short
          postalCode: "ABC", // Wrong format
          country: "US",
        },
        billing: {
          // Not filled yet in wizard
          cardNumber: "",
          expiryMonth: 0,
          expiryYear: 0,
          cvv: "",
        },
      };

      // In a real app, you might use pick() to validate only shipping fields
      const result = validator.validate(shippingData, { abortEarly: false });

      const shippingErrors = result.errors.filter((e) =>
        e.path.startsWith("shipping")
      );
      expect(shippingErrors.length).toBeGreaterThan(0);
    });
  });

  describe("API Data Import Validation", () => {
    type ImportRecord = {
      id: string;
      timestamp: string;
      data: {
        temperature: number;
        humidity: number;
        pressure: number;
      };
      location: {
        lat: number;
        lng: number;
      };
    };

    const createImportValidator = () => {
      return Builder()
        .use(requiredPlugin)
        .use(stringPatternPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(transformPlugin)
        .for<ImportRecord>()
        .v("id", (b) => b.string.required().pattern(/^[A-Z0-9]{8}$/))
        .v("timestamp", (b) =>
          b.string.required().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
        )
        .v("data.temperature", (b) => b.number.required().min(-50).max(50))
        .v("data.humidity", (b) => b.number.required().min(0).max(100))
        .v("data.pressure", (b) => b.number.required().min(800).max(1200))
        .v("location.lat", (b) => b.number.required().min(-90).max(90))
        .v("location.lng", (b) => b.number.required().min(-180).max(180))
        .build();
    };

    it("should validate batch imports efficiently", () => {
      const validator = createImportValidator();
      const records: ImportRecord[] = [
        {
          id: "INVALID", // Wrong format
          timestamp: "2024-01-01T12:00:00Z",
          data: { temperature: 25, humidity: 60, pressure: 1013 },
          location: { lat: 40.7128, lng: -74.006 },
        },
        {
          id: "ABC12345",
          timestamp: "invalid-date", // Wrong format
          data: { temperature: 100, humidity: 60, pressure: 1013 }, // Temp too high
          location: { lat: 40.7128, lng: -74.006 },
        },
        // ... more records
      ];

      // Validate each record, collecting all errors
      const results = records.map((record, index) => ({
        index,
        record,
        validation: validator.validate(record, {
          abortEarly: true, // Fail fast per record for performance
        }),
      }));

      const invalidRecords = results.filter((r) => !r.validation.valid);
      expect(invalidRecords.length).toBe(2);

      // Can provide detailed error report
      const errorReport = invalidRecords.map((r) => ({
        recordIndex: r.index,
        recordId: r.record.id,
        messageFactory: r.validation.errors[0], // First error only due to abortEarly
      }));

      expect(errorReport).toHaveLength(2);
    });

    it("should collect all errors for data quality reporting", () => {
      const validator = createImportValidator();

      // Record with multiple issues
      const problematicRecord = {
        id: "123", // Too short
        timestamp: "today", // Wrong format
        data: {
          temperature: 200, // Too high
          humidity: -10, // Too low
          pressure: 500, // Too low
        },
        location: {
          lat: 100, // Out of range
          lng: 200, // Out of range
        },
      };

      const result = validator.validate(problematicRecord, {
        abortEarly: false,
        abortEarlyOnEachField: false,
      });

      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(7);

      // Group errors by path for reporting
      const errorsByPath = result.errors.reduce(
        (acc, err) => {
          if (!acc[err.path]) acc[err.path] = [];
          acc[err.path].push(err);
          return acc;
        },
        {} as Record<string, typeof result.errors>
      );

      // Useful for data quality metrics
      const dataQualityReport = {
        totalErrors: result.errors.length,
        fieldErrors: Object.keys(errorsByPath).length,
        criticalFields: ["id", "timestamp"].filter(
          (field) => errorsByPath[field]
        ).length,
      };

      expect(dataQualityReport.fieldErrors).toBeGreaterThanOrEqual(7);
    });
  });
});
