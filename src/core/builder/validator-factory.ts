/**
 * Validator Factory - Separated validator construction responsibility
 * Responsible for generating performance-optimized validators
 */

import { NestedKeyOf, TypeOfPath } from "../../types/util";
import { Result } from "../../types/result";
import { applyDefault } from "../builder/types/field-options";
import { createFieldContext } from "./context/field-context";
import type {
  FieldBuilderContext,
  ApplyFieldTransforms as ApplyNestedTransforms,
  FieldValidator,
  TransformAwareValidator,
  ParseOptions,
  ValidationOptions,
  ValidationResult,
} from "./plugins/plugin-types";
import {
  selectOptimalStrategies,
  groupByStrategy,
} from "../optimization/execution-strategy-selector";
import {
  createUnifiedValidator,
  UnifiedValidator,
} from "../optimization/unified-validator";
import {
  createNestedValueAccessor,
  createFieldExistenceChecker,
  parseFieldPath,
  createArrayElementAccessor,
} from "../plugin/utils/field-accessor";

// Note: Accessor cache is now managed locally within each validator factory to avoid memory leaks
import {
  DOT,
  ValidationMode,
  VALIDATE_MODE,
  PARSE_MODE,
} from "../../constants";
import {
  analyzeArrayBatching,
  createArrayBatchValidator,
  ArrayBatchInfo,
} from "./array-batch-optimizer";
import { ArrayStructureInfo } from "../../types/array-type-analysis";
import {
  createUltraFastSingleFieldValidator,
  createUltraFastMultiFieldValidator,
} from "./ultra-fast-validator";
import { createRawValidator } from "./raw-validator";

// Pre-allocated objects for performance
const EMPTY_ERRORS: any[] = [];
const VALID_RESPONSE = Object.freeze({
  valid: true,
  value: null,
  errors: EMPTY_ERRORS,
});

/**
 * Field definition interface
 */
export interface FieldDefinition {
  path: string;
  builderFunction?: (context: FieldBuilderContext<any, any, any>) => any;
  rules?: any[]; // For pre-built validators
  metadata?: {
    inferredType?: string;
    hasTransforms?: boolean;
    fieldOptions?: import("../builder/types/field-options").FieldOptions<any>;
  };
  fieldType?: string;
  isArrayField?: boolean; // Indicates if this field was declared with b.array
  arrayStructure?: ArrayStructureInfo; // Build-time analyzed array structure for multi-dimensional arrays
  isOptional?: boolean; // Indicates if this field was marked as optional
}

/**
 * ValidatorFactory - Responsible for building high-performance validators
 */
export function createValidatorFactory<TObject extends object, TMap = {}>(
  plugins: Record<string, any>
) {
  /**
   * Build optimized validator
   */
  function buildOptimizedValidator(
    fieldDefinitions: Array<FieldDefinition>
  ): TransformAwareValidator<TObject, ApplyNestedTransforms<TObject, TMap>> {
    if (fieldDefinitions.length === 0) {
      return buildEmptyValidator<TObject, TMap>(plugins);
    }

    // Convert field definitions to the format expected by selectOptimalStrategies
    const fieldsWithBuilders = fieldDefinitions.map((def) => {
      // Detect if field is optional or has required plugin by building it and checking validators
      let isOptional = false;
      let hasRequired = false;
      if (def.builderFunction) {
        try {
          const context = createFieldContext(def.path, plugins);
          const built = def.builderFunction(context);
          if (built?._validators) {
            isOptional = built._validators.some(
              (v: any) => v.name === "optional"
            );
            hasRequired = built._validators.some(
              (v: any) => v.name === "required"
            );
          }
        } catch (e) {
          // If building fails, assume not optional and no required
          isOptional = false;
          hasRequired = false;
        }
      }

      return {
        path: def.path,
        builderFunction:
          def.builderFunction ||
          (() => {
            // Fallback for field definitions using the object form
            throw new Error(`Field ${def.path} uses object definition form`);
          }),
        isOptional: isOptional,
        hasRequired: hasRequired,
      };
    });

    // Determine execution strategy for each field at build time
    const executionStrategies = selectOptimalStrategies(
      fieldsWithBuilders,
      plugins
    );

    // Group fields by strategy
    const { fastFields, slowFields } = groupByStrategy(executionStrategies);

    // OPTIMIZATION: Analyze array batching opportunities
    // Pass field definitions with array field information
    const arrayBatches = analyzeArrayBatching(fieldDefinitions);

    // Remove array batch fields from regular processing
    const batchFieldPaths = new Set<string>();
    const enhancedArrayBatches = new Map<string, any>();
    const legacyArrayBatches = new Map<string, any>();

    for (const [arrayPath, batchInfo] of arrayBatches) {
      if (batchInfo._nestedInfo) {
        // Use enhanced nested array processing
        enhancedArrayBatches.set(arrayPath, batchInfo);
        // Remove ALL related fields from regular processing to avoid duplicates
        for (const fieldPath of batchInfo.fullFieldPaths) {
          batchFieldPaths.add(fieldPath);
        }
        // Also add the array path itself
        batchFieldPaths.add(arrayPath);
      } else {
        // Use legacy processing
        legacyArrayBatches.set(arrayPath, batchInfo);
        for (const fieldPath of batchInfo.fullFieldPaths) {
          batchFieldPaths.add(fieldPath);
        }
      }
    }

    const regularFastFields = fastFields.filter(
      (fp) => !batchFieldPaths.has(fp)
    );
    const regularSlowFields = slowFields.filter(
      (fp) => !batchFieldPaths.has(fp)
    );

    // Build unified validators for regular fields (excluding batched fields)
    // V8 optimization: Fast/Slow integration completed
    const slowValidators = buildUnifiedValidators(
      regularSlowFields,
      fieldDefinitions.filter((fd) => !batchFieldPaths.has(fd.path)),
      plugins
    );

    const fastValidators = buildUnifiedValidators(
      regularFastFields,
      fieldDefinitions.filter((fd) => !batchFieldPaths.has(fd.path)),
      plugins
    );

    // Build validators for all fields (needed for batch processing)
    const allValidators = new Map<string, any>();

    // Add all validators (unified)
    // Include ALL field paths, not just those in fast/slow fields
    const allFieldPaths = fieldDefinitions.map((fd) => fd.path);
    const allUnifiedValidators = buildUnifiedValidators(
      allFieldPaths,
      fieldDefinitions,
      plugins
    );
    for (const [path, validator] of allUnifiedValidators) {
      allValidators.set(path, validator);
    }

    // Create optional and required fields maps for executor
    const optionalFields = new Map<string, boolean>();
    const requiredFields = new Map<string, boolean>();
    const fieldOptionsMap = new Map<
      string,
      import("../builder/types/field-options").FieldOptions
    >();

    for (const field of fieldsWithBuilders) {
      if (field.isOptional) {
        optionalFields.set(field.path, true);
      }
      if (field.hasRequired) {
        requiredFields.set(field.path, true);
      }
    }

    // Extract field options from fieldDefinitions
    for (const fieldDef of fieldDefinitions) {
      if (fieldDef.metadata?.fieldOptions) {
        fieldOptionsMap.set(fieldDef.path, fieldDef.metadata.fieldOptions);
      }
    }

    // Update fast and slow validators with corrected array element recursive validators from allValidators
    for (const [path, validator] of allValidators) {
      if (path.includes("[*]")) {
        // If this is an array element validator, update it in fast/slow maps
        if (fastValidators.has(path)) {
          fastValidators.set(path, validator);
        }
        if (slowValidators.has(path)) {
          slowValidators.set(path, validator);
        }
      }
    }

    return createExecutorValidator<TObject, TMap>(
      slowValidators,
      fastValidators,
      fieldDefinitions,
      plugins,
      enhancedArrayBatches,
      allValidators,
      optionalFields,
      requiredFields,
      fieldOptionsMap
    );
  }

  return {
    buildOptimizedValidator,
  };
}

/**
 * Build empty validator
 */
function buildEmptyValidator<TObject extends object, TMap = {}>(
  plugins: Record<string, any>
): TransformAwareValidator<TObject, ApplyNestedTransforms<TObject, TMap>> {
  const pickValidator = createPickValidatorFactory<TObject>([], plugins);

  return {
    validate: (): Result<TObject> => Result.ok({} as TObject),
    parse: (
      value: Partial<TObject> | unknown,
      options?: ParseOptions
    ): Result<ApplyNestedTransforms<TObject, TMap>> =>
      Result.ok(value as ApplyNestedTransforms<TObject, TMap>),
    pick: <K extends NestedKeyOf<TObject>>(
      key: K
    ): FieldValidator<TObject, TypeOfPath<TObject, K>> => {
      return pickValidator.createPickedValidator(key);
    },
  };
}

/**
 * Build unified validators (V8 optimized, Fast/Slow integration)
 */
