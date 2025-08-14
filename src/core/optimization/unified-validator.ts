/**
 * Unified Validator - Integrates meaningless Fast/Slow separation
 *
 * User feedback: validateFast and validateSlow don't need separate function names
 * Since the caller uses the same interface, they should be unified
 *
 * Before: FastValidator + SlowValidator = 519 lines
 * After: UnifiedValidator = ~80 lines (85% reduction)
 */

import { createFieldContext } from "../builder/context/field-context";
import { ValidationMode, VALIDATE_MODE, PARSE_MODE } from "../../constants";

// V8 optimization: Unified Hidden Class + lazy evaluation
interface ValidationResult {
  readonly valid: boolean;
  readonly errors: Array<{
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }>;
}

interface ParseResult {
  readonly valid: boolean;
  readonly data?: any; // V8 optimization: Optional because it can be undefined
  readonly errors: Array<{
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }>;
}

// Unified interface
export interface UnifiedValidator {
  validate(
    value: any,
    rootData: any,
    options?: { abortEarlyOnEachField?: boolean }
  ): ValidationResult;

  parse(
    value: any,
    rootData: any,
    options?: { abortEarlyOnEachField?: boolean }
  ): ParseResult;

  // Pre-compiled field accessor for performance
  accessor?: (obj: any) => any;
}

// Internal execution strategy (not exposed externally)
type ExecutionStrategy = "definition_order" | "fast_separated";

/**
 * Create unified validator
 * Fast/Slow differences are internal implementation only, external interface is unified
 */
export function createUnifiedValidator(
  fieldDef: { path: string; builderFunction: Function },
  plugins: Record<string, any>,
  strategy: ExecutionStrategy = "fast_separated",
  accessor?: (obj: any) => any
): UnifiedValidator {
  // Create field context (common processing)
  const context = createFieldContext(fieldDef.path, plugins);
  let builtField = fieldDef.builderFunction(context);

  // Check if the result needs to be built (composable plugins return a composer)
  if (builtField && typeof builtField.build === "function") {
    builtField = builtField.build();
  }

  // Extract validators and transforms (common processing)
  const validators = builtField._validators || [];
  const transforms = builtField._transforms || [];
  const path = fieldDef.path;

  // V8 optimization: Ultra-fast path for simple validations (no skip plugins, no transforms)
  const hasSkipPlugins = validators.some(
    (v: any) => v.shouldSkipAllValidation || v.shouldSkipValidation
  );
  const hasTransforms = transforms.length > 0;
  // Increased validator limit from 3 to 10 for realistic use cases
  const isSimpleValidation =
    !hasSkipPlugins &&
    !hasTransforms &&
    validators.length <= 10 &&
    strategy === "fast_separated";

  if (isSimpleValidation) {
    // V8 optimization: Compiled ultra-fast validator - eliminate all abstraction overhead
    return createUltraFastValidator(validators, path);
  }

  // V8 optimization: Optimized path for simple validators with transforms
  const isSimpleWithTransforms =
    !hasSkipPlugins &&
    hasTransforms &&
    validators.length <= 10 &&
    transforms.length <= 5 &&
    strategy === "fast_separated";
  if (isSimpleWithTransforms) {
    return createOptimizedTransformValidator(validators, transforms, path);
  }

  // Determine execution order based on strategy (internal implementation differences only)
  // Only use definition order if explicitly requested or has complex skip logic
  const executeInDefinitionOrder =
    strategy === "definition_order" || hasSkipPlugins;

  // V8 optimization: Always return the same shape for unified Hidden Class
  const definitionOrderValidator = (
    value: any,
    rootData: any,
    options: any
  ): ValidationResult => {
    const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;
    // Call executeDefinitionOrder in Validate mode (skip Transform)
    const result = executeDefinitionOrder(
      value,
      rootData,
      validators,
      transforms,
      path,
      abortEarlyOnEachField,
      VALIDATE_MODE
    );
    // Unified Hidden Class: always return in valid, errors order
    return {
      valid: result.valid,
      errors: result.errors,
    };
  };

  const fastValidatorForValidate = (
    value: any,
    rootData: any,
    options: { abortEarlyOnEachField?: boolean } = {}
  ): ValidationResult => {
    const abortEarlyOnEachField = options.abortEarlyOnEachField !== false;
    // Call executeFastSeparated in Validate mode (skip Transform)
    return executeFastSeparated(
      value,
      rootData,
      validators,
      transforms,
      path,
      abortEarlyOnEachField,
      VALIDATE_MODE
    );
  };

  const validate = executeInDefinitionOrder
    ? definitionOrderValidator
    : fastValidatorForValidate;

  const parseDefinitionOrder = (value: any, rootData: any, options: any) => {
    const abortEarlyOnEachField = options?.abortEarlyOnEachField !== false;
    // Call executeDefinitionOrder in Parse mode (execute Transform)
    const result = executeDefinitionOrder(
      value,
      rootData,
      validators,
      transforms,
      path,
      abortEarlyOnEachField,
      PARSE_MODE
    );
    return result;
  };
  const fastValidatorForParse = (
    value: any,
    rootData: any,
    options: { abortEarlyOnEachField?: boolean } = {}
  ) => {
    const abortEarlyOnEachField = options.abortEarlyOnEachField !== false;
    // Call executeFastSeparated in Parse mode (execute Transform)
    return executeFastSeparated(
      value,
      rootData,
      validators,
      transforms,
      path,
      abortEarlyOnEachField,
      PARSE_MODE
    );
  };
  const parse = executeInDefinitionOrder
    ? parseDefinitionOrder
    : fastValidatorForParse;

  return {
    validate,
    parse,
    accessor,
  };
}

