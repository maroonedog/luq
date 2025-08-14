/**
 * Enhanced Nested Array Processor
 *
 * Supports complete nested array validation with accurate error paths.
 * This module handles arrays at any depth level with proper index tracking.
 */

import { ValidationMode, VALIDATE_MODE, PARSE_MODE } from "../../constants";
import {
  createAccessor as createFieldAccessor,
  createFieldSetter,
} from "../plugin/utils/field-accessor";

/**
 * Parse array element path pattern and extract array path and element field
 * Examples:
 * - "items[*].name" => { arrayPath: "items", elementField: "name" }
 * - "items.*.name" => { arrayPath: "items", elementField: "name" }
 * - "users[*].addresses[*].street" => { arrayPath: "users", elementField: "addresses[*].street" }
 */
export function parseArrayElementPath(path: string): {
  isArrayElementPath: boolean;
  arrayPath?: string;
  elementField?: string;
} {
  // Check for multi-dimensional array patterns (consecutive [*] without dots)
  // Pattern: matrix[*][*][*] -> arrayPath: "matrix[*][*]", elementField: ""
  const multiDimMatch = path.match(/^(.+\[\*\])\[\*\]$/);
  if (multiDimMatch) {
    return {
      isArrayElementPath: true,
      arrayPath: multiDimMatch[1],
      elementField: "",
    };
  }

  // Check for complex nested array patterns with arbitrary depth
  // Pattern: any number of [*]. segments followed by optional final field
  // Examples: "orders[*].items[*].productId", "departments[*].teams[*].projects[*].title"
  const complexNestedMatch = path.match(/^(.+?)(\[\*\]\.(.+))?$/);
  if (complexNestedMatch && path.includes('[*].')) {
    // Split the path into segments at [*]. boundaries
    const segments = path.split(/\[\*\]\./);
    
    if (segments.length >= 2) {
      // The last segment is the final field (or empty for direct array access)
      const finalSegment = segments[segments.length - 1];
      
      // Check if the final segment itself contains [*] (for direct array access patterns)
      if (finalSegment.includes('[*]')) {
        // This is a direct array access pattern like "departments[*].teams[*]"
        // Remove the [*] from the final segment to build the array path
        const cleanFinalSegment = finalSegment.replace(/\[\*\]$/, '');
        const arrayPathSegments = segments.slice(0, -1).concat(cleanFinalSegment);
        
        return {
          isArrayElementPath: true,
          arrayPath: arrayPathSegments.join('.'),
          elementField: "",
        };
      } else {
        // This is a field access pattern like "departments[*].teams[*].projects[*].title"
        // Build the array path from all segments except the last one
        const arrayPathSegments = segments.slice(0, -1);
        
        return {
          isArrayElementPath: true,
          arrayPath: arrayPathSegments.join('.'),
          elementField: finalSegment,
        };
      }
    }
  }

  // Check for [*] pattern with field
  const bracketMatch = path.match(/^([^\[]+)\[\*\]\.(.+)$/);
  if (bracketMatch) {
    return {
      isArrayElementPath: true,
      arrayPath: bracketMatch[1],
      elementField: bracketMatch[2],
    };
  }

  // Check for direct [*] pattern (no field after)
  const directBracketMatch = path.match(/^([^\[]+)\[\*\]$/);
  if (directBracketMatch) {
    return {
      isArrayElementPath: true,
      arrayPath: directBracketMatch[1],
      elementField: "",
    };
  }

  // Check for .* pattern
  const dotMatch = path.match(/^([^\.]+)\.\*\.(.+)$/);
  if (dotMatch) {
    return {
      isArrayElementPath: true,
      arrayPath: dotMatch[1],
      elementField: dotMatch[2],
    };
  }

  return { isArrayElementPath: false };
}

export interface NestedArrayBatchInfo {
  arrayPath: string; // e.g., "departments", "departments.teams"
  elementFields: string[]; // Direct element fields only, e.g., ["name", "id"]
  fullFieldPaths: string[]; // All paths including nested, e.g., ["departments.name", "departments.teams.name"]
  validators: Map<string, any>; // validators for each full field path
  accessors: Map<string, (obj: any) => any>; // element field -> accessor function
  childArrays: Map<string, NestedArrayBatchInfo>; // nested arrays within this array
  depth: number; // nesting depth (0 = top level)
  parentPath?: string; // parent array path if this is nested
}

/**
 * Build hierarchical array structure from field definitions
 */
export function buildNestedArrayHierarchy(
  fieldDefinitions: Array<{
    path: string;
    isArrayField?: boolean;
    builderFunction?: (context: any) => any;
  }>
): Map<string, NestedArrayBatchInfo> {
  // First, process array element paths and convert them to array field markers
  const processedDefinitions: Array<{
    path: string;
    isArrayField?: boolean;
    originalPath?: string;
    builderFunction?: (context: any) => any;
  }> = [];

  const arrayPaths = new Set<string>();

  // Identify array paths from element paths
  for (const fd of fieldDefinitions) {
    const parsed = parseArrayElementPath(fd.path);
    if (parsed.isArrayElementPath && parsed.arrayPath) {
      arrayPaths.add(parsed.arrayPath);
      
      // Check if the elementField contains nested array patterns
      if (parsed.elementField && parsed.elementField.includes('[*]')) {
        // This is a nested array pattern like "items[*].productId"
        // We need to create an additional array field for the nested array
        const nestedArrayPath = `${parsed.arrayPath}.${parsed.elementField.split('[*]')[0]}`;
        arrayPaths.add(nestedArrayPath);
      }
      
      processedDefinitions.push({
        ...fd,
        originalPath: fd.path,
      });
    } else {
      processedDefinitions.push(fd);
    }
  }

  // Add array field markers for identified array paths
  for (const arrayPath of arrayPaths) {
    if (
      !processedDefinitions.some(
        (fd) => fd.path === arrayPath && fd.isArrayField
      )
    ) {
      processedDefinitions.push({
        path: arrayPath,
        isArrayField: true,
      });
    }
  }

  // Additional processing: ensure nested arrays are properly marked
  // Look for array patterns in element fields and create explicit array field markers
  const additionalNestedArrays = new Set<string>();
  for (const fd of processedDefinitions) {
    if (fd.originalPath) {
      const parsed = parseArrayElementPath(fd.originalPath);
      if (parsed.isArrayElementPath && parsed.elementField && parsed.elementField.includes('[*]')) {
        // This elementField contains a nested array pattern
        const baseElementField = parsed.elementField.split('[*]')[0];
        const nestedArrayFullPath = `${parsed.arrayPath}.${baseElementField}`;
        if (!additionalNestedArrays.has(nestedArrayFullPath) && 
            !processedDefinitions.some(d => d.path === nestedArrayFullPath && d.isArrayField)) {
          additionalNestedArrays.add(nestedArrayFullPath);
        }
      }
    }
  }

  // Add the additional nested arrays as explicit array fields
  for (const nestedArrayPath of additionalNestedArrays) {
    processedDefinitions.push({
      path: nestedArrayPath,
      isArrayField: true,
    });
  }

  // Find all array fields (but exclude array element patterns like "orders[*].items")
  const arrayFields = processedDefinitions.filter((fd) => {
    if (!fd.isArrayField) return false;
    
    // For multi-dimensional arrays, we need to distinguish between:
    // 1. Array field paths like "matrix[*]" (represent sub-arrays - KEEP)
    // 2. Array element validation paths like "matrix[*][*]" or "orders[*].name" (validate elements - EXCLUDE)
    
    // If path contains [*], check if it's a multi-dimensional array field vs element validation
    if (fd.path.includes('[*]')) {
      // Check if this is a direct multi-dimensional array pattern (ends with [*])
      if (fd.path.match(/\[\*\]$/)) {
        // This is a multi-dimensional array field like "matrix[*]" or "cube[*][*]"
        // These should be included as array fields
        return true;
      }
      
      // This is an element validation pattern like "orders[*].name" - exclude
      return false;
    }
    
    return true;
  });

  // Sort by depth to process from top level down
  arrayFields.sort((a, b) => {
    const depthA = a.path.split(".").length;
    const depthB = b.path.split(".").length;
    return depthA - depthB; // Shallowest first
  });

  const arrayHierarchy = new Map<string, NestedArrayBatchInfo>();

  // Build hierarchy
  for (const arrayField of arrayFields) {
    const arrayPath = arrayField.path;
    const depth = arrayPath.split(".").length - 1;

    // Find parent array if this is nested
    let parentPath: string | undefined;
    for (const existingPath of arrayHierarchy.keys()) {
      // Handle regular nested paths with dots (like "orders.items")
      if (arrayPath.startsWith(existingPath + ".")) {
        if (!parentPath || existingPath.length > parentPath.length) {
          parentPath = existingPath;
        }
      }
      // Handle multi-dimensional array paths (like "matrix[*]" having parent "matrix")
      else if (arrayPath.startsWith(existingPath + "[*]") && existingPath !== arrayPath) {
        if (!parentPath || existingPath.length > parentPath.length) {
          parentPath = existingPath;
        }
      }
    }

    // Find all fields that belong to this array
    const allRelatedFields = processedDefinitions.filter((fd) => {
      // Check original path if it exists (for array element paths)
      const pathToCheck = fd.originalPath || fd.path;
      const parsed = parseArrayElementPath(pathToCheck);
      if (parsed.isArrayElementPath && parsed.arrayPath === arrayPath) {
        return true;
      }
      return pathToCheck.startsWith(arrayPath + ".");
    });

    // Skip array fields that have no related element fields
    // These should be processed as regular fields, not through array batching
    if (allRelatedFields.length === 0) {
      continue;
    }

    // Separate direct element fields from nested array fields
    const elementFields: string[] = [];
    const fullFieldPaths: string[] = [];

    for (const field of allRelatedFields) {
      const pathToCheck = field.originalPath || field.path;
      const parsed = parseArrayElementPath(pathToCheck);

      let relativePath: string;
      if (
        parsed.isArrayElementPath &&
        parsed.arrayPath === arrayPath &&
        parsed.elementField !== undefined
      ) {
        relativePath = parsed.elementField;
      } else {
        relativePath = pathToCheck.substring(arrayPath.length + 1);
      }

      // Check if this field belongs to a nested array
      const belongsToNestedArray = arrayFields.some(
        (af) =>
          af.path !== arrayPath &&
          af.path.startsWith(arrayPath + ".") &&
          field.path.startsWith(af.path + ".")
      );

      if (!belongsToNestedArray) {
        // This is a direct element field
        elementFields.push(relativePath);
      }

      // Only add to fullFieldPaths if this field has a validator (not array field markers)
      if (!field.isArrayField) {
        fullFieldPaths.push(field.originalPath || field.path);
      }
    }

    // Create accessors for direct element fields
    const accessors = new Map<string, (obj: any) => any>();
    for (const elementField of elementFields) {
      const segments = elementField.split(".");
      accessors.set(elementField, createFieldAccessor(segments));
    }

    const batchInfo: NestedArrayBatchInfo = {
      arrayPath,
      elementFields,
      fullFieldPaths,
      validators: new Map(),
      accessors,
      childArrays: new Map(),
      depth,
      parentPath,
    };

    arrayHierarchy.set(arrayPath, batchInfo);
  }

  // Link child arrays to their parents
  for (const [arrayPath, batchInfo] of arrayHierarchy) {
    if (batchInfo.parentPath) {
      const parent = arrayHierarchy.get(batchInfo.parentPath);
      if (parent) {
        // Calculate child key properly for both dot-separated and multi-dimensional arrays
        let childKey: string;
        if (arrayPath.startsWith(batchInfo.parentPath + ".")) {
          // Regular nested path like "orders.items" -> child key is "items"
          childKey = arrayPath.substring(batchInfo.parentPath.length + 1);
        } else if (arrayPath.startsWith(batchInfo.parentPath + "[*]")) {
          // Multi-dimensional array like "matrix[*]" -> child key is "[*]"
          childKey = arrayPath.substring(batchInfo.parentPath.length);
        } else {
          // Fallback
          childKey = arrayPath.substring(batchInfo.parentPath.length + 1);
        }
        parent.childArrays.set(childKey, batchInfo);
      }
    }
  }

  return arrayHierarchy;
}

/**
 * Create hierarchical nested array validator
 */
export function createNestedArrayValidator(
  nestedBatchInfo: NestedArrayBatchInfo,
  fieldValidators: Map<string, any>
): (
  arrayData: any[],
  rootData: any,
  abortEarly: boolean,
  abortEarlyOnEachField: boolean,
  mode: ValidationMode,
  parentPath?: string
) => NestedValidationResult {
  // Populate validators map for this level (if not already pre-populated)
  // The array batch optimizer may have already populated this with all collected validators
  if (nestedBatchInfo.validators.size === 0) {
    for (const fullPath of nestedBatchInfo.fullFieldPaths) {
      const validator = fieldValidators.get(fullPath);
      if (validator) {
        nestedBatchInfo.validators.set(fullPath, validator);
      }
    }
  }

  return function processNestedArray(
    arrayData: any[],
    rootData: any,
    abortEarly: boolean,
    abortEarlyOnEachField: boolean = true,
    mode: ValidationMode = VALIDATE_MODE,
    parentPath: string = ""
  ): NestedValidationResult {
    const errors: NestedError[] = [];
    const transformedArray = mode === PARSE_MODE ? [...arrayData] : undefined;
    const effectiveAbortEarlyOnEachField = false; // Always validate all fields in array elements

    if (!Array.isArray(arrayData)) {
      return { errors, transformedData: transformedArray };
    }

    // Process each array element
    for (
      let elementIndex = 0;
      elementIndex < arrayData.length;
      elementIndex++
    ) {
      const element = arrayData[elementIndex];
      let transformedElement = mode === PARSE_MODE ? (typeof element === 'object' && element !== null ? { ...element } : element) : undefined;
      let elementHasError = false;

      // Build current element path
      const currentElementPath = parentPath
        ? `${parentPath}[${elementIndex}]`
        : `${nestedBatchInfo.arrayPath}[${elementIndex}]`;

      // Validate direct element fields
      for (const elementField of nestedBatchInfo.elementFields) {
        // Handle special case where elementField is empty (direct array element validation)
        if (elementField === "") {
          // Direct element validation (e.g., matrix[*] validates each element)
          // For nested arrays, we need to find the validator by checking the full field paths
          // since the validator is stored with the original pattern (e.g., "users[*].tags[*]")
          // not the derived pattern (e.g., "users.tags[*]")
          let validator = null;
          
          // Try the constructed path first (works for multi-dimensional arrays)
          const arrayElementPath = `${nestedBatchInfo.arrayPath}[*]`;
          validator = nestedBatchInfo.validators.get(arrayElementPath);
          
          // If not found, look for validators in fullFieldPaths (works for nested object arrays)
          if (!validator) {
            for (const fullPath of nestedBatchInfo.fullFieldPaths) {
              const candidateValidator = nestedBatchInfo.validators.get(fullPath);
              if (candidateValidator) {
                validator = candidateValidator;
                break; // Use the first validator found
              }
            }
          }
          
          if (!validator) continue;

          const elementValue = transformedElement || element;
          const elementFieldPath = currentElementPath;

          // Validate the array element itself
          let result: any;
          if (mode === VALIDATE_MODE) {
            if (validator.validate) {
              result = validator.validate(elementValue, rootData, {
                abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
              });
            } else if (validator.validateSlow) {
              result = validator.validateSlow(elementValue, rootData, {
                abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
              });
            } else if (validator.validateFast) {
              result = validator.validateFast(elementValue, rootData);
            } else {
              continue;
            }
          } else if (mode === PARSE_MODE) {
            if (validator.parse) {
              result = validator.parse(elementValue, rootData, {
                abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
              });
            } else if (validator.parseSlow) {
              result = validator.parseSlow(elementValue, rootData, {
                abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
              });
            } else if (validator.parseFast) {
              result = validator.parseFast(elementValue, rootData);
            } else {
              continue;
            }
          } else {
            continue;
          }

          if (!result.valid) {
            elementHasError = true;
            if (result.errors && result.errors.length > 0) {
              for (const error of result.errors) {
                errors.push({
                  path: elementFieldPath,
                  code:
                    error.code ||
                    (mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR"),
                  message:
                    error.message ||
                    (mode === PARSE_MODE ? "Parse failed" : "Validation failed"),
                  paths: () => [elementFieldPath],
                });
              }
            } else {
              errors.push({
                path: elementFieldPath,
                code: mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR",
                message:
                  mode === PARSE_MODE ? "Parse failed" : "Validation failed",
                paths: () => [elementFieldPath],
              });
            }

            if (effectiveAbortEarlyOnEachField) {
              break;
            }
          } else if (
            mode === PARSE_MODE &&
            result.data !== undefined
          ) {
            // For direct element validation, replace the entire element
            if (transformedArray) {
              transformedArray[elementIndex] = result.data;
            }
          }
          continue; // Skip the regular field validation logic below
        }

        // Regular field validation within elements
        const fullFieldPath = `${nestedBatchInfo.arrayPath}.${elementField}`;

        // Check if we have a validator for the array element path pattern
        const arrayElementPath = `${nestedBatchInfo.arrayPath}[*].${elementField}`;
        const dotArrayElementPath = `${nestedBatchInfo.arrayPath}.*.${elementField}`;

        let validator = nestedBatchInfo.validators.get(fullFieldPath);
        if (!validator) {
          validator = nestedBatchInfo.validators.get(arrayElementPath);
        }
        if (!validator) {
          validator = nestedBatchInfo.validators.get(dotArrayElementPath);
        }
        
        // If still not found, search through fullFieldPaths (for nested object arrays)
        if (!validator) {
          for (const fullPath of nestedBatchInfo.fullFieldPaths) {
            // Check if this fullPath matches the current elementField
            const candidateValidator = nestedBatchInfo.validators.get(fullPath);
            if (candidateValidator && fullPath.includes(elementField)) {
              validator = candidateValidator;
              break;
            }
          }
        }

        if (!validator) continue;

        // Use pre-compiled accessor
        const accessor = nestedBatchInfo.accessors.get(elementField);
        const elementValue = accessor
          ? accessor(transformedElement || element)
          : undefined;
        const elementFieldPath = `${currentElementPath}.${elementField}`;

        // Validate the field
        let result: any;
        if (mode === VALIDATE_MODE) {
          if (validator.validate) {
            // Use unified validator interface
            result = validator.validate(elementValue, rootData, {
              abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
            });
          } else if (validator.validateSlow) {
            result = validator.validateSlow(elementValue, rootData, {
              abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
            });
          } else if (validator.validateFast) {
            result = validator.validateFast(elementValue, rootData);
          } else {
            continue;
          }
        } else if (mode === PARSE_MODE) {
          if (validator.parse) {
            // Use unified validator interface
            result = validator.parse(elementValue, rootData, {
              abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
            });
          } else if (validator.parseSlow) {
            result = validator.parseSlow(elementValue, rootData, {
              abortEarlyOnEachField: effectiveAbortEarlyOnEachField,
            });
          } else if (validator.parseFast) {
            result = validator.parseFast(elementValue, rootData);
          } else {
            continue;
          }
        } else {
          continue;
        }

        if (!result.valid) {
          elementHasError = true;
          if (result.errors && result.errors.length > 0) {
            for (const error of result.errors) {
              errors.push({
                path: elementFieldPath,
                code:
                  error.code ||
                  (mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR"),
                message:
                  error.message ||
                  (mode === PARSE_MODE ? "Parse failed" : "Validation failed"),
                paths: () => [elementFieldPath],
              });
            }
          } else {
            errors.push({
              path: elementFieldPath,
              code: mode === PARSE_MODE ? "PARSE_ERROR" : "VALIDATION_ERROR",
              message:
                mode === PARSE_MODE ? "Parse failed" : "Validation failed",
              paths: () => [elementFieldPath],
            });
          }

          if (effectiveAbortEarlyOnEachField) {
            break;
          }
        } else if (
          mode === PARSE_MODE &&
          result.data !== undefined &&
          transformedElement
        ) {
          setNestedValue(transformedElement, elementField, result.data);
        }
      }

      // Process nested arrays within this element
      for (const [
        childArrayKey,
        childBatchInfo,
      ] of nestedBatchInfo.childArrays) {
        let childArrayData: any;
        let childPath: string;
        
        // Handle multi-dimensional array patterns vs nested object arrays
        if (childArrayKey.startsWith("[*]")) {
          // Multi-dimensional array: the element itself is the child array
          // e.g., for matrix[*], each element is a sub-array like [1, 2, 3]
          childArrayData = transformedElement || element;
          childPath = currentElementPath; // Use current element path directly
        } else {
          // Regular nested object array: access the child array as a property
          // e.g., for users[*].addresses, access element.addresses
          childArrayData = transformedElement?.[childArrayKey] || element[childArrayKey];
          childPath = `${currentElementPath}.${childArrayKey}`;
        }

        if (Array.isArray(childArrayData)) {
          const childValidator = createNestedArrayValidator(
            childBatchInfo,
            fieldValidators
          );
          const childResult = childValidator(
            childArrayData,
            rootData,
            abortEarly,
            abortEarlyOnEachField,
            mode,
            childPath
          );

          if (childResult.errors.length > 0) {
            errors.push(...childResult.errors);
            elementHasError = true;
          }

          if (
            mode === PARSE_MODE &&
            childResult.transformedData &&
            transformedElement
          ) {
            transformedElement[childArrayKey] = childResult.transformedData;
          }
        }
      }

      // Only update the transformed array if we haven't already set it via direct element validation
      if (mode === PARSE_MODE && transformedArray && transformedElement && typeof transformedElement === 'object') {
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

// Type definitions
interface NestedError {
  path: string;
  code: string;
  message: string;
  paths: () => string[];
}

interface NestedValidationResult {
  errors: NestedError[];
  transformedData?: any[];
}
