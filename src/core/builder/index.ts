/**
 * Builder module - organized by functionality
 *
 * New directory structure:
 * - core/         - Core builder functionality
 * - plugins/      - Plugin system
 * - context/      - Field context management
 * - validation/   - Validation engine
 * - types/        - Type definitions and results
 * - analysis/     - Analysis and optimization
 */

// Core Builder Functionality
export * from "./core/builder";
export * from "./core/field-builder";

// Plugin System
export * from "./plugins/composable-plugin";
export * from "./plugins/composable-conditional-plugin";
export * from "./plugins/composable-directly-plugin";
export * from "./plugins/plugin-interfaces";
export * from "./plugins/plugin-types";

// Field Context Management
export * from "./context/field-context";

// Validation Engine
export { createValidatorFactory } from "./validator-factory";

// Type Definitions and Results
export * from "./types/types";

// Re-export from core for backward compatibility
export { Builder } from "./core/builder";
export type { FieldBuilder } from "./core/field-builder";
export { createFieldContext } from "./context/field-context";
