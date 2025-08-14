import { Builder } from "../../../dist/index.js";
import { jsonSchemaPlugin } from "../../../dist/plugins/jsonSchema.js";
import { requiredPlugin } from "../../../dist/plugins/required.js";
import { requiredIfPlugin } from "../../../dist/plugins/requiredIf.js";
import { stringMinPlugin } from "../../../dist/plugins/stringMin.js";
import { stringMaxPlugin } from "../../../dist/plugins/stringMax.js";
import { stringEmailPlugin } from "../../../dist/plugins/stringEmail.js";
import { stringPatternPlugin } from "../../../dist/plugins/stringPattern.js";
import { numberMinPlugin } from "../../../dist/plugins/numberMin.js";
import { numberMaxPlugin } from "../../../dist/plugins/numberMax.js";
import { numberIntegerPlugin } from "../../../dist/plugins/numberInteger.js";
import { arrayMinLengthPlugin } from "../../../dist/plugins/arrayMinLength.js";
import { arrayMaxLengthPlugin } from "../../../dist/plugins/arrayMaxLength.js";
import { arrayUniquePlugin } from "../../../dist/plugins/arrayUnique.js";
import { objectMinPropertiesPlugin } from "../../../dist/plugins/objectMinProperties.js";
import { objectMaxPropertiesPlugin } from "../../../dist/plugins/objectMaxProperties.js";
import { objectAdditionalPropertiesPlugin } from "../../../dist/plugins/objectAdditionalProperties.js";
import { oneOfPlugin } from "../../../dist/plugins/oneOf.js";
import { customPlugin } from "../../../dist/plugins/custom.js";
import { jsonSchema } from "../../schemas/shared-types";

// Use JSON Schema plugin with all required validation plugins
const builder = Builder()
  .use(jsonSchemaPlugin)
  .use(requiredPlugin)
  .use(requiredIfPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(stringPatternPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .use(numberIntegerPlugin)
  .use(arrayMinLengthPlugin)
  .use(arrayMaxLengthPlugin)
  .use(arrayUniquePlugin)
  .use(objectMinPropertiesPlugin)
  .use(objectMaxPropertiesPlugin)
  .use(objectAdditionalPropertiesPlugin)
  .use(oneOfPlugin)
  .use(customPlugin);

// Build validator from JSON Schema
export const validator = builder.fromJsonSchema(jsonSchema).build();

// Export validation function
export function validate(data: unknown): boolean {
  return validator
    .validate(data, { abortEarly: false, abortEarlyOnEachField: false })
    .isValid();
}
