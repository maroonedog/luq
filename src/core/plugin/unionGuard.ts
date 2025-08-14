/**
 * @luq-plugin
 * @name unionGuard
 * @category composable-conditional
 * @description Validates union types by applying different validation rules based on type guards
 * @allowedTypes ["union"]
 * @example
 * ```typescript
 * // Union type validation with type guards
 * type StringOrNumber = string | number;
 *
 * const validator = Builder()
 *   .use(unionGuardPlugin)
 *   .for<{ value: StringOrNumber }>()
 *   .v("value", (b) => b.union
 *     .guard(
 *       (v): v is string => typeof v === 'string',
 *       (b) => b.string.min(3)
 *     )
 *     .guard(
 *       (v): v is number => typeof v === 'number',
 *       (b) => b.number.min(0).max(100)
 *     )
 *   )
 *   .build();
 * ```
 * @params
 * - condition: TypeGuardCondition - Type guard function that returns true if value matches the type
 * - builderFn: (context: FieldBuilderContext) => any - Builder function for the specific type
 * @returns Composable validation function that can chain multiple guards
 * @customError
 * Returns false if no guard condition matches the value
 * @since 0.1.0-alpha
 */
/**
 * Union Guard Plugin - Composable implementation for chaining
 * Supports: guard(cond1, builder1).guard(cond2, builder2)
 */

import { createComposableConditionalPlugin } from "../builder/plugins/composable-conditional-plugin";
import {
  createValidatorResult,
  type ComposableValidatorResult,
} from "../builder/plugins/composable-plugin";
import type { FieldBuilderContext } from "../builder/plugins/plugin-types";
import { createFieldContext } from "../builder/context/field-context";

export interface TypeGuardCondition {
  (value: unknown): boolean;
}

export interface GuardBuilderFunction<TObject extends object, TPlugins> {
  (context: FieldBuilderContext<TObject, TPlugins, any>): any;
}

/**
 * Union Guard Composable Plugin
 * Accumulates multiple guard calls and builds an integrated validator
 */
export const unionGuardPlugin = createComposableConditionalPlugin<
  "unionGuard",
  "guard",
  readonly ["union"],
  [TypeGuardCondition, GuardBuilderFunction<object, unknown>]
>(
  "unionGuard",
  "guard",
  ["union"] as const,
  <TPlugins>(
    compositions: Array<
      [TypeGuardCondition, GuardBuilderFunction<object, unknown>]
    >,
    fieldPath: string,
    plugins: TPlugins
  ): ComposableValidatorResult => {
    // If no guards are provided, create a validator that always fails
    if (compositions.length === 0) {
      const alwaysFailValidator = {
        check: () => false,
        name: "unionGuard",
        code: "unionGuard",

        getErrorMessage: (value: any, path: string) => {
          return "No union type guards defined";
        },
      };
      return createValidatorResult([alwaysFailValidator], []);
    }

    // Store guard compositions with pre-built validators
    const guards = compositions.map(([condition, builderFn]) => {
      // Create a field context for the builder
      const context = createFieldContext(fieldPath, plugins);

      // Execute the builder function to get the builder result
      const builderResult = builderFn(context);

      // Build the validators if there's a build method
      let validators: any[] = [];
      if (builderResult && typeof builderResult.build === "function") {
        const built = builderResult.build();
        validators = built._validators || [];
      }

      return {
        condition,
        validators,
      };
    });

    // Create a single validator that checks guards and runs their validators
    const validator = {
      check: (value: unknown, rootData: unknown) => {
        // Find matching guard
        let matchedGuard = null;
        const guardsLength = guards.length;
        for (let i = 0; i < guardsLength; i++) {
          const guard = guards[i];
          if (guard.condition(value)) {
            matchedGuard = guard;
            break;
          }
        }

        if (!matchedGuard) {
          return false; // No guard matches
        }

        // Run all validators for the matched guard
        const validatorsLength = matchedGuard.validators.length;
        for (let i = 0; i < validatorsLength; i++) {
          const validator = matchedGuard.validators[i];
          const result = validator.check(value, rootData);
          if (!result) {
            return false;
          }
        }

        return true;
      },
      name: "unionGuard",
      code: "unionGuard",
      getErrorMessage: (value: any, path: string) => {
        return "Value does not match any union type guard";
      },
    };

    // Return using helper
    return createValidatorResult([validator], []);
  }
);