function buildUnifiedValidators(
  fields: string[],
  fieldDefinitions: Array<FieldDefinition>,
  plugins: Record<string, any>
): Map<string, UnifiedValidator> {
  const validators = new Map<string, UnifiedValidator>();
  const recursiveFieldsMap = new Map<
    string,
    { targetFieldPath: string; maxDepth: number }
  >();
  const arrayElementRecursiveFields = new Map<
    string,
    { targetFieldPath: string; maxDepth: number }
  >();

  // First pass: Build all validators and identify recursive fields
  for (const fieldPath of fields) {
    const fieldDef = fieldDefinitions.find((f) => f.path === fieldPath);

    if (fieldDef && fieldDef.builderFunction) {
      // Pre-compile field accessor for performance
      const accessor = createNestedValueAccessor(fieldPath);

      // Build the field to check for recursive marker
      const context = createFieldContext(fieldPath, plugins);
      let builtField = fieldDef.builderFunction(context);

      // Check if the result needs to be built (composable plugins)
      if (builtField && typeof builtField.build === "function") {
        builtField = builtField.build();
      }

      // Check for recursive marker
      const hasRecursiveMarker = builtField._validators?.some?.(
        (v: any) => v.__isRecursive === true
      );

      if (hasRecursiveMarker) {
        // Find the recursive validator
        const recursiveValidator = builtField._validators.find(
          (v: any) => v.__isRecursive === true
        );
        if (recursiveValidator?.recursive) {
          const recursiveInfo = {
            targetFieldPath: recursiveValidator.recursive.targetFieldPath,
            maxDepth: recursiveValidator.recursive.maxDepth || 10,
          };

          // Separate array element recursive fields for later processing
          if (fieldPath.includes("[*]")) {
            arrayElementRecursiveFields.set(fieldPath, recursiveInfo);
          } else {
            recursiveFieldsMap.set(fieldPath, recursiveInfo);
          }
        }
      }

      // unified-validator automatically selects optimal strategy
      const unifiedValidator = createUnifiedValidator(
        {
          path: fieldDef.path,
          builderFunction: fieldDef.builderFunction || (() => ({})),
        },
        plugins,
        "fast_separated",
        accessor
      );
      validators.set(fieldPath, unifiedValidator);
    }
  }

  // Second pass: Enhance regular recursive validators with target field validators
  for (const [fieldPath, recursiveInfo] of recursiveFieldsMap) {
    const originalValidator = validators.get(fieldPath)!;

    let targetValidator: UnifiedValidator | null = null;

    // Handle special keywords
    if (recursiveInfo.targetFieldPath === "__Self") {
      // For __Self, we need to apply all validators from the root object
      targetValidator = null; // Signal to use all field validators
    } else if (recursiveInfo.targetFieldPath === "__Element") {
      // For __Element in array context, use all validators
      targetValidator = null; // Signal to use all field validators for array elements
    } else {
      // Regular field path
      const targetFieldDef = fieldDefinitions.find(
        (f) => f.path === recursiveInfo.targetFieldPath
      );
      if (targetFieldDef && targetFieldDef.builderFunction) {
        targetValidator = validators.get(recursiveInfo.targetFieldPath) || null;
      }
    }

    // Create recursive wrapper
    const recursiveValidator = createRecursiveValidator(
      originalValidator,
      targetValidator,
      fieldPath,
      recursiveInfo.targetFieldPath,
      recursiveInfo.maxDepth,
      fieldDefinitions
        .filter((fd) => fd.builderFunction)
        .map((fd) => ({
          path: fd.path,
          builderFunction: fd.builderFunction!,
        })),
      plugins,
      validators
    );
    validators.set(fieldPath, recursiveValidator);
  }

  // Third pass: Create array element recursive validators with access to ALL validators
  for (const [fieldPath, recursiveInfo] of arrayElementRecursiveFields) {
    const originalValidator = validators.get(fieldPath)!;

    // Check if we have all the related validators for this array pattern
    const parseResult = parseFieldPath(fieldPath);
    const arrayPattern = parseResult.baseArrayPath + "[*]";

    // Find all validators that match this array pattern
    const relatedValidators = Array.from(validators.keys()).filter(
      (path) => path.startsWith(arrayPattern) && path !== fieldPath
    );

    // Only create the recursive validator if we have related validators
    if (relatedValidators.length > 0) {
      const arrayElementRecursiveValidator =
        createArrayElementRecursiveValidator(
          originalValidator,
          fieldPath,
          recursiveInfo.targetFieldPath,
          recursiveInfo.maxDepth,
          fieldDefinitions
            .filter((fd) => fd.builderFunction)
            .map((fd) => ({
              path: fd.path,
              builderFunction: fd.builderFunction!,
            })),
          plugins,
          validators // Now this contains ALL validators
        );
      validators.set(fieldPath, arrayElementRecursiveValidator);
    } else {
    }
  }

  return validators;
}

/**
 * Create validator with execution logic (V8 optimization: Using Unified Validator)
 */
function createExecutorValidator<TObject extends object, TMap = {}>(
  slowValidators: Map<string, UnifiedValidator>,
  fastValidators: Map<string, UnifiedValidator>,
  originalFieldDefinitions: Array<FieldDefinition>,
  plugins: Record<string, any>,
  arrayBatches: Map<string, ArrayBatchInfo>,
  allValidators: Map<string, any>,
  optionalFields: Map<string, boolean>,
  requiredFields: Map<string, boolean>,
  fieldOptionsMap?: Map<
    string,
    import("../builder/types/field-options").FieldOptions
  >
): TransformAwareValidator<TObject, ApplyNestedTransforms<TObject, TMap>> {
  // V8 optimization: Ultra-fast path for simple validators
  const hasArrayBatches = arrayBatches.size > 0;
  const hasSlowFields = slowValidators.size > 0;
  const totalValidators = fastValidators.size + slowValidators.size;
  const isSimpleValidator =
    !hasArrayBatches && !hasSlowFields && fastValidators.size <= 10;

  // V8 optimization: Check for ultra-fast mode first
  const useUltraFastMode =
    process.env.LUQ_ULTRA_FAST === "true" ||
    (global as any).__LUQ_ULTRA_FAST__ === true;

  // In ultra-fast mode, allow more complex validators
  // V8 optimization: Increased limit from 10 to 50 for complex schemas
  const canUseUltraFast =
    useUltraFastMode && !hasArrayBatches && totalValidators <= 50;

  if (canUseUltraFast) {
    // Ultra-fast path using raw validator
    // Combine fast and slow validators for ultra-fast mode
    const allValidatorsMap = new Map([...fastValidators, ...slowValidators]);
    const rawValidator = createRawValidator<TObject>(allValidatorsMap);

    const pickValidatorInstance = createPickValidatorFactory<TObject>(
      originalFieldDefinitions.map((d) => ({
        path: d.path,
        builderFunction:
          d.builderFunction ||
          ((() => ({})) as (
            context: FieldBuilderContext<any, any, any>
          ) => any),
        fieldType: d.fieldType || "unknown",
      })),
      plugins
    );

    // Create wrapper functions that handle field options
    const validateWithDefaults = (
      value: Partial<TObject> | unknown,
      options?: any
    ): Result<TObject> => {
      if (value == null) {
        return Result.error([
          {
            path: "",
            message: "Value is required",
            code: "REQUIRED",
            paths: () => [""],
          },
        ]);
      }

      let obj = value as Record<string, unknown>;

      // Apply default values from field options for validation
      if (fieldOptionsMap && fieldOptionsMap.size > 0) {
        const objWithDefaults = { ...obj };
        for (const [fieldPath, fieldOpts] of fieldOptionsMap) {
          const currentValue = getNestedValue(objWithDefaults, fieldPath);
          const defaultApplied = applyDefault(currentValue, fieldOpts, {
            allValues: objWithDefaults,
          });
          if (defaultApplied !== currentValue) {
            setNestedValue(objWithDefaults, fieldPath, defaultApplied);
          }
        }
        obj = objWithDefaults;
      }

      return rawValidator.validate(obj as TObject, options);
    };

    const parseWithDefaults = (
      value: Partial<TObject> | unknown,
      options?: ParseOptions
    ): Result<ApplyNestedTransforms<TObject, TMap>> => {
      if (value == null) {
        return Result.error([
          {
            path: "",
            message: "Value is required",
            code: "REQUIRED",
            paths: () => [""],
          },
        ]);
      }

      const obj = value as Record<string, unknown>;
      let transformedData = { ...obj };

      // Apply default values from field options
      if (fieldOptionsMap && fieldOptionsMap.size > 0) {
        for (const [fieldPath, fieldOpts] of fieldOptionsMap) {
          const currentValue = getNestedValue(transformedData, fieldPath);
          const defaultApplied = applyDefault(currentValue, fieldOpts, {
            allValues: transformedData,
          });
          if (defaultApplied !== currentValue) {
            setNestedValue(transformedData, fieldPath, defaultApplied);
          }
        }
      }

      return rawValidator.parse(transformedData as TObject, options) as Result<
        ApplyNestedTransforms<TObject, TMap>
      >;
    };

    return {
      validate: validateWithDefaults,
      parse: parseWithDefaults,
      pick: <K extends NestedKeyOf<TObject>>(
        key: K
      ): FieldValidator<TObject, TypeOfPath<TObject, K>> => {
        return pickValidatorInstance.createPickedValidator(key);
      },
      // Expose raw methods for maximum performance
      validateRaw: rawValidator.validateRaw.bind(rawValidator),
      parseRaw: rawValidator.parseRaw.bind(rawValidator) as (
        value: TObject,
        options?: ParseOptions
      ) => {
        valid: boolean;
        data?: ApplyNestedTransforms<TObject, TMap>;
        error?: any;
      },
    };
  }

  if (isSimpleValidator) {
    // Create ultra-fast executor for simple cases
    return createUltraFastExecutorValidator<TObject, TMap>(
      fastValidators,
      originalFieldDefinitions.map((d) => ({
        path: d.path,
        builderFunction: d.builderFunction || (() => ({})),
      })),
      plugins,
      fieldOptionsMap // Pass field options
    );
  }

  // Regular path for complex validators
  const executor = createValidatorExecutor<TObject, TMap>(
    slowValidators,
    fastValidators,
    arrayBatches,
    allValidators,
    optionalFields,
    requiredFields,
    fieldOptionsMap
  );
  const fieldDefinitions: FieldDefinition[] = originalFieldDefinitions.map(
    (def) => ({
      path: def.path,
      builderFunction: (def.builderFunction || (() => ({}))) as (
        context: FieldBuilderContext<any, any, any>
      ) => any,
      fieldType: def.fieldType || "unknown",
    })
  );
  
  // Create the validator object first
  const validatorObject = {
    validate: (
      value: Partial<TObject> | unknown,
      options?: any
    ): Result<TObject> => {
      return executor.executeValidate(value, options);
    },

    parse: (
      value: Partial<TObject> | unknown,
      options?: ParseOptions
    ): Result<ApplyNestedTransforms<TObject, TMap>> => {
      return executor.executeParse(value, options);
    },

    pick: null as any, // Will be set after pickValidator is created
  };

  // Create the pick validator with the original validator
  const pickValidator = createPickValidatorFactory<TObject>(
    fieldDefinitions,
    plugins,
    undefined, // buildValidators
    validatorObject // Pass the original validator
  );

  // Set the pick method
  validatorObject.pick = <K extends NestedKeyOf<TObject>>(
    key: K
  ): FieldValidator<TObject, TypeOfPath<TObject, K>> => {
    return pickValidator.createPickedValidator(key);
  };

  return validatorObject;
}

/**
 * V8 optimization: Ultra-fast executor for simple validators
 * Eliminates all unnecessary checks and iterations
 */
