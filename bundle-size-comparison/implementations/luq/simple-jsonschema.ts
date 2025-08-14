import { Builder } from "../../../dist/index.js";
import { jsonSchemaPlugin } from "../../../dist/plugins/jsonSchema.js";
import { requiredPlugin } from "../../../dist/plugins/required.js";
import { stringMinPlugin } from "../../../dist/plugins/stringMin.js";
import { stringMaxPlugin } from "../../../dist/plugins/stringMax.js";
import { stringEmailPlugin } from "../../../dist/plugins/stringEmail.js";
import { numberMinPlugin } from "../../../dist/plugins/numberMin.js";
import { numberMaxPlugin } from "../../../dist/plugins/numberMax.js";
import { numberIntegerPlugin } from "../../../dist/plugins/numberInteger.js";
import { simpleJsonSchema, SimpleUser } from "../../schemas/shared-types";

// Use JSON Schema plugin with required validation plugins
const builder = Builder()
  .use(jsonSchemaPlugin)
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .use(numberIntegerPlugin);

// Build validator from JSON Schema
export const validator = builder.fromJsonSchema(simpleJsonSchema).build();

// Export validation function
export function validate(data: unknown): boolean {
  return validator
    .validate(data, { abortEarly: false, abortEarlyOnEachField: false })
    .isValid();
}