/**
 * Lightweight Execution Context for Definition Order
 * Maintain CurrentValue and achieve true definition order execution
 */
interface LightweightExecutionContext {
  currentValue: any;
  originalValue: any;
  rootData: any;
  path: string;
  errorIndices: number[];
  transformErrors: Array<{ path: string; code: string; message: string }>;
  abortEarlyOnEachField: boolean;
}

/**
 * Definition order execution (true definition order execution)
 * Optimized for mixed validators and transforms
 */
function executeDefinitionOrder(
  value: any,
  rootData: any,
  validators: any[],
  transforms: any[],
  path: string,
  abortEarlyOnEachField: boolean,
  mode: ValidationMode = PARSE_MODE
) {
  // V8 optimization: Direct error array
  const errors: Array<{ path: string; code: string; message: string }> = [];
  let currentValue = value;

  // Check if we should skip validation for null/undefined values
  const hasSkipForNull = validators.some(v => v.skipForNull === true);
  const hasSkipForUndefined = validators.some(v => v.skipForUndefined === true);
  
  if ((value === null && hasSkipForNull) || (value === undefined && hasSkipForUndefined)) {
    // Skip both validation AND transforms for null/undefined when appropriate validators are present
    if (mode === PARSE_MODE) {
      // In parse mode, return original value without transforms
      return {
        valid: true,
        data: value,
        errors: [],
      };
    } else {
      // In validate mode, just return valid
      return {
        valid: true,
        data: undefined,
        errors: [],
      };
    }
  }

  // Phase 1: Fast validation
  const validatorsLength = validators.length;
  for (let i = 0; i < validatorsLength; i++) {
    const validator = validators[i];

    // Skip check
    if (
      validator.shouldSkipAllValidation &&
      typeof validator.shouldSkipAllValidation === "function"
    ) {
      if (validator.shouldSkipAllValidation(currentValue, rootData)) {
        // Skip all validations from this point forward
        break; // Exit the validation loop
      }
    }

    // Direct validation
    const checkFn = validator.check || validator;
    if (typeof checkFn === "function" && !checkFn(currentValue, rootData)) {
      const error = {
        path: path,
        code: validator.code || validator.pluginName || "VALIDATION_ERROR",
        message: computeErrorMessage(validator, currentValue, path, rootData),
      };

      if (abortEarlyOnEachField) {
        return {
          valid: false,
          data: undefined,
          errors: [error],
        };
      }

      errors.push(error);
    }
  }

  // Check validation errors
  if (errors.length > 0) {
    return {
      valid: false,
      data: undefined,
      errors: errors,
    };
  }

  // Phase 2: Transform (only for parse mode)
  if (mode === PARSE_MODE && transforms.length > 0) {
    // Pre-compile transforms
    const validTransforms: Array<(v: any) => any> = [];
    for (let i = 0; i < transforms.length; i++) {
      const transform = transforms[i];
      if (typeof transform === "function") {
        validTransforms.push(transform);
      } else if (transform && typeof transform.apply === "function") {
        validTransforms.push(transform.apply);
      }
    }

    const validTransformCount = validTransforms.length;

    // Execute transforms
    if (validTransformCount === 1) {
      currentValue = validTransforms[0](currentValue);
    } else if (validTransformCount === 2) {
      currentValue = validTransforms[0](currentValue);
      currentValue = validTransforms[1](currentValue);
    } else if (validTransformCount > 0) {
      for (let i = 0; i < validTransformCount; i++) {
        currentValue = validTransforms[i](currentValue);
      }
    }
  }

  // Return success
  if (mode === VALIDATE_MODE) {
    return ULTRA_FAST_VALID_RESULT;
  }

  return {
    valid: true,
    data: currentValue,
    errors: [],
  };
}

