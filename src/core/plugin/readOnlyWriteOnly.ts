/**
 * @luq-plugin
 * @name readOnlyWriteOnly
 * @category context
 * @description Validates fields based on read-only or write-only context
 * @allowedTypes ["string", "number", "boolean", "date", "array", "object"]
 * @example
 * ```typescript
 * // Read-only field (should not be modified after creation)
 * const validator = Builder()
 *   .use(readOnlyWriteOnlyPlugin)
 *   .for<{ id: string; name: string; }>()
 *   .v("id", (b) => b.string.readOnly())
 *   .v("name", (b) => b.string.required())
 *   .build();
 *
 * // Write-only field (e.g., password that shouldn't be read back)
 * builder.v("password", b => b.string.writeOnly())
 *
 * // With operation context
 * const result = validator.validate(data, { 
 *   context: { operation: "read" } // or "write"
 * });
 * ```
 * @params
 * - mode?: "readOnly" | "writeOnly" - The access mode for the field
 * - options?: { errorMessage?: string } - Optional configuration
 * @returns Validation function that checks field access based on context
 * @since 0.1.0-alpha
 */

import { plugin } from "../builder/plugins/plugin-creator";

export interface ReadOnlyWriteOnlyOptions {
  /** Custom error message */
  errorMessage?: string;
  /** Whether to skip validation entirely for inaccessible fields */
  skipValidation?: boolean;
}

export const readOnlyWriteOnlyPlugin = plugin({
  name: "readOnlyWriteOnly",
  methodName: "readOnly",
  allowedTypes: ["string", "number", "boolean", "date", "array", "object"] as const,
  category: "context" as const,
  impl: (options: ReadOnlyWriteOnlyOptions = {}) => ({
    check: (value: any, allValues: any, context?: any) => {
      // Check if we're in a write context
      const operation = context?.operation || "write";
      
      if (operation === "write") {
        // In write context, readOnly fields should not be present or modified
        if (value !== undefined && context?.isUpdate) {
          return false; // Can't modify read-only field
        }
      }
      
      return true;
    },
    code: "READ_ONLY",
    getErrorMessage: (value: any, path: string) => {
      return options.errorMessage || `${path} is read-only and cannot be modified`;
    },
    params: ["readOnly", options],
  }),
});

// Write-only variant
export const writeOnlyPlugin = plugin({
  name: "writeOnly",
  methodName: "writeOnly",
  allowedTypes: ["string", "number", "boolean", "date", "array", "object"] as const,
  category: "context" as const,
  impl: (options: ReadOnlyWriteOnlyOptions = {}) => ({
    check: (value: any, allValues: any, context?: any) => {
      // Check if we're in a read context
      const operation = context?.operation || "write";
      
      if (operation === "read") {
        // In read context, writeOnly fields should not be present
        if (value !== undefined) {
          return false; // Can't read write-only field
        }
      }
      
      return true;
    },
    code: "WRITE_ONLY",
    getErrorMessage: (value: any, path: string) => {
      return options.errorMessage || `${path} is write-only and cannot be read`;
    },
    params: ["writeOnly", options],
  }),
});