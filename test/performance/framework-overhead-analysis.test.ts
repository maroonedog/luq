import { describe, test, expect } from "@jest/globals";
import {
  Builder,
  requiredPlugin,
  stringMinPlugin,
  numberMinPlugin,
} from "../../src";

describe("Framework Overhead Analysis", () => {
  const measure = (
    name: string,
    fn: () => void,
    iterations: number = 100000
  ): number => {
    // Warm up
    for (let i = 0; i < 1000; i++) {
      fn();
    }

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const duration = end - start;
    const ops = Math.round(iterations / (duration / 1000));
    console.log(
      `${name}: ${ops.toLocaleString()} ops/sec (${duration.toFixed(2)}ms)`
    );
    return ops;
  };

  test("Baseline - Direct function calls", () => {
    console.log("\n⚡ Baseline Performance (No Framework):");

    // Direct validation function
    const directValidate = (value: any) => {
      if (value == null || value === "") return false;
      if (typeof value !== "string") return false;
      if (value.length < 3) return false;
      return true;
    };

    const testValue = "test";
    const directOps = measure("Direct function", () => {
      directValidate(testValue);
    });

    // Direct object validation
    const directObjectValidate = (obj: any) => {
      if (!obj || typeof obj !== "object") return false;
      if (!directValidate(obj.name)) return false;
      return true;
    };

    const testObject = { name: "test" };
    const directObjectOps = measure("Direct object validation", () => {
      directObjectValidate(testObject);
    });

    console.log("\n📊 Baseline Results:");
    console.log(`  Direct function: ${directOps.toLocaleString()} ops/sec`);
    console.log(`  Direct object: ${directObjectOps.toLocaleString()} ops/sec`);
  });

  test("Framework overhead - Single field", () => {
    console.log("\n🏗️ Framework Overhead - Single Field:");

    // Minimal validator - just required
    const minimalValidator = Builder()
      .use(requiredPlugin)
      .for<{ name: string }>()
      .v("name", (b) => b.string.required())
      .build();

    const testData = { name: "test" };
    const minimalOps = measure("Minimal (required only)", () => {
      minimalValidator.validate(testData);
    });

    // With string validation
    const stringValidator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ name: string }>()
      .v("name", (b) => b.string.required().min(3))
      .build();

    const stringOps = measure("Required + stringMin", () => {
      stringValidator.validate(testData);
    });

    // Test empty builder
    const emptyValidator = Builder().for<{}>().build();

    const emptyData = {};
    const emptyOps = measure("Empty validator", () => {
      emptyValidator.validate(emptyData);
    });

    console.log("\n📊 Single Field Results:");
    console.log(`  Empty validator: ${emptyOps.toLocaleString()} ops/sec`);
    console.log(`  Minimal (required): ${minimalOps.toLocaleString()} ops/sec`);
    console.log(`  With stringMin: ${stringOps.toLocaleString()} ops/sec`);
  });

  test("Framework overhead - Multiple fields", () => {
    console.log("\n🏗️ Framework Overhead - Multiple Fields:");

    type TestData = {
      field1: string;
      field2: string;
      field3: number;
    };

    // 3 fields
    const threeFieldValidator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<TestData>()
      .v("field1", (b) => b.string.required().min(3))
      .v("field2", (b) => b.string.required().min(3))
      .v("field3", (b) => b.number.required().min(1))
      .build();

    const testData3 = { field1: "test", field2: "test", field3: 10 };
    const threeFieldOps = measure("3 fields", () => {
      threeFieldValidator.validate(testData3);
    });

    // Test with ultra-fast mode
    console.log("\n🚀 With Ultra-Fast Mode:");
    (global as any).__LUQ_ULTRA_FAST__ = true;

    const ultraFastOps = measure("3 fields (ultra-fast)", () => {
      threeFieldValidator.validate(testData3);
    });

    delete (global as any).__LUQ_ULTRA_FAST__;

    console.log("\n📊 Multiple Fields Results:");
    console.log(
      `  3 fields (normal): ${threeFieldOps.toLocaleString()} ops/sec`
    );
    console.log(
      `  3 fields (ultra-fast): ${ultraFastOps.toLocaleString()} ops/sec`
    );
    console.log(`  Speedup: ${(ultraFastOps / threeFieldOps).toFixed(1)}x`);
  });

  test("Plugin system overhead", () => {
    console.log("\n🔌 Plugin System Overhead:");

    // Test plugin chain length impact
    const testData = { value: "test123" };

    // 1 plugin
    const onePlugin = Builder()
      .use(requiredPlugin)
      .for<{ value: string }>()
      .v("value", (b) => b.string.required())
      .build();

    const onePluginOps = measure("1 plugin", () => {
      onePlugin.validate(testData);
    });

    // 2 plugins
    const twoPlugins = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ value: string }>()
      .v("value", (b) => b.string.required().min(3))
      .build();

    const twoPluginOps = measure("2 plugins", () => {
      twoPlugins.validate(testData);
    });

    // 3 plugins (with pattern)
    const stringPatternPlugin = {
      name: "pattern",
      methodName: "pattern",
      allowedTypes: ["string"],
      category: "string",
      impl: (regex: RegExp) => ({
        check: (value: any) => typeof value === "string" && regex.test(value),
        code: "PATTERN",

        getErrorMessage: () => "Pattern mismatch",
        params: [regex],
      }),
    };

    const threePlugins = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringPatternPlugin as any)
      .for<{ value: string }>()
      .v("value", (b) =>
        (b.string as any)
          .required()
          .min(3)
          .pattern(/^[a-z]+\d+$/)
      )
      .build();

    const threePluginOps = measure("3 plugins", () => {
      threePlugins.validate(testData);
    });

    console.log("\n📊 Plugin Chain Results:");
    console.log(`  1 plugin: ${onePluginOps.toLocaleString()} ops/sec`);
    console.log(`  2 plugins: ${twoPluginOps.toLocaleString()} ops/sec`);
    console.log(`  3 plugins: ${threePluginOps.toLocaleString()} ops/sec`);
    console.log(
      `  Per-plugin overhead: ~${Math.round((onePluginOps - twoPluginOps) / 1).toLocaleString()} ops/sec`
    );
  });
});