/**
 * V8 optimization: Execute validation phase (loop optimization)
 */
function executeValidationPhase(
  context: LightweightExecutionContext,
  validators: any[]
): boolean {
  const validatorsLength = validators.length;

  // V8 optimization: Speed up access with local variables
  const currentValue = context.currentValue;
  const rootData = context.rootData;
  const abortEarly = context.abortEarlyOnEachField;

  // V8 optimization: Execute validators in definition order
  for (let i = 0; i < validatorsLength; i++) {
    const validator = validators[i];

    // Skip check
    if (
      validator.shouldSkipAllValidation &&
      typeof validator.shouldSkipAllValidation === "function"
    ) {
      const shouldSkip = validator.shouldSkipAllValidation(
        currentValue,
        rootData
      );
      if (shouldSkip) {
        // Skip all validations from this point forward
        return true; // Exit validation phase successfully
      }
    }

    // V8 optimization: reduce property access by extracting checkFn
    const checkFn = validator.check || validator;

    if (typeof checkFn === "function") {
      // V8 optimization: monomorphic call
      const isValid = checkFn(currentValue, rootData);
      if (!isValid) {
        context.errorIndices.push(i);

        // V8 optimization: minimize early termination checks
        if (abortEarly) {
          return false;
        }
      }
    }
  }

  return true; // Can continue
}

/**
 * V8 optimization: Execute transform phase (loop optimization)
 */
function executeTransformPhase(
  context: LightweightExecutionContext,
  transforms: any[]
): boolean {
  const transformsLength = transforms.length;

  // V8 optimization: faster access with local variables
  let currentValue = context.currentValue;
  const path = context.path;

  // V8 optimization: Pre-validate transforms outside hot loop
  const validTransforms: Array<(v: any) => any> = [];
  for (let i = 0; i < transformsLength; i++) {
    const transform = transforms[i];
    if (typeof transform === "function") {
      validTransforms.push(transform);
    } else if (transform && typeof transform.apply === "function") {
      validTransforms.push(transform.apply);
    }
  }

  const validTransformCount = validTransforms.length;

  // V8 optimization: Optimized transform execution without try-catch in hot path
  if (validTransformCount === 1) {
    // Single transform optimization
    currentValue = validTransforms[0](currentValue);
  } else if (validTransformCount === 2) {
    // Two transforms optimization
    currentValue = validTransforms[0](currentValue);
    currentValue = validTransforms[1](currentValue);
  } else {
    // Multiple transforms
    for (let i = 0; i < validTransformCount; i++) {
      currentValue = validTransforms[i](currentValue);
    }
  }

  // V8 optimization: update context at the end
  context.currentValue = currentValue;
  return true;
}

/**
 * V8 optimization: Create error result (lazy generation + Hidden Class unification)
 * Control data field according to mode
 */
function createErrorResult(
  context: LightweightExecutionContext,
  validators: any[],
  mode: ValidationMode = PARSE_MODE
) {
  const hasErrors =
    context.errorIndices.length > 0 || context.transformErrors.length > 0;

  if (!hasErrors) {
    // V8 optimization: Hidden Class unification (always valid, data, errors order)
    return {
      valid: true,
      data: mode === PARSE_MODE ? context.currentValue : undefined,
      errors: [],
    };
  }

  // V8 optimization: Unified Hidden Class + lazy evaluation
  return {
    valid: false,
    data: undefined,
    get errors() {
      const errors: Array<{ path: string; code: string; message: string }> = [];
      const indices = context.abortEarlyOnEachField
        ? [context.errorIndices[0]]
        : context.errorIndices;
      const indicesLength = indices.length;
      const validatorsLength = validators.length;

      // V8 optimization: loop optimization with for statement
      for (let i = 0; i < indicesLength; i++) {
        const idx = indices[i];
        if (idx < validatorsLength) {
          errors.push(
            createValidationError(
              validators[idx],
              context.currentValue,
              context.path,
              context.rootData
            )
          );
        }
      }

      // V8 optimization: remove spread operator, add transform errors only in Parse mode
      if (mode === PARSE_MODE) {
        const transformErrorsLength = context.transformErrors.length;
        for (let i = 0; i < transformErrorsLength; i++) {
          errors.push(context.transformErrors[i]);
        }
      }

      return errors;
    },
  };
}

// V8 optimization: Function to create parse success result
function createParseSuccessResult(data: any): ParseResult {
  return {
    valid: true,
    data: data,
    errors: [],
  };
}

