/**
 * Field Accessor Utilities
 *
 * Optimized field value access with pre-created accessor functions.
 * V8 Optimization: Direct property access chains for better performance.
 */

import { DOT } from "../../../constants";

/**
 * Create optimized accessor function for a nested field path
 * V8 Optimization: Generate direct property access code for common depths
 *
 * @param pathSegments - Array of property keys to traverse
 * @returns Optimized accessor function
 */
export function createAccessor(pathSegments: string[]): (obj: any) => any {
  if (pathSegments.length === 0) {
    return (obj) => obj;
  }

  if (pathSegments.length === 1) {
    const key = pathSegments[0];
    return (obj) => obj?.[key];
  }

  if (pathSegments.length === 2) {
    const [key1, key2] = pathSegments;
    return (obj) => obj?.[key1]?.[key2];
  }

  if (pathSegments.length === 3) {
    const [key1, key2, key3] = pathSegments;
    return (obj) => obj?.[key1]?.[key2]?.[key3];
  }

  if (pathSegments.length === 4) {
    const [key1, key2, key3, key4] = pathSegments;
    return (obj) => obj?.[key1]?.[key2]?.[key3]?.[key4];
  }

  if (pathSegments.length === 5) {
    const [key1, key2, key3, key4, key5] = pathSegments;
    return (obj) => obj?.[key1]?.[key2]?.[key3]?.[key4]?.[key5];
  }

  // For deeper paths, fall back to loop (removed for...of, index-based)
  return (obj) => {
    let result = obj;
    const pathSegmentsLength = pathSegments.length;
    for (let i = 0; i < pathSegmentsLength; i++) {
      const key = pathSegments[i];
      result = result?.[key];
      if (result === undefined) return undefined;
    }
    return result;
  };
}

/**
 * Create accessor from dot-notation field path
 *
 * @param fieldPath - Field path in dot notation (e.g., "user.profile.name")
 * @returns Optimized accessor function
 */
export function createFieldAccessor(fieldPath: string): (obj: any) => any {
  return createAccessor(fieldPath.split(DOT));
}

/**
 * Get cached accessor or create new one
 * NOTE: Cache should be managed by the caller (e.g., validator factory)
 * to avoid global state and memory leaks
 *
 * @param fieldPath - Field path in dot notation
 * @param cache - Cache map provided by the caller
 * @returns Cached or newly created accessor function
 */
export function getCachedAccessor(
  fieldPath: string,
  cache: Map<string, (obj: any) => any>
): (obj: any) => any {
  if (!cache.has(fieldPath)) {
    cache.set(fieldPath, createFieldAccessor(fieldPath));
  }
  return cache.get(fieldPath)!;
}

/**
 * Create accessor cache factory
 * Returns a function that manages its own cache scope
 * 
 * @returns Function to get cached accessors with local cache
 */
export function createAccessorCacheFactory(): (fieldPath: string) => (obj: any) => any {
  const cache = new Map<string, (obj: any) => any>();
  
  return (fieldPath: string) => {
    if (!cache.has(fieldPath)) {
      cache.set(fieldPath, createFieldAccessor(fieldPath));
    }
    return cache.get(fieldPath)!;
  };
}

/**
 * Batch create accessors for multiple field paths
 * Useful for plugins that need to access multiple fields
 *
 * @param fieldPaths - Array of field paths in dot notation
 * @returns Array of accessor objects with fieldName and accessor function
 */
export function createBatchAccessors(fieldPaths: string[]): Array<{
  fieldName: string;
  accessor: (obj: any) => any;
}> {
  return fieldPaths.map((fieldPath) => ({
    fieldName: fieldPath,
    accessor: createFieldAccessor(fieldPath),
  }));
}

/**
 * Create field value getter that returns values for multiple fields
 *
 * @param fieldPaths - Array of field paths to access
 * @returns Function that extracts values for all specified fields
 */
export function createMultiFieldGetter(
  fieldPaths: string[]
): (obj: any) => Record<string, any> {
  const accessors = createBatchAccessors(fieldPaths);

  return (obj: any) => {
    const result: Record<string, any> = {};
    for (let i = 0; i < accessors.length; i++) {
      const { fieldName, accessor } = accessors[i];
      result[fieldName] = accessor(obj);
    }
    return result;
  };
}

/**
 * Optimized field existence checker
 *
 * @param fieldPath - Field path in dot notation
 * @returns Function that checks if field exists (not undefined)
 */
export function createFieldExistenceChecker(
  fieldPath: string
): (obj: any) => boolean {
  const accessor = createFieldAccessor(fieldPath);
  return (obj: any) => accessor(obj) !== undefined;
}

/**
 * Create field setter for nested paths
 * V8 Optimization: Direct property assignment for common depths
 *
 * @param fieldPath - Field path in dot notation
 * @returns Function that sets the field value
 */
export function createFieldSetter(
  fieldPath: string
): (obj: any, value: any) => void {
  const pathSegments = fieldPath.split(DOT);

  if (pathSegments.length === 1) {
    const key = pathSegments[0];
    return (obj, value) => {
      obj[key] = value;
    };
  }

  if (pathSegments.length === 2) {
    const [key1, key2] = pathSegments;
    return (obj, value) => {
      if (!obj[key1]) obj[key1] = {};
      obj[key1][key2] = value;
    };
  }

  if (pathSegments.length === 3) {
    const [key1, key2, key3] = pathSegments;
    return (obj, value) => {
      if (!obj[key1]) obj[key1] = {};
      if (!obj[key1][key2]) obj[key1][key2] = {};
      obj[key1][key2][key3] = value;
    };
  }

  // For deeper paths, use generic approach
  return (obj, value) => {
    let current = obj;
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const key = pathSegments[i];
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    current[pathSegments[pathSegments.length - 1]] = value;
  };
}