function createUltraFastExecutorValidator<TObject extends object, TMap = {}>(
  fastValidators: Map<string, UnifiedValidator>,
  originalFieldDefinitions: Array<{
    path: string;
    builderFunction: Function;
    fieldType?: string;
  }>,
  plugins: Record<string, any>,
  fieldOptions?: Map<
    string,
    import("../builder/types/field-options").FieldOptions
  >
): TransformAwareValidator<TObject, ApplyNestedTransforms<TObject, TMap>> {
  // Pre-compile validator array for ultra-fast access
  const validatorEntries = Array.from(fastValidators);
  const validatorCount = validatorEntries.length;

  // Pre-compile field accessors for direct access
  const fieldAccessors: Array<{
    path: string;
    accessor: (obj: any) => any;
    validator: UnifiedValidator;
  }> = [];
  for (let i = 0; i < validatorCount; i++) {
    const [path, validator] = validatorEntries[i];
    fieldAccessors.push({
      path,
      // V8 optimization: Use pre-compiled accessor from validator if available
      accessor: validator.accessor || createNestedValueAccessor(path),
      validator,
    });
  }

  const fieldDefinitions: FieldDefinition[] = originalFieldDefinitions.map(
    (def) => ({
      path: def.path,
      builderFunction: (def.builderFunction || (() => ({}))) as (
        context: FieldBuilderContext<any, any, any>
      ) => any,
      fieldType: def.fieldType || "unknown",
    })
  );
  const pickValidator = createPickValidatorFactory<TObject>(
    fieldDefinitions,
    plugins
  );

  // V8 optimization: Pre-allocated arrays and results
  const errors: any[] = [];
  const OK_RESULT = Result.ok({} as TObject);

  // V8 optimization: Generate specialized validator based on field count
  if (validatorCount === 1) {
    // Special case: single field validator
    const { path, accessor, validator } = fieldAccessors[0];

    return {
      validate: (
        value: Partial<TObject> | unknown,
        options?: any
      ): Result<TObject> => {
        if (value == null) {
          return Result.error([
            {
              path: "",
              message: "Value is required",
              code: "REQUIRED",
              paths: () => [""],
            },
          ]);
        }

        let obj = value as Record<string, unknown>;

        // Apply default values from field options for validation
        if (fieldOptions && fieldOptions.size > 0) {
          const objWithDefaults = { ...obj };
          for (const [fieldPath, fieldOpts] of fieldOptions) {
            const currentValue = getNestedValue(objWithDefaults, fieldPath);
            const defaultApplied = applyDefault(currentValue, fieldOpts, {
              allValues: objWithDefaults,
            });
            if (defaultApplied !== currentValue) {
              setNestedValue(objWithDefaults, fieldPath, defaultApplied);
            }
          }
          obj = objWithDefaults;
        }

        const fieldValue = accessor(obj);

        const result = validator.validate(fieldValue, obj, options);
        if (!result.valid) {
          // Convert error format
          const errors = result.errors.map((e) => ({
            path: e.path,
            code: e.code,
            message: e.message,
            paths: () => [e.path],
          }));
          return Result.error(errors);
        }

        return Result.ok(value as TObject);
      },

      parse: (
        value: Partial<TObject> | unknown,
        options?: ParseOptions
      ): Result<ApplyNestedTransforms<TObject, TMap>> => {
        if (value == null) {
          return Result.error([
            {
              path: "",
              message: "Value is required",
              code: "REQUIRED",
              paths: () => [""],
            },
          ]);
        }

        let obj = value as Record<string, unknown>;
        let transformedData = { ...obj };

        // Apply default values from field options
        if (fieldOptions && fieldOptions.size > 0) {
          for (const [fieldPath, fieldOpts] of fieldOptions) {
            const currentValue = getNestedValue(transformedData, fieldPath);
            const defaultApplied = applyDefault(currentValue, fieldOpts, {
              allValues: transformedData,
            });
            if (defaultApplied !== currentValue) {
              setNestedValue(transformedData, fieldPath, defaultApplied);
            }
          }
        }

        const fieldValue = accessor(transformedData);

        const result = validator.parse(fieldValue, obj, options);
        if (!result.valid) {
          // Convert error format
          const errors = result.errors.map((e) => ({
            path: e.path,
            code: e.code,
            message: e.message,
            paths: () => [e.path],
          }));
          return Result.error(errors);
        }

        // V8 optimization: Direct property set for single field
        if (result.data !== undefined && result.data !== fieldValue) {
          setNestedValue(transformedData, path, result.data);
          return Result.ok(
            transformedData as ApplyNestedTransforms<TObject, TMap>
          );
        }

        return Result.ok(
          transformedData as ApplyNestedTransforms<TObject, TMap>
        );
      },

      pick: <K extends NestedKeyOf<TObject>>(
        key: K
      ): FieldValidator<TObject, TypeOfPath<TObject, K>> => {
        return pickValidator.createPickedValidator(key);
      },
    };
  }

  // General case: multiple fields
  return {
    validate: (
      value: Partial<TObject> | unknown,
      options?: any
    ): Result<TObject> => {
      if (value == null) {
        return Result.error([
          {
            path: "",
            message: "Value is required",
            code: "REQUIRED",
            paths: () => [""],
          },
        ]);
      }

      let obj = value as Record<string, unknown>;

      // Apply default values from field options for validation
      if (fieldOptions && fieldOptions.size > 0) {
        const objWithDefaults = { ...obj };
        for (const [fieldPath, fieldOpts] of fieldOptions) {
          const currentValue = getNestedValue(objWithDefaults, fieldPath);
          const defaultApplied = applyDefault(currentValue, fieldOpts, {
            allValues: objWithDefaults,
          });
          if (defaultApplied !== currentValue) {
            setNestedValue(objWithDefaults, fieldPath, defaultApplied);
          }
        }
        obj = objWithDefaults;
      }
      const abortEarly = options?.abortEarly !== false; // Default to true
      const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;

      // V8 optimization: Reset errors array instead of creating new one
      errors.length = 0;

      // V8 optimization: Direct field validation loop with pre-compiled accessors
      for (let i = 0; i < validatorCount; i++) {
        const { path, accessor, validator } = fieldAccessors[i];
        const fieldValue = accessor(obj);

        const result = validator.validate(fieldValue, obj, {
          abortEarlyOnEachField,
        });
        if (!result.valid) {
          const resultErrors = result.errors;
          for (let j = 0; j < resultErrors.length; j++) {
            const e = resultErrors[j];
            errors.push({
              path: e.path,
              code: e.code,
              message: e.message,
              paths: () => [e.path],
            });
          }
          if (abortEarly) {
            return Result.error(errors.slice()); // Clone to prevent mutation
          }
        }
      }

      if (errors.length > 0) {
        return Result.error(errors.slice()); // Clone to prevent mutation
      }

      return Result.ok(value as TObject);
    },

    parse: (
      value: Partial<TObject> | unknown,
      options?: ParseOptions
    ): Result<ApplyNestedTransforms<TObject, TMap>> => {
      if (value == null) {
        return Result.error([
          {
            path: "",
            message: "Value is required",
            code: "REQUIRED",
            paths: () => [""],
          },
        ]);
      }

      const obj = value as Record<string, unknown>;
      let transformedData = { ...obj };

      // Apply default values from field options
      if (fieldOptions && fieldOptions.size > 0) {
        for (const [fieldPath, fieldOpts] of fieldOptions) {
          const currentValue = getNestedValue(transformedData, fieldPath);
          const defaultApplied = applyDefault(currentValue, fieldOpts, {
            allValues: transformedData,
          });
          if (defaultApplied !== currentValue) {
            setNestedValue(transformedData, fieldPath, defaultApplied);
          }
        }
      }
      const abortEarly = options?.abortEarly !== false; // Default to true
      const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;

      // V8 optimization: Reset errors array
      errors.length = 0;

      // V8 optimization: Direct field parse loop
      for (let i = 0; i < validatorCount; i++) {
        const { path, accessor, validator } = fieldAccessors[i];
        const fieldValue = accessor(transformedData);

        const result = validator.parse(fieldValue, transformedData, {
          abortEarlyOnEachField,
        });
        if (!result.valid) {
          const resultErrors = result.errors;
          for (let j = 0; j < resultErrors.length; j++) {
            const e = resultErrors[j];
            errors.push({
              path: e.path,
              code: e.code,
              message: e.message,
              paths: () => [e.path],
            });
          }
          if (abortEarly) {
            return Result.error(errors.slice());
          }
        } else if (result.data !== undefined) {
          setNestedValue(transformedData, path, result.data);
        }
      }

      if (errors.length > 0) {
        return Result.error(errors.slice());
      }

      return Result.ok(transformedData as ApplyNestedTransforms<TObject, TMap>);
    },

    pick: <K extends NestedKeyOf<TObject>>(
      key: K
    ): FieldValidator<TObject, TypeOfPath<TObject, K>> => {
      return pickValidator.createPickedValidator(key);
    },
  };
}

/**
 * ValidatorExecutor - V8 optimized using Unified Validator
 */