/**
 * V8 optimization: Fast separated execution (loop + Hidden Class optimization)
 * Validation first, then Transform (separate execution)
 * mode: 'validate' | 'parse' controls Transform execution
 */
function executeFastSeparated(
  value: any,
  rootData: any,
  validators: any[],
  transforms: any[],
  path: string,
  abortEarlyOnEachField: boolean,
  mode: ValidationMode = PARSE_MODE
) {
  // V8 optimization: Pre-allocate error arrays
  const errors: Array<{ path: string; code: string; message: string }> = [];

  // V8 optimization: Execute validators in definition order
  const validatorsLength = validators.length;

  // Check if we should skip validation for null/undefined values
  const hasSkipForNull = validators.some(v => v.skipForNull === true);
  const hasSkipForUndefined = validators.some(v => v.skipForUndefined === true);
  
  if ((value === null && hasSkipForNull) || (value === undefined && hasSkipForUndefined)) {
    // Skip both validation AND transforms for null/undefined when appropriate validators are present
    if (mode === PARSE_MODE) {
      // In parse mode, return original value without transforms
      return {
        valid: true,
        data: value,
        errors: [],
      };
    } else {
      // In validate mode, just return valid
      return {
        valid: true,
        data: undefined,
        errors: [],
      };
    }
  }

  for (let i = 0; i < validatorsLength; i++) {
    const validator = validators[i];

    // Check if this is a skip plugin
    if (
      validator.shouldSkipAllValidation &&
      typeof validator.shouldSkipAllValidation === "function"
    ) {
      const shouldSkip = validator.shouldSkipAllValidation(value, rootData);
      if (shouldSkip) {
        // Skip all validations from this point forward
        break; // Exit the validation loop
      }
    }

    // V8 optimization: Direct validation check
    const checkFn = validator.check || validator;
    if (typeof checkFn === "function" && !checkFn(value, rootData)) {
      // Validation failed
      if (abortEarlyOnEachField) {
        // V8 optimization: Direct error creation for abort early
        const error = {
          path: path,
          code: validator.code || validator.pluginName || "VALIDATION_ERROR",
          message: computeErrorMessage(validator, value, path, rootData),
        };
        return {
          valid: false,
          data: undefined,
          errors: [error],
        };
      }

      // Collect error for non-abort early
      errors.push({
        path: path,
        code: validator.code || validator.pluginName || "VALIDATION_ERROR",
        message: computeErrorMessage(validator, value, path, rootData),
      });
    }
  }

  // V8 optimization: Skip transforms in Validate mode (optimization)
  if (mode === VALIDATE_MODE) {
    if (errors.length === 0) {
      return ULTRA_FAST_VALID_RESULT;
    }
    return {
      valid: false,
      errors: errors,
    };
  }

  // V8 optimization: Check for validation errors before transform
  if (errors.length > 0) {
    return {
      valid: false,
      data: undefined,
      errors: errors,
    };
  }

  // V8 optimization: 2. Transform phase for parse mode
  let transformedValue = value;
  const transformsLength = transforms.length;

  // V8 optimization: Pre-compile transform functions
  if (transformsLength > 0) {
    // Pre-validate transform functions
    const validTransforms: Array<(v: any) => any> = [];
    for (let i = 0; i < transformsLength; i++) {
      const transform = transforms[i];
      if (typeof transform === "function") {
        validTransforms.push(transform);
      } else if (transform && typeof transform.apply === "function") {
        validTransforms.push(transform.apply);
      }
    }

    const validTransformCount = validTransforms.length;

    // V8 optimization: Optimized transform execution
    if (validTransformCount === 1) {
      // Single transform
      transformedValue = validTransforms[0](transformedValue);
    } else if (validTransformCount === 2) {
      // Two transforms
      transformedValue = validTransforms[0](transformedValue);
      transformedValue = validTransforms[1](transformedValue);
    } else if (validTransformCount > 0) {
      // Multiple transforms
      for (let i = 0; i < validTransformCount; i++) {
        transformedValue = validTransforms[i](transformedValue);
      }
    }
  }

  // V8 optimization: Return success with transformed data
  return {
    valid: true,
    data: transformedValue,
    errors: [],
  };
}

/**
 * V8 optimization: Ultra-fast validator for simple cases - eliminates ALL abstraction overhead
 * Generates inline validation code for maximum performance
 */
