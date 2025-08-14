import * as yup from "yup";
import { SimpleUser } from "../../schemas/shared-types";

// シンプルなユーザースキーマ
export const schema = yup
  .object({
    name: yup.string().required().min(3).max(50),
    email: yup.string().required().email(),
    age: yup.number().required().min(18).max(100),
  })
  .required();

// バリデーション関数
export function validate(data: unknown): boolean {
  return schema.isValidSync(data);
}
