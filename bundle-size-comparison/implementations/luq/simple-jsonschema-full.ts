import { Builder } from "../../../dist/index.js";
import { jsonSchemaFullFeaturePlugin } from "../../../dist/plugins/jsonSchemaFullFeature.js";
import { simpleJsonSchema, SimpleUser } from "../../schemas/shared-types";

// Use JSON Schema full feature plugin (includes all necessary plugins)
const builder = Builder().use(jsonSchemaFullFeaturePlugin);

// Build validator from JSON Schema
export const validator = builder.fromJsonSchema(simpleJsonSchema).build();

// Export validation function
export function validate(data: unknown): boolean {
  return validator
    .parse(data, { abortEarly: false, abortEarlyOnEachField: false })
    .isValid();
}
