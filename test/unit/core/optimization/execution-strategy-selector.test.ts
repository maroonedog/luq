/**
 * Test coverage for execution-strategy-selector.ts
 * Focused on core functionality and edge cases
 */

import { 
  selectOptimalStrategies, 
  groupByStrategy 
} from "../../../../src/core/optimization/execution-strategy-selector";

import { 
  ValidationStrategy,
  StrategyAnalysis
} from "../../../../src/core/optimization/core/strategy-factory";

describe("Execution Strategy Selector", () => {
  const mockPlugins = {
    required: { category: "standard" },
    stringMin: { category: "standard" },
    transform: { category: "transform" },
  };

  describe("selectOptimalStrategies", () => {
    test("should handle empty field definitions", () => {
      const result = selectOptimalStrategies([], mockPlugins);
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBe(0);
    });

    test("should create strategy analysis for single field", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const result = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      
      expect(result.size).toBe(1);
      expect(result.has("name")).toBe(true);
      
      const analysis = result.get("name");
      expect(analysis).toBeDefined();
      expect(analysis!.strategy).toBeDefined();
      expect(analysis!.reason).toBeDefined();
      expect(typeof analysis!.canOptimize).toBe("boolean");
    });

    test("should create strategy analysis for multiple fields", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required()"; }
        },
        {
          path: "age",
          builderFunction: function() { return "b.number.required()"; }
        },
        {
          path: "email",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const result = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      
      expect(result.size).toBe(3);
      expect(result.has("name")).toBe(true);
      expect(result.has("age")).toBe(true);
      expect(result.has("email")).toBe(true);
    });

    test("should handle field definitions with transform functions", () => {
      const fieldDefinitions = [
        {
          path: "name",
          builderFunction: function() { return "b.string.required().transform()"; }
        }
      ];

      const result = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      
      expect(result.size).toBe(1);
      const analysis = result.get("name");
      expect(analysis).toBeDefined();
    });

    test("should handle array field paths", () => {
      const fieldDefinitions = [
        {
          path: "items.*.name",
          builderFunction: function() { return "b.string.required()"; }
        },
        {
          path: "items.*.id",
          builderFunction: function() { return "b.number.required()"; }
        }
      ];

      const result = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      
      expect(result.size).toBe(2);
      expect(result.has("items.*.name")).toBe(true);
      expect(result.has("items.*.id")).toBe(true);
    });
  });

  describe("groupByStrategy", () => {
    test("should handle empty strategies map", () => {
      const strategies = new Map<string, StrategyAnalysis>();
      const result = groupByStrategy(strategies);
      
      expect(result.fastFields).toEqual([]);
      expect(result.slowFields).toEqual([]);
    });

    test("should group fields by fast separated strategy", () => {
      const strategies = new Map<string, StrategyAnalysis>();
      
      strategies.set("field1", {
        strategy: ValidationStrategy.FAST_SEPARATED,
        reason: "No transforms",
        canOptimize: true,
        hasTransforms: false,
        hasArrayFields: false,
        fieldCount: 1
      });
      
      strategies.set("field2", {
        strategy: ValidationStrategy.FAST_SEPARATED,
        reason: "No transforms",
        canOptimize: true,
        hasTransforms: false,
        hasArrayFields: false,
        fieldCount: 1
      });

      const result = groupByStrategy(strategies);
      
      expect(result.fastFields).toEqual(["field1", "field2"]);
      expect(result.slowFields).toEqual([]);
    });

    test("should group fields by definition order strategy", () => {
      const strategies = new Map<string, StrategyAnalysis>();
      
      strategies.set("field1", {
        strategy: ValidationStrategy.DEFINITION_ORDER,
        reason: "Has transforms",
        canOptimize: false,
        hasTransforms: true,
        hasArrayFields: false,
        fieldCount: 1
      });
      
      strategies.set("field2", {
        strategy: ValidationStrategy.DEFINITION_ORDER,
        reason: "Has transforms",
        canOptimize: false,
        hasTransforms: true,
        hasArrayFields: false,
        fieldCount: 1
      });

      const result = groupByStrategy(strategies);
      
      expect(result.fastFields).toEqual([]);
      expect(result.slowFields).toEqual(["field1", "field2"]);
    });

    test("should group mixed strategies correctly", () => {
      const strategies = new Map<string, StrategyAnalysis>();
      
      strategies.set("fastField", {
        strategy: ValidationStrategy.FAST_SEPARATED,
        reason: "No transforms",
        canOptimize: true,
        hasTransforms: false,
        hasArrayFields: false,
        fieldCount: 1
      });
      
      strategies.set("slowField", {
        strategy: ValidationStrategy.DEFINITION_ORDER,
        reason: "Has transforms",
        canOptimize: false,
        hasTransforms: true,
        hasArrayFields: false,
        fieldCount: 1
      });

      const result = groupByStrategy(strategies);
      
      expect(result.fastFields).toEqual(["fastField"]);
      expect(result.slowFields).toEqual(["slowField"]);
    });

    test("should handle array batch strategy as slow field", () => {
      const strategies = new Map<string, StrategyAnalysis>();
      
      strategies.set("arrayField", {
        strategy: ValidationStrategy.ARRAY_BATCH,
        reason: "Has array fields",
        canOptimize: true,
        hasTransforms: false,
        hasArrayFields: true,
        fieldCount: 1
      });

      const result = groupByStrategy(strategies);
      
      expect(result.fastFields).toEqual([]);
      expect(result.slowFields).toEqual(["arrayField"]);
    });
  });

  describe("Integration tests", () => {
    test("should work with real-world field definitions", () => {
      const fieldDefinitions = [
        {
          path: "user.name",
          builderFunction: function() { return "b.string.required().min(2)"; }
        },
        {
          path: "user.email",
          builderFunction: function() { return "b.string.required().email()"; }
        },
        {
          path: "tags.*.name",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const strategies = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      const grouped = groupByStrategy(strategies);
      
      expect(strategies.size).toBe(3);
      expect(grouped.fastFields.length + grouped.slowFields.length).toBe(3);
    });

    test("should handle complex nested paths", () => {
      const fieldDefinitions = [
        {
          path: "data.users.*.profile.settings.theme",
          builderFunction: function() { return "b.string.required()"; }
        }
      ];

      const result = selectOptimalStrategies(fieldDefinitions, mockPlugins);
      
      expect(result.size).toBe(1);
      expect(result.has("data.users.*.profile.settings.theme")).toBe(true);
    });
  });
});