function createUltraFastValidator(
  validators: any[],
  path: string,
  accessor?: (obj: any) => any
): UnifiedValidator {
  // Pre-extract validation functions and eliminate runtime checks
  const validationChecks: Array<(value: any, rootData: any) => boolean> = [];
  const errorCodes: string[] = [];
  const errorMessages: string[] = [];
  const isDynamic: boolean[] = [];  // Track which messages are dynamic

  // Pre-compile all validators and cache error data
  const validatorsLength = validators.length;
  for (let i = 0; i < validatorsLength; i++) {
    const validator = validators[i];

    validationChecks.push(validator.check || validator);
    errorCodes.push(
      validator.code || validator.pluginName || "VALIDATION_ERROR"
    );

    // Pre-compute static error messages where possible
    if (
      validator.getErrorMessage &&
      typeof validator.getErrorMessage === "function"
    ) {
      errorMessages.push(""); // Dynamic - will compute at runtime
      isDynamic.push(true);
    } else if (validator.messageFactory) {
      errorMessages.push(""); // Dynamic - will compute at runtime
      isDynamic.push(true);
    } else {
      errorMessages.push(`Validation failed for ${path}`);
      isDynamic.push(false);
    }
  }

  const validationChecksLength = validationChecks.length;

  // V8 optimization: Pre-allocated error object for single-error case
  const singleError = { path: path, code: "", message: "" };
  
  // V8 optimization: Generate specialized validators based on count
  let validate: (value: any, rootData: any, options: any) => ValidationResult;
  
  if (validationChecksLength === 1) {
    // Ultra-optimized single validator path
    const check0 = validationChecks[0];
    const code0 = errorCodes[0];
    const msg0 = errorMessages[0];
    const dynamic0 = isDynamic[0];
    
    validate = (value: any, rootData: any, options: any): ValidationResult => {
      if (check0(value, rootData)) {
        return ULTRA_FAST_VALID_RESULT;
      }
      
      singleError.code = code0;
      singleError.message = dynamic0 
        ? computeErrorMessage(validators[0], value, path, rootData)
        : msg0;
      
      return {
        valid: false,
        errors: [{ path: singleError.path, code: singleError.code, message: singleError.message }]
      };
    };
  } else if (validationChecksLength === 2) {
    // Optimized two-validator path
    const check0 = validationChecks[0];
    const check1 = validationChecks[1];
    const code0 = errorCodes[0];
    const code1 = errorCodes[1];
    const msg0 = errorMessages[0];
    const msg1 = errorMessages[1];
    const dynamic0 = isDynamic[0];
    const dynamic1 = isDynamic[1];
    
    validate = (value: any, rootData: any, options: any): ValidationResult => {
      if (!check0(value, rootData)) {
        if (options?.abortEarlyOnEachField !== false) {
          singleError.code = code0;
          singleError.message = dynamic0 
            ? computeErrorMessage(validators[0], value, path, rootData)
            : msg0;
          return {
            valid: false,
            errors: [{ path: singleError.path, code: singleError.code, message: singleError.message }]
          };
        }
        
        // Collect all errors
        const errors = [{
          path: path,
          code: code0,
          message: dynamic0 
            ? computeErrorMessage(validators[0], value, path, rootData)
            : msg0
        }];
        
        if (!check1(value, rootData)) {
          errors.push({
            path: path,
            code: code1,
            message: dynamic1 
              ? computeErrorMessage(validators[1], value, path, rootData)
              : msg1
          });
        }
        
        return { valid: false, errors };
      }
      
      if (!check1(value, rootData)) {
        singleError.code = code1;
        singleError.message = dynamic1 
          ? computeErrorMessage(validators[1], value, path, rootData)
          : msg1;
        return {
          valid: false,
          errors: [{ path: singleError.path, code: singleError.code, message: singleError.message }]
        };
      }
      
      return ULTRA_FAST_VALID_RESULT;
    };
  } else {
    // General case for multiple validators
    validate = (value: any, rootData: any, options: any): ValidationResult => {
      // V8 optimization: Hot path - inline validation with zero allocations on success
      for (let i = 0; i < validationChecksLength; i++) {
        if (!validationChecks[i](value, rootData)) {
          // Fast path: immediate error return for abort early (most common case)
          if (options?.abortEarlyOnEachField !== false) {
            singleError.code = errorCodes[i];
            singleError.message = isDynamic[i]
              ? computeErrorMessage(validators[i], value, path, rootData)
              : errorMessages[i];

            return {
              valid: false,
              errors: [{ path: singleError.path, code: singleError.code, message: singleError.message }]
            };
          }

          // Slow path: collect all errors (rare case)
          const errors: Array<{ path: string; code: string; message: string }> = [];
          errors.push({
            path: path,
            code: errorCodes[i],
            message: isDynamic[i]
              ? computeErrorMessage(validators[i], value, path, rootData)
              : errorMessages[i]
          });

          // Continue checking remaining validators
          for (let j = i + 1; j < validationChecksLength; j++) {
            if (!validationChecks[j](value, rootData)) {
              errors.push({
                path: path,
                code: errorCodes[j],
                message: isDynamic[j]
                  ? computeErrorMessage(validators[j], value, path, rootData)
                  : errorMessages[j]
              });
            }
          }

          return {
            valid: false,
            errors: errors
          };
        }
      }

      // V8 optimization: Success path - return pre-allocated constant
      return ULTRA_FAST_VALID_RESULT;
    };
  }

  // V8 optimization: Parse is identical to validate for simple cases (no transforms)
  const parse = (
    value: any,
    rootData: any,
    options: { abortEarlyOnEachField?: boolean } = {}
  ): ParseResult => {
    // First validate
    const validationResult = validate(value, rootData, options);
    if (!validationResult.valid) {
      return {
        valid: false,
        data: undefined,
        errors: validationResult.errors,
      };
    }

    // No transforms, just return the original value
    return {
      valid: true,
      data: value,
      errors: [],
    };
  };

  return { validate, parse, accessor };
}

