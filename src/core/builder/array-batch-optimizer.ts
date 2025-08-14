/**
 * Array Batch Processing Optimizer
 *
 * Optimizes validation by batching array element fields:
 * Instead of accessing the same array multiple times for different element properties,
 * we access the array once and validate all element properties in batch.
 *
 * Example:
 * - customer.addresses.type
 * - customer.addresses.name
 * - customer.addresses.street
 *
 * Instead of 3 separate array accesses, we do:
 * 1. Get customer.addresses array once
 * 2. For each address element, validate type, name, street together
 */

import { ValidationMode, VALIDATE_MODE, PARSE_MODE } from "../../constants";
import { createFieldSetter } from "../plugin/utils/field-accessor";
import { ArrayStructureInfo } from "../../types/array-type-analysis";
import {
  buildNestedArrayHierarchy,
  createNestedArrayValidator,
  NestedArrayBatchInfo,
} from "./nested-array-processor";

export interface ArrayBatchInfo {
  arrayPath: string; // e.g., "customer.addresses"
  elementFields: string[]; // e.g., ["type", "name", "street"]
  fullFieldPaths: string[]; // e.g., ["customer.addresses.type", "customer.addresses.name", "customer.addresses.street"]
  validators: Map<string, any>; // validators for each full field path
  // Pre-compiled accessors for performance
  accessors: Map<string, (obj: any) => any>; // element field -> accessor function
  // Multi-dimensional array support
  arrayStructure?: ArrayStructureInfo; // Build-time analyzed array structure
  optimizedValidator?: (
    array: any,
    rootData: any,
    options: any
  ) => ValidationResult; // Generated validator for deep arrays
  // Enhanced nested array support
  _nestedInfo?: NestedArrayBatchInfo; // Internal: enhanced nested processing info
}

// Validation result for multi-dimensional arrays
interface ValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    code: string;
    message: string;
    paths: () => string[];
  }>;
  transformedData?: any;
}

/**
 * Enhanced nested array processing using new hierarchical approach
 * Converts legacy ArrayBatchInfo to new NestedArrayBatchInfo format
 */
function findNestedArrays(
  fieldDefinitions: FieldDefinitionWithArray[]
): Map<string, ArrayBatchInfo> {
  // Use the new hierarchical approach
  const nestedHierarchy = buildNestedArrayHierarchy(fieldDefinitions);

  // Convert to legacy format for backward compatibility
  // Only include top-level arrays to avoid duplicates
  const arrayBatches = new Map<string, ArrayBatchInfo>();

  for (const [arrayPath, nestedInfo] of nestedHierarchy) {
    // Only include top-level arrays (no parent)
    if (!nestedInfo.parentPath) {
      // Collect ALL validators from the entire hierarchy tree (parent + all children)
      const allValidatorPaths = collectAllValidatorPaths(nestedInfo, nestedHierarchy);
      
      // Convert NestedArrayBatchInfo to ArrayBatchInfo
      const legacyBatchInfo: ArrayBatchInfo = {
        arrayPath: nestedInfo.arrayPath,
        elementFields: nestedInfo.elementFields,
        fullFieldPaths: allValidatorPaths, // Include all validators from hierarchy
        validators: nestedInfo.validators,
        accessors: nestedInfo.accessors,
        // Store the nested info for enhanced processing
        _nestedInfo: nestedInfo,
      };

      arrayBatches.set(arrayPath, legacyBatchInfo);
    }
  }

  return arrayBatches;
}

/**
 * Recursively collect all validator paths from nested array hierarchy
 */
function collectAllValidatorPaths(
  rootInfo: NestedArrayBatchInfo,
  hierarchy: Map<string, NestedArrayBatchInfo>
): string[] {
  const allPaths: string[] = [];
  
  // Add this level's validator paths
  allPaths.push(...rootInfo.fullFieldPaths);
  
  // Recursively add child validator paths
  for (const [childKey, childInfo] of rootInfo.childArrays) {
    const childPaths = collectAllValidatorPaths(childInfo, hierarchy);
    allPaths.push(...childPaths);
  }
  
  return allPaths;
}

// This function is no longer needed since we now use explicit isArrayField marking
// instead of heuristic-based detection

/**
 * Field definition with array information
 */
interface FieldDefinitionWithArray {
  path: string;
  builderFunction?: (context: any) => any;
  inferredType?: string;
  isArrayField?: boolean;
}

/**
 * Analyze field paths to identify array batching opportunities
 * Now uses field definitions with array field information
 */
export function analyzeArrayBatching(
  fieldDefinitions: FieldDefinitionWithArray[]
): Map<string, ArrayBatchInfo> {
  // Use the new approach based on explicit isArrayField marking
  return findNestedArrays(fieldDefinitions);
}

/**
 * Create optimized batch validator for array processing
 */
