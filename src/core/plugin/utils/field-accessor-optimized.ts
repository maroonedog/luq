/**
 * Optimized Field Accessor Utilities
 * 
 * High-performance field access with:
 * - Pre-split path segments cached at build time
 * - No runtime string splitting
 * - Direct property access for common depths
 * - Minimal object allocations
 */

import { DOT } from "../../../constants";

// NOTE: Global caches removed to prevent memory leaks in server environments
// Validators should pre-compile accessors at build time and store them locally

/**
 * Get or cache path segments to avoid runtime splitting
 */
export function getPathSegments(fieldPath: string): readonly string[] {
  // Direct computation without caching
  return Object.freeze(fieldPath.split(DOT));
}

/**
 * Create optimized accessor function for a nested field path
 * V8 Optimization: Generate direct property access code for common depths
 */
export function createAccessor(pathSegments: readonly string[]): (obj: any) => any {
  const length = pathSegments.length;
  
  // Direct returns for common cases
  switch (length) {
    case 0:
      return (obj) => obj;
    case 1:
      const key0 = pathSegments[0];
      return (obj) => obj?.[key0];
    case 2:
      const key1 = pathSegments[0];
      const key2 = pathSegments[1];
      return (obj) => obj?.[key1]?.[key2];
    case 3:
      const k1 = pathSegments[0];
      const k2 = pathSegments[1];
      const k3 = pathSegments[2];
      return (obj) => obj?.[k1]?.[k2]?.[k3];
    case 4:
      const k4_1 = pathSegments[0];
      const k4_2 = pathSegments[1];
      const k4_3 = pathSegments[2];
      const k4_4 = pathSegments[3];
      return (obj) => obj?.[k4_1]?.[k4_2]?.[k4_3]?.[k4_4];
    case 5:
      const k5_1 = pathSegments[0];
      const k5_2 = pathSegments[1];
      const k5_3 = pathSegments[2];
      const k5_4 = pathSegments[3];
      const k5_5 = pathSegments[4];
      return (obj) => obj?.[k5_1]?.[k5_2]?.[k5_3]?.[k5_4]?.[k5_5];
    default:
      // For deeper paths, use optimized loop
      return (obj) => {
        let result = obj;
        for (let i = 0; i < length; i++) {
          result = result?.[pathSegments[i]];
          if (result === undefined) return undefined;
        }
        return result;
      };
  }
}

/**
 * Create accessor from dot-notation field path with caching
 */
export function createFieldAccessor(fieldPath: string): (obj: any) => any {
  // Direct creation without caching
  const segments = getPathSegments(fieldPath);
  return createAccessor(segments);
}

/**
 * Batch create accessors for multiple field paths
 * Pre-allocates array for better performance
 */
export function createBatchAccessors(fieldPaths: readonly string[]): Array<{
  fieldName: string;
  accessor: (obj: any) => any;
}> {
  const length = fieldPaths.length;
  const result = new Array(length);
  
  for (let i = 0; i < length; i++) {
    const fieldPath = fieldPaths[i];
    result[i] = {
      fieldName: fieldPath,
      accessor: createFieldAccessor(fieldPath)
    };
  }
  
  return result;
}

/**
 * Create field setter with caching
 * V8 Optimization: Direct property assignment for common depths
 */
export function createFieldSetter(fieldPath: string): (obj: any, value: any) => void {
  // Direct creation without caching
  const segments = getPathSegments(fieldPath);
  const length = segments.length;
  
  let setter: (obj: any, value: any) => void;
  
  switch (length) {
    case 1:
      const key = segments[0];
      setter = (obj, value) => {
        obj[key] = value;
      };
      break;
    case 2:
      const k1 = segments[0];
      const k2 = segments[1];
      setter = (obj, value) => {
        if (!obj[k1]) obj[k1] = {};
        obj[k1][k2] = value;
      };
      break;
    case 3:
      const k3_1 = segments[0];
      const k3_2 = segments[1];
      const k3_3 = segments[2];
      setter = (obj, value) => {
        if (!obj[k3_1]) obj[k3_1] = {};
        if (!obj[k3_1][k3_2]) obj[k3_1][k3_2] = {};
        obj[k3_1][k3_2][k3_3] = value;
      };
      break;
    default:
      // For deeper paths
      setter = (obj, value) => {
        let current = obj;
        for (let i = 0; i < length - 1; i++) {
          const key = segments[i];
          if (!current[key]) current[key] = {};
          current = current[key];
        }
        current[segments[length - 1]] = value;
      };
  }
  
  return setter;
}

/**
 * Optimized nested value accessor with array support
 * Pre-compiles access patterns for better performance
 */
export function createNestedValueAccessor(
  fieldPath: string
): (obj: Record<string, unknown>) => unknown {
  // Fast path for simple property access
  if (!fieldPath.includes(DOT)) {
    return (obj) => obj[fieldPath];
  }

  const segments = getPathSegments(fieldPath);
  const length = segments.length;

  // Fast path for two-level access
  if (length === 2) {
    const key1 = segments[0];
    const key2 = segments[1];
    return (obj) => {
      const firstValue = obj[key1];

      // Array element validation case
      if (Array.isArray(firstValue)) {
        return firstValue;
      }

      // Standard nested access
      return firstValue != null && typeof firstValue === "object"
        ? (firstValue as Record<string, unknown>)[key2]
        : undefined;
    };
  }

  // Pre-compile for general case
  return (obj) => {
    let current = obj;
    for (let i = 0; i < length; i++) {
      if (current == null || typeof current !== "object") {
        return undefined;
      }

      const part = segments[i];
      const value = (current as Record<string, unknown>)[part];

      // Check if this is an array that needs element validation
      if (Array.isArray(value) && i < length - 1) {
        // Pre-compiled remaining path access
        const remainingSegments = segments.slice(i + 1);
        const remainingLength = remainingSegments.length;
        
        const elementValues = value.map(element => {
          if (element == null || typeof element !== "object") {
            return undefined;
          }
          
          // Fast path for single property
          if (remainingLength === 1) {
            return (element as Record<string, unknown>)[remainingSegments[0]];
          }
          
          // Multiple properties
          let elementCurrent = element;
          for (let j = 0; j < remainingLength; j++) {
            if (elementCurrent == null || typeof elementCurrent !== "object") {
              return undefined;
            }
            elementCurrent = (elementCurrent as Record<string, unknown>)[remainingSegments[j]];
          }
          
          return elementCurrent;
        });
        
        // Return special array marker for validation system
        const arrayPath = segments.slice(0, i + 1).join(DOT);
        return { __isArrayElementField: true, values: elementValues, arrayPath };
      }

      current = value as Record<string, unknown>;
    }

    return current;
  };
}

/**
 * Pre-warm the cache with common field paths
 * @deprecated Caches have been removed to prevent memory leaks
 */
export function prewarmCache(commonPaths: string[]): void {
  // No-op: caches have been removed
  // Validators should pre-compile accessors at build time
}

/**
 * Clear all caches (useful for testing)
 * @deprecated Caches have been removed to prevent memory leaks
 */
export function clearAllCaches(): void {
  // No-op: caches have been removed
}