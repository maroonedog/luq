import { describe, test, expect } from "@jest/globals";
import { validator as complexValidator } from "../../bundle-size-comparison/implementations/luq/complex";
import { complexValidData } from "../../bundle-size-comparison/schemas/shared-types";

describe("Complex Schema Bottleneck Analysis", () => {
  const measure = (name: string, fn: () => void, iterations: number = 10000): number => {
    // Warm up
    for (let i = 0; i < 100; i++) {
      fn();
    }
    
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const duration = end - start;
    const ops = Math.round(iterations / (duration / 1000));
    console.log(`${name}: ${ops.toLocaleString()} ops/sec (${duration.toFixed(2)}ms for ${iterations} iterations)`);
    return ops;
  };

  test("Profile different validation phases", () => {
    console.log("\n🔍 Complex Schema Validation Profile:");
    
    // Test minimal object validation
    const minimalData = {};
    const minimalOps = measure("Minimal object (empty)", () => {
      complexValidator.validate(minimalData);
    });
    
    // Test with only required fields
    const requiredOnlyData = {
      orderId: "ORD-2024-123456",
      status: "pending",
      customer: { id: "CUST-123456", name: "John Doe", email: "john@example.com", addresses: [{ type: "billing", street: "123 Main St", city: "NYC", postalCode: "12345", country: "US", isDefault: true }] },
      items: [{ productId: "PROD-1", name: "Product", quantity: 1, price: 10 }],
      payment: { method: "credit_card", status: "pending" },
      shipping: { carrier: "UPS", expedited: false },
      totals: { subtotal: 10, tax: 1, shipping: 2, discount: 0, total: 13 },
      tags: [],
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z"
    };
    const requiredOps = measure("Required fields only", () => {
      complexValidator.validate(requiredOnlyData);
    });
    
    // Test with full valid data
    const fullOps = measure("Full valid data", () => {
      complexValidator.validate(complexValidData);
    });
    
    // Test field access performance
    const fieldAccessTest = { ...complexValidData };
    let accessCount = 0;
    const fieldAccessStart = performance.now();
    for (let i = 0; i < 10000; i++) {
      // Simulate nested field access patterns
      const v1 = fieldAccessTest.customer?.id;
      const v2 = fieldAccessTest.customer?.addresses?.[0]?.street;
      const v3 = fieldAccessTest.items?.[0]?.productId;
      const v4 = fieldAccessTest.payment?.status;
      const v5 = fieldAccessTest.totals?.total;
      accessCount += 5;
    }
    const fieldAccessEnd = performance.now();
    const fieldAccessOps = Math.round(accessCount / ((fieldAccessEnd - fieldAccessStart) / 1000));
    console.log(`Field access only: ${fieldAccessOps.toLocaleString()} ops/sec`);
    
    // Test array iteration performance  
    const arrayData = { items: new Array(100).fill({ productId: "PROD-1", name: "Product", quantity: 1, price: 10 }) };
    let arrayIterations = 0;
    const arrayStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      for (const item of arrayData.items) {
        if (item.productId && item.name) arrayIterations++;
      }
    }
    const arrayEnd = performance.now();
    const arrayOps = Math.round(arrayIterations / ((arrayEnd - arrayStart) / 1000));
    console.log(`Array iteration: ${arrayOps.toLocaleString()} ops/sec`);
    
    console.log("\n📊 Performance Breakdown:");
    console.log(`  Empty object overhead: ${((minimalOps / fullOps) * 100).toFixed(1)}x faster than full`);
    console.log(`  Required fields impact: ${((requiredOps / fullOps)).toFixed(1)}x faster than full`);
    console.log(`  Field access speed: ${fieldAccessOps.toLocaleString()} ops/sec`);
    console.log(`  Array processing: ${arrayOps.toLocaleString()} ops/sec`);
    
    console.log("\n🎯 Target: 100,000 ops/sec (Valibot level)");
    console.log(`  Current: ${fullOps.toLocaleString()} ops/sec`);
    console.log(`  Needed improvement: ${(100000 / fullOps).toFixed(1)}x`);
  });
  
  test("Test validation with different array sizes", () => {
    console.log("\n📈 Array Size Impact:");
    
    for (const itemCount of [1, 5, 10, 20, 50]) {
      const testData = {
        ...complexValidData,
        items: new Array(itemCount).fill({ 
          productId: "PROD-1", 
          name: "Product", 
          quantity: 1, 
          price: 10 
        })
      };
      
      const ops = measure(`${itemCount} items`, () => {
        complexValidator.validate(testData);
      });
    }
  });
});