function createValidatorExecutor<TObject extends object, TMap = {}>(
  slowValidators: Map<string, UnifiedValidator>,
  fastValidators: Map<string, UnifiedValidator>,
  arrayBatches: Map<string, ArrayBatchInfo>,
  allValidators: Map<string, any>,
  optionalFields: Map<string, boolean>,
  requiredFields: Map<string, boolean>,
  fieldOptions?: Map<
    string,
    import("../builder/types/field-options").FieldOptions
  >
) {
  // V8 optimization: Pre-compile all field accessors to avoid repeated createNestedValueAccessor calls
  const fieldAccessorCache = new Map<string, (obj: any) => any>();
  const fieldExistenceCache = new Map<string, (obj: any) => boolean>();

  // Pre-compile accessors and existence checkers for all validators
  for (const [fieldPath, validator] of fastValidators) {
    if (!fieldAccessorCache.has(fieldPath)) {
      fieldAccessorCache.set(
        fieldPath,
        validator.accessor || createNestedValueAccessor(fieldPath)
      );
      fieldExistenceCache.set(
        fieldPath,
        createFieldExistenceChecker(fieldPath)
      );
    }
  }
  for (const [fieldPath, validator] of slowValidators) {
    if (!fieldAccessorCache.has(fieldPath)) {
      fieldAccessorCache.set(
        fieldPath,
        validator.accessor || createNestedValueAccessor(fieldPath)
      );
      fieldExistenceCache.set(
        fieldPath,
        createFieldExistenceChecker(fieldPath)
      );
    }
  }
  /**
   * Execute validate - Skip Transform after last validator
   */
  function executeValidate(
    value: Partial<TObject> | unknown,
    options?: ValidationOptions
  ): Result<TObject> {
    if (value == null) {
      return Result.error([
        {
          path: "",
          message: "Value is required",
          code: "REQUIRED",
          paths: () => [""],
        },
      ]);
    }

    const errors: any[] = [];
    let obj = value as Record<string, unknown>;

    // Apply default values from field options for validation
    if (fieldOptions && fieldOptions.size > 0) {
      // Create a copy to apply defaults for validation
      const objWithDefaults = { ...obj };
      for (const [fieldPath, fieldOpts] of fieldOptions) {
        const currentValue = getNestedValue(objWithDefaults, fieldPath);
        const defaultApplied = applyDefault(currentValue, fieldOpts, {
          allValues: objWithDefaults,
        });
        if (defaultApplied !== currentValue) {
          setNestedValue(objWithDefaults, fieldPath, defaultApplied);
        }
      }
      obj = objWithDefaults;
    }

    // V8 optimization: Default is false for backward compatibility
    const abortEarly = options?.abortEarly !== false; // Default to true
    // Default to true for abortEarlyOnEachField
    const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;

    // STEP 1: Process array batches first (eliminates duplicate array access)
    for (const [arrayPath, batchInfo] of arrayBatches) {
      // V8 optimization: Use cached accessor for array path
      const arrayAccessor =
        fieldAccessorCache.get(arrayPath) ||
        createNestedValueAccessor(arrayPath);
      if (!fieldAccessorCache.has(arrayPath)) {
        fieldAccessorCache.set(arrayPath, arrayAccessor);
      }
      const arrayData = arrayAccessor(obj);

      // First, validate the array field itself (e.g., required, type checks)
      const arrayFieldValidator = allValidators.get(arrayPath);
      if (arrayFieldValidator) {
        let arrayFieldResult: any;
        if (arrayFieldValidator.validate) {
          arrayFieldResult = arrayFieldValidator.validate(arrayData, obj, {
            abortEarlyOnEachField,
          });
        } else if (arrayFieldValidator.validateSlow) {
          arrayFieldResult = arrayFieldValidator.validateSlow(arrayData, obj, {
            abortEarlyOnEachField,
          });
        } else if (arrayFieldValidator.validateFast) {
          arrayFieldResult = arrayFieldValidator.validateFast(arrayData, obj);
        }

        if (arrayFieldResult && !arrayFieldResult.valid) {
          if (arrayFieldResult.errors && arrayFieldResult.errors.length > 0) {
            errors.push(...arrayFieldResult.errors);
          } else {
            errors.push({
              path: arrayPath,
              code: "VALIDATION_ERROR",
              message: "Array field validation failed",
              paths: () => [arrayPath],
            });
          }
          if (abortEarly) {
            return Result.error(errors);
          }
          // If array field validation fails, skip element validation
          continue;
        }
      }

      // Then, validate array elements if it's an array
      if (Array.isArray(arrayData)) {
        const batchValidator = createArrayBatchValidator(
          batchInfo,
          allValidators
        );
        const batchResult = batchValidator(
          arrayData,
          obj,
          abortEarly,
          abortEarlyOnEachField,
          VALIDATE_MODE
        );

        if (batchResult.errors.length > 0) {
          errors.push(...batchResult.errors);
          if (abortEarly) {
            return Result.error(errors);
          }
        }
      }
    }

    // V8 optimization: Fast path optimization - use direct iterator without Array.from
    // STEP 2: Validate regular fast fields (array batch fields already processed)
    for (const [fieldPath, validator] of fastValidators) {
      // Skip array element field if parent array is empty
      if (fieldPath.includes(".") && !fieldPath.includes("[") && !fieldPath.includes("*")) {
        const parts = fieldPath.split(".");
        if (parts.length > 1) {
          // Check if any parent in the path is an empty array
          let skipDueToEmptyArray = false;
          for (let i = 0; i < parts.length - 1; i++) {
            const parentPath = parts.slice(0, i + 1).join(".");
            const parentValue = getNestedValue(obj, parentPath);
            if (Array.isArray(parentValue) && parentValue.length === 0) {
              skipDueToEmptyArray = true;
              break;
            }
          }
          if (skipDueToEmptyArray) {
            continue; // Skip this field validation
          }
        }
      }
      
      // V8 optimization: Skip array element path check for simple paths (most common)
      if (!fieldPath.includes("[") && !fieldPath.includes("*")) {
        // Fast path for simple field names
        // V8 optimization: Use pre-compiled accessor from cache
        const accessor = fieldAccessorCache.get(fieldPath);
        const fieldValue = accessor
          ? accessor(obj)
          : getNestedValue(obj, fieldPath);

        // V8 optimization: Direct validation without existence checks for fast path
        const result = validator.validate(fieldValue, obj, {
          abortEarlyOnEachField,
        });
        if (!result.valid) {
          // V8 optimization: Direct array push without spread - reuse error objects
          if (result.errors && result.errors.length > 0) {
            for (let j = 0; j < result.errors.length; j++) {
              errors.push(result.errors[j]);
            }
          }
          if (abortEarly) {
            return Result.error(errors);
          }
        }
      } else {
        // Slow path: array element patterns
        const isArrayElementPath =
          fieldPath.includes("[*]") || fieldPath.includes(".*");

        if (isArrayElementPath) {
          const arrayElementErrors = validateArrayElementPath(
            fieldPath,
            validator,
            obj,
            obj,
            abortEarly,
            abortEarlyOnEachField
          );
          if (arrayElementErrors.length > 0) {
            errors.push(...arrayElementErrors);
            if (abortEarly) {
              return Result.error(errors);
            }
          }
          continue;
        }

        // Regular field with brackets (rare case)
        const accessor = fieldAccessorCache.get(fieldPath);
        const fieldValue = accessor
          ? accessor(obj)
          : getNestedValue(obj, fieldPath);
        const result = validator.validate(fieldValue, obj, {
          abortEarlyOnEachField,
        });
        if (!result.valid) {
          if (result.errors && result.errors.length > 0) {
            for (let j = 0; j < result.errors.length; j++) {
              errors.push(result.errors[j]);
            }
          }
          if (abortEarly) {
            return Result.error(errors);
          }
        }
      }
    }

    // STEP 3: Validate regular slow fields (array batch fields already processed)
    for (const [fieldPath, validator] of slowValidators) {
      // Skip array element field if parent array is empty
      if (fieldPath.includes(".") && !fieldPath.includes("[") && !fieldPath.includes("*")) {
        const parts = fieldPath.split(".");
        if (parts.length > 1) {
          // Check if any parent in the path is an empty array
          let skipDueToEmptyArray = false;
          for (let i = 0; i < parts.length - 1; i++) {
            const parentPath = parts.slice(0, i + 1).join(".");
            const parentValue = getNestedValue(obj, parentPath);
            if (Array.isArray(parentValue) && parentValue.length === 0) {
              skipDueToEmptyArray = true;
              break;
            }
          }
          if (skipDueToEmptyArray) {
            continue; // Skip this field validation
          }
        }
      }
      
      // Check if this is an array element path pattern
      const isArrayElementPath =
        fieldPath.includes("[*]") || fieldPath.includes(".*");

      if (isArrayElementPath) {
        // Handle array element path validation
        const arrayElementErrors = validateArrayElementPath(
          fieldPath,
          validator,
          obj,
          obj,
          abortEarly,
          abortEarlyOnEachField
        );
        if (arrayElementErrors.length > 0) {
          errors.push(...arrayElementErrors);
          if (abortEarly) {
            return Result.error(errors);
          }
        }
        continue;
      }

      // Check if field is present in input object
      // V8 optimization: Use pre-compiled existence checker
      const existenceChecker = fieldExistenceCache.get(fieldPath);
      const fieldExists = existenceChecker
        ? existenceChecker(obj)
        : hasNestedField(obj, fieldPath);
      const isOptional = optionalFields.get(fieldPath) || false;
      const hasRequiredPlugin = requiredFields.get(fieldPath) || false;

      // If field is missing and optional, skip validation entirely
      if (!fieldExists && isOptional) {
        continue;
      }

      // If field is missing, not optional, and has no explicit required plugin, add default required error
      if (!fieldExists && !isOptional && !hasRequiredPlugin) {
        errors.push({
          path: fieldPath,
          code: "REQUIRED",
          message: `Field '${fieldPath}' is required`,
          paths: () => [fieldPath],
        });
        if (abortEarly) {
          return Result.error(errors);
        }
        continue;
      }

      // For fields with explicit required plugin, let the plugin handle missing fields with custom messages
      // For present fields, continue with normal validation

      // V8 optimization: Use pre-compiled accessor from cache
      const accessor = fieldAccessorCache.get(fieldPath);
      const fieldValue = accessor
        ? accessor(obj)
        : getNestedValue(obj, fieldPath);

      // V8 optimization: Unified validator interface
      const result = validator.validate(fieldValue, obj, {
        abortEarlyOnEachField,
      });
      if (!result.valid) {
        if (result.errors && result.errors.length > 0) {
          for (let j = 0; j < result.errors.length; j++) {
            errors.push(result.errors[j]);
          }
        }
        if (abortEarly) {
          return Result.error(errors);
        }
      }
    }

    if (errors.length > 0) {
      return Result.error(errors);
    }

    return Result.ok(value as TObject);
  }

  /**
   * Execute parse - Execute all steps
   */
  function executeParse(
    value: Partial<TObject> | unknown,
    options?: ParseOptions
  ): Result<ApplyNestedTransforms<TObject, TMap>> {
    if (value == null) {
      return Result.error([
        {
          path: "",
          message: "Value is required",
          code: "REQUIRED",
          paths: () => [""],
        },
      ]);
    }

    const errors: any[] = [];
    const obj = value as Record<string, unknown>;
    let transformedData = { ...obj };

    // Apply default values from field options
    if (fieldOptions && fieldOptions.size > 0) {
      for (const [fieldPath, fieldOpts] of fieldOptions) {
        const currentValue = getNestedValue(transformedData, fieldPath);
        const defaultApplied = applyDefault(currentValue, fieldOpts, {
          allValues: transformedData,
        });
        if (defaultApplied !== currentValue) {
          setNestedValue(transformedData, fieldPath, defaultApplied);
        }
      }
    }

    // V8 optimization: Default is false for backward compatibility
    const abortEarly = options?.abortEarly !== false; // Default to true
    // Default to true for abortEarlyOnEachField
    const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;

    // STEP 1: Process array batches first (eliminates duplicate array access)
    for (const [arrayPath, batchInfo] of arrayBatches) {
      // V8 optimization: Use cached accessor for array path
      const arrayAccessor =
        fieldAccessorCache.get(arrayPath) ||
        createNestedValueAccessor(arrayPath);
      if (!fieldAccessorCache.has(arrayPath)) {
        fieldAccessorCache.set(arrayPath, arrayAccessor);
      }
      const arrayData = arrayAccessor(transformedData);

      // First, validate the array field itself (e.g., required, type checks)
      const arrayFieldValidator = allValidators.get(arrayPath);
      if (arrayFieldValidator) {
        let arrayFieldResult: any;
        if (arrayFieldValidator.parse) {
          arrayFieldResult = arrayFieldValidator.parse(arrayData, transformedData, {
            abortEarlyOnEachField,
          });
        } else if (arrayFieldValidator.parseSlow) {
          arrayFieldResult = arrayFieldValidator.parseSlow(arrayData, transformedData, {
            abortEarlyOnEachField,
          });
        } else if (arrayFieldValidator.parseFast) {
          arrayFieldResult = arrayFieldValidator.parseFast(arrayData, transformedData);
        }

        if (arrayFieldResult && !arrayFieldResult.valid) {
          if (arrayFieldResult.errors && arrayFieldResult.errors.length > 0) {
            errors.push(...arrayFieldResult.errors);
          } else {
            errors.push({
              path: arrayPath,
              code: "PARSE_ERROR",
              message: "Array field parsing failed",
              paths: () => [arrayPath],
            });
          }
          if (abortEarly) {
            return Result.error(errors);
          }
          // If array field validation fails, skip element processing
          continue;
        } else if (arrayFieldResult && arrayFieldResult.data !== undefined) {
          // Apply any transforms to the array field itself
          setNestedValue(transformedData, arrayPath, arrayFieldResult.data);
          // Update arrayData for element processing
          const updatedArrayData = arrayAccessor(transformedData);
          if (Array.isArray(updatedArrayData)) {
            // Process array elements with updated data
            const batchProcessor = createArrayBatchValidator(
              batchInfo,
              allValidators
            );
            const parseResult = batchProcessor(
              updatedArrayData,
              transformedData,
              abortEarly,
              abortEarlyOnEachField,
              PARSE_MODE
            );

            if (parseResult.errors.length > 0) {
              errors.push(...parseResult.errors);
              if (abortEarly) {
                return Result.error(errors);
              }
            }

            // Apply transformed array data
            if (parseResult.transformedData) {
              setNestedValue(
                transformedData,
                arrayPath,
                parseResult.transformedData
              );
            }
          }
          continue;
        }
      }

      // Then, validate array elements if it's an array
      if (Array.isArray(arrayData)) {
        const batchProcessor = createArrayBatchValidator(
          batchInfo,
          allValidators
        );
        const parseResult = batchProcessor(
          arrayData,
          transformedData,
          abortEarly,
          abortEarlyOnEachField,
          PARSE_MODE
        );

        if (parseResult.errors.length > 0) {
          errors.push(...parseResult.errors);
          if (abortEarly) {
            return Result.error(errors);
          }
        }

        // Apply transformed array data
        if (parseResult.transformedData) {
          setNestedValue(
            transformedData,
            arrayPath,
            parseResult.transformedData
          );
        }
      }
    }

    // STEP 2: Execute regular fast fields (array batch fields already processed)
    for (const [fieldPath, validator] of fastValidators) {
      // V8 optimization: Use pre-compiled accessor from cache
      const accessor = fieldAccessorCache.get(fieldPath);
      const fieldValue = accessor
        ? accessor(transformedData)
        : getNestedValue(transformedData, fieldPath);

      // V8 optimization: Unified validator parse
      const result = validator.parse(fieldValue, transformedData, {
        abortEarlyOnEachField,
      });

      if (!result.valid) {
        if (result.errors && result.errors.length > 0) {
          for (let j = 0; j < result.errors.length; j++) {
            errors.push(result.errors[j]);
          }
        }
        // If abortEarly: true (default), return immediately
        if (abortEarly) {
          return Result.error(errors);
        }
      } else if (result.data !== undefined) {
        setNestedValue(transformedData, fieldPath, result.data);
      }
    }

    // STEP 3: Execute regular slow fields (array batch fields already processed)
    for (const [fieldPath, validator] of slowValidators) {
      // Check if field is present in input object
      // V8 optimization: Use pre-compiled existence checker
      const existenceChecker = fieldExistenceCache.get(fieldPath);
      const fieldExists = existenceChecker
        ? existenceChecker(transformedData)
        : hasNestedField(transformedData, fieldPath);
      const isOptional = optionalFields.get(fieldPath) || false;
      const hasRequiredPlugin = requiredFields.get(fieldPath) || false;

      // If field is missing and optional, skip validation entirely
      if (!fieldExists && isOptional) {
        continue;
      }

      // If field is missing, not optional, and has no explicit required plugin, add default required error
      if (!fieldExists && !isOptional && !hasRequiredPlugin) {
        errors.push({
          path: fieldPath,
          code: "REQUIRED",
          message: `Field '${fieldPath}' is required`,
          paths: () => [fieldPath],
        });
        if (abortEarly) {
          return Result.error(errors);
        }
        continue;
      }

      // For fields with explicit required plugin, let the plugin handle missing fields with custom messages
      // For present fields, continue with normal validation

      // V8 optimization: Use pre-compiled accessor from cache
      const accessor = fieldAccessorCache.get(fieldPath);
      const fieldValue = accessor
        ? accessor(transformedData)
        : getNestedValue(transformedData, fieldPath);

      // V8 optimization: Unified validator parse
      const result = validator.parse(fieldValue, transformedData, {
        abortEarlyOnEachField,
      });

      if (!result.valid) {
        if (result.errors && result.errors.length > 0) {
          for (let j = 0; j < result.errors.length; j++) {
            errors.push(result.errors[j]);
          }
        }
        // If abortEarly: true (default), return immediately
        if (abortEarly) {
          return Result.error(errors);
        }
      } else if (result.data !== undefined) {
        setNestedValue(transformedData, fieldPath, result.data);
      }
    }

    if (errors.length > 0) {
      return Result.error(errors);
    }

    return Result.ok(transformedData as ApplyNestedTransforms<TObject, TMap>);
  }

  return {
    executeValidate,
    executeParse,
  };
}

