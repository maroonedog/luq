import * as v from "valibot";
import { SimpleUser } from "../../schemas/shared-types";

// シンプルなユーザースキーマ
export const schema = v.object({
  name: v.string([v.minLength(3), v.maxLength(50)]),
  email: v.string([v.email()]),
  age: v.number([v.minValue(18), v.maxValue(100)]),
});

// バリデーション関数
export function validate(data: unknown): boolean {
  try {
    v.parse(schema, data);
    return true;
  } catch (error) {
    return false;
  }
}
