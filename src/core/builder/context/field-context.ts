/**
 * Optimized field context creation for V8 performance
 * Removes Proxy usage and reduces object allocation
 */

import type {
  TypeName,
  ChainableFieldBuilder,
  FieldBuilderContext,
  TransformFunction,
  TypeMapping,
} from "../plugins/plugin-types";
import { attachComposablePlugin } from "../plugins/composable-plugin";

// Validation function signature optimized for monomorphic calls
type OptimizedValidator<T = unknown> = (value: T, currentValue: T) => boolean;

// Type-safe validator with metadata
interface ValidatorWithMeta<TValue = unknown> {
  check: OptimizedValidator<TValue>;
  name: string;
  messageFactory?: (context: any) => string;

  // Type information for better type safety
  inputType?: TypeName;
  outputType?: TypeName;
  // Validation metadata
  metadata?: {
    severity?: "error" | "warning" | "info";
    async?: boolean;
    dependencies?: string[];
  };
}

/**
 * Get basic type validator for a given type
 */
function getTypeValidator(type: TypeName): ValidatorWithMeta<unknown> | null {
  switch (type) {
    case "string":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return typeof value === "string";
        },
        name: "stringType",
        messageFactory: () => "Expected string",
        inputType: "string",
        outputType: "string",
        metadata: { severity: "error" as const, async: false },
      };
    case "number":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return typeof value === "number" && !isNaN(value);
        },
        name: "numberType",
        messageFactory: () => "Expected number",
        inputType: "number",
        outputType: "number",
        metadata: { severity: "error" as const, async: false },
      };
    case "boolean":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return typeof value === "boolean";
        },
        name: "booleanType",
        messageFactory: () => "Expected boolean",
        inputType: "boolean",
        outputType: "boolean",
        metadata: { severity: "error" as const, async: false },
      };
    case "array":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return Array.isArray(value);
        },
        name: "arrayType",
        messageFactory: () => "Expected array",
        inputType: "array",
        outputType: "array",
        metadata: { severity: "error" as const, async: false },
      };
    case "object":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return (
            typeof value === "object" && value !== null && !Array.isArray(value)
          );
        },
        name: "objectType",
        messageFactory: () => "Expected object",
        inputType: "object",
        outputType: "object",
        metadata: { severity: "error" as const, async: false },
      };
    case "date":
      return {
        check: (value: any) => {
          // Skip null check if nullable plugin is present (will be handled later)
          if (value === null || value === undefined) {
            // Let nullable plugin handle this later in the chain
            return true;
          }
          return value instanceof Date;
        },
        name: "dateType",
        messageFactory: () => "Expected Date",
        inputType: "date",
        outputType: "date",
        metadata: { severity: "error" as const, async: false },
      };
    case "null":
      return {
        check: (value: any) => value === null,
        name: "nullType",
        messageFactory: () => "Expected null",
        inputType: "null",
        outputType: "null",
        metadata: { severity: "error" as const, async: false },
      };
    case "any":
      // For "any" type, we always return true (accept any value)
      return {
        check: () => true,
        name: "anyType",
        messageFactory: () => "",
        inputType: "any",
        outputType: "any",
        metadata: { severity: "error" as const, async: false },
      };
    default:
      return null; // union, tuple types don't get automatic validation
  }
}

/**
 * Create type-safe chainable field builder without Proxy
 * All methods are directly attached to the builder object with proper typing
 */
export function createOptimizedTypeBuilder<
  TObject extends object,
  TPlugins,
  TType extends TypeName,
