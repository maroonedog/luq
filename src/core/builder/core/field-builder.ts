/**
 * Refactored Field Builder - Streamlined through separation of concerns
 * Focused on core builder logic
 */

import { NestedKeyOf, TypeOfPath } from "../../../types/util";
import type {
  FieldBuilder,
  FieldBuilderContext,
  AddFieldTransform,
  ExtractFieldType,
  ApplyFieldTransforms as ApplyNestedTransforms,
  TransformAwareValidator,
  MissingFields,
  FieldDefinition as FieldDefinitionType,
} from "../plugins/plugin-types";
import type { FieldConfig, FieldOptions } from "../types/field-options";
import { normalizeFieldConfig } from "../types/field-options";
import type { FieldRule } from "../../registry/plugin-registry";
import { FieldBuilderDefinition } from "../types/types";
import { createValidatorFactory, FieldDefinition } from "../validator-factory";
import { DOT } from "../../../constants";
import { createFieldContext } from "../context/field-context";

// Re-export types from plugin-types
export type { FieldBuilder } from "../plugins/plugin-types";
export type { FieldBuilderDefinition } from "../types/types";

/**
 * Streamlined FieldBuilder implementation focused on core building logic
 */
export function createFieldBuilderImpl<
  TObject extends object,
  TMap = {},
  TPlugins = {},
  TDeclaredFields extends string = never,
>(
  plugins: TPlugins,
  chainableBuilder: any,
  fieldDefinitions: Array<FieldBuilderDefinition> = [],
  isStrict: boolean = false
): FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields> {
  // Store field definitions for deferred building with type safety
  const _fieldDefinitions = [...fieldDefinitions];
  const _isStrict = isStrict;

  // Cached validator factory for performance
  let _validatorFactory:
    | ReturnType<typeof createValidatorFactory<TObject, TMap>>
    | undefined;

  /**
   * Infer field type from path at compile time
   */
  const inferFieldType = <Key extends string>(path: Key): string => {
    // Basic inference - can be enhanced with more sophisticated type checking
    if (path.includes(DOT)) return "nested";
    return "scalar";
  };

  /**
   * @deprecated Use `v` method instead. This method will be removed in a future version.
   * Add a field with type-safe validation and optional field configuration
   * Ensures path exists in TObject at compile time
   * WIP: Does not validate unknown properties by default
   */
  const field = <Key extends NestedKeyOf<TObject> & string, TFieldBuilder>(
    path: Key,
    definition: FieldDefinitionType<
      TObject,
      TPlugins,
      TypeOfPath<TObject, Key>,
      TFieldBuilder
    >,
    fieldOptions?: FieldConfig<TypeOfPath<TObject, Key>>
  ): FieldBuilder<
    TObject,
    AddFieldTransform<
      TMap,
      Key,
      TypeOfPath<TObject, Key>,
      ExtractFieldType<TFieldBuilder>
    >,
    TPlugins,
    TDeclaredFields | Key
  > => {
    // Normalize field options
    const normalizedOptions = fieldOptions !== undefined ? 
      normalizeFieldConfig(fieldOptions) : 
      undefined;

    // Store field definition with type information and options preserved
    const fieldDefinition: FieldBuilderDefinition = {
      path,
      inferredType: inferFieldType<Key>(path),
      builderFunction: definition as any,
      fieldOptions: normalizedOptions, // Store the field options
    };

    // Return new instance with type safety maintained
    return createFieldBuilderImpl<
      TObject,
      AddFieldTransform<
        TMap,
        Key,
        TypeOfPath<TObject, Key>,
        ExtractFieldType<TFieldBuilder>
      >,
      TPlugins,
      TDeclaredFields | Key
    >(
      plugins,
      chainableBuilder,
      [..._fieldDefinitions, fieldDefinition],
      _isStrict
    );
  };

  /**
   * Alias for field() with same signature and field options support
   * WIP: Does not validate unknown properties by default
   */
  const v = field;

  /**
   * Register a pre-built field rule with type-safe path checking
   * Tip: Use PluginRegistry to create type-safe field rules
   * @example
   * ```typescript
   * const registry = createPluginRegistry().use(requiredPlugin);
   * const rules = registry.createFieldRules();
   * builder.useField("name", rules.string.required());
   * ```
   */
  const useField = <Key extends NestedKeyOf<TObject> & string>(
    path: Key,
    fieldRule: FieldRule<TypeOfPath<TObject, Key>>
  ): FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields | Key> => {
    const fieldDefinition: FieldBuilderDefinition = {
      path,
      inferredType: inferFieldType<Key>(path),
      builderFunction: () => fieldRule,
      fieldOptions: fieldRule.fieldOptions, // Extract field options from the field rule
    };

    return createFieldBuilderImpl<TObject, TMap, TPlugins, TDeclaredFields | Key>(
      plugins,
      chainableBuilder,
      [..._fieldDefinitions, fieldDefinition],
      _isStrict
    );
  };

  /**
   * WIP: Enable strict mode ensuring all fields are declared
   * Returns type error at compile time if fields are missing
   * @deprecated This is a work in progress and may change in future versions
   */
  const strict = (): MissingFields<TObject, TDeclaredFields> extends never
    ? FieldBuilder<TObject, TMap, TPlugins, TDeclaredFields>
    : {
        _error: `Missing field declarations in strict mode: ${MissingFields<
          TObject,
          TDeclaredFields
        > &
          string}`;
        _missingFields: MissingFields<TObject, TDeclaredFields>;
      } => {
    return createFieldBuilderImpl<TObject, TMap, TPlugins, TDeclaredFields>(
      plugins,
      chainableBuilder,
      _fieldDefinitions,
      true
    ) as any;
  };

  /**
   * WIP: Alias for strict mode with editor-specific naming
   * Provides better IDE integration and error messages
   * @deprecated This is a work in progress and may change in future versions
   */
  const strictOnEditor = strict;

  /**
   * Build the final validator with optimizations
   * Generates efficient validation function with type transformations
   * WIP: The built validator does not validate unknown properties by default.
   * Use objectAdditionalProperties plugin for strict property validation.
   */
  const build = (): TransformAwareValidator<
    TObject,
    ApplyNestedTransforms<TObject, TMap>
  > => {
    // Use cached factory or create new one for performance
    if (!_validatorFactory) {
      _validatorFactory = createValidatorFactory<TObject, TMap>(plugins as Record<string, any>);
    }

    // Process field definitions with context creation
    const processedDefinitions = _fieldDefinitions.map((def) => {
      const context = createFieldContext<TObject, TPlugins, any>(
        def.path,
        plugins
      );

      const result = def.builderFunction(context);
      
      // Ensure FieldDefinition type compliance
      const fieldDef: FieldDefinition = {
        path: def.path,
        builderFunction: def.builderFunction,
        rules: Array.isArray(result) ? result : [result],
        metadata: {
          inferredType: def.inferredType,
          hasTransforms: false,
          fieldOptions: def.fieldOptions, // Pass field options to metadata
        },
        fieldType: def.inferredType || "unknown",
      };

      return fieldDef;
    });

    // Generate optimized validator with type safety
    return _validatorFactory.buildOptimizedValidator(processedDefinitions);
  };

  // Return the builder interface with all methods
  return {
    field,
    v,
    useField,
    strict,
    strictOnEditor,
    build,
  };
}

// For backward compatibility, export FieldBuilderImpl as an alias
export const FieldBuilderImpl = createFieldBuilderImpl as any;
