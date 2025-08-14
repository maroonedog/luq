/**
 * Plugin Registry - Shared plugin management for reusable field rules
 *
 * Enables:
 * 1. Pre-defining field validation rules with plugins
 * 2. Individual field validation before integration
 * 3. Shared plugin pools for team consistency
 */

import { Result } from "../../types/result";
import { ValidationOptions, ParseOptions } from "../../types";
import type {
  TypedPlugin,
  FieldBuilderContext,
  ChainableFieldBuilder,
  PluginCategory,
  TypeName,
  PluginType,
} from "../builder/plugins/plugin-types";
import {
  normalizeFieldConfig,
  applyDefault,
} from "../builder/types/field-options";
import { createFieldContext } from "../builder/context/field-context";
import { Builder, IChainableBuilder } from "../builder/core/builder";
import type { NestedKeyOf, TypeOfPath } from "../../types/util";

/**
 * Field Rule - Individual field validation rule with plugin support
 */
export interface FieldRule<T> {
  readonly _phantomType: T; // phantom type for type safety
  readonly name?: string;
  readonly description?: string;
  readonly fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;

  /**
   * Validate single field value
   */
  validate(value: T | unknown, options?: ValidationOptions): Result<T>;

  /**
   * Parse single field value (with transformations)
   */
  parse(value: T | unknown, options?: ParseOptions): Result<T>;

  /**
   * Get the plugin registry used by this rule
   */
  getPluginRegistry(): PluginRegistry<any>;

  /**
   * Internal: Get validators and transforms for integration
   * @internal
   */
  _getInternalValidators?: () => {
    validators: any[];
    transforms: any[];
    executionPlan: any;
  };
}

/**
 * Plugin Registry - Manages shared plugins for field rules with type accumulation
 */
export interface PluginRegistry<TPlugins = {}> {
  /**
   * Add a plugin to the registry with type accumulation
   */
  use<
    TName extends string,
    TMethodName extends string,
    TMethod extends Function,
    TAllowedTypes extends readonly TypeName[] | undefined,
    TPluginType extends PluginType = PluginType,
    TCategory extends PluginCategory = PluginCategory,
  >(
    plugin: TypedPlugin<
      TName,
      TMethodName,
      TMethod,
      TAllowedTypes,
      TPluginType,
      TCategory
    >
  ): PluginRegistry<
    TPlugins & {
      [K in TName]: TypedPlugin<
        TName,
        TMethodName,
        TMethod,
        TAllowedTypes,
        TPluginType,
        TCategory
      >;
    }
  > &
    TPlugins & { [K in TMethodName]: TMethod };

  /**
   * Create a field rule using registered plugins with practical type inference
   */
  createFieldRule<T>(
    definition: (
      context: FieldBuilderContext<any, TPlugins, T>
    ) => ChainableFieldBuilder<any, TPlugins, any, T>,
    options?:
      | {
          name?: string;
          description?: string;
          fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;
        }
      | import("../builder/types/field-options").FieldConfig<T>
  ): FieldRule<T>;