/**
 * Validate array element field
 */
function validateArrayElementField(
  arrayFieldInfo: { values: any[]; arrayPath: string },
  fieldPath: string,
  validator: any,
  rootData: any,
  abortEarly: boolean
): Array<{
  path: string;
  code: string;
  message: string;
  paths: () => string[];
}> {
  const errors: Array<{
    path: string;
    code: string;
    message: string;
    paths: () => string[];
  }> = [];
  const { values, arrayPath } = arrayFieldInfo;

  // Skip element validation if array is empty
  if (!values || values.length === 0) {
    return errors;
  }

  // Validate each element's value
  for (let i = 0; i < values.length; i++) {
    const elementValue = values[i];
    const elementPath = `${arrayPath}[${i}].${fieldPath.replace(arrayPath + ".", "")}`;

    let elementResult: any;

    // V8 optimization: Unified validator
    if (validator.validate) {
      elementResult = validator.validate(elementValue, rootData);
    } else {
      // Fallback - shouldn't happen
      continue;
    }

    if (!elementResult.valid) {
      // Map errors to correct element path
      if (elementResult.errors && elementResult.errors.length > 0) {
        for (const error of elementResult.errors) {
          errors.push({
            path: elementPath,
            code: error.code || "VALIDATION_ERROR",
            message: error.message || "Validation failed",
            paths: () => [elementPath],
          });
        }
      } else {
        errors.push({
          path: elementPath,
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          paths: () => [elementPath],
        });
      }

      if (abortEarly) {
        break;
      }
    }
  }

  return errors;
}

/**
 * Parse array element field (validate + transform)
 */
function parseArrayElementField(
  arrayFieldInfo: { values: any[]; arrayPath: string },
  fieldPath: string,
  validator: any,
  transformedData: any,
  abortEarly: boolean
): Array<{
  path: string;
  code: string;
  message: string;
  paths: () => string[];
}> {
  const errors: Array<{
    path: string;
    code: string;
    message: string;
    paths: () => string[];
  }> = [];
  const { values, arrayPath } = arrayFieldInfo;

  // Skip element validation if array is empty
  if (!values || values.length === 0) {
    return errors;
  }

  // Get the array from transformed data to update it
  const arrayAccessor = createNestedValueAccessor(arrayPath);
  const transformedArray = arrayAccessor(transformedData);

  if (!Array.isArray(transformedArray)) {
    return errors; // Skip if not an array
  }

  // Parse each element's value
  for (let i = 0; i < values.length && i < transformedArray.length; i++) {
    const elementValue = values[i];
    const elementPath = `${arrayPath}[${i}].${fieldPath.replace(arrayPath + ".", "")}`;

    let elementResult: any;

    // V8 optimization: Unified validator
    if (validator.parse) {
      elementResult = validator.parse(elementValue, transformedData);
    } else {
      // Fallback - shouldn't happen
      continue;
    }

    if (!elementResult.valid) {
      // Map errors to correct element path
      if (elementResult.errors && elementResult.errors.length > 0) {
        for (const error of elementResult.errors) {
          errors.push({
            path: elementPath,
            code: error.code || "VALIDATION_ERROR",
            message: error.message || "Validation failed",
            paths: () => [elementPath],
          });
        }
      } else {
        errors.push({
          path: elementPath,
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          paths: () => [elementPath],
        });
      }

      if (abortEarly) {
        break;
      }
    } else if (elementResult.data !== undefined) {
      // Apply transformation to the element
      const elementPropertyPath = fieldPath.replace(arrayPath + ".", "");
      setNestedValueInArrayElement(
        transformedArray,
        i,
        elementPropertyPath,
        elementResult.data
      );
    }
  }

  return errors;
}

// NOTE: Array element setter creation moved to validator factory local cache to avoid memory leaks
function createArrayElementSetter(
  propertyPath: string
): (array: any[], index: number, value: any) => void {
  // Create setter without global caching - should be managed by validator factory
  if (!propertyPath.includes(".")) {
    return (array: any[], index: number, value: any) => {
      if (!array[index]) {
        array[index] = {};
      }
      array[index][propertyPath] = value;
    };
  } else {
    const segments = propertyPath.split(".");
    const lastIndex = segments.length - 1;
    return (array: any[], index: number, value: any) => {
      if (!array[index]) {
        array[index] = {};
      }
      let current = array[index];
      for (let i = 0; i < lastIndex; i++) {
        const segment = segments[i];
        if (!current[segment]) current[segment] = {};
        current = current[segment];
      }
      current[segments[lastIndex]] = value;
    };
  }
}

/**
 * Set nested value in array element
 */
function setNestedValueInArrayElement(
  array: any[],
  index: number,
  propertyPath: string,
  value: any
): void {
  const setter = createArrayElementSetter(propertyPath);
  setter(array, index, value);
}

