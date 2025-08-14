import Ajv from "ajv";
import addFormats from "ajv-formats";
import { simpleJsonSchema, SimpleUser } from "../../schemas/shared-types";

// AJVインスタンスを作成
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// バリデータをコンパイル
const validateFn = ajv.compile<SimpleUser>(simpleJsonSchema);

export function validate(data: unknown): boolean {
  return validateFn(data);
}

export { validateFn };
