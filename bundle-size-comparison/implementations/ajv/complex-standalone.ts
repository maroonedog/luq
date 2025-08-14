// AJV Standalone version - Pre-compiled validator without runtime compilation
// This imports the pre-generated standalone validator from ajv-standalone directory

// Import the standalone validator
import { validate } from "../ajv-standalone/complex";
import { ComplexOrder } from "../../schemas/shared-types";

// Export for benchmarking
export { validate };

// Also export as validateFn for compatibility
export const validateFn = validate;

// Type assertion for TypeScript
export type ValidateFunction = (data: unknown) => data is ComplexOrder;