  /**
   * Create a builder instance using this registry's plugins
   */
  toBuilder(): IChainableBuilder<
    any,
    TPlugins & {
      [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
        any,
        any,
        any,
        any,
        any,
        any
      >
        ? TPlugins[K]
        : never;
    }
  >;

  /**
   * Get all registered plugins
   */
  getPlugins(): Record<string, TypedPlugin<any, any, any, any, any, any>>;

  /**
   * Set the target type for type-safe field rule creation
   */
  for<TObject extends object>(): TypedPluginRegistry<TObject, TPlugins>;
}

/**
 * Type-safe Plugin Registry with target type specified
 */
export interface TypedPluginRegistry<TObject extends object, TPlugins = {}>
  extends Omit<PluginRegistry<TPlugins>, "createFieldRule" | "for"> {
  /**
   * Create a field rule with type-safe field names and automatic type inference
   */
  createFieldRule<
    TName extends NestedKeyOf<TObject> & string,
    TExplicitType = TypeOfPath<TObject, TName>,
  >(
    definition: (
      context: FieldBuilderContext<TObject, TPlugins, TExplicitType>
    ) => ChainableFieldBuilder<TObject, TPlugins, any, TExplicitType>,
    options: {
      name: TName;
      description?: string;
      fieldOptions?: import("../builder/types/field-options").FieldOptions<TExplicitType>;
    }
  ): FieldRule<TExplicitType>;

  /**
   * Create a field rule with explicit type override
   */
  createFieldRule<T>(
    definition: (
      context: FieldBuilderContext<any, TPlugins, T>
    ) => ChainableFieldBuilder<any, TPlugins, any, T>,
    options: {
      name: NestedKeyOf<TObject> & string;
      description?: string;
      fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;
    }
  ): FieldRule<T>;

  /**
   * Change the target type
   */
  for<TNewObject extends object>(): TypedPluginRegistry<TNewObject, TPlugins>;
}

/**
 * Internal implementation of PluginRegistry with proper type tracking
 */
interface PluginRegistryInternalState<TPlugins> {
  plugins: Map<string, TypedPlugin<any, any, any, any, any, any>>;
  pluginsObject: TPlugins; // Store the actual plugins object with proper types
  _typeMarker?: TPlugins;
}

function createPluginRegistryImpl<TPlugins = {}>(
  existingPlugins?: Map<string, TypedPlugin<any, any, any, any, any, any>>,
  existingPluginsObject?: TPlugins
): PluginRegistry<TPlugins> {
  const state: PluginRegistryInternalState<TPlugins> = {
    plugins: existingPlugins ? new Map(existingPlugins) : new Map(),
    pluginsObject: existingPluginsObject || ({} as TPlugins),
  };

  const registry: PluginRegistry<TPlugins> = {
    use<
      TName extends string,
      TMethodName extends string,
      TMethod extends Function,
      TAllowedTypes extends readonly TypeName[] | undefined,
      TPluginType extends PluginType = PluginType,
      TCategory extends PluginCategory = PluginCategory,
    >(
      plugin: TypedPlugin<
        TName,
        TMethodName,
        TMethod,
        TAllowedTypes,
        TPluginType,
        TCategory
      >
    ): PluginRegistry<
      TPlugins & {
        [K in TName]: TypedPlugin<
          TName,
          TMethodName,
          TMethod,
          TAllowedTypes,
          TPluginType,
          TCategory
        >;
      }
    > &
      TPlugins & { [K in TMethodName]: TMethod } {
      state.plugins.set(plugin.name, plugin);

      // Create new plugins object with the added plugin - store by NAME not methodName
      const newPluginsObject = {
        ...state.pluginsObject,
        [plugin.name]: plugin, // Changed from plugin.methodName to plugin.name
      } as TPlugins & {
        [K in TName]: TypedPlugin<
          TName,
          TMethodName,
          TMethod,
          TAllowedTypes,
          TPluginType,
          TCategory
        >;
      };

      const newRegistry = createPluginRegistryImpl<
        TPlugins & {
          [K in TName]: TypedPlugin<
            TName,
            TMethodName,
            TMethod,
            TAllowedTypes,
            TPluginType,
            TCategory
          >;
        }
      >(state.plugins, newPluginsObject);

      // Cast to match the expected return type with intersection
      return newRegistry as any;
    },

    createFieldRule<T>(
      definition: (
        context: FieldBuilderContext<any, TPlugins, T>
      ) => ChainableFieldBuilder<any, TPlugins, any, T>,
      options?:
        | {
            name?: string;
            description?: string;
            fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;
          }
        | import("../builder/types/field-options").FieldConfig<T>
    ): FieldRule<T> {
      return createFieldRuleImpl<T, TPlugins>(
        registry,
        state.pluginsObject,
        definition,
        options
      );
    },

    toBuilder(): IChainableBuilder<
      any,
      TPlugins & {
        [K in keyof TPlugins]: TPlugins[K] extends TypedPlugin<
          any,
          any,
          any,
          any,
          any,
          any
        >
          ? TPlugins[K]
          : never;
      }
    > {
      let builder = Builder() as any;

      // Add all registered plugins to the builder (removed for...of, index-based)
      const pluginValues = Array.from(state.plugins.values());
      const pluginValuesLength = pluginValues.length;
      for (let i = 0; i < pluginValuesLength; i++) {
        const plugin = pluginValues[i];
        builder = builder.use(plugin);
      }

      return builder;
    },

    getPlugins(): Record<string, TypedPlugin<any, any, any, any, any, any>> {
      const result: Record<
        string,
        TypedPlugin<any, any, any, any, any, any>
      > = {};
      const pluginEntries = Array.from(state.plugins.entries());
      const pluginEntriesLength = pluginEntries.length;
      for (let i = 0; i < pluginEntriesLength; i++) {
        const [name, plugin] = pluginEntries[i];
        result[name] = plugin;
      }
      return result;
    },

    for<TObject extends object>(): TypedPluginRegistry<TObject, TPlugins> {
      return createTypedPluginRegistry<TObject, TPlugins>(
        state.plugins,
        state.pluginsObject,
        registry
      );
    },
  };

  return registry;
}

/**
 * Create a typed plugin registry with target type
 */
function createTypedPluginRegistry<TObject extends object, TPlugins = {}>(
  plugins: Map<string, TypedPlugin<any, any, any, any, any, any>>,
  pluginsObject: TPlugins,
  baseRegistry: PluginRegistry<TPlugins>
): TypedPluginRegistry<TObject, TPlugins> {
  const typedRegistry: TypedPluginRegistry<TObject, TPlugins> = {
    // Delegate non-overridden methods to base registry
    use: baseRegistry.use as any,
    toBuilder: baseRegistry.toBuilder,
    getPlugins: baseRegistry.getPlugins,

    // Type-safe createFieldRule with automatic type inference
    createFieldRule<
      TName extends NestedKeyOf<TObject> & string,
      TExplicitType = TypeOfPath<TObject, TName>,
    >(
      definition: (
        context: FieldBuilderContext<TObject, TPlugins, TExplicitType>
      ) => ChainableFieldBuilder<TObject, TPlugins, any, TExplicitType>,
      options: {
        name: TName;
        description?: string;
        fieldOptions?: import("../builder/types/field-options").FieldOptions<TExplicitType>;
      }
    ): FieldRule<TExplicitType> {
      // Use the base implementation with proper types
      return createFieldRuleImpl<TExplicitType, TPlugins>(
        baseRegistry,
        pluginsObject,
        definition as any,
        options
      );
    },

    // Allow changing the target type
    for<TNewObject extends object>(): TypedPluginRegistry<
      TNewObject,
      TPlugins
    > {
      return createTypedPluginRegistry<TNewObject, TPlugins>(
        plugins,
        pluginsObject,
        baseRegistry
      );
    },
  };

  return typedRegistry;
}

/**
 * Internal implementation of FieldRule
 */
function createFieldRuleImpl<T, TPlugins = any>(
  registry: PluginRegistry<TPlugins>,
  pluginsObject: TPlugins,
  definition: (
    context: FieldBuilderContext<any, TPlugins, T>
  ) => ChainableFieldBuilder<any, TPlugins, any, T>,
  options?:
    | {
        name?: string;
        description?: string;
        fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;
      }
    | import("../builder/types/field-options").FieldConfig<T>
): FieldRule<T> {
  // Helper functions for field options are now imported at the top

  // Normalize options to handle both object and simple value formats
  let normalizedOptions: {
    name?: string;
    description?: string;
    fieldOptions?: import("../builder/types/field-options").FieldOptions<T>;
  } = {};

  if (options !== undefined) {
    if (
      typeof options === "object" &&
      options !== null &&
      ("name" in options ||
        "description" in options ||
        "fieldOptions" in options)
    ) {
      // It's the options object format
      normalizedOptions = options as any;
    } else {
      // It's a simple field config (default value or FieldOptions)
      const fieldConfig = normalizeFieldConfig(
        options as import("../builder/types/field-options").FieldConfig<T>
      );
      normalizedOptions = {
        fieldOptions: fieldConfig,
      };
    }
  }

  const createSingleFieldValidator = () => {
    // Use a unique path that includes the rule name to avoid any potential sharing
    const uniquePath = `__standalone__${normalizedOptions?.name || Math.random()}`;
    // Pass the pluginsObject with proper type information
    const fieldContext = createFieldContext(uniquePath, pluginsObject);

    // Execute the rule definition to get the field builder
    // We need to cast because of union type handling differences
    const fieldBuilder = definition(
      fieldContext as FieldBuilderContext<any, TPlugins, T>
    );

    // Build the validator from the field builder
    const builtValidator = fieldBuilder.build() as any;

    // Create a simple validate function using the validators and transforms
    return {
      validate: (value: any, context?: any, options?: any) => {
        // Apply default value if needed
        let processedValue = value;
        if (normalizedOptions?.fieldOptions) {
          processedValue = applyDefault(value, normalizedOptions.fieldOptions, {
            allValues: context || {},
          });
        }

        const validators = builtValidator._validators || [];
        const transforms = builtValidator._transforms || [];

        // Run validators
        for (const validator of validators) {
          if (
            validator.check &&
            !validator.check(processedValue, context || {})
          ) {
            const message =
              typeof validator.messageFactory === "function"
                ? validator.messageFactory({
                    path: uniquePath,
                    value: processedValue,
                    context: context || {},
                  })
                : "Validation failed";
            return {
              valid: false,
              errors: [
                {
                  path: uniquePath,
                  message,
                  code: validator.name || "VALIDATION_ERROR",
                  paths: () => [uniquePath],
                },
              ],
              data: processedValue,
            };
          }
        }

        // Apply transforms if validation passed
        let transformedValue = processedValue;
        for (const transform of transforms) {
          if (typeof transform === "function") {
            transformedValue = transform(transformedValue);
          } else if (transform && typeof transform.transformFn === "function") {
            // Handle transform objects with transformFn
            transformedValue = transform.transformFn(transformedValue);
          }
        }

        return {
          valid: true,
          data: transformedValue,
          errors: [],
        };
      },
      _executionPlan: builtValidator._executionPlan,
      _validators: builtValidator._validators,
      _transforms: builtValidator._transforms,
    };
  };

  const fieldRule: FieldRule<T> = {
    _phantomType: undefined as any as T,
    name: normalizedOptions?.name,
    description: normalizedOptions?.description,
    fieldOptions: normalizedOptions?.fieldOptions,
    // Expose internal validators and transforms for integration
    _getInternalValidators: () => {
      const validator = createSingleFieldValidator();
      return {
        validators: validator._validators || [],
        transforms: validator._transforms || [],
        executionPlan: validator._executionPlan,
      };
    },

    validate(
      value: T | unknown,
      validateOptions?: ValidationOptions
    ): Result<T> {
      try {
        // Create a temporary single-field validator using the registry's plugins
        const fieldValidator = createSingleFieldValidator();
        const legacyResult = fieldValidator.validate(
          value as any,
          {},
          validateOptions
        );

        // Convert legacy ValidationResult to Result
        if (legacyResult.valid) {
          return Result.ok(legacyResult.data as T);
        } else {
          return Result.error(legacyResult.errors || []);
        }
      } catch (error) {
        return Result.error([
          {
            path: "",
            message:
              error instanceof Error ? error.message : "Validation failed",
            code: "FIELD_RULE_ERROR",
            paths: () => [""],
          },
        ]);
      }
    },

    parse(value: T | unknown, parseOptions?: ParseOptions): Result<T> {
      try {
        // Apply default value first
        let processedValue = value;
        if (normalizedOptions?.fieldOptions) {
          processedValue = applyDefault(value, normalizedOptions.fieldOptions, {
            allValues: {},
          });
        }

        // For parsing, we need to execute the full pipeline including transforms
        const fieldValidator = createSingleFieldValidator();

        // Use ExecutionPlan if available to execute validation and transforms in correct order
        if (
          fieldValidator._executionPlan &&
          typeof fieldValidator._executionPlan.execute === "function"
        ) {
          const context = {
            originalValue: processedValue,
            currentValue: processedValue,
            allValues: {},
            path: normalizedOptions?.name || "field",
            reporter: { report: () => {}, getReports: () => [] },
          };

          const result = fieldValidator._executionPlan.execute(
            processedValue,
            context
          );

          if (result.valid) {
            return Result.ok(result.finalValue as T);
          } else {
            return Result.error(result.errors || []);
          }
        } else {
          // Fallback: manually handle transforms and then validation
          let currentValue = processedValue;

          // Apply all transforms first (including defaults)
          if (fieldValidator._transforms) {
            for (const transform of fieldValidator._transforms) {
              if (typeof transform === "function") {
                currentValue = transform(currentValue);
              }
            }
          }

          // Now validate the transformed value
          const validators = fieldValidator._validators || [];
          const path = normalizedOptions?.name || "field";
          for (const validator of validators) {
            if (validator.check && !validator.check(currentValue, {})) {
              const message =
                typeof validator.messageFactory === "function"
                  ? validator.messageFactory({
                      path,
                      value: currentValue,
                      context: {},
                    })
                  : "Validation failed";
              return Result.error([
                {
                  path,
                  message,
                  code: validator.name || "VALIDATION_ERROR",
                  paths: () => [path],
                },
              ]);
            }
          }

          return Result.ok(currentValue as T);
        }
      } catch (error) {
        return Result.error([
          {
            path: "",
            message: error instanceof Error ? error.message : "Parse failed",
            code: "FIELD_RULE_PARSE_ERROR",
            paths: () => [""],
          },
        ]);
      }
    },

    getPluginRegistry(): PluginRegistry<any> {
      return registry;
    },
  };

  return fieldRule;
}

/**
 * Create a new plugin registry with empty plugin set
 * Generic type parameter allows TypeScript to properly track plugin accumulation
 */
export function createPluginRegistry<
  TPlugins = {},
>(): PluginRegistry<TPlugins> {
  return createPluginRegistryImpl<TPlugins>();
}

/**
 * Type helper to extract the field type from a FieldRule
 */
export type ExtractFieldRuleType<T> = T extends FieldRule<infer U> ? U : never;

/**
 * Type helper for field rule definitions
 */
export type FieldRuleDefinition<T, TPlugins = {}> = (
  context: FieldBuilderContext<{}, TPlugins, T>
) => ChainableFieldBuilder<{}, TPlugins, any, T>;
