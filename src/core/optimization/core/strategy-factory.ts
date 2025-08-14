/**
 * Strategy Pattern Implementation
 * Validation strategy integration and factory pattern
 */

import {
  ValidationEngine,
  getValidationEngine,
  ValidationField,
  ValidationResult,
  ParseResult,
  ValidationContext,
} from "./validation-engine";
import { FieldUtils, createFieldAccessor } from "./field-utils";

export enum ValidationStrategy {
  FAST_SEPARATED = "fast_separated",
  DEFINITION_ORDER = "definition_order",
  ARRAY_BATCH = "array_batch",
  HOISTED_OPTIMIZED = "hoisted_optimized",
}

export interface StrategyValidationOptions {
  abortEarly?: boolean;
  abortEarlyOnEachField?: boolean;
}

export interface StrategyAnalysis {
  strategy: ValidationStrategy;
  reason: string;
  canOptimize: boolean;
  hasTransforms: boolean;
  hasArrayFields: boolean;
  fieldCount: number;
}

/**
 * Unified validation strategy interface
 */
export interface IValidationStrategy {
  readonly strategyType: ValidationStrategy;

  validate(
    value: any,
    rootData: any,
    options?: StrategyValidationOptions
  ): ValidationResult;

  parse(
    value: any,
    rootData: any,
    options?: StrategyValidationOptions
  ): ParseResult;

  // Hoisted optimization support
  validateHoisted?(
    value: any,
    rootData: any,
    abortEarlyOnEachField?: boolean
  ): {
    valid: boolean;
    errorIndices?: number[];
  };

  reconstructErrors?(
    errorIndices: number[],
    value: any,
    rootData: any,
    abortEarlyOnEachField?: boolean
  ): Array<{ path: string; code: string; message: string }>;
}

/**
 * Fast Separated Strategy
 * Execute in order: Validators → Transforms (optimized)
 */
