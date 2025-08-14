import { plugin } from "../builder/plugins/plugin-creator";
import { ValidationOptions } from "./types";
import { NestedKeyOf, TypeOfPath } from "../../types/util";

// V8 Optimization: Module-level constants
const supportedTypes = ["object"] as const;

// Special keywords for recursive validation
export const RECURSIVE_SELF = "__Self" as const;
export const RECURSIVE_ELEMENT = "__Element" as const;

type RecursiveKeyword = typeof RECURSIVE_SELF | typeof RECURSIVE_ELEMENT;

interface RecursiveOptions<TFieldPath extends RecursiveKeyword>
  extends ValidationOptions<{ targetPath: RecursiveKeyword }> {
  targetFieldPath: TFieldPath;
  maxDepth?: number;
}

/**
 * @luq-plugin
 * @name objectRecursively
 * @category standard
 * @description Applies validation rules recursively to nested fields or array elements
 * @allowedTypes ["object"]
 * @example
 * ```typescript
 * // Self-referential structure using __Self
 * type TreeNode = {
 *   id: string;
 *   name: string;
 *   value: number;
 *   parent?: TreeNode;
 *   left?: TreeNode;
 *   right?: TreeNode;
 * }
 *
 * const validator = Builder()
 *   .use(objectRecursivelyPlugin)
 *   .for<TreeNode>()
 *   .v("id", b => b.string.required())
 *   .v("name", b => b.string.required().min(3))
 *   .v("value", b => b.number.required().min(0))
 *   .v("parent", b => b.object.optional().recursively("__Self"))
 *   .v("left", b => b.object.optional().recursively("__Self"))
 *   .v("right", b => b.object.optional().recursively("__Self"))
 *   .build();
 *
 * // Array elements using __Element
 * type Category = {
 *   id: number;
 *   name: string;
 *   description?: string;
 *   parentCategory?: Category;
 *   subcategories: Category[];
 * }
 *
 * const categoryValidator = Builder()
 *   .use(objectRecursivelyPlugin)
 *   .for<Category>()
 *   .v("id", b => b.number.required().min(1))
 *   .v("name", b => b.string.required())
 *   .v("description", b => b.string.optional())
 *   .v("parentCategory", b => b.object.optional().recursively("__Self"))
 *   .v("subcategories", b => b.array.required())
 *   .v("subcategories[*]", b => b.object.recursively("__Element"))
 *   .build();
 * ```
 * @params
 * - targetFieldPath: string | "__Self" | "__Element" - Special keywords or field path
 * - options?: { maxDepth?: number } - Optional configuration for recursion depth
 * @returns Validation function that marks object for recursive validation
 * @customError
 * ```typescript
 * This plugin does not generate errors - it enables recursive validation
 * ```
 * @since 0.1.0-alpha
 */
export const objectRecursivelyPlugin = plugin({
  name: "recursively",
  methodName: "recursively",
  allowedTypes: supportedTypes,
  category: "standard",

  // Update the implementation to accept targetFieldPath as parameter
  impl: (
    targetFieldPath: RecursiveKeyword,
    options?: Omit<RecursiveOptions<RecursiveKeyword>, "targetFieldPath">
  ) => {
    const maxDepth = options?.maxDepth ?? 10;
    const code = options?.code || "recursively";

    // Return hoisted validator format
    return {
      check: (value: any) => {
        // For recursive validation, we always return true
        // The actual recursive logic is handled by the validator factory
        return true;
      },
      code: code,

      getErrorMessage: (value: any, path: string) => {
        if (options?.messageFactory) {
          return options.messageFactory({
            value,
            path,
            code,
            targetPath: targetFieldPath,
          });
        }
        return `Recursive validation for ${targetFieldPath}`;
      },
      params: [targetFieldPath, options],
      // Special marker for recursive validation
      __isRecursive: true,
      // Store recursive configuration
      recursive: {
        targetFieldPath,
        maxDepth,
      },
    };
  },
});