export function createArrayBatchValidator(
  batchInfo: ArrayBatchInfo,
  fieldValidators: Map<string, any>
): (
  arrayData: any[],
  rootData: any,
  abortEarly: boolean,
  abortEarlyOnEachField: boolean,
  mode?: ValidationMode
) => {
  errors: Array<{
    path: string;
    code: string;
    message: string;
    paths: () => string[];
  }>;
  transformedData?: any[];
} {
  // Check if we have enhanced nested info
  if (batchInfo._nestedInfo) {
    // CRITICAL FIX: Pre-populate the nested info validators with all collected validators
    // The _nestedInfo.fullFieldPaths only contains direct fields, but we need ALL validators
    // including those from child arrays (collected in batchInfo.fullFieldPaths)
    for (const fullPath of batchInfo.fullFieldPaths) {
      const validator = fieldValidators.get(fullPath);
      if (validator) {
        batchInfo._nestedInfo.validators.set(fullPath, validator);
      }
    }
    
    // Use the new nested array processor
    const nestedValidator = createNestedArrayValidator(
      batchInfo._nestedInfo,
      fieldValidators
    );

    return function enhancedBatchProcess(
      arrayData: any[],
      rootData: any,
      abortEarly: boolean,
      abortEarlyOnEachField: boolean = true,
      mode: ValidationMode = VALIDATE_MODE
    ): {
      errors: Array<{
        path: string;
        code: string;
        message: string;
        paths: () => string[];
      }>;
      transformedData?: any[];
    } {
      const result = nestedValidator(
        arrayData,
        rootData,
        abortEarly,
        abortEarlyOnEachField,
        mode
      );

      return {
        errors: result.errors,
        transformedData: result.transformedData,
      };
    };
  }

  // Fall back to legacy processing for backwards compatibility
  // Populate validators map
  for (const fullPath of batchInfo.fullFieldPaths) {
    const validator = fieldValidators.get(fullPath);
    if (validator) {
      batchInfo.validators.set(fullPath, validator);
    }
  }

  return function legacyBatchProcess(
    arrayData: any[],
    rootData: any,
    abortEarly: boolean,
    abortEarlyOnEachField: boolean = true,
    mode: ValidationMode = VALIDATE_MODE
  ): {
    errors: Array<{
      path: string;
      code: string;
      message: string;
      paths: () => string[];
    }>;
    transformedData?: any[];
  } {
    // For array element validation, we want to check all fields of each element
    // Override abortEarlyOnEachField to false for array batch processing
    const effectiveAbortEarlyOnEachField = false;

    // Use optimized multi-dimensional validator if available
    if (batchInfo.optimizedValidator && (batchInfo.arrayStructure?.depth ?? 0) > 1) {
      const result = batchInfo.optimizedValidator(arrayData, rootData, {
        abortEarly,
        abortEarlyOnEachField,
        mode,
      });
      return {
        errors: result.errors,
        transformedData: result.transformedData,
      };
    }

    // Fall back to traditional single-level array processing
    const errors: Array<{
      path: string;
      code: string;
      message: string;
      paths: () => string[];
    }> = [];

    if (!Array.isArray(arrayData)) {
      return { errors }; // Not an array, skip
    }

    // Skip element validation if array is empty
    // Only the array-level validators (like minLength) should run
    if (arrayData.length === 0) {
      return { errors };
    }

    const transformedArray = mode === PARSE_MODE ? [...arrayData] : undefined;

    // Process each array element
    for (
      let elementIndex = 0;
      elementIndex < arrayData.length;
      elementIndex++
    ) {
      const element = arrayData[elementIndex];
      let transformedElement = mode === PARSE_MODE ? { ...element } : undefined;
      let elementHasError = false;

      // Validate all element properties in batch
      for (const elementField of batchInfo.elementFields) {
        const fullFieldPath = `${batchInfo.arrayPath}.${elementField}`;
        const validator = batchInfo.validators.get(fullFieldPath);

        if (!validator) {
          continue;
        }

        // Use pre-compiled accessor
        const accessor = batchInfo.accessors.get(elementField);
        const elementValue = accessor
          ? accessor(transformedElement || element)
          : undefined;
        const elementPath = `${batchInfo.arrayPath}[${elementIndex}].${elementField}`;

        // V8 optimization: Use unified validator interface directly
        let result: any;
        if (mode === VALIDATE_MODE) {
          // Unified validators always have validate method
          result = validator.validate(elementValue, rootData, {
            abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
          });
        } else if (mode === PARSE_MODE) {
          // Unified validators always have parse method
          result = validator.parse(elementValue, rootData, {
            abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
          });
        } else {
          continue;
        }

        if (!result.isValid()) {
          elementHasError = true;
          if (result.errors && result.errors.length > 0) {
            for (const error of result.errors) {
              errors.push({
                path: elementPath,
                code:
                  error.code ||
                  (mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR"),
                message:
                  error.message ||
                  (mode === PARSE_MODE ? "Parse failed" : "Validation failed"),
                paths: () => [elementPath],
              });
            }
          } else {
            errors.push({
              path: elementPath,
              code: mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR",
              message:
                mode === PARSE_MODE ? "Parse failed" : "Validation failed",
              paths: () => [elementPath],
            });
          }

          // Only abort if abortEarlyOnEachField is true
          // This allows us to validate all fields of the current element
          if (effectiveAbortEarlyOnEachField) {
            break; // Break inner loop, but continue with next element
          }
        } else if (
          mode === PARSE_MODE &&
          result.data !== undefined &&
          transformedElement
        ) {
          // Apply transformation using pre-compiled setter
          setNestedValue(transformedElement, elementField, result.data);
        }
      }

      if (mode === PARSE_MODE && transformedArray && transformedElement) {
        transformedArray[elementIndex] = transformedElement;
      }

      // If we found errors in this element and abortEarly is true, stop processing more elements
      if (elementHasError && abortEarly) {
        return { errors, transformedData: transformedArray };
      }
    }

    return { errors, transformedData: transformedArray };
  };
}

/**
 * Set nested value using field-accessor utility
 */
function setNestedValue(obj: any, path: string, value: any): void {
  const setter = createFieldSetter(path);
  setter(obj, value);
}
