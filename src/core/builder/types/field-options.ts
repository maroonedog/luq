/**
 * Field-level options that are not validation rules but field configuration
 * Field-level settings (not validation rules)
 */
export interface FieldOptions<T = any> {
  /**
   * Default value when the field is undefined or null
   * Can be a static value or a function that returns the value
   */
  default?: T | (() => T);
  
  /**
   * Whether to apply default to null values (not just undefined)
   * @default true
   */
  applyDefaultToNull?: boolean;
  
  /**
   * Field description for documentation
   */
  description?: string;
  
  /**
   * Mark field as deprecated
   */
  deprecated?: boolean | string;
  
  /**
   * Custom metadata
   */
  metadata?: Record<string, any>;
}

/**
 * Simplified default value type (for shorthand syntax)
 */
export type DefaultValue<T> = T | (() => T);

/**
 * Field configuration: either just default value or full options
 */
export type FieldConfig<T> = DefaultValue<T> | FieldOptions<T>;

/**
 * Helper to normalize field config
 */
export function normalizeFieldConfig<T>(
  config?: FieldConfig<T>
): FieldOptions<T> | undefined {
  if (config === undefined) {
    return undefined;
  }
  
  // If it's already an options object (has any of the known properties)
  if (
    typeof config === 'object' &&
    config !== null &&
    !Array.isArray(config) &&
    ('default' in config || 
     'description' in config || 
     'deprecated' in config ||
     'metadata' in config)
  ) {
    return config as FieldOptions<T>;
  }
  
  // Otherwise, treat it as a default value
  return {
    default: config as DefaultValue<T>
  };
}

/**
 * Apply default value if needed
 */
export function applyDefault<T>(
  value: any,
  options?: FieldOptions<T>,
  context?: { allValues?: any }
): any {
  if (!options || !('default' in options)) {
    return value;
  }
  
  // Check if we should apply default
  const shouldApply = 
    value === undefined ||
    (value === null && options.applyDefaultToNull !== false);
  
  if (!shouldApply) {
    return value;
  }
  
  // Apply default value
  const defaultValue = options.default;
  if (typeof defaultValue === 'function') {
    return (defaultValue as () => T)();
  }
  
  return defaultValue;
}