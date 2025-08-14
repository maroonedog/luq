/**
 * Async-compatible plugin extensions
 *
 * Adds async context functionality to the existing plugin system
 * Plugins continue to work synchronously, async data is pre-resolved
 */

import { getAsyncContext } from "./async-context";
import type { ValidationContext } from "../builder/types/types";

/**
 * Utility functions for async plugins
 */
export const AsyncPluginUtils = {
  /**
   * Check if async context exists
   */
  hasAsyncContext(context: ValidationContext<any, any>): boolean {
    return getAsyncContext(context as any) !== undefined;
  },

  /**
   * Check if a specific key exists in async context
   */
  has<T extends Record<string, any> = Record<string, any>>(context: ValidationContext<any, any>, key: keyof T): boolean {
    const asyncData = getAsyncContext<T>(context as any) as
      | Record<any, any>
      | undefined;
    return asyncData !== undefined && key in asyncData;
  },

  /**
   * Safe retrieval of async data
   */
  tryGet<T extends Record<string, any> = Record<string, any>, K extends keyof T = keyof T>(
    context: ValidationContext<any, any>,
    key: K
  ): T[K] | undefined {
    const asyncData = getAsyncContext<T>(context as any);
    return asyncData?.[key];
  },

  /**
   * Required async context validation
   */
  requireAsyncContext<T extends Record<string, any> = Record<string, any>>(
    context: ValidationContext<any, any>
  ): { valid: true; data: T } | { valid: false; message: string } {
    const asyncData = getAsyncContext<T>(context as any);

    if (!asyncData) {
      return {
        valid: false,
        message: "This validation requires async context",
      };
    }

    return { valid: true, data: asyncData };
  },
};