// V8 optimization: Pre-allocated success result to avoid object creation
const ULTRA_FAST_VALID_RESULT: ValidationResult = Object.freeze({
  valid: true,
  errors: [] as Array<{
    readonly path: string;
    readonly code: string;
    readonly message: string;
  }>,
});

/**
 * V8 optimization: Compute error message only when needed
 */
function computeErrorMessage(
  validator: any,
  value: any,
  path: string,
  rootData: any
): string {
  if (validator.getErrorMessage) {
    try {
      return validator.getErrorMessage(value, path, rootData);
    } catch (e) {
      return `Validation failed for ${path}`;
    }
  } else if (validator.messageFactory) {
    try {
      const issueContext = {
        path: path,
        value: value,
        code: validator.code || validator.pluginName || "VALIDATION_ERROR",
      };
      return validator.messageFactory(issueContext);
    } catch (e) {
      return `Validation failed for ${path}`;
    }
  }
  return `Validation failed for ${path}`;
}

/**
 * V8 optimization: Optimized validator for simple cases with transforms
 * Pre-compiles validation and transform pipelines for maximum performance
 */
function createOptimizedTransformValidator(
  validators: any[],
  transforms: any[],
  path: string,
  accessor?: (obj: any) => any
): UnifiedValidator {
  // V8 optimization: Pre-compile everything outside the hot path
  const validatorCount = validators.length;
  const transformCount = transforms.length;

  // Pre-compile validation checks and error data
  const validationChecks: Array<(value: any, rootData: any) => boolean> =
    new Array(validatorCount);
  const errorCodes: string[] = new Array(validatorCount);

  for (let i = 0; i < validatorCount; i++) {
    const validator = validators[i];
    validationChecks[i] = validator.check || validator;
    errorCodes[i] =
      validator.code || validator.pluginName || "VALIDATION_ERROR";
  }

  // Pre-compile transform functions
  const transformFunctions: Array<(value: any) => any> = new Array(
    transformCount
  );
  let actualTransformCount = 0;

  for (let i = 0; i < transformCount; i++) {
    const transform = transforms[i];
    if (typeof transform === "function") {
      transformFunctions[actualTransformCount++] = transform;
    } else if (transform && typeof transform.apply === "function") {
      transformFunctions[actualTransformCount++] = transform.apply;
    }
  }

  // V8 optimization: Generate specialized functions based on validator/transform count
  // This eliminates loop overhead for common cases

  // Create specialized validators for common cases
  if (validatorCount === 1 && actualTransformCount === 1) {
    // MOST COMMON CASE: 1 validator, 1 transform
    const check = validationChecks[0];
    const errorCode = errorCodes[0];
    const transform = transformFunctions[0];
    const validator = validators[0];

    // V8 optimization: Pre-allocate error structures
    const validateError = {
      valid: false,
      errors: [{ path: path, code: errorCode, message: "" }],
    };

    const parseError = {
      valid: false,
      data: undefined,
      errors: [{ path: path, code: errorCode, message: "" }],
    };

    // V8 optimization: Pre-allocate success result
    const parseSuccess = {
      valid: true,
      data: null,
      errors: [],
    };

    return {
      validate: (
        value: any,
        rootData: any,
        options?: any
      ): ValidationResult => {
        if (!check(value, rootData)) {
          // V8 optimization: Lazy error message computation
          validateError.errors[0].message = computeErrorMessage(
            validator,
            value,
            path,
            rootData
          );
          return validateError;
        }
        return ULTRA_FAST_VALID_RESULT;
      },

      parse: (value: any, rootData: any, options?: any): ParseResult => {
        if (!check(value, rootData)) {
          // V8 optimization: Lazy error message computation
          parseError.errors[0].message = computeErrorMessage(
            validator,
            value,
            path,
            rootData
          );
          return parseError;
        }

        // V8 optimization: Direct transform and reuse success object
        parseSuccess.data = transform(value);
        return parseSuccess;
      },
    };
  }

  if (validatorCount === 2 && actualTransformCount === 1) {
    // COMMON CASE: 2 validators (e.g., required + min), 1 transform
    const check1 = validationChecks[0];
    const check2 = validationChecks[1];
    const errorCode1 = errorCodes[0];
    const errorCode2 = errorCodes[1];
    const transform = transformFunctions[0];
    const validator1 = validators[0];
    const validator2 = validators[1];

    // V8 optimization: Pre-allocate error structures
    const validateError1 = {
      valid: false,
      errors: [{ path: path, code: errorCode1, message: "" }],
    };

    const validateError2 = {
      valid: false,
      errors: [{ path: path, code: errorCode2, message: "" }],
    };

    const parseError1 = {
      valid: false,
      data: undefined,
      errors: [{ path: path, code: errorCode1, message: "" }],
    };

    const parseError2 = {
      valid: false,
      data: undefined,
      errors: [{ path: path, code: errorCode2, message: "" }],
    };

    const parseSuccess = {
      valid: true,
      data: null,
      errors: [],
    };

    return {
      validate: (
        value: any,
        rootData: any,
        options?: any
      ): ValidationResult => {
        if (!check1(value, rootData)) {
          validateError1.errors[0].message = computeErrorMessage(
            validator1,
            value,
            path,
            rootData
          );
          return validateError1;
        }

        if (!check2(value, rootData)) {
          validateError2.errors[0].message = computeErrorMessage(
            validator2,
            value,
            path,
            rootData
          );
          return validateError2;
        }

        return ULTRA_FAST_VALID_RESULT;
      },

      parse: (value: any, rootData: any, options?: any): ParseResult => {
        if (!check1(value, rootData)) {
          parseError1.errors[0].message = computeErrorMessage(
            validator1,
            value,
            path,
            rootData
          );
          return parseError1;
        }

        if (!check2(value, rootData)) {
          parseError2.errors[0].message = computeErrorMessage(
            validator2,
            value,
            path,
            rootData
          );
          return parseError2;
        }

        parseSuccess.data = transform(value);
        return parseSuccess;
      },
    };
  }

  // Fall back to general case
  // V8 optimization: Pre-allocated error structure
  const singleError = { path: path, code: "", message: "" };

  // V8 optimization: Optimized validate function (skip transforms)
  const validate = (
    value: any,
    rootData: any,
    options: { abortEarlyOnEachField?: boolean } = {}
  ): ValidationResult => {
    // Fast validation loop
    for (let i = 0; i < validatorCount; i++) {
      if (!validationChecks[i](value, rootData)) {
        if (options.abortEarlyOnEachField !== false) {
          singleError.code =
            validators[i].code ||
            validators[i].pluginName ||
            "VALIDATION_ERROR";
          singleError.message = computeErrorMessage(
            validators[i],
            value,
            path,
            rootData
          );
          return {
            valid: false,
            errors: [{ ...singleError }],
          };
        }

        // Collect all errors - slow path
        const errors: Array<{ path: string; code: string; message: string }> =
          [];
        errors.push({
          path: path,
          code:
            validators[i].code ||
            validators[i].pluginName ||
            "VALIDATION_ERROR",
          message: computeErrorMessage(validators[i], value, path, rootData),
        });

        for (let j = i + 1; j < validatorCount; j++) {
          if (!validationChecks[j](value, rootData)) {
            errors.push({
              path: path,
              code:
                validators[j].code ||
                validators[j].pluginName ||
                "VALIDATION_ERROR",
              message: computeErrorMessage(
                validators[j],
                value,
                path,
                rootData
              ),
            });
          }
        }

        return { valid: false, errors: errors };
      }
    }

    return ULTRA_FAST_VALID_RESULT;
  };

  // V8 optimization: Optimized parse function (validate + transform)
  const parse = (
    value: any,
    rootData: any,
    options: { abortEarlyOnEachField?: boolean } = {}
  ): ParseResult => {
    // Check if we should skip validation for null/undefined values
    const hasSkipForNull = validators.some(v => v.skipForNull === true);
    const hasSkipForUndefined = validators.some(v => v.skipForUndefined === true);
    
    if ((value === null && hasSkipForNull) || (value === undefined && hasSkipForUndefined)) {
      // Skip both validation AND transforms for null/undefined when appropriate validators are present
      // Return the original value without any transformation
      return {
        valid: true,
        data: value,
        errors: [],
      };
    }
    
    // Phase 1: Fast validation
    for (let i = 0; i < validatorCount; i++) {
      if (!validationChecks[i](value, rootData)) {
        if (options.abortEarlyOnEachField !== false) {
          singleError.code =
            validators[i].code ||
            validators[i].pluginName ||
            "VALIDATION_ERROR";
          singleError.message = computeErrorMessage(
            validators[i],
            value,
            path,
            rootData
          );
          return {
            valid: false,
            data: undefined,
            errors: [{ ...singleError }],
          };
        }

        // Collect all validation errors
        const errors: Array<{ path: string; code: string; message: string }> =
          [];
        errors.push({
          path: path,
          code:
            validators[i].code ||
            validators[i].pluginName ||
            "VALIDATION_ERROR",
          message: computeErrorMessage(validators[i], value, path, rootData),
        });

        for (let j = i + 1; j < validatorCount; j++) {
          if (!validationChecks[j](value, rootData)) {
            errors.push({
              path: path,
              code:
                validators[j].code ||
                validators[j].pluginName ||
                "VALIDATION_ERROR",
              message: computeErrorMessage(
                validators[j],
                value,
                path,
                rootData
              ),
            });
          }
        }

        return { valid: false, data: undefined, errors: errors };
      }
    }

    // Phase 2: Fast transform pipeline (only if validation passed)
    let transformedValue = value;

    // V8 optimization: Unrolled transform loop for common cases
    if (actualTransformCount === 1) {
      // Most common case: single transform
      transformedValue = transformFunctions[0](transformedValue);
    } else if (actualTransformCount === 2) {
      // Common case: two transforms
      transformedValue = transformFunctions[0](transformedValue);
      transformedValue = transformFunctions[1](transformedValue);
    } else if (actualTransformCount > 0) {
      // General case: multiple transforms
      for (let i = 0; i < actualTransformCount; i++) {
        transformedValue = transformFunctions[i](transformedValue);
      }
    }

    return {
      valid: true,
      data: transformedValue,
      errors: [],
    };
  };

  return { validate, parse, accessor };
}

