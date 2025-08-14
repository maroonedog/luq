/**
 * Field Processing Utilities
 * Integrated field processing utilities - eliminates duplicate logic
 */

export type FieldAccessor<T = any> = (obj: any) => T;
export type FieldSetter<T = any> = (obj: any, value: T) => void;

export interface ParsedFieldPath {
  segments: string[];
  isArrayElement: boolean;
  arrayPath?: string;
  elementKey?: string;
  depth: number;
}

export interface ArrayFieldInfo {
  arrayPath: string;
  elementPath: string;
  indexPattern: RegExp;
}

// NOTE: Caches removed to prevent memory leaks in server environments
// Each validator instance should manage its own cache if needed

/**
 * Parse field path (consolidates logic duplicated across 4 files)
 */
export function parseFieldPath(path: string): ParsedFieldPath {
  // Direct computation without caching
  const segments = path.split(".");
  let isArrayElement = false;
  let arrayPath: string | undefined;
  let elementKey: string | undefined;

  const result: ParsedFieldPath = {
    segments,
    isArrayElement,
    arrayPath,
    elementKey,
    depth: segments.length,
  };

  return result;
}

/**
 * Create field accessor (consolidates and optimizes duplicated logic)
 */
export function createFieldAccessor<T = any>(path: string): FieldAccessor<T> {
  // Direct creation without caching
  const parsedPath = parseFieldPath(path);
  let accessor: FieldAccessor<T>;

  // Performance optimization: Generate optimized accessor based on depth
  if (parsedPath.depth === 1) {
    // Single property (fastest)
    const key = parsedPath.segments[0];
    accessor = (obj: any) => obj?.[key];
  } else if (parsedPath.depth === 2) {
    // 2 levels (fast)
    const [key1, key2] = parsedPath.segments;
    accessor = (obj: any) => obj?.[key1]?.[key2];
  } else if (parsedPath.depth === 3) {
    // 3 levels (medium speed)
    const [key1, key2, key3] = parsedPath.segments;
    accessor = (obj: any) => obj?.[key1]?.[key2]?.[key3];
  } else {
    // Deep nesting (generic)
    accessor = (obj: any) => {
      let current = obj;
      for (const segment of parsedPath.segments) {
        if (current == null) return undefined;
        current = current[segment];
      }
      return current;
    };
  }

  return accessor;
}

/**
 * Create field setter (consolidates and optimizes duplicated logic)
 */
export function createFieldSetter<T = any>(path: string): FieldSetter<T> {
  // Direct creation without caching
  const parsedPath = parseFieldPath(path);
  let setter: FieldSetter<T>;

  // Performance optimization: Generate optimized setter based on depth
  if (parsedPath.depth === 1) {
    // Single property (fastest)
    const key = parsedPath.segments[0];
    setter = (obj: any, value: T) => {
      if (obj != null) obj[key] = value;
    };
  } else if (parsedPath.depth === 2) {
    // 2 levels (fast)
    const [key1, key2] = parsedPath.segments;
    setter = (obj: any, value: T) => {
      if (obj != null) {
        if (!obj[key1]) obj[key1] = {};
        obj[key1][key2] = value;
      }
    };
  } else if (parsedPath.depth === 3) {
    // 3 levels (medium speed)
    const [key1, key2, key3] = parsedPath.segments;
    setter = (obj: any, value: T) => {
      if (obj != null) {
        if (!obj[key1]) obj[key1] = {};
        if (!obj[key1][key2]) obj[key1][key2] = {};
        obj[key1][key2][key3] = value;
      }
    };
  } else {
    // Deep nesting (generic)
    setter = (obj: any, value: T) => {
      if (obj == null) return;

      let current = obj;
      const segments = parsedPath.segments;

      for (let i = 0; i < segments.length - 1; i++) {
        const segment = segments[i];
        if (!current[segment]) {
          current[segment] = {};
        }
        current = current[segment];
      }

      current[segments[segments.length - 1]] = value;
    };
  }

  return setter;
}

/**
 * Get nested value (unified helper)
 */
export function getNestedValue(obj: any, path: string): any {
  const accessor = createFieldAccessor(path);
  return accessor(obj);
}

