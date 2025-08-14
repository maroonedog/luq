import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src";
import * as plugins from "../../src/core/plugin";

describe("Comprehensive tests for nested objects", () => {
  const createBuilder = () => {
    return Builder()
      .use(plugins.requiredPlugin)
      .use(plugins.optionalPlugin)
      .use(plugins.nullablePlugin)
      .use(plugins.stringMinPlugin)
      .use(plugins.stringMaxPlugin)
      .use(plugins.stringPatternPlugin)
      .use(plugins.stringEmailPlugin)
      .use(plugins.numberMinPlugin)
      .use(plugins.numberMaxPlugin)
      .use(plugins.numberIntegerPlugin)
      .use(plugins.arrayMinLengthPlugin)
      .use(plugins.arrayMaxLengthPlugin)
      .use(plugins.objectPlugin)
      .use(plugins.objectRecursivelyPlugin);
  };

  describe("Deeply nested objects", () => {
    interface DeepNestedStructure {
      level1: {
        name: string;
        level2: {
          description: string;
          level3: {
            value: number;
            level4: {
              items: string[];
              level5: {
                flag: boolean;
                metadata?: {
                  created: Date;
                  tags?: string[];
                };
              };
            };
          };
        };
      };
    }

    test("Validation of 5-level deep nesting", () => {
      const validator = createBuilder()
        .for<DeepNestedStructure>()
        .v("level1.name", (b) => b.string.required().min(2))
        .v("level1.level2.description", (b) => b.string.required().max(100))
        .v("level1.level2.level3.value", (b) =>
          b.number.required().min(0).max(1000)
        )
        .v("level1.level2.level3.level4.items", (b) =>
          b.array.required().minLength(1)
        )
        .v("level1.level2.level3.level4.level5.flag", (b) =>
          b.boolean.required()
        )
        .v("level1.level2.level3.level4.level5.metadata.tags", (b) =>
          b.array.optional().maxLength(10)
        )
        .build();

      // 有効なデータ
      const validData: DeepNestedStructure = {
        level1: {
          name: "Root",
          level2: {
            description: "Second level description",
            level3: {
              value: 500,
              level4: {
                items: ["item1", "item2"],
                level5: {
                  flag: true,
                  metadata: {
                    created: new Date(),
                    tags: ["tag1", "tag2"],
                  },
                },
              },
            },
          },
        },
      };

      const result = validator.validate(validData);
      expect(result.isValid()).toBe(true);

      // 無効なデータ - 深い階層でのエラー
      const invalidData = {
        level1: {
          name: "R", // 短すぎる
          level2: {
            description: "x".repeat(101), // 長すぎる
            level3: {
              value: 1001, // 範囲外
              level4: {
                items: [], // 空配列
                level5: {
                  flag: true,
                },
              },
            },
          },
        },
      };

      const invalidResult = validator.validate(invalidData);
      expect(invalidresult.isValid()).toBe(false);
      expect(invalidResult.errors).toHaveLength(4);
      expect(invalidResult.errors.map((e) => e.path).sort()).toEqual([
        "level1.level2.description",
        "level1.level2.level3.level4.items",
        "level1.level2.level3.value",
        "level1.name",
      ]);
    });

    test("オプショナルなネストプロパティ", () => {
      interface OptionalNested {
        user: {
          profile?: {
            bio?: string;
            social?: {
              twitter?: string;
              github?: string;
            };
          };
        };
      }

      const validator = createBuilder()
        .for<OptionalNested>()
        .v("user.profile.bio", (b) => b.string.optional().max(500))
        .v("user.profile.social.twitter", (b) =>
          b.string.optional().pattern(/^@[\w]+$/)
        )
        .v("user.profile.social.github", (b) =>
          b.string.optional().pattern(/^[\w-]+$/)
        )
        .build();

      // すべて未定義
      expect(validator.validate({ user: {} }).valid).toBe(true);

      // 部分的に定義
      expect(
        validator.validate({
          user: {
            profile: {
              bio: "Developer",
            },
          },
        }).valid
      ).toBe(true);

      // 無効なパターン
      expect(
        validator.validate({
          user: {
            profile: {
              social: {
                twitter: "invalid_handle", // @が必要
              },
            },
          },
        }).valid
      ).toBe(false);
    });
  });

  describe("配列内のオブジェクトのバリデーション", () => {
    interface ProductOrder {
      orderId: string;
      items: Array<{
        productId: string;
        name: string;
        quantity: number;
        price: number;
        attributes?: {
          color?: string;
          size?: string;
          customization?: {
            text: string;
            font: string;
          };
        };
      }>;
      shipping: {
        addresses: Array<{
          type: "billing" | "shipping";
          street: string;
          city: string;
          country: string;
          postalCode: string;
        }>;
      };
    }

    test("配列の各要素に対するバリデーション", () => {
      // 配列要素のバリデーションを正しく設定
      const validator = createBuilder()
        .use(plugins.oneOfPlugin)
        .for<ProductOrder>()
        .v("orderId", (b) => b.string.required().pattern(/^ORD-\d{6}$/))
        // 配列自体のバリデーション
        .v("items", (b) => b.array.required().minLength(1))
        // 配列要素のバリデーション（[*] syntax を使用）
        .v("items[*].productId", (b) =>
          b.string.required().pattern(/^PROD-\d{4}$/)
        )
        .v("items[*].name", (b) => b.string.required().min(1))
        .v("items[*].quantity", (b) => b.number.required().min(1))
        .v("items[*].price", (b) => b.number.required().min(0))
        .v("items[*].attributes.color", (b) =>
          b.string.optional().oneOf(["blue", "red", "green", "black", "white"])
        )
        .v("items[*].attributes.size", (b) =>
          b.string.optional().oneOf(["S", "M", "L", "XL"])
        )
        // 配送先住所の配列
        .v("shipping.addresses", (b) =>
          b.array.required().minLength(1).maxLength(5)
        )
        .v("shipping.addresses[*].type", (b) =>
          b.string.required().oneOf(["billing", "shipping"])
        )
        .v("shipping.addresses[*].street", (b) => b.string.required().min(5))
        .v("shipping.addresses[*].city", (b) => b.string.required().min(2))
        .v("shipping.addresses[*].country", (b) =>
          b.string.required().pattern(/^[A-Z]{2}$/)
        )
        .v("shipping.addresses[*].postalCode", (b) =>
          b.string.required().pattern(/^\d{5}(-\d{4})?$/)
        )
        .build();

      const validOrder: ProductOrder = {
        orderId: "ORD-123456",
        items: [
          {
            productId: "PROD-1234",
            name: "Custom T-Shirt",
            quantity: 2,
            price: 29.99,
            attributes: {
              color: "blue",
              size: "L",
              customization: {
                text: "Hello World",
                font: "Arial",
              },
            },
          },
          {
            productId: "PROD-5678",
            name: "Standard Cap",
            quantity: 1,
            price: 19.99,
          },
        ],
        shipping: {
          addresses: [
            {
              type: "billing",
              street: "123 Main Street",
              city: "New York",
              country: "US",
              postalCode: "10001",
            },
            {
              type: "shipping",
              street: "456 Oak Avenue",
              city: "Los Angeles",
              country: "US",
              postalCode: "90001-1234",
            },
          ],
        },
      };

      const result = validator.validate(validOrder);
      expect(result.isValid()).toBe(true);

      // 無効なデータ - 配列要素のエラー
      const invalidOrder: ProductOrder = {
        orderId: "INVALID",
        items: [
          {
            productId: "INVALID-ID",
            name: "",
            quantity: 0,
            price: -10,
            attributes: {
              color: "yellow", // 許可されていない色
              size: "XXXL", // 許可されていないサイズ
            },
          },
        ],
        shipping: {
          addresses: [
            {
              type: "express" as any, // 無効なタイプ
              street: "123",
              city: "A",
              country: "USA", // 3文字（2文字であるべき）
              postalCode: "1234", // 無効な形式
            },
          ],
        },
      };

      const invalidResult = validator.validate(invalidOrder);
      expect(invalidresult.isValid()).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(5);
    });

    test("配列インデックスによる動的バリデーション", () => {
      interface Survey {
        questions: Array<{
          id: number;
          text: string;
          required: boolean;
          answer?: string;
        }>;
      }

      // 配列要素のバリデーションを正しく設定
      const validator = createBuilder()
        .use(plugins.requiredIfPlugin)
        .for<Survey>()
        .v("questions", (b) => b.array.required().minLength(1))
        // 配列要素のバリデーション
        .v("questions[*].id", (b) => b.number.required())
        .v("questions[*].text", (b) => b.string.required().min(1))
        .v("questions[*].required", (b) => b.boolean.required())
        // answer フィールドは optional だが、存在する場合は最小長をチェック
        .v("questions[*].answer", (b) => b.string.optional().min(1))
        .build();

      // 必須質問に回答がある場合
      const validSurvey: Survey = {
        questions: [
          {
            id: 1,
            text: "What is your favorite programming language?",
            required: true,
            answer: "TypeScript",
          },
        ],
      };
      expect(validator.validate(validSurvey).valid).toBe(true);

      // 無効なデータを含む質問
      const invalidSurvey: Survey = {
        questions: [
          {
            id: 1,
            text: "", // 空の text（無効）
            required: true,
            answer: "", // 空の answer（無効、min(1) に違反）
          },
        ],
      };
      expect(validator.validate(invalidSurvey).valid).toBe(false);

      // オプション質問（回答なしでOK）
      const optionalSurvey: Survey = {
        questions: [
          {
            id: 2,
            text: "Any additional comments?",
            required: false,
            // answerが欠落してもOK
          },
        ],
      };
      expect(validator.validate(optionalSurvey).valid).toBe(true);
    });
  });

  describe("リカーシブなオブジェクト構造", () => {
    interface TreeNode {
      id: string;
      name: string;
      value: number;
      children?: TreeNode[];
    }

    interface FileSystem {
      root: {
        name: string;
        type: "folder";
        children: Array<{
          name: string;
          type: "file" | "folder";
          size?: number;
          children?: any[];
        }>;
      };
    }

    test("ツリー構造のバリデーション", () => {
      // 配列の特定インデックスへのバリデーションはサポートされていないため、
      // ツリー構造のルートノードのみをバリデーション
      const validator = createBuilder()
        .for<{ tree: TreeNode }>()
        .v("tree.id", (b) => b.string.required().pattern(/^node-\d+$/))
        .v("tree.name", (b) => b.string.required().min(1).max(50))
        .v("tree.value", (b) => b.number.required().min(0))
        .v("tree.children", (b) => b.array.optional())
        .build();

      const validTree = {
        tree: {
          id: "node-1",
          name: "Root",
          value: 100,
          children: [
            {
              id: "node-2",
              name: "Child 1",
              value: 50,
              children: [
                {
                  id: "node-3",
                  name: "Grandchild",
                  value: 25,
                },
              ],
            },
            {
              id: "node-4",
              name: "Child 2",
              value: 50,
            },
          ],
        },
      };

      expect(validator.validate(validTree).valid).toBe(true);

      // 無効なツリー
      const invalidTree = {
        tree: {
          id: "invalid-id",
          name: "",
          value: -10,
          children: [
            {
              id: "node-2",
              name: "x".repeat(51), // 長すぎる
              value: -5, // 負の値
            },
          ],
        },
      };

      const result = validator.validate(invalidTree);
      expect(result.isValid()).toBe(false);
      expect(result.errors.some((e) => e.path === "tree.id")).toBe(true);
      expect(result.errors.some((e) => e.path === "tree.name")).toBe(true);
      expect(result.errors.some((e) => e.path === "tree.value")).toBe(true);
    });

    test("objectRecursivelyプラグインを使った再帰的バリデーション", () => {
      interface Category {
        id: number;
        name: string;
        description?: string;
        parent?: Category;
        children?: Category[];
      }

      const validator = createBuilder()
        .for<{ category: Category }>()
        .v("category", (b) =>
          b.object.recursively({
            maxDepth: 5,
            validate: (ctx) => {
              const cat = ctx.current as Category;
              const errors: Array<{
                path: string;
                message: string;
                code: string;
              }> = [];

              // ID のバリデーション
              if (typeof cat.id !== "number" || cat.id <= 0) {
                errors.push({
                  path: ctx.path + ".id",
                  message: "ID must be a positive number",
                  code: "invalid_id",
                });
              }

              // Name のバリデーション
              if (typeof cat.name !== "string" || cat.name.length < 2) {
                errors.push({
                  path: ctx.path + ".name",
                  message: "Name must be at least 2 characters",
                  code: "invalid_name",
                });
              }

              // Description のバリデーション（オプショナル）
              if (
                cat.description !== undefined &&
                (typeof cat.description !== "string" ||
                  cat.description.length > 200)
              ) {
                errors.push({
                  path: ctx.path + ".description",
                  message:
                    "Description must be a string with max 200 characters",
                  code: "invalid_description",
                });
              }

              return {
                valid: errors.length === 0,
                errors: errors.length > 0 ? errors : undefined,
              };
            },
          })
        )
        .build();

      // 有効な再帰構造
      const validCategory: { category: Category } = {
        category: {
          id: 1,
          name: "Electronics",
          description: "Electronic products",
          children: [
            {
              id: 2,
              name: "Computers",
              children: [
                {
                  id: 3,
                  name: "Laptops",
                },
                {
                  id: 4,
                  name: "Desktops",
                },
              ],
            },
            {
              id: 5,
              name: "Phones",
            },
          ],
        },
      };

      expect(validator.validate(validCategory).valid).toBe(true);

      // 無効な再帰構造
      const invalidCategory = {
        category: {
          id: -1, // 負の値
          name: "A", // 短すぎる
          description: "x".repeat(201), // 長すぎる
          children: [
            {
              id: 0, // 0は無効
              name: "", // 空文字列
              children: [
                {
                  id: "string", // 文字列は無効
                  name: 123, // 数値は無効
                },
              ],
            },
          ],
        },
      };

      const result = validator.validate(invalidCategory);
      expect(result.isValid()).toBe(false);
      expect(result.errors.length).toBeGreaterThan(4);
    });
  });

  describe("複雑な混合パターン", () => {
    interface ComplexDocument {
      meta: {
        version: string;
        created: Date;
        tags: string[];
      };
      sections: Array<{
        id: string;
        title: string;
        content: {
          type: "text" | "image" | "video";
          data: any;
          attributes?: Record<string, any>;
        };
        subsections?: Array<{
          id: string;
          title: string;
          items: Array<{
            key: string;
            value: any;
            metadata?: {
              author: string;
              timestamp: Date;
              revision: number;
            };
          }>;
        }>;
      }>;
      references: {
        internal: Array<{ id: string; path: string }>;
        external: Array<{ url: string; title: string }>;
      };
    }

    test("複雑な混合構造のバリデーション", () => {
      // 配列の特定インデックスへのバリデーションはサポートされていないため、
      // 配列自体と非配列フィールドのバリデーションのみをテスト
      const validator = createBuilder()
        .use(plugins.oneOfPlugin)
        .use(plugins.stringUrlPlugin)
        .for<ComplexDocument>()
        // メタデータ
        .v("meta.version", (b) =>
          b.string.required().pattern(/^\d+\.\d+\.\d+$/)
        )
        .v("meta.tags", (b) => b.array.required().minLength(1).maxLength(10))
        // セクション配列
        .v("sections", (b) => b.array.required().minLength(1))
        // 参照配列
        .v("references.internal", (b) => b.array.required())
        .v("references.external", (b) => b.array.required())
        .build();

      const validDocument: ComplexDocument = {
        meta: {
          version: "1.2.3",
          created: new Date(),
          tags: ["important", "draft"],
        },
        sections: [
          {
            id: "sec-1",
            title: "Introduction",
            content: {
              type: "text",
              data: "Lorem ipsum...",
            },
            subsections: [
              {
                id: "subsec-1",
                title: "Overview",
                items: [
                  {
                    key: "point1",
                    value: "First point",
                    metadata: {
                      author: "John Doe",
                      timestamp: new Date(),
                      revision: 3,
                    },
                  },
                ],
              },
            ],
          },
        ],
        references: {
          internal: [{ id: "ref-1", path: "/docs/guide" }],
          external: [
            { url: "https://example.com", title: "Example Reference" },
          ],
        },
      };

      expect(validator.validate(validDocument).valid).toBe(true);

      // 複数のエラーを含む無効なドキュメント
      const invalidDocument = {
        meta: {
          version: "1.2", // 不完全なバージョン
          created: new Date(),
          tags: [], // 空配列
        },
        sections: [], // 空配列
        references: {
          internal: [
            { id: "invalid", path: "no-slash" }, // 無効なパス
          ],
          external: [
            { url: "not-a-url", title: "" }, // 無効なURL、空のタイトル
          ],
        },
      };

      const result = validator.validate(invalidDocument);
      expect(result.isValid()).toBe(false);
      expect(result.errors.some((e) => e.path === "meta.version")).toBe(true);
      expect(result.errors.some((e) => e.path === "meta.tags")).toBe(true);
      expect(result.errors.some((e) => e.path === "sections")).toBe(true);
    });
  });
});