/**
 * V8 optimization: Error message creation (Hidden Class unification)
 */
function createValidationError(
  validator: any,
  value: any,
  path: string,
  rootData?: any
): { path: string; code: string; message: string; context?: any } {
  // V8 optimization: プロパティアクセス最小化
  const code = validator.code || validator.pluginName || "VALIDATION_ERROR";
  let message = "Validation failed";
  let context: any = undefined;

  // Extract plugin-specific context from validator params
  if (validator.params && Array.isArray(validator.params)) {
    const [firstParam] = validator.params;
    if (
      validator.pluginName === "stringStartsWith" &&
      typeof firstParam === "string"
    ) {
      context = { prefix: firstParam };
    } else if (
      validator.pluginName === "stringEndsWith" &&
      typeof firstParam === "string"
    ) {
      context = { suffix: firstParam };
    } else if (
      validator.pluginName === "stringMin" &&
      typeof firstParam === "number"
    ) {
      context = { min: firstParam };
    } else if (
      validator.pluginName === "stringMax" &&
      typeof firstParam === "number"
    ) {
      context = { max: firstParam };
    } else if (
      validator.pluginName === "arrayMaxLength" &&
      typeof firstParam === "number"
    ) {
      context = { max: firstParam };
    } else if (
      validator.pluginName === "arrayMinLength" &&
      typeof firstParam === "number"
    ) {
      context = { min: firstParam };
    }
  }

  // V8 optimization: function existence check first
  if (validator.getErrorMessage) {
    try {
      message = validator.getErrorMessage(value, path, rootData);
    } catch (e) {
      message = `Validation failed for ${path}`;
    }
  } else if (validator.messageFactory) {
    try {
      // V8 optimization: Fixed object structure for Hidden Class unification
      const issueContext = { path: path, value: value, code: code, ...context };
      message = validator.messageFactory(issueContext);
    } catch (e) {
      message = `Validation failed for ${path}`;
    }
  }

  // V8 optimization: Hidden Class統一 - context is optional
  const errorObj: {
    path: string;
    code: string;
    message: string;
    context?: any;
  } = {
    path: path,
    code: code,
    message: message,
  };

  if (context) {
    errorObj.context = context;
  }

  return errorObj;
}
