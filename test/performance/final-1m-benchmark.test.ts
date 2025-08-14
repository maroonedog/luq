import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src";

describe("Final 1M ops/sec Achievement Test", () => {
  // Enable ultra-fast mode
  beforeAll(() => {
    (global as any).__LUQ_ULTRA_FAST__ = true;
  });

  afterAll(() => {
    delete (global as any).__LUQ_ULTRA_FAST__;
  });

  const measure = (
    name: string,
    fn: () => void,
    iterations: number = 100000
  ): number => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const ops = Math.round(iterations / ((end - start) / 1000));
    console.log(`${name}: ${ops.toLocaleString()} ops/sec`);
    return ops;
  };

  test("🎯 1M ops/sec with parseRaw", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(transformPlugin)
      .for<{ value: string }>()
      .v("value", (b) =>
        b.string
          .required()
          .min(3)
          .transform((v) => v.toLowerCase())
      )
      .build();

    console.log("Ultra-fast mode enabled:", (global as any).__LUQ_ULTRA_FAST__);
    console.log("Has parseRaw method:", !!validator.parseRaw);

    const testData = { value: "TEST123" };

    // Test standard parse
    const parseOps = measure("Standard parse", () => {
      const result = validator.parse(testData);
      if (!result.isValid()) throw new Error("Failed");
    });

    // Test parseRaw if available
    if (validator.parseRaw) {
      const parseRawOps = measure("🚀 parseRaw", () => {
        const result = validator.parseRaw!(testData);
        if (!result.isValid()) throw new Error("Failed");
        if (result.data?.value !== "test123")
          throw new Error("Transform failed");
      });

      console.log("\n📊 Performance Comparison:");
      console.log(`  Standard parse: ${parseOps.toLocaleString()} ops/sec`);
      console.log(`  parseRaw: ${parseRawOps.toLocaleString()} ops/sec`);
      console.log(`  Speedup: ${(parseRawOps / parseOps).toFixed(1)}x`);

      console.log("\n🎯 1M ops/sec Target:");
      console.log(
        `  Achievement: ${parseRawOps >= 1000000 ? "✅ SUCCESS!" : "❌ Not yet"}`
      );
      console.log(
        `  Performance: ${((parseRawOps / 1000000) * 100).toFixed(1)}% of target`
      );

      // Expect to achieve 1M+ ops/sec
      expect(parseRawOps).toBeGreaterThan(1000000);
    } else {
      throw new Error("parseRaw method not available");
    }
  });

  test("Multiple fields performance", () => {
    type User = {
      firstName: string;
      lastName: string;
      email: string;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(transformPlugin)
      .for<User>()
      .v("firstName", (b) => b.string.required().min(2))
      .v("lastName", (b) => b.string.required().min(2))
      .v("email", (b) =>
        b.string
          .required()
          .min(5)
          .transform((v) => v.toLowerCase())
      )
      .build();

    const testData = {
      firstName: "John",
      lastName: "Doe",
      email: "JOHN@EXAMPLE.COM",
    };

    if (validator.parseRaw) {
      const parseRawOps = measure("🚀 parseRaw (3 fields)", () => {
        const result = validator.parseRaw!(testData);
        if (!result.isValid()) throw new Error("Failed");
        if (result.data?.email !== "john@example.com")
          throw new Error("Transform failed");
      });

      console.log("\n🎯 Three fields target: 800K+ ops/sec");
      console.log(
        `  Achievement: ${parseRawOps >= 800000 ? "✅ SUCCESS!" : "❌ Not yet"}`
      );
      console.log(`  Performance: ${parseRawOps.toLocaleString()} ops/sec`);

      expect(parseRawOps).toBeGreaterThan(800000);
    }
  });

  test("Real-world example", () => {
    type LoginForm = {
      username: string;
      password: string;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(transformPlugin)
      .for<LoginForm>()
      .v("username", (b) =>
        b.string
          .required()
          .min(3)
          .transform((v) => v.trim().toLowerCase())
      )
      .v("password", (b) => b.string.required().min(8))
      .build();

    const testData = {
      username: "  JohnDoe  ",
      password: "SecurePassword123",
    };

    const parseOps = measure("Login form (parse)", () => {
      const result = validator.parse(testData);
      if (!result.isValid()) throw new Error("Failed");
    });

    if (validator.parseRaw) {
      const parseRawOps = measure("Login form (parseRaw)", () => {
        const result = validator.parseRaw!(testData);
        if (!result.isValid()) throw new Error("Failed");
        if (result.data?.username !== "johndoe")
          throw new Error("Transform failed");
      });

      console.log("\n📊 Real-world Performance:");
      console.log(`  Standard: ${parseOps.toLocaleString()} ops/sec`);
      console.log(`  Raw: ${parseRawOps.toLocaleString()} ops/sec`);
      console.log(
        `  Improvement: ${(parseRawOps / parseOps).toFixed(1)}x faster`
      );
    }
  });
});