/**
 * Set nested value (unified helper)
 */
export function setNestedValue(obj: any, path: string, value: any): void {
  const setter = createFieldSetter(path);
  setter(obj, value);
}

/**
 * Analyze array field information
 */
export function analyzeArrayField(path: string): ArrayFieldInfo | null {
  const parsedPath = parseFieldPath(path);

  if (
    !parsedPath.isArrayElement ||
    !parsedPath.arrayPath ||
    !parsedPath.elementKey
  ) {
    return null;
  }

  return {
    arrayPath: parsedPath.arrayPath,
    elementPath: parsedPath.elementKey,
    indexPattern: new RegExp(
      `${parsedPath.arrayPath.replace(/\./g, "\\.")}\\[(\\d+)\\]\\.${parsedPath.elementKey.replace(/\./g, "\\.")}`
    ),
  };
}

/**
 * Create array accessor (optimized)
 */
export function createArrayAccessor(arrayPath: string): FieldAccessor<any[]> {
  const baseAccessor = createFieldAccessor<any>(arrayPath);

  return (obj: any) => {
    const value = baseAccessor(obj);
    return Array.isArray(value) ? value : [];
  };
}

/**
 * Group array fields from field definitions
 */
export function groupArrayFields(
  fieldPaths: string[]
): Map<string, { arrayPath: string; elementFields: string[] }> {
  const arrayGroups = new Map<
    string,
    { arrayPath: string; elementFields: string[] }
  >();

  for (const path of fieldPaths) {
    const arrayInfo = analyzeArrayField(path);

    if (arrayInfo) {
      const { arrayPath, elementPath } = arrayInfo;

      if (!arrayGroups.has(arrayPath)) {
        arrayGroups.set(arrayPath, {
          arrayPath,
          elementFields: [],
        });
      }

      arrayGroups.get(arrayPath)!.elementFields.push(elementPath);
    }
  }

  return arrayGroups;
}

/**
 * Create batch accessors (for accessing multiple fields at once)
 */
export function createBatchAccessors(
  paths: string[]
): Array<{ fieldName: string; path: string; accessor: FieldAccessor }> {
  return paths.map((path) => ({
    fieldName: path.split(".").pop() || path,
    path,
    accessor: createFieldAccessor(path),
  }));
}

/**
 * Validate field path
 */
export function isValidFieldPath(path: string): boolean {
  if (!path || typeof path !== "string") {
    return false;
  }

  // Check for empty segments or invalid characters
  const segments = path.split(".");
  return segments.every(
    (segment) =>
      segment.length > 0 && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(segment)
  );
}

/**
 * Normalize field path
 */
export function normalizeFieldPath(path: string): string {
  return path
    .split(".")
    .filter((segment) => segment.length > 0)
    .join(".");
}

/**
 * Compare field paths
 */
export function compareFieldPaths(path1: string, path2: string): number {
  const segments1 = path1.split(".");
  const segments2 = path2.split(".");

  // Compare by depth
  if (segments1.length !== segments2.length) {
    return segments1.length - segments2.length;
  }

  // Compare alphabetically
  return path1.localeCompare(path2);
}

/**
 * Clear cache (for memory management)
 * @deprecated Caches have been removed to prevent memory leaks
 */
export function clearCache(): void {
  // No-op: caches have been removed
}

/**
 * Get cache statistics (for debugging)
 * @deprecated Caches have been removed to prevent memory leaks
 */
export function getCacheStats(): {
  pathCacheSize: number;
  accessorCacheSize: number;
  setterCacheSize: number;
} {
  return {
    pathCacheSize: 0,
    accessorCacheSize: 0,
    setterCacheSize: 0,
  };
}

// FieldUtils object for backward compatibility
export const FieldUtils = {
  parseFieldPath,
  createFieldAccessor,
  createFieldSetter,
  getNestedValue,
  setNestedValue,
  analyzeArrayField,
  createArrayAccessor,
  groupArrayFields,
  createBatchAccessors,
  isValidFieldPath,
  normalizeFieldPath,
  compareFieldPaths,
  clearCache,
  getCacheStats,
};