/**
 * Create optimized nested value accessor with array support
 * Handles array element validation patterns and standard nested access
 * V8 Optimization: Fast paths for common access patterns
 *
 * @param fieldPath - Field path in dot notation
 * @returns Function that gets nested values with array support
 */
export function createNestedValueAccessor(
  fieldPath: string
): (obj: Record<string, unknown>) => unknown {
  // Fast path for simple property access
  if (!fieldPath.includes(DOT)) {
    return (obj) => obj[fieldPath];
  }

  const parts = fieldPath.split(DOT);
  const partsLength = parts.length;

  // Fast path for two-level access
  if (partsLength === 2) {
    const [key1, key2] = parts;
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

  // General case for deeper nesting
  return (obj) => {
    let current = obj;
    for (let i = 0; i < partsLength; i++) {
      if (current == null || typeof current !== "object") {
        return undefined;
      }

      const part = parts[i];
      const value = (current as Record<string, unknown>)[part];

      // Check if this is an array that needs element validation
      if (Array.isArray(value) && i < partsLength - 1) {
        // Array element field access: extract property from each element
        const remainingPath = parts.slice(i + 1).join('.');
        const elementValues = value.map(element => {
          if (element == null || typeof element !== "object") {
            return undefined;
          }
          
          // For simple property access on element
          if (remainingPath.indexOf('.') === -1) {
            return (element as Record<string, unknown>)[remainingPath];
          }
          
          // For nested property access on element
          let elementCurrent = element;
          const remainingParts = parts.slice(i + 1);
          
          const remainingLength = remainingParts.length;
          for (let j = 0; j < remainingLength; j++) {
            if (elementCurrent == null || typeof elementCurrent !== "object") {
              return undefined;
            }
            elementCurrent = (elementCurrent as Record<string, unknown>)[remainingParts[j]];
          }
          
          return elementCurrent;
        });
        
        // Return special array marker for validation system
        return { __isArrayElementField: true, values: elementValues, arrayPath: parts.slice(0, i + 1).join('.') };
      }

      current = value as Record<string, unknown>;
    }

    return current;
  };
}

/**
 * Parse field path and detect array element notation [*]
 * 
 * @param fieldPath - Field path that may contain [*] notation
 * @returns Object describing the path structure
 */
export function parseFieldPath(fieldPath: string): {
  hasArrayElements: boolean;
  segments: Array<{ name: string; isArrayElement: boolean }>;
  baseArrayPath?: string;
  elementPath?: string;
} {
  const hasArrayElements = fieldPath.includes('[*]');
  
  if (!hasArrayElements) {
    return {
      hasArrayElements: false,
      segments: fieldPath.split(DOT).map(name => ({ name, isArrayElement: false }))
    };
  }
  
  // Parse path with [*] notation like "categories[*]" or "categories[*].subcategories[*]"
  const parts = fieldPath.split(DOT);
  const segments: Array<{ name: string; isArrayElement: boolean }> = [];
  
  for (const part of parts) {
    if (part.endsWith('[*]')) {
      const baseName = part.slice(0, -3); // Remove [*]
      segments.push({ name: baseName, isArrayElement: true });
    } else {
      segments.push({ name: part, isArrayElement: false });
    }
  }
  
  // Find first array element to determine base array path and element path
  const firstArrayIndex = segments.findIndex(s => s.isArrayElement);
  if (firstArrayIndex !== -1) {
    const baseArrayPath = segments.slice(0, firstArrayIndex + 1)
      .map(s => s.name)
      .join(DOT);
    const elementPath = segments.slice(firstArrayIndex + 1)
      .map(s => s.name)
      .join(DOT);
    
    return {
      hasArrayElements: true,
      segments,
      baseArrayPath,
      elementPath: elementPath || ''
    };
  }
  
  return {
    hasArrayElements: true,
    segments
  };
}

/**
 * Create accessor for array element fields with [*] notation
 * Returns array of values that should be validated individually
 * 
 * @param fieldPath - Field path with [*] notation (e.g., "categories[*]", "categories[*].name")
 * @returns Function that returns array element values for validation
 */
export function createArrayElementAccessor(
  fieldPath: string
): (obj: any) => { elements: any[]; basePath: string; elementPath: string } | null {
  const parsed = parseFieldPath(fieldPath);
  
  if (!parsed.hasArrayElements || !parsed.baseArrayPath) {
    return () => null;
  }
  
  const baseArrayAccessor = createFieldAccessor(parsed.baseArrayPath);
  const elementPath = parsed.elementPath || '';
  
  return (obj: any) => {
    const arrayValue = baseArrayAccessor(obj);
    
    if (!Array.isArray(arrayValue)) {
      return null;
    }
    
    let elements: any[];
    
    if (elementPath === '') {
      // Direct array elements: "categories[*]"
      elements = arrayValue;
    } else {
      // Nested property from array elements: "categories[*].name"
      const elementAccessor = createFieldAccessor(elementPath);
      elements = arrayValue.map(element => elementAccessor(element));
    }
    
    return {
      elements,
      basePath: parsed.baseArrayPath!,
      elementPath
    };
  };
}
