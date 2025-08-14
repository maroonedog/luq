import Ajv from "ajv";
import addFormats from "ajv-formats";
import { ComplexOrder, jsonSchema } from "../../schemas/shared-types";

// AJVインスタンスを作成
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);

// バリデータをコンパイル
const validateFn = ajv.compile<ComplexOrder>(jsonSchema);

export function validate(data: unknown): boolean {
  return validateFn(data);
}

export { validateFn };
