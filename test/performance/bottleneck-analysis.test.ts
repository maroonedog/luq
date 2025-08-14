import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  transformPlugin,
} from "../../src";
import { createUnifiedValidator } from "../../src/core/optimization/unified-validator";
import { Result } from "../../src/types/result";

describe("Bottleneck Analysis for 1M ops/sec", () => {
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

  test("Overhead analysis", () => {
    // 1. Baseline: Direct function call
    const directValidate = (value: string) => value.length >= 3;
    const directTransform = (value: string) => value.toLowerCase();

    const baselineOps = measure("1. Baseline (direct function)", () => {
      const value = "TEST123";
      if (!directValidate(value)) throw new Error();
      const result = directTransform(value);
    });

    // 2. With Result wrapper
    const withResultOps = measure("2. With Result wrapper", () => {
      const value = "TEST123";
      if (!directValidate(value)) {
        const err = Result.error([
          {
            path: "value",
            code: "MIN",
            message: "Too short",
            paths: () => ["value"],
          },
        ]);
      } else {
        const ok = Result.ok({ value: directTransform(value) });
      }
    });

    // 3. With object spread
    const withSpreadOps = measure("3. With object spread", () => {
      const obj = { value: "TEST123" };
      if (!directValidate(obj.value)) throw new Error();
      const transformed = { ...obj, value: directTransform(obj.value) };
    });

    // 4. With field accessor
    const accessor = (obj: any) => obj.value;
    const withAccessorOps = measure("4. With field accessor", () => {
      const obj = { value: "TEST123" };
      const value = accessor(obj);
      if (!directValidate(value)) throw new Error();
      const result = directTransform(value);
    });

    // 5. Full unified validator (direct)
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

    const unifiedOps = measure("5. Unified validator (direct)", () => {
      const result = unifiedValidator.parse("TEST123", {});
      if (!result.isValid()) throw new Error();
    });

    // 6. Full builder
    const builder = Builder()
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

    const builderOps = measure("6. Full builder", () => {
      const result = builder.parse({ value: "TEST123" });
      if (!result.isValid()) throw new Error();
    });

    // Analysis
    console.log("\n📊 Bottleneck Analysis:");
    console.log(`  Baseline: ${baselineOps.toLocaleString()} ops/sec (100%)`);
    console.log(
      `  Result wrapper overhead: ${(((baselineOps - withResultOps) / baselineOps) * 100).toFixed(1)}%`
    );
    console.log(
      `  Object spread overhead: ${(((baselineOps - withSpreadOps) / baselineOps) * 100).toFixed(1)}%`
    );
    console.log(
      `  Field accessor overhead: ${(((baselineOps - withAccessorOps) / baselineOps) * 100).toFixed(1)}%`
    );
    console.log(
      `  Unified validator: ${unifiedOps.toLocaleString()} ops/sec (${((unifiedOps / baselineOps) * 100).toFixed(1)}% of baseline)`
    );
    console.log(
      `  Full builder: ${builderOps.toLocaleString()} ops/sec (${((builderOps / baselineOps) * 100).toFixed(1)}% of baseline)`
    );
    console.log(`\n🎯 Target: 1,000,000 ops/sec`);
    console.log(`  Current: ${builderOps.toLocaleString()} ops/sec`);
    console.log(
      `  Gap: ${(((1000000 - builderOps) / builderOps) * 100).toFixed(1)}% improvement needed`
    );

    // For reaching 1M, builder needs to achieve at least 8-10% of baseline
    const targetEfficiency = (1000000 / baselineOps) * 100;
    console.log(
      `\n💡 To reach 1M ops/sec, need ${targetEfficiency.toFixed(1)}% efficiency of baseline`
    );
  });

  test("Error handling overhead", () => {
    // Test error creation overhead
    const errorCreationOps = measure("Error object creation", () => {
      const err = {
        path: "value",
        code: "STRING_MIN",
        message: "Value too short",
        paths: () => ["value"],
      };
    });

    const errorArrayOps = measure("Error array creation", () => {
      const errors = [
        {
          path: "value",
          code: "STRING_MIN",
          message: "Value too short",
          paths: () => ["value"],
        },
      ];
    });

    const resultErrorOps = measure("Result.error creation", () => {
      const err = Result.error([
        {
          path: "value",
          code: "STRING_MIN",
          message: "Value too short",
          paths: () => ["value"],
        },
      ]);
    });

    console.log("\n📊 Error Handling Overhead:");
    console.log(
      `  Single error object: ${errorCreationOps.toLocaleString()} ops/sec`
    );
    console.log(`  Error array: ${errorArrayOps.toLocaleString()} ops/sec`);
    console.log(`  Result.error: ${resultErrorOps.toLocaleString()} ops/sec`);
  });
});
