/**
 * 共通のバリデーションパターン
 * 各ライブラリで同じバリデーションロジックを実装して比較する
 */

export const VALIDATION_PATTERNS = {
  // 基本的なユーザープロファイル
  basicUser: {
    name: "Basic User Profile",
    description: "Name, email, age validation",
    fields: {
      name: { type: "string", min: 2, max: 50, required: true },
      email: { type: "string", format: "email", required: true },
      age: { type: "number", min: 18, max: 120, required: true },
    },
  },

  // 文字列処理重要
  stringProcessing: {
    name: "String Processing Heavy",
    description: "Multiple string validations and transforms",
    fields: {
      username: {
        type: "string",
        pattern: /^[a-zA-Z0-9_]+$/,
        min: 3,
        max: 20,
        required: true,
      },
      bio: { type: "string", max: 500, optional: true },
      website: { type: "string", format: "url", optional: true },
      phone: { type: "string", pattern: /^\+?[\d\s-()]+$/, optional: true },
    },
  },

  // 複雑なオブジェクト
  complexObject: {
    name: "Complex Object Validation",
    description: "Nested objects, arrays, conditional validation",
    fields: {
      user: {
        type: "object",
        fields: {
          profile: {
            type: "object",
            fields: {
              firstName: { type: "string", required: true },
              lastName: { type: "string", required: true },
              avatar: { type: "string", format: "url", optional: true },
            },
          },
          preferences: {
            type: "object",
            fields: {
              theme: {
                type: "string",
                enum: ["light", "dark"],
                required: true,
              },
              notifications: { type: "boolean", required: true },
            },
          },
        },
      },
      tags: { type: "array", items: { type: "string" }, min: 1, max: 10 },
      metadata: { type: "object", additionalProperties: true, optional: true },
    },
  },

  // Transform使用例
  transformHeavy: {
    name: "Transform Heavy Usage",
    description: "Heavy use of transformations",
    fields: {
      email: {
        type: "string",
        transforms: ["trim", "toLowerCase"],
        format: "email",
        required: true,
      },
      name: {
        type: "string",
        transforms: ["trim", "capitalize"],
        min: 2,
        required: true,
      },
      slug: {
        type: "string",
        transforms: ["trim", "slugify"],
        pattern: /^[a-z0-9-]+$/,
        required: true,
      },
      price: {
        type: "string",
        transforms: ["removeNonDigits", "toNumber"],
        min: 0,
        required: true,
      },
    },
  },
};

export default VALIDATION_PATTERNS;