/**
 * Get nested value from object using dot notation
 * NOTE: This should only be used for paths where we don't have pre-compiled accessors
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  // NOTE: This should only be used as fallback when pre-compiled accessors aren't available
  // For optimal performance, use pre-compiled accessors from the validator factory cache
  const accessor = createNestedValueAccessor(path);
  return accessor(obj);
}

// NOTE: Existence checker creation moved to validator factory local cache to avoid memory leaks
function createExistenceChecker(path: string): (obj: any) => boolean {
  // Create existence checker without global caching - should be managed by validator factory
  if (!path.includes(DOT)) {
    return (obj: any) => path in obj;
  } else {
    const parts = path.split(DOT);
    const lastIndex = parts.length - 1;
    return (obj: any) => {
      let current = obj;
      for (let i = 0; i < lastIndex; i++) {
        const part = parts[i];
        if (
          !(part in current) ||
          current[part] == null ||
          typeof current[part] !== "object"
        ) {
          return false;
        }
        current = current[part];
      }
      const finalPart = parts[lastIndex];
      return finalPart in current;
    };
  }
}

/**
 * Check if a field path exists in the object (not just returns undefined)
 */
function hasNestedField(obj: Record<string, unknown>, path: string): boolean {
  const checker = createExistenceChecker(path);
  return checker(obj);
}

/**
 * Check if a validator set contains the optional plugin
 */
function hasOptionalValidator(
  allValidators: Map<string, any>,
  fieldPath: string
): boolean {
  const validator = allValidators.get(fieldPath);
  if (!validator) {
    // console.log(`DEBUG: No validator found for ${fieldPath}`);
    return false;
  }

  // console.log(`DEBUG: Checking ${fieldPath}, validator:`, Object.keys(validator));

  // Check if any validator in the set has name 'optional'
  const checkValidatorSet = (validatorSet: any) => {
    if (validatorSet?._validators) {
      // console.log(`DEBUG: Found _validators:`, validatorSet._validators.map((v: any) => v.name));
      return validatorSet._validators.some((v: any) => v.name === "optional");
    }
    if (validatorSet?.validators) {
      // console.log(`DEBUG: Found validators:`, validatorSet.validators.map((v: any) => v.name));
      return validatorSet.validators.some((v: any) => v.name === "optional");
    }
    if (validatorSet?.validate) {
      // Check if this is a unified validator with internal structure
      // console.log(`DEBUG: Found unified validator for ${fieldPath}`);
      return false; // For now, assume unified validators don't expose this info easily
    }
    // console.log(`DEBUG: Unknown validator structure for ${fieldPath}:`, Object.keys(validatorSet));
    return false;
  };

  return checkValidatorSet(validator);
}

