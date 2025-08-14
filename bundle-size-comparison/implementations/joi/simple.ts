import * as Joi from "joi";
import { SimpleUser } from "../../schemas/shared-types";

// Joiスキーマ定義
const schema = Joi.object<SimpleUser>({
  name: Joi.string().min(3).max(50).required(),
  email: Joi.string().email().required(),
  age: Joi.number().integer().min(18).max(100).required(),
});

export function validate(data: unknown): boolean {
  const result = schema.validate(data, { abortEarly: false, allowUnknown: true });
  return !result.error;
}

export { schema };
