import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../src/core/plugin/numberMax";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { stringMaxPlugin } from "../../src/core/plugin/stringMax";
import { arrayMinLengthPlugin } from "../../src/core/plugin/arrayMinLength";
import { objectPlugin } from "../../src/core/plugin/object";

describe("Array Batching Real-world Tests", () => {
  describe("Nested Object Arrays (Currently Supported Pattern)", () => {
    test("should batch validate array element fields", () => {
      // This is the pattern that is currently supported
      type Order = {
        orderNumber: string;
        items: Array<{
          productId: string;
          name: string;
          quantity: number;
          price: number;
        }>;
        customer: {
          name: string;
          email: string;
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(arrayMinLengthPlugin)
        .for<Order>()
        .v("orderNumber", (b) => b.string.required().min(5))
        .v("items", (b) => b.array.required().minLength(1))
        // Array element fields - these should be batched
        .v("items.productId", (b) => b.string.required().min(3))
        .v("items.name", (b) => b.string.required().min(1))
        .v("items.quantity", (b) => b.number.required().min(1).max(1000))
        .v("items.price", (b) => b.number.required().min(0.01))
        .v("customer.name", (b) => b.string.required().min(2))
        .v("customer.email", (b) => b.string.required().min(5))
        .build();

      // Valid order
      const validOrder: Order = {
        orderNumber: "ORD-12345",
        items: [
          { productId: "PRD001", name: "Laptop", quantity: 2, price: 999.99 },
          { productId: "PRD002", name: "Mouse", quantity: 5, price: 29.99 },
          { productId: "PRD003", name: "Keyboard", quantity: 3, price: 79.99 },
        ],
        customer: {
          name: "John Doe",
          email: "john@example.com",
        },
      };

      const result = validator.validate(validOrder);
      expect(result.isValid()).toBe(true);

      // Invalid order with multiple errors in array elements
      const invalidOrder: Order = {
        orderNumber: "ORD", // Too short
        items: [
          { productId: "P1", name: "", quantity: 0, price: -10 }, // Multiple errors
          { productId: "PRD002", name: "Mouse", quantity: 2000, price: 29.99 }, // quantity too high
          { productId: "", name: "Keyboard", quantity: 3, price: 0 }, // productId empty, price too low
        ],
        customer: {
          name: "J", // Too short
          email: "bad", // Too short
        },
      };

      const invalidResult = validator.validate(invalidOrder);
      expect(invalidresult.isValid()).toBe(false);

      // Check that we get errors for array elements
      const errorPaths = invalidResult.errors.map((e) => e.path).sort();
      console.log("Error paths:", errorPaths);

      // Array element errors should be present
      expect(errorPaths).toContain("items[0].productId");
      expect(errorPaths).toContain("items[0].name");
      expect(errorPaths).toContain("items[0].quantity");
      expect(errorPaths).toContain("items[0].price");
      expect(errorPaths).toContain("items[1].quantity");
      expect(errorPaths).toContain("items[2].productId");
      expect(errorPaths).toContain("items[2].price");
    });

    test("should handle deeply nested arrays", () => {
      type Company = {
        name: string;
        departments: Array<{
          name: string;
          budget: number;
          employees: Array<{
            id: string;
            name: string;
            salary: number;
            skills: string[];
          }>;
        }>;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Company>()
        .v("name", (b) => b.string.required().min(2))
        .v("departments", (b) => b.array.required().minLength(1))
        .v("departments.name", (b) => b.string.required().min(2))
        .v("departments.budget", (b) => b.number.required().min(10000))
        .v("departments.employees", (b) => b.array.required().minLength(1))
        .v("departments.employees.id", (b) => b.string.required().min(3))
        .v("departments.employees.name", (b) => b.string.required().min(2))
        .v("departments.employees.salary", (b) =>
          b.number.required().min(30000)
        )
        .v("departments.employees.skills", (b) =>
          b.array.required().minLength(1)
        )
        .build();

      const validCompany: Company = {
        name: "Tech Corp",
        departments: [
          {
            name: "Engineering",
            budget: 1000000,
            employees: [
              {
                id: "EMP001",
                name: "Alice Smith",
                salary: 120000,
                skills: ["JavaScript", "TypeScript", "React"],
              },
              {
                id: "EMP002",
                name: "Bob Johnson",
                salary: 110000,
                skills: ["Python", "Django"],
              },
            ],
          },
          {
            name: "Marketing",
            budget: 500000,
            employees: [
              {
                id: "EMP003",
                name: "Carol White",
                salary: 90000,
                skills: ["SEO", "Content Marketing"],
              },
            ],
          },
        ],
      };

      const result = validator.validate(validCompany);
      expect(result.isValid()).toBe(true);

      // Test with nested array errors
      const invalidCompany: Company = {
        name: "X", // Too short
        departments: [
          {
            name: "E", // Too short
            budget: 5000, // Too low
            employees: [
              {
                id: "E1", // Too short
                name: "A", // Too short
                salary: 20000, // Too low
                skills: [], // Empty array
              },
            ],
          },
        ],
      };

      const invalidResult = validator.validate(invalidCompany);
      expect(invalidresult.isValid()).toBe(false);

      const errorPaths = invalidResult.errors.map((e) => e.path).sort();
      console.log("Nested array error paths:", errorPaths);

      // Check nested array element errors
      expect(errorPaths).toContain("departments[0].name");
      expect(errorPaths).toContain("departments[0].budget");
      expect(errorPaths).toContain("departments[0].employees[0].id");
      expect(errorPaths).toContain("departments[0].employees[0].name");
      expect(errorPaths).toContain("departments[0].employees[0].salary");
      expect(errorPaths).toContain("departments[0].employees[0].skills");
    });
  });

  describe("Performance with Array Batching", () => {
    test("should efficiently process large arrays with batching", () => {
      type ProductCatalog = {
        products: Array<{
          id: string;
          name: string;
          description: string;
          price: number;
          stock: number;
          category: string;
        }>;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(stringMaxPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<ProductCatalog>()
        .v("products", (b) => b.array.required())
        .v("products.id", (b) => b.string.required().min(5).max(20))
        .v("products.name", (b) => b.string.required().min(2).max(100))
        .v("products.description", (b) => b.string.required().min(10).max(500))
        .v("products.price", (b) => b.number.required().min(0.01).max(99999))
        .v("products.stock", (b) => b.number.required().min(0).max(10000))
        .v("products.category", (b) => b.string.required().min(3).max(50))
        .build();

      // Generate large product catalog (1000 products)
      const largeCatalog: ProductCatalog = {
        products: Array.from({ length: 1000 }, (_, i) => ({
          id: `PROD${String(i + 1).padStart(5, "0")}`,
          name: `Product ${i + 1}`,
          description: `This is a detailed description for product ${i + 1} with various features.`,
          price: Math.random() * 1000 + 10,
          stock: Math.floor(Math.random() * 100),
          category: ["Electronics", "Clothing", "Books", "Home"][i % 4],
        })),
      };

      const startTime = performance.now();
      const result = validator.validate(largeCatalog);
      const endTime = performance.now();

      expect(result.isValid()).toBe(true);

      const executionTime = endTime - startTime;
      console.log(
        `Validated 1000 products with 6 fields each (6000 validations) in ${executionTime.toFixed(2)}ms`
      );

      // Should complete reasonably fast with batching optimization
      expect(executionTime).toBeLessThan(200); // 200ms for 6000 field validations
    });

    test("should show performance benefit of array batching", () => {
      // This test demonstrates the benefit of array batching
      // by comparing theoretical access patterns

      type TestData = {
        items: Array<{
          field1: string;
          field2: string;
          field3: string;
          field4: string;
          field5: string;
        }>;
      };

      const data: TestData = {
        items: Array.from({ length: 100 }, (_, i) => ({
          field1: `value1_${i}`,
          field2: `value2_${i}`,
          field3: `value3_${i}`,
          field4: `value4_${i}`,
          field5: `value5_${i}`,
        })),
      };

      // Without batching: 5 separate array accesses
      // With batching: 1 array access, then validate all 5 fields per element

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<TestData>()
        .v("items", (b) => b.array.required())
        .v("items.field1", (b) => b.string.required().min(5))
        .v("items.field2", (b) => b.string.required().min(5))
        .v("items.field3", (b) => b.string.required().min(5))
        .v("items.field4", (b) => b.string.required().min(5))
        .v("items.field5", (b) => b.string.required().min(5))
        .build();

      const result = validator.validate(data);
      expect(result.isValid()).toBe(true);

      // Log theoretical performance improvement
      console.log("Array access pattern:");
      console.log(
        "Without batching: 500 array element accesses (100 items × 5 fields)"
      );
      console.log(
        "With batching: 100 array element accesses (100 items × 1 access)"
      );
      console.log("Reduction: 80% fewer array accesses");
    });
  });

  describe("Error Path Generation", () => {
    test("should generate correct paths for array element errors", () => {
      type ValidationTest = {
        data: Array<{
          value: number;
          nested: {
            inner: string;
          };
        }>;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .use(stringMinPlugin)
        .for<ValidationTest>()
        .v("data", (b) => b.array.required())
        .v("data.value", (b) => b.number.required().min(0).max(100))
        .v("data.nested.inner", (b) => b.string.required().min(3))
        .build();

      const invalidData: ValidationTest = {
        data: [
          { value: 50, nested: { inner: "valid" } }, // Valid
          { value: -10, nested: { inner: "ok" } }, // value too low, inner too short
          { value: 150, nested: { inner: "valid" } }, // value too high
          { value: 75, nested: { inner: "x" } }, // inner too short
        ],
      };

      const result = validator.validate(invalidData);
      expect(result.isValid()).toBe(false);

      // Verify error paths are correctly generated
      const errors = result.errors.sort((a, b) => a.path.localeCompare(b.path));

      expect(errors.find((e) => e.path === "data[1].value")).toBeDefined();
      expect(
        errors.find((e) => e.path === "data[1].nested.inner")
      ).toBeDefined();
      expect(errors.find((e) => e.path === "data[2].value")).toBeDefined();
      expect(
        errors.find((e) => e.path === "data[3].nested.inner")
      ).toBeDefined();

      // Verify no errors for valid element
      expect(errors.find((e) => e.path.startsWith("data[0]"))).toBeUndefined();
    });
  });
});
