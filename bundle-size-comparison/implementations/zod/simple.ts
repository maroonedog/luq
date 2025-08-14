import { z } from "zod";
import { SimpleUser } from "../../schemas/shared-types";

// シンプルなユーザースキーマ
export const schema = z.object({
  name: z.string().min(3).max(50),
  email: z.string().email(),
  age: z.number().min(18).max(100),
});

// バリデーション関数
export function validate(data: unknown): boolean {
  return schema.safeParse(data).success;
}

// schema is already exported above as const
