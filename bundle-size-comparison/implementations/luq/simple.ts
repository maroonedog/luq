import { Builder } from "../../../dist/index.js";
import { requiredPlugin } from "../../../dist/plugins/required.js";
import { stringMinPlugin } from "../../../dist/plugins/stringMin.js";
import { stringMaxPlugin } from "../../../dist/plugins/stringMax.js";
import { stringEmailPlugin } from "../../../dist/plugins/stringEmail.js";
import { numberMinPlugin } from "../../../dist/plugins/numberMin.js";
import { numberMaxPlugin } from "../../../dist/plugins/numberMax.js";
import { SimpleUser } from "../../schemas/shared-types";

// Use only necessary minimum plugins
const builder = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringMaxPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .for<SimpleUser>();

// Simple user validator
export const validator = builder
  .v("name", (b) => b.string.required().min(3).max(50))
  .v("email", (b) => b.string.required().email())
  .v("age", (b) => b.number.required().min(18).max(100))
  .build();

// Export validation function
export function validate(data: unknown): boolean {
  return validator
    .validate(data, { abortEarly: false, abortEarlyOnEachField: false })
    .isValid();
}

// validator is already exported above as const
