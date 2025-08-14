/**
 * Test coverage for strategy-factory.ts
 * Testing core strategy pattern implementations
 */

import {
  ValidationStrategy,
  StrategyAnalysis,
  analyzeFields,
  createOptimalStrategy,
  createSingleFieldStrategy
} from "../../../../src/core/optimization/core/strategy-factory";

describe("Strategy Factory", () => {
  const mockPlugins = {
    required: { methodName: "required", category: "standard" },
    stringMin: { methodName: "stringMin", category: "standard" },
    transform: { methodName: "transform", category: "transform" },
    toUpperCase: { methodName: "toUpperCase", category: "transform" }
  };

  describe("analyzeFields", () => {
    test("should detect simple field without transforms", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.strategy).toBe(ValidationStrategy.FAST_SEPARATED);
      expect(analysis.canOptimize).toBe(true);
      expect(analysis.hasTransforms).toBe(false);
      expect(analysis.hasArrayFields).toBe(false);
      expect(analysis.fieldCount).toBe(1);
      expect(analysis.reason).toContain("fast separated");
    });

    test("should detect transforms and use definition order", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required().transform()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.strategy).toBe(ValidationStrategy.DEFINITION_ORDER);
      expect(analysis.canOptimize).toBe(false);
      expect(analysis.hasTransforms).toBe(true);
      expect(analysis.hasArrayFields).toBe(false);
      expect(analysis.fieldCount).toBe(1);
      expect(analysis.reason).toContain("Transforms detected");
    });

    test("should detect array fields and use batch processing", () => {
      const fieldDefinitions = [
        {
          path: "items.*.name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.strategy).toBe(ValidationStrategy.ARRAY_BATCH);
      expect(analysis.canOptimize).toBe(true);
      expect(analysis.hasTransforms).toBe(false);
      expect(analysis.hasArrayFields).toBe(true);
      expect(analysis.fieldCount).toBe(1);
      expect(analysis.reason).toContain("Array fields detected");
    });

    test("should handle multiple fields with mixed characteristics", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        },
        {
          path: "items.*.id",
          builderFunction: function() { return "b.number.required()"; }
        },
        {
          path: "description",
          builderFunction: function() { return "b.string.transform()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.fieldCount).toBe(3);
      expect(analysis.hasTransforms).toBe(true);
      expect(analysis.hasArrayFields).toBe(true);
      // Should prioritize array batch when both arrays and transforms exist
      expect(analysis.strategy).toBe(ValidationStrategy.ARRAY_BATCH);
    });

    test("should handle empty field definitions", () => {
      const analysis = analyzeFields([], mockPlugins);

      expect(analysis.strategy).toBe(ValidationStrategy.FAST_SEPARATED);
      expect(analysis.canOptimize).toBe(true);
      expect(analysis.hasTransforms).toBe(false);
      expect(analysis.hasArrayFields).toBe(false);
      expect(analysis.fieldCount).toBe(0);
    });

    test("should detect toUpperCase transform plugin", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required().toUpperCase()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.hasTransforms).toBe(true);
      expect(analysis.strategy).toBe(ValidationStrategy.DEFINITION_ORDER);
    });
  });

  describe("createOptimalStrategy", () => {
    test("should create strategy with analysis for simple field", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const result = createOptimalStrategy(fieldDefinitions, mockPlugins);

      expect(result.strategy).toBeDefined();
      expect(result.analysis).toBeDefined();
      expect(result.analysis.strategy).toBe(ValidationStrategy.FAST_SEPARATED);
      expect(result.strategy.strategyType).toBeDefined();
    });

    test("should create strategy for transform field", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required().transform()"; }
        }
      ];

      const result = createOptimalStrategy(fieldDefinitions, mockPlugins);

      expect(result.strategy).toBeDefined();
      expect(result.analysis.strategy).toBe(ValidationStrategy.DEFINITION_ORDER);
      expect(result.strategy.strategyType).toBeDefined();
    });

    test("should create strategy for array fields", () => {
      const fieldDefinitions = [
        {
          path: "items.*.name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const result = createOptimalStrategy(fieldDefinitions, mockPlugins);

      expect(result.strategy).toBeDefined();
      expect(result.analysis.strategy).toBe(ValidationStrategy.ARRAY_BATCH);
    });
  });

  describe("createSingleFieldStrategy", () => {
    test("should create fast separated strategy for field without transforms", () => {
      const mockValidators = [
        { code: "required", check: () => true }
      ];

      const strategy = createSingleFieldStrategy("name", mockValidators);

      expect(strategy.strategyType).toBe(ValidationStrategy.FAST_SEPARATED);
    });

    test("should create definition order strategy for field with transforms", () => {
      const mockValidators = [
        { code: "required", check: () => true }
      ];
      const mockTransforms = [
        { code: "transform", transform: (v: any) => v }
      ];

      const strategy = createSingleFieldStrategy("name", mockValidators, mockTransforms);

      expect(strategy.strategyType).toBe(ValidationStrategy.DEFINITION_ORDER);
    });

    test("should handle empty validators", () => {
      const strategy = createSingleFieldStrategy("name", []);

      expect(strategy.strategyType).toBe(ValidationStrategy.FAST_SEPARATED);
    });

    test("should handle single validator", () => {
      const mockValidators = [
        { code: "required", check: () => true }
      ];

      const strategy = createSingleFieldStrategy("name", mockValidators);

      expect(strategy.strategyType).toBe(ValidationStrategy.FAST_SEPARATED);
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle invalid function strings gracefully", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: () => null // Invalid function
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis).toBeDefined();
      expect(analysis.fieldCount).toBe(1);
      expect(analysis.strategy).toBeDefined();
    });

    test("should handle fields with complex nested array paths", () => {
      const fieldDefinitions = [
        {
          path: "data.items.*.nested.*.value",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, mockPlugins);

      expect(analysis.hasArrayFields).toBe(true);
      expect(analysis.strategy).toBe(ValidationStrategy.ARRAY_BATCH);
    });

    test("should handle plugins without proper structure", () => {
      const badPlugins = {
        incomplete: { /* missing methodName */ }
      };

      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const analysis = analyzeFields(fieldDefinitions, badPlugins);

      expect(analysis).toBeDefined();
      expect(analysis.fieldCount).toBe(1);
    });
  });
});