export function createFastSeparatedStrategy(
  field: ValidationField,
  engine: ValidationEngine = getValidationEngine()
): IValidationStrategy {
  return {
    strategyType: ValidationStrategy.FAST_SEPARATED,

    validate(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ValidationResult {
      const context: ValidationContext = {
        originalValue: value,
        currentValue: value,
        allValues: rootData,
        path: field.path,
      };

      return engine.validateField(field, value, context, {
        abortEarly: options.abortEarlyOnEachField !== false,
      });
    },

    parse(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ParseResult {
      const context: ValidationContext = {
        originalValue: value,
        currentValue: value,
        allValues: rootData,
        path: field.path,
      };

      return engine.parseField(field, value, context, {
        abortEarly: options.abortEarlyOnEachField !== false,
      });
    },

    validateHoisted(
      value: any,
      rootData: any,
      abortEarlyOnEachField: boolean = true
    ): {
      valid: boolean;
      errorIndices?: number[];
    } {
      return engine.validateHoisted(
        field,
        value,
        rootData,
        abortEarlyOnEachField
      );
    },

    reconstructErrors(
      errorIndices: number[],
      value: any,
      rootData: any,
      abortEarlyOnEachField: boolean = true
    ): Array<{ path: string; code: string; message: string }> {
      return engine.reconstructErrors(field, errorIndices, value, rootData);
    },
  };
}

/**
 * Definition Order Strategy
 * Execute in definition order (including transforms)
 */
export function createDefinitionOrderStrategy(
  field: ValidationField,
  engine: ValidationEngine = getValidationEngine()
): IValidationStrategy {
  const strategy: IValidationStrategy = {
    strategyType: ValidationStrategy.DEFINITION_ORDER,

    validate(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ValidationResult {
      // Definition order strategy uses parse for validation to maintain order
      const parseResult = strategy.parse(value, rootData, options);
      return {
        valid: parseResult.valid,
        errors: parseResult.errors,
      };
    },

    parse(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ParseResult {
      const context: ValidationContext = {
        originalValue: value,
        currentValue: value,
        allValues: rootData,
        path: field.path,
      };

      return engine.parseField(field, value, context, {
        abortEarly: options.abortEarlyOnEachField !== false,
      });
    },

    validateHoisted(
      value: any,
      rootData: any,
      abortEarlyOnEachField: boolean = true
    ): {
      valid: boolean;
      errorIndices?: number[];
    } {
      // For definition order, hoisting is less beneficial but still supported
      return engine.validateHoisted(
        field,
        value,
        rootData,
        abortEarlyOnEachField
      );
    },

    reconstructErrors(
      errorIndices: number[],
      value: any,
      rootData: any,
      abortEarlyOnEachField: boolean = true
    ): Array<{ path: string; code: string; message: string }> {
      return engine.reconstructErrors(field, errorIndices, value, rootData);
    },
  };

  return strategy;
}

/**
 * Array Batch Strategy
 * Batch processing of array elements (optimized)
 */
export function createArrayBatchStrategy(
  arrayPath: string,
  elementFields: ValidationField[],
  engine: ValidationEngine = getValidationEngine()
): IValidationStrategy {
  // Pre-compile accessors for performance
  const arrayAccessor = FieldUtils.createArrayAccessor(arrayPath);
  const elementAccessors = elementFields.map((field) => {
    // Pre-compute the element key to avoid repeated replace operations
    const elementKey = field.path.replace(`${arrayPath}.`, "");
    return {
      fieldName: field.path,
      elementKey,
      accessor: createFieldAccessor(elementKey),
      setter: FieldUtils.createFieldSetter(elementKey),
    };
  });

  return {
    strategyType: ValidationStrategy.ARRAY_BATCH,

    validate(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ValidationResult {
      const { abortEarly = false } = options;
      const abortEarlyOnEachField = options.abortEarlyOnEachField !== false;
      const arrayValue = arrayAccessor(rootData);

      if (!Array.isArray(arrayValue)) {
        return { valid: true, errors: [] };
      }

      // Skip validation for empty arrays
      if (arrayValue.length === 0) {
        return { valid: true, errors: [] };
      }

      const allErrors: Array<{ path: string; code: string; message: string }> =
        [];

      // Batch validate all elements
      for (let i = 0; i < arrayValue.length; i++) {
        const element = arrayValue[i];

        for (let j = 0; j < elementFields.length; j++) {
          const field = elementFields[j];
          const accessorInfo = elementAccessors[j];
          const elementValue = accessorInfo.accessor(element);
          const elementPath = `${arrayPath}[${i}].${accessorInfo.elementKey}`;

          const context: ValidationContext = {
            originalValue: elementValue,
            currentValue: elementValue,
            allValues: rootData,
            path: elementPath,
          };

          const result = engine.validateField(field, elementValue, context, {
            abortEarly: abortEarlyOnEachField,
          });

          if (!result.valid) {
            allErrors.push(...result.errors);

            if (abortEarly) {
              return { valid: false, errors: allErrors };
            }
          }
        }
      }

      return {
        valid: allErrors.length === 0,
        errors: allErrors,
      };
    },

    parse(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ParseResult {
      const { abortEarly = false } = options;
      const arrayValue = arrayAccessor(rootData);

      if (!Array.isArray(arrayValue)) {
        return { valid: true, data: rootData, errors: [] };
      }

      // Skip validation for empty arrays
      if (arrayValue.length === 0) {
        return { valid: true, data: rootData, errors: [] };
      }

      const transformedData = engine.applyTransforms([], rootData, {
        originalValue: rootData,
        currentValue: rootData,
        allValues: rootData,
        path: "",
      }); // Deep clone logic is in engine

      const allErrors: Array<{ path: string; code: string; message: string }> =
        [];
      const transformedArray = arrayAccessor(transformedData);

      // Batch parse all elements
      for (let i = 0; i < arrayValue.length; i++) {
        const element = arrayValue[i];

        for (let j = 0; j < elementFields.length; j++) {
          const field = elementFields[j];
          const accessorInfo = elementAccessors[j];
          const elementValue = accessorInfo.accessor(element);
          const elementPath = `${arrayPath}[${i}].${accessorInfo.elementKey}`;

          const context: ValidationContext = {
            originalValue: elementValue,
            currentValue: elementValue,
            allValues: rootData,
            path: elementPath,
          };

          const result = engine.parseField(field, elementValue, context, {
            abortEarly: options.abortEarlyOnEachField !== false,
          });

          if (!result.valid) {
            allErrors.push(...result.errors);

            if (abortEarly) {
              return { valid: false, errors: allErrors };
            }
          } else if (result.data !== undefined) {
            // Set transformed value using pre-compiled setter
            accessorInfo.setter(transformedArray[i], result.data);
          }
        }
      }

      return {
        valid: allErrors.length === 0,
        data: allErrors.length === 0 ? transformedData : undefined,
        errors: allErrors,
      };
    },
  };
}

/**
 * Multi-Field Strategy
 * Integrated processing of multiple fields
 */
export function createMultiFieldStrategy(
  fields: ValidationField[],
  engine: ValidationEngine = getValidationEngine()
): IValidationStrategy {
  return {
    strategyType: ValidationStrategy.FAST_SEPARATED, // Base type

    validate(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ValidationResult {
      return engine.validateBatch(fields, rootData, {
        abortEarly: options.abortEarly,
        abortEarlyOnEachField: options.abortEarlyOnEachField,
      });
    },

    parse(
      value: any,
      rootData: any,
      options: StrategyValidationOptions = {}
    ): ParseResult {
      return engine.parseBatch(fields, rootData, {
        abortEarly: options.abortEarly,
        abortEarlyOnEachField: options.abortEarlyOnEachField,
      });
    },
  };
}

/**
 * Strategy Factory
 * Automatically select optimal strategy
 */
const strategyEngine = getValidationEngine();

/**
 * Analyze field definitions to determine optimal strategy
 */
export function analyzeFields(
  fieldDefinitions: Array<{ path: string; builderFunction: Function }>,
  plugins: Record<string, any>
): StrategyAnalysis {
  const fieldCount = fieldDefinitions.length;
  let hasTransforms = false;
  let hasArrayFields = false;

  // Analyze each field
  for (const fieldDef of fieldDefinitions) {
    const pluginCalls = extractPluginCalls(fieldDef.builderFunction);

    // Check for transforms
    if (pluginCalls.some((call) => isTransformPlugin(call, plugins))) {
      hasTransforms = true;
    }

    // Check for array fields
    if (FieldUtils.parseFieldPath(fieldDef.path).isArrayElement) {
      hasArrayFields = true;
    }
  }

  // Determine optimal strategy
  let strategy: ValidationStrategy;
  let reason: string;
  let canOptimize: boolean;

  if (hasArrayFields) {
    strategy = ValidationStrategy.ARRAY_BATCH;
    reason = "Array fields detected - using batch processing";
    canOptimize = true;
  } else if (hasTransforms) {
    strategy = ValidationStrategy.DEFINITION_ORDER;
    reason = "Transforms detected - using definition order";
    canOptimize = false;
  } else {
    strategy = ValidationStrategy.FAST_SEPARATED;
    reason = "No transforms or arrays - using fast separated execution";
    canOptimize = true;
  }

  return {
    strategy,
    reason,
    canOptimize,
    hasTransforms,
    hasArrayFields,
    fieldCount,
  };
}

/**
 * Create strategy instance
 */
export function createStrategy(
  analysis: StrategyAnalysis,
  fieldDefinitions: Array<{
    path: string;
    builderFunction: Function;
    validators?: any[];
    transforms?: any[];
  }>,
  plugins: Record<string, any>
): IValidationStrategy {
  // Convert field definitions to ValidationField format
  const fields = fieldDefinitions.map((fieldDef) => ({
    path: fieldDef.path,
    validators: fieldDef.validators || [],
    transforms: fieldDef.transforms || [],
  }));

  switch (analysis.strategy) {
    case ValidationStrategy.ARRAY_BATCH:
      return createArrayBatchStrategyFromFields(fields);

    case ValidationStrategy.DEFINITION_ORDER:
      return createMultiFieldStrategy(fields, strategyEngine);

    case ValidationStrategy.FAST_SEPARATED:
    default:
      return createMultiFieldStrategy(fields, strategyEngine);
  }
}

/**
 * Create array batch strategy
 */
function createArrayBatchStrategyFromFields(
  fields: ValidationField[]
): IValidationStrategy {
  const arrayGroups = FieldUtils.groupArrayFields(fields.map((f) => f.path));

  // For now, take the first array group
  // TODO: Support multiple array groups
  const firstGroup = arrayGroups.values().next().value;

  if (firstGroup) {
    const elementFields = fields.filter((f) =>
      firstGroup.elementFields.some((ef) => f.path.endsWith(ef))
    );

    return createArrayBatchStrategy(
      firstGroup.arrayPath,
      elementFields,
      strategyEngine
    );
  }

  // Fallback to multi-field strategy
  return createMultiFieldStrategy(fields, strategyEngine);
}

/**
 * Plugin calls extraction (simplified)
 */
function extractPluginCalls(builderFunction: Function): string[] {
  const funcString = builderFunction.toString();
  const methodCallPattern = /\.(\w+)\(/g;
  const calls: string[] = [];
  let match;

  while ((match = methodCallPattern.exec(funcString)) !== null) {
    calls.push(match[1]);
  }

  return calls;
}

/**
 * Transform plugin detection
 */
function isTransformPlugin(
  methodName: string,
  plugins: Record<string, any>
): boolean {
  const plugin = Object.values(plugins).find(
    (p: any) => p?.methodName === methodName
  );
  return (
    plugin?.category === "transform" ||
    methodName === "transform" ||
    methodName.startsWith("to")
  );
}

// Export utility functions
export function createOptimalStrategy(
  fieldDefinitions: Array<{ path: string; builderFunction: Function }>,
  plugins: Record<string, any>
): { strategy: IValidationStrategy; analysis: StrategyAnalysis } {
  const analysis = analyzeFields(fieldDefinitions, plugins);
  const strategy = createStrategy(analysis, fieldDefinitions, plugins);

  return { strategy, analysis };
}

export function createSingleFieldStrategy(
  path: string,
  validators: any[],
  transforms: any[] = []
): IValidationStrategy {
  const field: ValidationField = { path, validators, transforms };

  if (transforms.length > 0) {
    return createDefinitionOrderStrategy(field);
  } else {
    return createFastSeparatedStrategy(field);
  }
}