// NOTE: Setter creation moved to validator factory local cache to avoid memory leaks
function createGlobalSetter(path: string): (obj: any, value: any) => void {
  // Create setter without global caching - should be managed by validator factory
  if (!path.includes(DOT)) {
    return (obj: any, value: any) => {
      obj[path] = value;
    };
  } else {
    const parts = path.split(DOT);
    const lastIndex = parts.length - 1;
    return (obj: any, value: any) => {
      let current = obj;
      for (let i = 0; i < lastIndex; i++) {
        const part = parts[i];
        if (!(part in current) || typeof current[part] !== "object") {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[lastIndex]] = value;
    };
  }
}

/**
 * Set nested value in object using dot notation
 */
function setNestedValue(
  obj: Record<string, any>,
  path: string,
  value: any
): void {
  const setter = createGlobalSetter(path);
  setter(obj, value);
}

/**
 * Validate array element path (e.g., items[*].name)
 */
function validateArrayElementPath(
  fieldPath: string,
  validator: any,
  obj: Record<string, unknown>,
  rootData: any,
  abortEarly: boolean,
  abortEarlyOnEachField: boolean
): Array<{
  path: string;
  code: string;
  message: string;
  paths: () => string[];
}> {
  const errors: Array<{
    path: string;
    code: string;
    message: string;
    paths: () => string[];
  }> = [];

  // Parse the array element path
  let arrayPath: string;
  let elementField: string;

  const bracketMatch = fieldPath.match(/^([^\[]+)\[\*\]\.(.+)$/);
  if (bracketMatch) {
    arrayPath = bracketMatch[1];
    elementField = bracketMatch[2];
  } else {
    const dotMatch = fieldPath.match(/^([^\.]+)\.\*\.(.+)$/);
    if (dotMatch) {
      arrayPath = dotMatch[1];
      elementField = dotMatch[2];
    } else {
      // Check if this is a direct array element path like "categories[*]"
      const directBracketMatch = fieldPath.match(/^([^\[]+)\[\*\]$/);
      if (directBracketMatch) {
        arrayPath = directBracketMatch[1];
        elementField = ""; // No specific field, validate the whole element
      } else {
        return errors;
      }
    }
  }

  // Get the array
  const arrayData = getNestedValue(obj, arrayPath);
  if (!Array.isArray(arrayData)) {
    // Not an array, skip validation
    return errors;
  }

  // Special handling for direct array element validation (e.g., "matrix[*]")
  if (elementField === "") {
    // Validate each element individually
    for (let i = 0; i < arrayData.length; i++) {
      const element = arrayData[i];
      const elementPath = `${arrayPath}[${i}]`;
      
      const result = validator.validate(element, rootData, {
        abortEarlyOnEachField,
      });
      
      if (!result.valid) {
        if (result.errors && result.errors.length > 0) {
          for (const error of result.errors) {
            errors.push({
              path: error.path ? `${elementPath}.${error.path}` : elementPath,
              code: error.code || "VALIDATION_ERROR",
              message: error.message || "Validation failed",
              paths: () => [error.path ? `${elementPath}.${error.path}` : elementPath],
            });
          }
        } else {
          errors.push({
            path: elementPath,
            code: "VALIDATION_ERROR",
            message: "Validation failed",
            paths: () => [elementPath],
          });
        }
        
        if (abortEarly) {
          break;
        }
      }
    }
    return errors;
  }

  // Skip element validation if array is empty
  if (arrayData.length === 0) {
    return errors;
  }

  // Regular field validation for each element
  for (let i = 0; i < arrayData.length; i++) {
    const element = arrayData[i];

    // Specific field validation (e.g., "categories[*].name")
    if (!element || typeof element !== "object") {
      continue;
    }

    const elementValue = getNestedValue(element, elementField);
    const elementPath = `${arrayPath}[${i}].${elementField}`;

    const result = validator.validate(elementValue, rootData, {
      abortEarlyOnEachField,
    });

    if (!result.valid) {
      if (result.errors && result.errors.length > 0) {
        for (const error of result.errors) {
          errors.push({
            path: error.path || elementPath,
            code: error.code || "VALIDATION_ERROR",
            message: error.message || "Validation failed",
            paths: () => [error.path || elementPath],
          });
        }
      } else {
        errors.push({
          path: elementPath,
          code: "VALIDATION_ERROR",
          message: "Validation failed",
          paths: () => [elementPath],
        });
      }

      if (abortEarly) {
        break;
      }
    }
  }

  return errors;
}

/**
 * Create recursive validator wrapper
 */
function createRecursiveValidator(
  originalValidator: UnifiedValidator,
  targetValidator: UnifiedValidator | null,
  fieldPath: string,
  targetFieldPath: string,
  maxDepth: number,
  fieldDefinitions: Array<{ path: string; builderFunction: Function }>,
  plugins: Record<string, any>,
  allFieldValidators?: Map<string, UnifiedValidator>
): UnifiedValidator {
  const validateRecursive = (
    value: any,
    rootData: any,
    currentDepth: number,
    currentPath: string,
    visitedSet: WeakSet<object>,
    options?: { abortEarlyOnEachField?: boolean }
  ): { valid: boolean; errors: any[] } => {
    // Check max depth
    if (currentDepth > maxDepth) {
      return { valid: true, errors: [] };
    }

    // Check for circular reference
    if (value && typeof value === "object" && visitedSet.has(value)) {
      return { valid: true, errors: [] };
    }

    if (value && typeof value === "object") {
      visitedSet.add(value);
    }

    // Handle null/undefined values properly for nullable/optional fields
    if (value === null || value === undefined) {
      // For null/undefined values, only validate with the original validator
      // The original validator should handle nullable/optional logic properly
      const originalResult = originalValidator.validate(
        value,
        rootData,
        options
      );
      if (!originalResult.valid) {
        // Map errors to correct path
        const mappedErrors = originalResult.errors.map((e) => ({
          ...e,
          path: currentPath,
        }));
        return { valid: false, errors: mappedErrors };
      }
      // If null/undefined is valid, don't proceed with recursive validation
      return { valid: true, errors: [] };
    }

    // First validate the current field with original validators
    const originalResult = originalValidator.validate(value, rootData, options);
    if (!originalResult.valid) {
      // Map errors to correct path
      const mappedErrors = originalResult.errors.map((e) => ({
        ...e,
        path: currentPath,
      }));
      return { valid: false, errors: mappedErrors };
    }

    // Handle special keywords
    if (targetFieldPath === "__Self") {
      // Apply all field validators from the root type
      if (value && typeof value === "object" && allFieldValidators) {
        const errors: any[] = [];
        // For recursive validation, don't abort early between fields - validate all fields in the nested object

        // Apply all validators to the nested object, except the current recursive field to prevent infinite recursion
        for (const [validatorFieldPath, validator] of allFieldValidators) {
          // Skip the current recursive field to prevent infinite recursion
          if (validatorFieldPath === fieldPath) continue;

          // Handle array element validators with [*] notation
          if (validatorFieldPath.includes("[*]")) {
            const arrayElementAccessor =
              createArrayElementAccessor(validatorFieldPath);
            const arrayResult = arrayElementAccessor(value);

            if (arrayResult) {
              const { elements, basePath, elementPath } = arrayResult;

              // Validate each array element
              elements.forEach((element, index) => {
                const elementResult = validator.validate(
                  element,
                  rootData,
                  options
                );

                if (!elementResult.valid) {
                  // Map errors to correct array element path
                  for (const error of elementResult.errors) {
                    const elementErrorPath = elementPath
                      ? `${currentPath}.${basePath}[${index}].${elementPath}`
                      : `${currentPath}.${basePath}[${index}]`;
                    errors.push({
                      ...error,
                      path: elementErrorPath,
                    });
                  }
                }
              });
            }
            continue;
          }

          // Get field value from nested object
          const fieldAccessor = createNestedValueAccessor(validatorFieldPath);
          const fieldValue = fieldAccessor(value);

          // Validate field
          const fieldResult = validator.validate(fieldValue, rootData, options);
          if (!fieldResult.valid) {
            // Map errors to nested path
            for (const error of fieldResult.errors) {
              errors.push({
                ...error,
                path: `${currentPath}.${error.path}`,
              });
            }
          }
        }

        // Recursively check nested self-referential fields
        for (const [validatorFieldPath, validator] of allFieldValidators) {
          // Skip the current recursive field to prevent infinite recursion
          if (validatorFieldPath === fieldPath) continue;

          // Handle array element recursive validation
          if (validatorFieldPath.includes("[*]")) {
            const arrayElementAccessor =
              createArrayElementAccessor(validatorFieldPath);
            const arrayResult = arrayElementAccessor(value);

            if (arrayResult) {
              const { elements, basePath, elementPath } = arrayResult;

              // Check if each array element should be recursively validated
              elements.forEach((element, index) => {
                if (element && typeof element === "object") {
                  // Check if this field has recursive marker
                  const fieldDef = fieldDefinitions.find(
                    (fd) => fd.path === validatorFieldPath
                  );
                  if (fieldDef?.builderFunction) {
                    const fieldContext = createFieldContext(
                      validatorFieldPath,
                      plugins
                    );
                    let fieldBuilt = fieldDef.builderFunction(fieldContext);
                    if (fieldBuilt?.build) fieldBuilt = fieldBuilt.build();

                    const hasRecursive = fieldBuilt?._validators?.some?.(
                      (v: any) => v.__isRecursive === true
                    );
                    if (hasRecursive) {
                      const elementCurrentPath = elementPath
                        ? `${currentPath}.${basePath}[${index}].${elementPath}`
                        : `${currentPath}.${basePath}[${index}]`;

                      const recursiveResult = validateRecursive(
                        element,
                        rootData,
                        currentDepth + 1,
                        elementCurrentPath,
                        visitedSet,
                        options
                      );
                      if (!recursiveResult.valid) {
                        errors.push(...recursiveResult.errors);
                      }
                    }
                  }
                }
              });
            }
            continue;
          }

          // Check if this field is also marked as recursive
          const fieldValue =
            createNestedValueAccessor(validatorFieldPath)(value);
          if (fieldValue && typeof fieldValue === "object") {
            // Check if this field has recursive marker
            const fieldDef = fieldDefinitions.find(
              (fd) => fd.path === validatorFieldPath
            );
            let fieldBuilt = null;
            if (fieldDef?.builderFunction) {
              const fieldContext = createFieldContext(
                validatorFieldPath,
                plugins
              );
              fieldBuilt = fieldDef.builderFunction(fieldContext);
              if (fieldBuilt?.build) fieldBuilt = fieldBuilt.build();
            }

            const hasRecursive = fieldBuilt?._validators?.some?.(
              (v: any) => v.__isRecursive === true
            );
            if (hasRecursive) {
              const recursiveResult = validateRecursive(
                fieldValue,
                rootData,
                currentDepth + 1,
                `${currentPath}.${validatorFieldPath}`,
                visitedSet,
                options
              );
              if (!recursiveResult.valid) {
                errors.push(...recursiveResult.errors);
              }
            }
          }
        }

        if (errors.length > 0) {
          return { valid: false, errors };
        }
      }
    } else if (targetFieldPath === "__Element") {
      // For array elements, apply all validators
      if (Array.isArray(value)) {
        const errors: any[] = [];
        // For array element validation, don't abort early between fields - validate all fields in each element

        for (let i = 0; i < value.length; i++) {
          const element = value[i];
          if (element && typeof element === "object" && allFieldValidators) {
            // Apply all validators to each element
            for (const [validatorFieldPath, validator] of allFieldValidators) {
              // Skip array element validators
              if (validatorFieldPath.includes("[*]")) continue;

              // Get field value from element
              const fieldAccessor =
                createNestedValueAccessor(validatorFieldPath);
              const fieldValue = fieldAccessor(element);

              // Validate field
              const fieldResult = validator.validate(
                fieldValue,
                rootData,
                options
              );
              if (!fieldResult.valid) {
                // Map errors to element path
                for (const error of fieldResult.errors) {
                  errors.push({
                    ...error,
                    path: `${currentPath}[${i}].${error.path}`,
                  });
                }
              }
            }
          }
        }

        if (errors.length > 0) {
          return { valid: false, errors };
        }
      }
    } else if (targetValidator) {
      // Regular field path - apply specific field validators
      if (value && typeof value === "object") {
        const errors: any[] = [];
        const abortEarly = options?.abortEarlyOnEachField !== false;

        // Get the target field path pattern
        const targetPathParts = targetFieldPath.split(".");
        const fieldName = targetPathParts[targetPathParts.length - 1];

        // Handle arrays
        if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const element = value[i];
            if (element && typeof element === "object") {
              // Check if element has the target field
              if (fieldName in element) {
                const elementFieldValue = element[fieldName];
                const elementPath = `${currentPath}[${i}].${fieldName}`;

                // Recursively validate
                const elementResult = validateRecursive(
                  elementFieldValue,
                  rootData,
                  currentDepth + 1,
                  elementPath,
                  visitedSet,
                  options
                );

                if (!elementResult.valid) {
                  errors.push(...elementResult.errors);
                  if (abortEarly) {
                    return { valid: false, errors };
                  }
                }
              }
            }
          }
        } else {
          // Handle objects
          if (fieldName in value) {
            const nestedFieldValue = value[fieldName];
            const nestedPath = `${currentPath}.${fieldName}`;

            // Recursively validate
            const nestedResult = validateRecursive(
              nestedFieldValue,
              rootData,
              currentDepth + 1,
              nestedPath,
              visitedSet,
              options
            );

            if (!nestedResult.valid) {
              errors.push(...nestedResult.errors);
              if (abortEarly) {
                return { valid: false, errors };
              }
            }
          }
        }

        if (errors.length > 0) {
          return { valid: false, errors };
        }
      }
    }

    // Clean up visited set
    if (value && typeof value === "object") {
      visitedSet.delete(value);
    }

    return { valid: true, errors: [] };
  };

  return {
    validate: (
      value: any,
      rootData: any,
      options?: { abortEarlyOnEachField?: boolean }
    ) => {
      const visitedSet = new WeakSet<object>();
      return validateRecursive(
        value,
        rootData,
        0,
        fieldPath,
        visitedSet,
        options
      );
    },

    parse: (
      value: any,
      rootData: any,
      options?: { abortEarlyOnEachField?: boolean }
    ) => {
      const visitedSet = new WeakSet<object>();
      // For now, parse behaves the same as validate
      // In the future, we might want to handle transforms recursively
      const result = validateRecursive(
        value,
        rootData,
        0,
        fieldPath,
        visitedSet,
        options
      );
      if (!result.valid) {
        return { ...result, data: undefined };
      }
      return { valid: true, data: value, errors: [] };
    },

    accessor: originalValidator.accessor,
  };
}

/**
 * Create array element recursive validator wrapper
 * Specialized for handling array element recursive validation with [*] notation
 */
function createArrayElementRecursiveValidator(
  originalValidator: UnifiedValidator,
  fieldPath: string,
  targetFieldPath: string,
  maxDepth: number,
  fieldDefinitions: Array<{ path: string; builderFunction: Function }>,
  plugins: Record<string, any>,
  allFieldValidators?: Map<string, UnifiedValidator>
): UnifiedValidator {
  const parseResult = parseFieldPath(fieldPath);

  return {
    validate: (arrayValue: any, rootData: any, options?: ValidationOptions) => {
      // Handle null/undefined arrays
      if (arrayValue === null || arrayValue === undefined) {
        return originalValidator.validate(arrayValue, rootData, options);
      }

      // Must be an array for array element validation
      if (!Array.isArray(arrayValue)) {
        return originalValidator.validate(arrayValue, rootData, options);
      }

      const errors: any[] = [];
      const visitedSet = new WeakSet<object>();

      // Apply recursive validation to each array element
      arrayValue.forEach((element, index) => {
        if (element && typeof element === "object") {
          // Apply all field validators to each element with __Self logic
          if (targetFieldPath === "__Self" && allFieldValidators) {
            for (const [validatorFieldPath, validator] of allFieldValidators) {
              // For recursive array element validation, we want to apply validators that match our array pattern
              if (validatorFieldPath.includes("[*]")) {
                // Check if this validator is for the same array pattern
                const currentArrayPattern = parseResult.baseArrayPath + "[*]";
                if (validatorFieldPath.startsWith(currentArrayPattern)) {
                  // Extract the field path after the array pattern
                  const fieldPathAfterArray = validatorFieldPath.slice(
                    currentArrayPattern.length
                  );

                  let fieldValue: any;
                  let targetPath: string;
                  let elementFieldPath: string;

                  if (fieldPathAfterArray === "") {
                    // This is the array element validator itself (categories[*])
                    // Skip to avoid infinite recursion
                    continue;
                  } else if (fieldPathAfterArray.startsWith(".")) {
                    // This is a field of the array element (categories[*].id)
                    elementFieldPath = fieldPathAfterArray.slice(1); // Remove leading dot
                    fieldValue =
                      createNestedValueAccessor(elementFieldPath)(element);
                    targetPath = parseResult.baseArrayPath
                      ? `${parseResult.baseArrayPath}[${index}].${elementFieldPath}`
                      : `[${index}].${elementFieldPath}`;
                  } else {
                    continue;
                  }

                  // Validate field
                  const fieldResult = validator.validate(
                    fieldValue,
                    rootData,
                    options
                  );
                  if (!fieldResult.valid) {
                    // Map errors to array element path
                    for (const error of fieldResult.errors) {
                      errors.push({
                        ...error,
                        path: targetPath,
                      });
                    }
                  }
                }
                continue;
              }

              // Skip validators that don't apply to our array
              // (These would be validators for other fields)
              continue;
            }

            // For each element that has recursive fields (like subcategories), apply recursive validation
            for (const [validatorFieldPath, validator] of allFieldValidators) {
              if (validatorFieldPath.includes("[*]")) {
                const currentArrayPattern = parseResult.baseArrayPath + "[*]";
                if (validatorFieldPath.startsWith(currentArrayPattern)) {
                  const fieldPathAfterArray = validatorFieldPath.slice(
                    currentArrayPattern.length
                  );

                  if (fieldPathAfterArray.startsWith(".")) {
                    const elementFieldPath = fieldPathAfterArray.slice(1);

                    // Check if this field itself is an array that needs recursive validation
                    const elementFieldValue =
                      createNestedValueAccessor(elementFieldPath)(element);
                    if (Array.isArray(elementFieldValue)) {
                      // This is a nested array field (like subcategories)
                      // Apply recursive validation to it

                      // Recursively validate each element in the nested array
                      elementFieldValue.forEach(
                        (nestedElement, nestedIndex) => {
                          if (
                            nestedElement &&
                            typeof nestedElement === "object"
                          ) {
                            // Apply all same-pattern validators to nested elements
                            for (const [
                              nestedValidatorPath,
                              nestedValidator,
                            ] of allFieldValidators) {
                              if (
                                nestedValidatorPath.includes("[*]") &&
                                nestedValidatorPath.startsWith(
                                  currentArrayPattern
                                )
                              ) {
                                const nestedFieldAfterArray =
                                  nestedValidatorPath.slice(
                                    currentArrayPattern.length
                                  );
                                if (
                                  nestedFieldAfterArray.startsWith(".") &&
                                  nestedFieldAfterArray !==
                                    "." + elementFieldPath
                                ) {
                                  // This is a validator for a field in the nested object
                                  const nestedFieldPath =
                                    nestedFieldAfterArray.slice(1);
                                  const nestedFieldValue =
                                    createNestedValueAccessor(nestedFieldPath)(
                                      nestedElement
                                    );
                                  const nestedTargetPath = `${parseResult.baseArrayPath}[${index}].${elementFieldPath}[${nestedIndex}].${nestedFieldPath}`;

                                  const nestedResult = nestedValidator.validate(
                                    nestedFieldValue,
                                    rootData,
                                    options
                                  );
                                  if (!nestedResult.valid) {
                                    for (const error of nestedResult.errors) {
                                      errors.push({
                                        ...error,
                                        path: nestedTargetPath,
                                      });
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      );
                    }
                  }
                }
              }
            }
          }
        }
      });

      return {
        valid: errors.length === 0,
        errors: errors,
      };
    },

    parse: (arrayValue: any, rootData: any, options?: any) => {
      // For array element recursive validation, we delegate to the original validator
      // since parsing is handled at the array level, not element level
      return originalValidator.parse(arrayValue, rootData, options);
    },

    accessor: originalValidator.accessor,
  };
}

/**
 * Check if an actual field path matches a pattern with wildcards
 * e.g., "users[0].profile.tags" matches "users[*].profile.tags"
 */
function matchesFieldPattern(actualPath: string, patternPath: string): boolean {
  // Convert pattern path to regex by replacing [*] with [number]
  const regexPattern = "^" + patternPath.replace(/\[\*\]/g, "\\[\\d+\\]") + "$";
  const regex = new RegExp(regexPattern);
  return regex.test(actualPath);
}

/**
 * PickValidatorFactory - Factory dedicated to pick functionality
 */
function createPickValidatorFactory<TObject extends object>(
  fieldDefinitions: FieldDefinition[],
  plugins: Record<string, any>,
  buildValidators?: any,  // Pass the buildValidators function for re-use
  originalValidator?: any  // Pass the original validator for error filtering
) {
  /**
   * Create a picked validator for a specific field
   */
  function createPickedValidator<K extends NestedKeyOf<TObject>>(
    key: K
  ): FieldValidator<TObject, TypeOfPath<TObject, K>> {
    const keyPath = key as string;
    const targetFieldDef = fieldDefinitions.find((fd) => fd.path === keyPath);
    
    // Find related field definitions (array elements, nested fields, etc.)
    const relatedFieldDefs = fieldDefinitions.filter((fd) => {
      // Include the main field
      if (fd.path === keyPath) return true;
      
      // Include array element patterns like "field[*]", "field[*].subfield"
      if (fd.path.startsWith(keyPath + "[*]")) return true;
      
      // Include dot-star patterns like "field.*.subfield"  
      if (fd.path.startsWith(keyPath + ".*")) return true;
      
      // Include nested dot patterns like "field.subfield"
      if (fd.path.startsWith(keyPath + ".")) return true;
      
      return false;
    });


    if (!targetFieldDef && relatedFieldDefs.length === 0) {
      // Return a validator that always passes if field not found
      return {
        validate: () => ({
          valid: true,
          value: undefined as any,
          errors: [],
        }),
        parse: () => ({
          valid: true,
          value: undefined as any,
          errors: [],
        }),
      };
    }

    // If we have related field definitions (like array elements), create a comprehensive validator
    if (relatedFieldDefs.length > 1) {
      // Get the related field paths for filtering
      const relatedPaths = new Set(relatedFieldDefs.map(fd => fd.path));
      
      return {
        validate: (value: TypeOfPath<TObject, K> | null, allValues?: Partial<TObject>, options?: ValidationOptions): ValidationResult<TypeOfPath<TObject, K>> => {
          // If we have the original validator, use it with error filtering (best approach)
          if (originalValidator) {
            // Create temporary object with the picked value at the original key path
            const tempObject = { [keyPath]: value };
            
            // Validate using the original validator
            const result = originalValidator.validate(tempObject, options);
            
            // Filter errors to only include the related field paths using pattern matching
            const filteredErrors = result.valid ? [] : (result.errors || []).filter((error: any) => {
              // Check if the error path matches any of the related patterns
              for (const relatedPath of relatedPaths) {
                if (matchesFieldPattern(error.path, relatedPath)) {
                  return true;
                }
              }
              return false;
            });
            
            return {
              valid: filteredErrors.length === 0,
              value: filteredErrors.length === 0 ? value : null,
              errors: filteredErrors,
            };
          }
          
          // Fallback: create individual field validators (if original validator not available)
          const allErrors: any[] = [];
          
          for (const fieldDef of relatedFieldDefs) {
            const validator = createUnifiedValidator(fieldDef as any, plugins);
            const fieldResult = validator.validate({ [keyPath]: value }, { [keyPath]: value }, options);
            if (!fieldResult.valid && fieldResult.errors) {
              allErrors.push(...fieldResult.errors);
            }
          }
          
          return {
            valid: allErrors.length === 0,
            value: allErrors.length === 0 ? value : null,
            errors: allErrors,
          };
        },
        parse: (value: TypeOfPath<TObject, K> | null, allValues?: Partial<TObject>, options?: ValidationOptions): ValidationResult<TypeOfPath<TObject, K>> => {
          // If we have the original validator, use it with error filtering
          if (originalValidator) {
            // Create temporary object with the picked value at the original key path
            const tempObject = { [keyPath]: value };
            
            // Parse using the original validator
            const result = originalValidator.parse(tempObject, options);
            
            // Filter errors if validation failed using pattern matching
            if (!result.valid) {
              const filteredErrors = (result.errors || []).filter((error: any) => {
                // Check if the error path matches any of the related patterns
                for (const relatedPath of relatedPaths) {
                  if (matchesFieldPattern(error.path, relatedPath)) {
                    return true;
                  }
                }
                return false;
              });
              
              if (filteredErrors.length > 0) {
                return {
                  valid: false,
                  value: undefined as any,
                  errors: filteredErrors,
                };
              }
            }
            
            // If validation passed or no related errors, extract the parsed value
            const parsedData = result.valid ? result.value : tempObject;
            const extractedValue = parsedData && parsedData[keyPath] !== undefined ? parsedData[keyPath] : value;
            return {
              valid: true,
              value: extractedValue as TypeOfPath<TObject, K>,
              errors: [],
            };
          }
          
          // Fallback: simple validation using individual validators
          const allErrors: any[] = [];
          
          for (const fieldDef of relatedFieldDefs) {
            const validator = createUnifiedValidator(fieldDef as any, plugins);
            const fieldResult = validator.validate({ [keyPath]: value }, { [keyPath]: value }, options);
            if (!fieldResult.valid && fieldResult.errors) {
              allErrors.push(...fieldResult.errors);
            }
          }
          
          return {
            valid: allErrors.length === 0,
            value: allErrors.length === 0 ? value as TypeOfPath<TObject, K> : null as any,
            errors: allErrors,
          };
        },
      };
    }

    // Fallback to single field validation
    if (!targetFieldDef) {
      return {
        validate: () => ({ valid: true, value: undefined as any, errors: [] }),
        parse: () => ({ valid: true, value: undefined as any, errors: [] }),
      };
    }

    // Build individual field validator
    const context = createFieldContext(targetFieldDef.path, plugins);
    if (!targetFieldDef.builderFunction) {
      throw new Error(`Field definition for path '${targetFieldDef.path}' is missing builderFunction`);
    }
    const builtField = targetFieldDef.builderFunction(context);

    // Use the same optimization strategy detection
    const fieldWithBuilder = {
      path: targetFieldDef.path,
      builderFunction:
        targetFieldDef.builderFunction ||
        (() => {
          throw new Error(
            `Field ${targetFieldDef.path} uses object definition form`
          );
        }),
    };
    const strategies = selectOptimalStrategies([fieldWithBuilder], plugins);
    const fieldStrategy = strategies.get(targetFieldDef.path);

    let fieldValidator: any;

    // V8 optimization: Using Unified validator
    fieldValidator = createUnifiedValidator(targetFieldDef as any, plugins);

    return {
      validate: (
        value?: TypeOfPath<TObject, K> | null,
        allValues?: Partial<TObject>,
        options?: any
      ): ValidationResult<TypeOfPath<TObject, K>> => {
        // Create a mock object with just this field for validation context
        const mockObject = { ...allValues } as Record<string, unknown>;
        setNestedValue(mockObject, key as string, value);

        const fieldValue = getNestedValue(mockObject, key as string);

        // V8 optimization: Unified validator interface
        const result = fieldValidator.validate(fieldValue, mockObject, options);

        return {
          valid: result.valid,
          value: result.valid ? (value ?? null) : null,
          errors: result.errors || [],
        };
      },
      
      parse: (
        value?: TypeOfPath<TObject, K> | null,
        allValues?: Partial<TObject>,
        options?: any
      ) => {
        // Create a mock object with just this field for parse context
        const mockObject = { ...allValues } as Record<string, unknown>;
        setNestedValue(mockObject, key as string, value);

        const fieldValue = getNestedValue(mockObject, key as string);

        // V8 optimization: Unified validator interface for parse
        const result = fieldValidator.parse(fieldValue, mockObject, options);

        return {
          valid: result.valid,
          value: result.valid ? (result.data !== undefined ? result.data : value) : null,
          errors: result.errors || [],
        };
      },
    };
  }

  return {
    createPickedValidator,
  };
}
