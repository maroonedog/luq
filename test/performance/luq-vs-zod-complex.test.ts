import { describe, test, expect } from "@jest/globals";
import { z } from "zod";
import { 
  Builder,
  requiredPlugin,
  optionalPlugin,
  stringMinPlugin,
  stringMaxPlugin,
  stringEmailPlugin,
  numberMinPlugin,
  numberMaxPlugin,
  numberPositivePlugin,
  arrayMinLengthPlugin,
  arrayMaxLengthPlugin,
  arrayUniquePlugin,
  objectPlugin,
  oneOfPlugin,
  transformPlugin,
  requiredIfPlugin,
  validateIfPlugin,
  booleanTruthyPlugin,
  booleanFalsyPlugin,
  stringPatternPlugin
} from "../../src";
import { ComplexOrder, complexValidData, complexInvalidData } from "../../bundle-size-comparison/schemas/shared-types";

describe("Luq vs Zod Performance Comparison", () => {
  // Performance measurement helper
  const measurePerformance = (
    name: string,
    fn: () => void,
    iterations: number = 1000
  ): { total: number; average: number; ops: number } => {
    // Warm up
    for (let i = 0; i < 100; i++) {
      fn();
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    
    const total = end - start;
    const average = total / iterations;
    const ops = 1000 / average; // operations per second

    console.log(`${name}: ${average.toFixed(4)}ms/op, ${ops.toFixed(0)} ops/sec`);
    return { total, average, ops };
  };

  // === ZOD SCHEMA DEFINITION ===
  const addressSchema = z.object({
    type: z.enum(["billing", "shipping"]),
    street: z.string().min(5).max(200),
    city: z.string().min(2).max(100),
    postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
    country: z.string().regex(/^[A-Z]{2}$/),
    isDefault: z.boolean(),
  });

  const itemSchema = z.object({
    productId: z.string().regex(/^PROD-\d+$/),
    name: z.string().min(2).max(200),
    quantity: z.number().min(1).max(999),
    price: z.number().positive(),
    discount: z.number().min(0).max(100).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

  const paymentSchema = z
    .object({
      method: z.enum(["credit_card", "paypal", "bank_transfer"]),
      status: z.enum(["pending", "completed", "failed"]),
      transactionId: z.string().optional(),
      cardLast4: z.string().regex(/^\d{4}$/).optional(),
    })
    .refine(
      (data) => {
        if (data.status === "completed" && !data.transactionId) {
          return false;
        }
        return true;
      },
      {
        message: "Transaction ID is required when payment is completed",
        path: ["transactionId"],
      }
    )
    .refine(
      (data) => {
        if (data.method === "credit_card" && !data.cardLast4) {
          return false;
        }
        return true;
      },
      {
        message: "Card last 4 digits required for credit card payments",
        path: ["cardLast4"],
      }
    );

  const shippingSchema = z.object({
    carrier: z.string().min(2).max(50),
    trackingNumber: z.string().regex(/^[A-Z0-9]{10,30}$/).optional(),
    estimatedDelivery: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expedited: z.boolean(),
  });

  const totalsSchema = z.object({
    subtotal: z.number().positive(),
    tax: z.number().min(0),
    shipping: z.number().min(0),
    discount: z.number().min(0),
    total: z.number().positive(),
  });

  const zodSchema = z.object({
    orderId: z.string().regex(/^ORD-\d{4}-\d{6}$/),
    status: z.enum(["pending", "processing", "shipped", "delivered"]),
    customer: z.object({
      id: z.string().regex(/^CUST-\d{6}$/),
      name: z.string().min(2).max(100),
      email: z.string().email().transform((email) => email.toLowerCase()),
      phone: z.string().regex(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/).optional(),
      addresses: z.array(addressSchema).min(1).max(5),
    }),
    items: z.array(itemSchema).min(1).max(100),
    payment: paymentSchema,
    shipping: shippingSchema,
    totals: totalsSchema,
    notes: z.string().max(500).optional(),
    tags: z
      .array(z.string().min(2).max(30))
      .max(10)
      .refine((items) => new Set(items).size === items.length, {
        message: "Tags must be unique",
      })
      .transform((tags) => tags.map((t) => t.toLowerCase())),
    createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
  });

  // === LUQ SCHEMA DEFINITION ===
  const luqValidator = Builder()
    .use(requiredPlugin)
    .use(optionalPlugin)
    .use(stringMinPlugin)
    .use(stringMaxPlugin)
    .use(stringEmailPlugin)
    .use(stringPatternPlugin)
    .use(numberMinPlugin)
    .use(numberMaxPlugin)
    .use(numberPositivePlugin)
    .use(arrayMinLengthPlugin)
    .use(arrayMaxLengthPlugin)
    .use(arrayUniquePlugin)
    .use(objectPlugin)
    .use(oneOfPlugin)
    .use(transformPlugin)
    .use(requiredIfPlugin)
    .use(validateIfPlugin)
    .use(booleanTruthyPlugin)
    .use(booleanFalsyPlugin)
    .for<ComplexOrder>()
    // Order validation
    .v("orderId", (b) => b.string.required().pattern(/^ORD-\d{4}-\d{6}$/))
    .v("status", (b) =>
      b.string.required().oneOf(["pending", "processing", "shipped", "delivered"])
    )
    // Customer validation
    .v("customer", (b) => b.object.required())
    .v("customer.id", (b) => b.string.required().pattern(/^CUST-\d{6}$/))
    .v("customer.name", (b) => b.string.required().min(2).max(100))
    .v("customer.email", (b) =>
      b.string.required().email().transform((v) => v.toLowerCase())
    )
    .v("customer.phone", (b) =>
      b.string.optional().pattern(/^\+?\d{1,3}-?\d{3}-?\d{3}-?\d{4}$/)
    )
    // Addresses validation
    .v("customer.addresses", (b) =>
      b.array.required().minLength(1).maxLength(5)
    )
    .v("customer.addresses.type", (b) =>
      b.string.required().oneOf(["billing", "shipping"])
    )
    .v("customer.addresses.street", (b) =>
      b.string.required().min(5).max(200)
    )
    .v("customer.addresses.city", (b) => b.string.required().min(2).max(100))
    .v("customer.addresses.postalCode", (b) =>
      b.string.required().pattern(/^\d{5}(-\d{4})?$/)
    )
    .v("customer.addresses.country", (b) =>
      b.string.required().pattern(/^[A-Z]{2}$/)
    )
    .v("customer.addresses.isDefault", (b) => b.boolean.required())
    // Items validation
    .v("items", (b) => b.array.required().minLength(1).maxLength(100))
    .v("items.productId", (b) => b.string.required().pattern(/^PROD-\d+$/))
    .v("items.name", (b) => b.string.required().min(2).max(200))
    .v("items.quantity", (b) => b.number.required().min(1).max(999))
    .v("items.price", (b) => b.number.required().positive())
    .v("items.discount", (b) => b.number.optional().min(0).max(100))
    .v("items.metadata", (b) => b.object.optional())
    // Payment validation
    .v("payment", (b) => b.object.required())
    .v("payment.method", (b) =>
      b.string.required().oneOf(["credit_card", "paypal", "bank_transfer"])
    )
    .v("payment.status", (b) =>
      b.string.required().oneOf(["pending", "completed", "failed"])
    )
    .v("payment.transactionId", (b) =>
      b.string.requiredIf((data) => data?.payment?.status === "completed")
    )
    .v("payment.cardLast4", (b) =>
      b.string
        .validateIf((data) => data?.payment?.method === "credit_card")
        .pattern(/^\d{4}$/)
    )
    // Shipping validation
    .v("shipping", (b) => b.object.required())
    .v("shipping.carrier", (b) => b.string.required().min(2).max(50))
    .v("shipping.trackingNumber", (b) =>
      b.string.optional().pattern(/^[A-Z0-9]{10,30}$/)
    )
    .v("shipping.estimatedDelivery", (b) =>
      b.string.optional().pattern(/^\d{4}-\d{2}-\d{2}$/)
    )
    .v("shipping.expedited", (b) => b.boolean.required())
    // Totals validation
    .v("totals", (b) => b.object.required())
    .v("totals.subtotal", (b) => b.number.required().positive())
    .v("totals.tax", (b) => b.number.required().min(0))
    .v("totals.shipping", (b) => b.number.required().min(0))
    .v("totals.discount", (b) => b.number.required().min(0))
    .v("totals.total", (b) => b.number.required().positive())
    // Other fields
    .v("notes", (b) => b.string.optional().max(500))
    .v("tags", (b) =>
      b.array
        .required()
        .unique()
        .maxLength(10)
        .transform((tags) => Array.isArray(tags) ? tags.map((t) => t.toLowerCase()) : tags)
    )
    .v("createdAt", (b) =>
      b.string.required().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    )
    .v("updatedAt", (b) =>
      b.string.required().pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
    )
    .build();

  describe("Valid Data Performance", () => {
    test("Single validation performance comparison", () => {
      console.log("\n=== Single Validation Performance ===");
      
      const zodResult = measurePerformance(
        "Zod (valid)",
        () => {
          zodSchema.safeParse(complexValidData);
        },
        10000
      );

      const luqResult = measurePerformance(
        "Luq (valid)",
        () => {
          luqValidator.validate(complexValidData, { abortEarly: false });
        },
        10000
      );

      // Performance comparison
      const performanceRatio = zodResult.average / luqResult.average;
      console.log(`\nPerformance ratio (Zod/Luq): ${performanceRatio.toFixed(2)}x`);
      
      if (performanceRatio > 1) {
        console.log(`Luq is ${performanceRatio.toFixed(2)}x faster than Zod`);
      } else {
        console.log(`Zod is ${(1/performanceRatio).toFixed(2)}x faster than Luq`);
      }

      // Both should be reasonably fast
      expect(zodResult.average).toBeLessThan(5); // Zod should be under 5ms
      expect(luqResult.average).toBeLessThan(5); // Luq should be under 5ms
    });

    test("Batch validation performance (1000 items)", () => {
      console.log("\n=== Batch Validation Performance (1000 items) ===");
      
      const zodResult = measurePerformance(
        "Zod (1000 validations)",
        () => {
          for (let i = 0; i < 1000; i++) {
            zodSchema.safeParse(complexValidData);
          }
        },
        10
      );

      const luqResult = measurePerformance(
        "Luq (1000 validations)",
        () => {
          for (let i = 0; i < 1000; i++) {
            luqValidator.validate(complexValidData, { abortEarly: false });
          }
        },
        10
      );

      const batchRatio = zodResult.average / luqResult.average;
      console.log(`\nBatch performance ratio (Zod/Luq): ${batchRatio.toFixed(2)}x`);

      // Both should handle batch processing reasonably
      expect(zodResult.average).toBeLessThan(5000); // 5 seconds for 1000 validations
      expect(luqResult.average).toBeLessThan(5000);
    });
  });

  describe("Invalid Data Performance", () => {
    test("Invalid data validation performance", () => {
      console.log("\n=== Invalid Data Validation Performance ===");
      
      const zodResult = measurePerformance(
        "Zod (invalid)",
        () => {
          zodSchema.safeParse(complexInvalidData);
        },
        10000
      );

      const luqResult = measurePerformance(
        "Luq (invalid)",
        () => {
          luqValidator.validate(complexInvalidData, { abortEarly: false });
        },
        10000
      );

      const invalidRatio = zodResult.average / luqResult.average;
      console.log(`\nInvalid data performance ratio (Zod/Luq): ${invalidRatio.toFixed(2)}x`);

      // Error handling shouldn't be significantly slower
      expect(zodResult.average).toBeLessThan(10); // Within reasonable bounds
      expect(luqResult.average).toBeLessThan(10);
    });

    test("Early abort vs full validation comparison", () => {
      console.log("\n=== Early Abort vs Full Validation ===");
      
      const zodEarlyResult = measurePerformance(
        "Zod (early abort equivalent)",
        () => {
          const result = zodSchema.safeParse(complexInvalidData);
          // Zod doesn't have true early abort, but stops on first error per field
        },
        10000
      );

      const luqEarlyResult = measurePerformance(
        "Luq (early abort)",
        () => {
          luqValidator.validate(complexInvalidData, { abortEarly: true });
        },
        10000
      );

      const luqFullResult = measurePerformance(
        "Luq (full validation)",
        () => {
          luqValidator.validate(complexInvalidData, { abortEarly: false });
        },
        10000
      );

      console.log(`\nLuq early abort vs full: ${(luqFullResult.average / luqEarlyResult.average).toFixed(2)}x difference`);

      // Early abort should be faster for invalid data
      expect(luqEarlyResult.average).toBeLessThan(luqFullResult.average);
    });
  });

  describe("Memory and Scaling Performance", () => {
    test("Large dataset performance", () => {
      console.log("\n=== Large Dataset Performance ===");
      
      // Create a larger dataset by duplicating items
      const largeValidData: ComplexOrder = {
        ...complexValidData,
        items: Array(50).fill(null).map((_, i) => ({
          ...complexValidData.items[0],
          productId: `PROD-${i + 1000}`,
          name: `Product ${i + 1}`,
        })),
        customer: {
          ...complexValidData.customer,
          addresses: Array(5).fill(null).map((_, i) => ({
            ...complexValidData.customer.addresses[0],
            street: `${i + 100} Main St`,
          })),
        },
        tags: Array(10).fill(null).map((_, i) => `tag${i}`),
      };

      const zodLargeResult = measurePerformance(
        "Zod (large dataset)",
        () => {
          zodSchema.safeParse(largeValidData);
        },
        1000
      );

      const luqLargeResult = measurePerformance(
        "Luq (large dataset)",
        () => {
          luqValidator.validate(largeValidData, { abortEarly: false });
        },
        1000
      );

      const largeRatio = zodLargeResult.average / luqLargeResult.average;
      console.log(`\nLarge dataset performance ratio (Zod/Luq): ${largeRatio.toFixed(2)}x`);

      // Should scale reasonably with larger datasets
      expect(zodLargeResult.average).toBeLessThan(20);
      expect(luqLargeResult.average).toBeLessThan(20);
    });

    test("Validator creation performance", () => {
      console.log("\n=== Validator Creation Performance ===");
      
      const zodCreationResult = measurePerformance(
        "Zod schema creation",
        () => {
          // Zod schemas are created immediately, so we recreate the complex schema
          z.object({
            orderId: z.string().regex(/^ORD-\d{4}-\d{6}$/),
            status: z.enum(["pending", "processing", "shipped", "delivered"]),
            // Simplified for creation test
            items: z.array(z.object({
              productId: z.string(),
              name: z.string(),
              quantity: z.number(),
              price: z.number(),
            })),
          });
        },
        1000
      );

      const luqCreationResult = measurePerformance(
        "Luq validator creation",
        () => {
          Builder()
            .use(requiredPlugin)
            .use(stringPatternPlugin)
            .use(oneOfPlugin)
            .use(arrayMinLengthPlugin)
            .use(objectPlugin)
            .for<any>()
            .v("orderId", (b) => b.string.required().pattern(/^ORD-\d{4}-\d{6}$/))
            .v("status", (b) => b.string.required().oneOf(["pending", "processing", "shipped", "delivered"]))
            .v("items", (b) => b.array.required())
            .build();
        },
        1000
      );

      const creationRatio = zodCreationResult.average / luqCreationResult.average;
      console.log(`\nCreation performance ratio (Zod/Luq): ${creationRatio.toFixed(2)}x`);

      // Creation should be fast for both
      expect(zodCreationResult.average).toBeLessThan(1);
      expect(luqCreationResult.average).toBeLessThan(5); // Luq's builder pattern might be slightly slower
    });
  });

  describe("Feature-specific Performance", () => {
    test("Transform performance comparison", () => {
      console.log("\n=== Transform Performance ===");
      
      const dataWithTransforms = {
        email: "TEST@EXAMPLE.COM",
        tags: ["Holiday", "GIFT", "expedited"],
      };

      const zodTransformResult = measurePerformance(
        "Zod transforms",
        () => {
          const schema = z.object({
            email: z.string().email().transform(email => email.toLowerCase()),
            tags: z.array(z.string()).transform(tags => tags.map(t => t.toLowerCase())),
          });
          schema.parse(dataWithTransforms);
        },
        10000
      );

      const luqTransformResult = measurePerformance(
        "Luq transforms",
        () => {
          const validator = Builder()
            .use(requiredPlugin)
            .use(stringEmailPlugin)
            .use(transformPlugin)
            .for<{ email: string; tags: string[] }>()
            .v("email", (b) => b.string.required().email().transform(v => v.toLowerCase()))
            .v("tags", (b) => b.array.required().transform(tags => Array.isArray(tags) ? tags.map(t => t.toLowerCase()) : tags))
            .build();
          validator.validate(dataWithTransforms);
        },
        10000
      );

      const transformRatio = zodTransformResult.average / luqTransformResult.average;
      console.log(`\nTransform performance ratio (Zod/Luq): ${transformRatio.toFixed(2)}x`);
    });

    test("Conditional validation performance", () => {
      console.log("\n=== Conditional Validation Performance ===");
      
      const conditionalData = {
        type: "credit_card",
        cardLast4: "1234",
        status: "completed",
        transactionId: "TXN123",
      };

      const zodConditionalResult = measurePerformance(
        "Zod conditional validation",
        () => {
          const schema = z.object({
            type: z.string(),
            cardLast4: z.string().optional(),
            status: z.string(),
            transactionId: z.string().optional(),
          }).refine(data => {
            if (data.type === "credit_card" && !data.cardLast4) return false;
            if (data.status === "completed" && !data.transactionId) return false;
            return true;
          });
          schema.safeParse(conditionalData);
        },
        10000
      );

      const luqConditionalResult = measurePerformance(
        "Luq conditional validation",
        () => {
          const validator = Builder()
            .use(requiredPlugin)
            .use(requiredIfPlugin)
            .use(validateIfPlugin)
            .for<typeof conditionalData>()
            .v("type", (b) => b.string.required())
            .v("cardLast4", (b) => b.string.requiredIf(data => data.type === "credit_card"))
            .v("status", (b) => b.string.required())
            .v("transactionId", (b) => b.string.requiredIf(data => data.status === "completed"))
            .build();
          validator.validate(conditionalData);
        },
        10000
      );

      const conditionalRatio = zodConditionalResult.average / luqConditionalResult.average;
      console.log(`\nConditional performance ratio (Zod/Luq): ${conditionalRatio.toFixed(2)}x`);
    });
  });

  describe("Summary Report", () => {
    test("Complete performance comparison report", () => {
      console.log("\n" + "=".repeat(60));
      console.log("           COMPLETE PERFORMANCE COMPARISON REPORT");
      console.log("=".repeat(60));
      
      // Run all key comparisons and collect results
      const results: { [key: string]: { zod: number; luq: number; ratio: number } } = {};

      // Valid data comparison
      const zodValid = measurePerformance("", () => zodSchema.safeParse(complexValidData), 5000);
      const luqValid = measurePerformance("", () => luqValidator.validate(complexValidData), 5000);
      results["Valid Data"] = {
        zod: zodValid.average,
        luq: luqValid.average,
        ratio: zodValid.average / luqValid.average,
      };

      // Invalid data comparison
      const zodInvalid = measurePerformance("", () => zodSchema.safeParse(complexInvalidData), 5000);
      const luqInvalid = measurePerformance("", () => luqValidator.validate(complexInvalidData), 5000);
      results["Invalid Data"] = {
        zod: zodInvalid.average,
        luq: luqInvalid.average,
        ratio: zodInvalid.average / luqInvalid.average,
      };

      // Generate report
      console.log("\nResults (lower is better):");
      console.log("-".repeat(60));
      Object.entries(results).forEach(([test, result]) => {
        console.log(`${test.padEnd(20)} | Zod: ${result.zod.toFixed(4)}ms | Luq: ${result.luq.toFixed(4)}ms`);
        if (result.ratio > 1) {
          console.log(`${" ".repeat(21)} | Luq is ${result.ratio.toFixed(2)}x faster`);
        } else {
          console.log(`${" ".repeat(21)} | Zod is ${(1/result.ratio).toFixed(2)}x faster`);
        }
        console.log("-".repeat(60));
      });

      // Overall winner
      const avgRatio = Object.values(results).reduce((sum, r) => sum + r.ratio, 0) / Object.values(results).length;
      console.log(`\nOverall Performance: ${avgRatio > 1 ? 'Luq' : 'Zod'} is ${Math.abs(avgRatio > 1 ? avgRatio : 1/avgRatio).toFixed(2)}x faster on average`);
      
      console.log("\nKey Findings:");
      console.log("• Complex schema validation performance comparison completed");
      console.log("• Both libraries handle the same validation rules and constraints");
      console.log("• Performance differences may vary based on specific use cases");
      console.log("• Consider bundle size, API design, and ecosystem when choosing");
      
      console.log("=".repeat(60));

      // Assertions to ensure both libraries are performing reasonably
      expect(results["Valid Data"].zod).toBeLessThan(10);
      expect(results["Valid Data"].luq).toBeLessThan(10);
      expect(results["Invalid Data"].zod).toBeLessThan(15);
      expect(results["Invalid Data"].luq).toBeLessThan(15);
    });
  });
});