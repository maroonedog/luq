import { describe, test, expect } from "@jest/globals";
import { createRawValidator } from "../../src/core/builder/raw-validator";
import { createUnifiedValidator } from "../../src/core/optimization/unified-validator";

describe("Raw Validator 1M ops/sec Benchmark", () => {
  const iterations = 100000;

  const measure = (name: string, fn: () => void): number => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const ops = Math.round(iterations / ((end - start) / 1000));
    console.log(`${name}: ${ops.toLocaleString()} ops/sec`);
    return ops;
  };

  test("Raw validator - single field with transform", () => {
    // Create unified validator
    const fieldDef = {
      path: "value",
      builderFunction: () => ({
        _validators: [
          {
            check: (v: any) => typeof v === "string" && v.length >= 3,
            code: "STRING_MIN",
          },
        ],
        _transforms: [(v: any) => v.toLowerCase()],
      }),
    };

    const unifiedValidator = createUnifiedValidator(
      fieldDef,
      {},
      "fast_separated"
    );
    const validators = new Map([["value", unifiedValidator]]);

    // Create raw validator
    const rawValidator = createRawValidator<{ value: string }>(validators);

    const testData = { value: "TEST123" };

    // Test validateRaw
    const validateRawOps = measure("validateRaw", () => {
      if (!rawValidator.validateRaw(testData)) {
        throw new Error("Validation failed");
      }
    });

    // Test parseRaw
    const parseRawOps = measure("parseRaw", () => {
      const result = rawValidator.parseRaw(testData);
      if (!result.valid || result.data?.value !== "test123") {
        throw new Error("Parse failed");
      }
    });

    // Test regular parse (with Result wrapper)
    const parseOps = measure("parse (Result wrapper)", () => {
      const result = rawValidator.parse(testData);
      if (!result.isValid()) {
        throw new Error("Parse failed");
      }
    });

    console.log("\n📊 Raw Validator Performance:");
    console.log(`  validateRaw: ${validateRawOps.toLocaleString()} ops/sec`);
    console.log(`  parseRaw: ${parseRawOps.toLocaleString()} ops/sec`);
    console.log(`  parse (wrapped): ${parseOps.toLocaleString()} ops/sec`);
    console.log(`\n🎯 1M ops/sec Target:`);
    console.log(
      `  parseRaw: ${parseRawOps >= 1000000 ? "✅ ACHIEVED!" : "❌ Not yet"} (${((parseRawOps / 1000000) * 100).toFixed(1)}%)`
    );

    // Expect parseRaw to achieve 1M+ ops/sec
    expect(parseRawOps).toBeGreaterThan(1000000);
  });

  test("Raw validator - two fields", () => {
    // Create validators for two fields
    const nameDef = {
      path: "name",
      builderFunction: () => ({
        _validators: [
          {
            check: (v: any) => v != null && v !== "",
            code: "REQUIRED",
          },
          {
            check: (v: any) => typeof v === "string" && v.length >= 3,
            code: "STRING_MIN",
          },
        ],
        _transforms: [],
      }),
    };

    const emailDef = {
      path: "email",
      builderFunction: () => ({
        _validators: [
          {
            check: (v: any) => v != null && v !== "",
            code: "REQUIRED",
          },
        ],
        _transforms: [(v: any) => v.toLowerCase()],
      }),
    };

    const nameValidator = createUnifiedValidator(nameDef, {}, "fast_separated");
    const emailValidator = createUnifiedValidator(
      emailDef,
      {},
      "fast_separated"
    );

    const validators = new Map([
      ["name", nameValidator],
      ["email", emailValidator],
    ]);

    const rawValidator = createRawValidator<{ name: string; email: string }>(
      validators
    );

    const testData = { name: "John", email: "JOHN@EXAMPLE.COM" };

    const parseRawOps = measure("parseRaw (2 fields)", () => {
      const result = rawValidator.parseRaw(testData);
      if (!result.valid) {
        throw new Error("Parse failed");
      }
    });

    console.log(`\n🎯 Two fields target: 800K+ ops/sec`);
    console.log(
      `  Result: ${parseRawOps >= 800000 ? "✅ ACHIEVED!" : "❌ Not yet"} (${parseRawOps.toLocaleString()} ops/sec)`
    );

    // Expect good performance with two fields
    expect(parseRawOps).toBeGreaterThan(800000);
  });

  test("Performance scaling analysis", () => {
    console.log("\n📊 Performance Scaling Analysis:");

    // Test with 1, 2, 3, 5 fields
    const fieldCounts = [1, 2, 3, 5];
    const results: any[] = [];

    for (const count of fieldCounts) {
      const validators = new Map();

      for (let i = 0; i < count; i++) {
        const fieldDef = {
          path: `field${i}`,
          builderFunction: () => ({
            _validators: [
              {
                check: (v: any) => typeof v === "string" && v.length >= 3,
                code: "STRING_MIN",
              },
            ],
            _transforms: [(v: any) => v.toLowerCase()],
          }),
        };

        const validator = createUnifiedValidator(
          fieldDef,
          {},
          "fast_separated"
        );
        validators.set(`field${i}`, validator);
      }

      const rawValidator = createRawValidator(validators);

      const testData: any = {};
      for (let i = 0; i < count; i++) {
        testData[`field${i}`] = `VALUE${i}`;
      }

      const ops = measure(`${count} field(s)`, () => {
        const result = rawValidator.parseRaw(testData);
        if (!result.valid) throw new Error("Failed");
      });

      results.push({ count, ops });
    }

    console.log("\n📈 Scaling Results:");
    results.forEach((r) => {
      const efficiency = ((r.ops / results[0].ops) * 100).toFixed(1);
      console.log(
        `  ${r.count} field(s): ${r.ops.toLocaleString()} ops/sec (${efficiency}% of single field)`
      );
    });

    // Single field should achieve 1M+
    expect(results[0].ops).toBeGreaterThan(1000000);
  });
});