>(
  type: TType,
  fieldPath: string,
  plugins: TPlugins,
  existingState?: {
    validators: ValidatorWithMeta<unknown>[];
    transforms: Array<TransformFunction<unknown, unknown>>;
  }
): ChainableFieldBuilder<TObject, TPlugins, TType, TypeMapping[TType]> {
  // Simplified arrays without ExecutionPlan
  const validators: ValidatorWithMeta<unknown>[] = existingState?.validators
    ? [...existingState.validators]
    : [];

  // Add basic type checking validator for the specified type
  if (!existingState && type !== "union") {
    // Only add for new builders, not chained ones
    const typeValidator = getTypeValidator(type);
    if (typeValidator) {
      validators.push(typeValidator);
    }
  }
  const transforms: Array<TransformFunction<unknown, unknown>> =
    existingState?.transforms ? [...existingState.transforms] : [];

  // Base builder object - simplified without ExecutionPlan
  const builder: Record<string, unknown> = {
    _type: type,
    _fieldPath: fieldPath,
    _validators: validators,
    _transforms: transforms,

    build() {
      // For union types with no validators, add a default fail validator
      if (type === "union" && validators.length === 0) {
        validators.push({
          check: () => false,
          name: "unionGuard",
          messageFactory: () => "No union type guards defined",
          inputType: "union" as TypeName,
          outputType: "union" as TypeName,
          metadata: { severity: "error" as const, async: false },
        });
      }

      // Return minimal structure for unified-validator
      return {
        _validators: validators,
        _transforms: transforms,
      };
    },
  };

  // Attach plugin methods directly to builder
  attachPluginMethods(
    builder,
    type,
    fieldPath,
    plugins,
    validators,
    transforms
  );

  // Attach refine methods (needed by jsonSchema.ts)
  builder.refineString = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "string">(
      "string",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineNumber = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "number">(
      "number",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineBoolean = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "boolean">(
      "boolean",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineArray = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "array">(
      "array",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineObject = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "object">(
      "object",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineTuple = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "tuple">(
      "tuple",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineUnion = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "union">(
      "union",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineDate = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "date">(
      "date",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };
  builder.refineAny = () => {
    return createOptimizedTypeBuilder<TObject, TPlugins, "any">(
      "any",
      fieldPath,
      plugins,
      { validators, transforms }
    );
  };

  return builder as ChainableFieldBuilder<TObject, TPlugins, TType, TypeMapping[TType]>;
}

/**
 * Streamlined plugin method attachment - removed ExecutionPlan for bundle size
 */
function attachPluginMethods<TObject extends object, TPlugins>(
  builder: Record<string, unknown>,
  type: TypeName,
  fieldPath: string,
  plugins: TPlugins,
  validators: ValidatorWithMeta<unknown>[],
  transforms: Array<TransformFunction<unknown, unknown>>
): void {
  const pluginEntries = Object.entries(plugins as Record<string, any>);
  const entriesLength = pluginEntries.length;

  for (let i = 0; i < entriesLength; i++) {
    const [, plugin] = pluginEntries[i];

    // Quick skip invalid plugins
    if (!plugin || typeof plugin !== "object") continue;

    // Handle composable plugins
    if (plugin.category?.startsWith("composable")) {
      if (plugin.allowedTypes && !plugin.allowedTypes.includes(type)) continue;
      attachComposablePlugin(builder, plugin, fieldPath, plugins);
      continue;
    }

    // Handle typed plugins
    if (typeof plugin.create !== "function") continue;
    if (plugin.allowedTypes && !plugin.allowedTypes.includes(type)) continue;

    const { methodName, category = "standard", name } = plugin;
    const createFn = plugin.create();

    // Consolidated method creation
    builder[methodName] = function (...args: any[]) {
      try {
        const result = createFn(...args);

        if (category === "transform") {
          const transformFn = extractTransformFunction(result, args[0]);
          transforms.push(transformFn);
        } else {
          // All validation categories (standard, conditional, fieldReference, preprocessor)
          const checkFn = extractCheckFunction(result, fieldPath);
          const validator = createValidatorMeta(
            checkFn,
            name || methodName,
            type,
            args,
            result
          );
          validators.push(validator);
        }
      } catch (e) {
        // Plugin error - ignore silently
      }
      return builder;
    };
  }
}

// Consolidated helper functions
function extractTransformFunction(result: any, fallback: any) {
  if (typeof result === "function") return fallback;
  if (result?.__isTransform) return result.__transformFn;
  if (result?.__isCoerce) return (v: any) => result.coerce.coerceFn(v);
  if (result?.__isDefault)
    return (v: any, ctx: any) => result.default.applyDefault(v, ctx);
  if (result?.__isPreprocess)
    return (v: any, ctx: any) => result.preprocess.applyPreprocess(v, ctx);
  return fallback || ((v: any) => v);
}

function extractCheckFunction(result: any, fieldPath: string) {
  if (typeof result === "function") {
    return (value: any, currentValue: any) =>
      result(value, { path: fieldPath, allValues: currentValue }).valid;
  }
  if (result?.check) {
    return (value: any, currentValue: any) => result.check(value, currentValue);
  }
  return () => false;
}

function createValidatorMeta(
  checkFn: any,
  name: string,
  type: TypeName,
  args: any[],
  originalResult?: any
) {
  const validator = {
    check: checkFn,
    name,
    // V8 optimization: Keep code and getErrorMessage from plugin
    code: originalResult?.code || name,
    pluginName: originalResult?.pluginName || name,
    getErrorMessage: originalResult?.getErrorMessage,
    messageFactory:
      args[args.length - 1]?.messageFactory ||
      originalResult?.messageFactory ||
      (() => "Validation failed"),
    inputType: type,
    outputType: type,
    metadata: originalResult?.metadata || {
      severity: "error" as const,
      async: false,
    },
  };

  // Preserve special methods from the original result
  if (originalResult) {
    if (originalResult.shouldSkipAllValidation) {
      (validator as any).shouldSkipAllValidation =
        originalResult.shouldSkipAllValidation;
    }
    if (originalResult.shouldSkipValidation) {
      (validator as any).shouldSkipValidation =
        originalResult.shouldSkipValidation;
    }
    if (originalResult.shouldSkipFurtherValidation) {
      (validator as any).shouldSkipFurtherValidation =
        originalResult.shouldSkipFurtherValidation;
    }
    // Preserve skip flags for null/undefined values
    if (originalResult.skipForNull !== undefined) {
      (validator as any).skipForNull = originalResult.skipForNull;
    }
    if (originalResult.skipForUndefined !== undefined) {
      (validator as any).skipForUndefined = originalResult.skipForUndefined;
    }
    // Preserve recursive validation markers
    if (originalResult.__isRecursive) {
      (validator as any).__isRecursive = originalResult.__isRecursive;
    }
    if (originalResult.recursive) {
      (validator as any).recursive = originalResult.recursive;
    }
  }

  return validator;
}

/**
 * Create type-safe field context without Proxy
 */
export function createOptimizedFieldContext<
  TObject extends object,
  TPlugins,
  TFieldType,
>(
  fieldPath: string,
  plugins: TPlugins
): FieldBuilderContext<TObject, TPlugins, TFieldType> {
  // Pre-create all type builders to avoid lazy initialization
  const stringBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "string">(
    "string",
    fieldPath,
    plugins
  );
  const numberBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "number">(
    "number",
    fieldPath,
    plugins
  );
  const booleanBuilder = createOptimizedTypeBuilder<
    TObject,
    TPlugins,
    "boolean"
  >("boolean", fieldPath, plugins);
  const arrayBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "array">(
    "array",
    fieldPath,
    plugins
  );
  const objectBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "object">(
    "object",
    fieldPath,
    plugins
  );
  const unionBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "union">(
    "union",
    fieldPath,
    plugins
  );
  const tupleBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "tuple">(
    "tuple",
    fieldPath,
    plugins
  );
  const dateBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "date">(
    "date",
    fieldPath,
    plugins
  );
  const anyBuilder = createOptimizedTypeBuilder<TObject, TPlugins, "any">(
    "any",
    fieldPath,
    plugins
  );

  // Return direct object without getters
  return {
    string: stringBuilder,
    number: numberBuilder,
    boolean: booleanBuilder,
    date: dateBuilder,
    array: arrayBuilder,
    tuple: tupleBuilder,
    union: unionBuilder,
    object: objectBuilder,
    any: anyBuilder,
  } as FieldBuilderContext<TObject, TPlugins, TFieldType>;
}

// Export with standard name for compatibility
export { createOptimizedFieldContext as createFieldContext };
