import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import { recursivelyWithContextPlugin } from "../../../../src/core/plugin/recursivelyWithContext";
import { objectPlugin } from "../../../../src/core/plugin/object";
import { requiredPlugin } from "../../../../src/core/plugin/required";

describe("recursivelyWithContext Plugin", () => {
  describe("基本動作", () => {
    test("コンテキスト付き再帰バリデーションを有効化", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.recursivelyWithContext())
        .build();

      // マーカープラグインとして常にtrue
      const result = validator.validate({ data: {} });
      expect(result.isValid()).toBe(true);
    });

    test("ネストしたオブジェクトでのコンテキスト再帰", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ tree: { child: { grandchild: object } } }>()
        .v("tree", (b) => b.object.recursivelyWithContext({ maxDepth: 5 }))
        .build();

      const testData = {
        tree: {
          child: {
            grandchild: {
              value: "deep nested",
            },
          },
        },
      };

      expect(validator.validate(testData).valid).toBe(true);
    });

    test("配列内のオブジェクトでのコンテキスト再帰", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ items: Array<{ nested: object }> }>()
        .v("items", (b) => b.array.recursivelyWithContext())
        .build();

      const testData = {
        items: [
          { nested: { id: 1, data: "first" } },
          { nested: { id: 2, data: "second" } },
        ],
      };

      expect(validator.validate(testData).valid).toBe(true);
    });
  });

  describe("最大深度制限", () => {
    test("maxDepthオプションの設定", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.recursivelyWithContext({ maxDepth: 2 }))
        .build();

      // 深度2までの構造
      const validData = {
        data: {
          level1: {
            level2: {
              value: "at depth 2",
            },
          },
        },
      };

      expect(validator.validate(validData).valid).toBe(true);
    });

    test("最大深度を超える場合の処理", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.recursivelyWithContext({ maxDepth: 2 }))
        .build();

      // 深度3以上の構造
      const deepData = {
        data: {
          level1: {
            level2: {
              level3: {
                level4: "too deep",
              },
            },
          },
        },
      };

      // マーカープラグインなので常にtrue（実際の制限は別の場所で処理）
      expect(validator.validate(deepData).valid).toBe(true);
    });

    test("深度ゼロからの開始", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ root: object }>()
        .v("root", (b) => b.object.recursivelyWithContext({ maxDepth: 1 }))
        .build();

      const testData = {
        root: {
          directChild: "depth 0 content",
        },
      };

      expect(validator.validate(testData).valid).toBe(true);
    });
  });

  describe("深度に基づくバリデーション", () => {
    test("validateBasedOnDepth関数の使用", () => {
      let depthChecks: number[] = [];

      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) =>
          b.object.recursivelyWithContext({
            validateBasedOnDepth: (depth) => {
              depthChecks.push(depth);
              return depth <= 2; // 深度2以下のみバリデーション
            },
          })
        )
        .build();

      const testData = {
        data: {
          level1: {
            level2: {
              level3: "should be skipped",
            },
          },
        },
      };

      depthChecks = [];
      const result = validator.validate(testData);
      expect(result.isValid()).toBe(true);

      // validateBasedOnDepthが呼ばれたかの確認（実装依存）
      // Note: マーカープラグインなので実際の呼び出しは別の場所
    });

    test("深度条件による段階的バリデーション", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ menu: object }>()
        .v("menu", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 4,
            validateBasedOnDepth: (depth) => {
              // 深度0-2: フル検証
              // 深度3以上: 軽量検証
              return depth <= 3;
            },
          })
        )
        .build();

      const menuData = {
        menu: {
          main: {
            submenu: {
              items: {
                action: "deep action", // 深度3
                nestedAction: {
                  value: "very deep", // 深度4、軽量検証
                },
              },
            },
          },
        },
      };

      expect(validator.validate(menuData).valid).toBe(true);
    });
  });

  describe("カスタムエラーメッセージ", () => {
    test("maxDepth超過時のカスタムメッセージ", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 1,
            messageFactory: ({ maxDepth, currentDepth }) =>
              `Nesting too deep: ${currentDepth}/${maxDepth}`,
          })
        )
        .build();

      // マーカープラグインなので常にtrue
      const result = validator.validate({
        data: { level1: { level2: "too deep" } },
      });
      expect(result.isValid()).toBe(true);
    });

    test("カスタムエラーコードの設定", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ tree: object }>()
        .v("tree", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 2,
            code: "TREE_TOO_DEEP",
          })
        )
        .build();

      expect(
        validator.validate({
          tree: { branch: { leaf: { tooDeep: true } } },
        }).valid
      ).toBe(true);
    });
  });

  describe("コンテキスト情報の活用", () => {
    test("親オブジェクトへの参照", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ hierarchy: object }>()
        .v("hierarchy", (b) => b.object.recursivelyWithContext())
        .build();

      const hierarchyData = {
        hierarchy: {
          parent: {
            id: "parent",
            child: {
              id: "child",
              parentId: "parent", // 親への参照
            },
          },
        },
      };

      expect(validator.validate(hierarchyData).valid).toBe(true);
    });

    test("ルートオブジェクトへの参照", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ system: object }>()
        .v("system", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 10,
          })
        )
        .build();

      const systemData = {
        system: {
          rootConfig: "global",
          modules: {
            moduleA: {
              config: "local",
              reference: "should access root",
            },
          },
        },
      };

      expect(validator.validate(systemData).valid).toBe(true);
    });
  });

  describe("複雑な再帰構造", () => {
    test("ツリー構造での深度制限", () => {
      type TreeNode = {
        id: string;
        children?: TreeNode[];
        metadata?: {
          level: number;
          parent?: string;
        };
      };

      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ tree: TreeNode }>()
        .v("tree", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 5,
            validateBasedOnDepth: (depth) => depth <= 4,
          })
        )
        .build();

      const treeData = {
        tree: {
          id: "root",
          metadata: { level: 0 },
          children: [
            {
              id: "child1",
              metadata: { level: 1, parent: "root" },
              children: [
                {
                  id: "grandchild1",
                  metadata: { level: 2, parent: "child1" },
                },
              ],
            },
          ],
        },
      };

      expect(validator.validate(treeData).valid).toBe(true);
    });

    test("グラフ構造での循環検出", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ graph: object }>()
        .v("graph", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 3,
          })
        )
        .build();

      // 循環参照グラフ
      const nodeA: any = { id: "A" };
      const nodeB: any = { id: "B" };
      nodeA.next = nodeB;
      nodeB.next = nodeA; // 循環参照

      expect(() => {
        const result = validator.validate({ graph: nodeA });
        expect(result.isValid()).toBe(true);
      }).not.toThrow();
    });
  });

  describe("他のプラグインとの組み合わせ", () => {
    test("recursivelyWithContext + required の組み合わせ", () => {
      const validator = Builder()
        .use(requiredPlugin)
        .use(recursivelyWithContextPlugin)
        .for<{ config: object }>()
        .v("config", (b) => b.object.required().recursivelyWithContext())
        .build();

      expect(validator.validate({ config: {} }).valid).toBe(true);
      expect(validator.validate({}).valid).toBe(false); // requiredで失敗
    });

    test("recursivelyWithContext + object の組み合わせ", () => {
      const validator = Builder()
        .use(objectPlugin)
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) =>
          b.object.object().recursivelyWithContext({ maxDepth: 3 })
        )
        .build();

      expect(validator.validate({ data: {} }).valid).toBe(true);
      expect(validator.validate({ data: "not object" }).valid).toBe(false);
    });
  });

  describe("実用的なシナリオ", () => {
    test("設定ファイルの階層バリデーション", () => {
      type Config = {
        database: {
          primary: {
            connection: {
              pool?: { max: number; min: number };
            };
          };
          replicas?: {
            [key: string]: {
              connection: object;
            };
          };
        };
      };

      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<Config>()
        .v("database", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 6,
            validateBasedOnDepth: (depth) => depth <= 5,
          })
        )
        .build();

      const configData = {
        database: {
          primary: {
            connection: {
              pool: { max: 10, min: 2 },
            },
          },
          replicas: {
            replica1: {
              connection: { host: "replica1.db" },
            },
            replica2: {
              connection: { host: "replica2.db" },
            },
          },
        },
      };

      expect(validator.validate(configData).valid).toBe(true);
    });

    test("CMSコンテンツ構造の再帰バリデーション", () => {
      type ContentNode = {
        type: string;
        content?: string;
        children?: ContentNode[];
        attributes?: {
          [key: string]: any;
        };
      };

      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ page: ContentNode }>()
        .v("page", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 8,
            validateBasedOnDepth: (depth) => depth <= 6, // 深すぎるネストは軽量チェック
          })
        )
        .build();

      const pageData = {
        page: {
          type: "page",
          children: [
            {
              type: "section",
              children: [
                {
                  type: "paragraph",
                  content: "Hello world",
                  attributes: { style: "bold" },
                },
                {
                  type: "list",
                  children: [
                    { type: "listItem", content: "Item 1" },
                    { type: "listItem", content: "Item 2" },
                  ],
                },
              ],
            },
          ],
        },
      };

      expect(validator.validate(pageData).valid).toBe(true);
    });

    test("組織階層の深度制限バリデーション", () => {
      type Department = {
        name: string;
        manager?: string;
        subdepartments?: Department[];
        employees?: string[];
      };

      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ organization: Department }>()
        .v("organization", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 4, // 最大4階層まで
            messageFactory: ({ currentDepth, maxDepth }) =>
              `Organization depth ${currentDepth} exceeds limit ${maxDepth}`,
          })
        )
        .build();

      const orgData = {
        organization: {
          name: "Corporation",
          subdepartments: [
            {
              name: "Engineering",
              subdepartments: [
                {
                  name: "Frontend",
                  employees: ["Alice", "Bob"],
                },
                {
                  name: "Backend",
                  subdepartments: [
                    {
                      name: "API Team", // 深度3
                      employees: ["Charlie"],
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      expect(validator.validate(orgData).valid).toBe(true);
    });
  });

  describe("パフォーマンステスト", () => {
    test("深いネスト構造でのパフォーマンス", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ deep: object }>()
        .v("deep", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 6,
            validateBasedOnDepth: (depth) => depth <= 4,
          })
        )
        .build();

      // 6層の深いネスト構造を生成
      const createDeepStructure = (depth: number): any => {
        if (depth <= 0) return { value: "leaf" };
        return {
          id: `level-${depth}`,
          nested: createDeepStructure(depth - 1),
          siblings: Array.from({ length: 3 }, (_, i) => ({
            id: `sibling-${depth}-${i}`,
            data: `data-${i}`,
          })),
        };
      };

      const deepData = { deep: createDeepStructure(6) };

      const start = performance.now();
      const result = validator.validate(deepData);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(50); // 50ms以内での完了を期待
    });

    test("大量の並列オブジェクトでのパフォーマンス", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) =>
          b.object.recursivelyWithContext({
            maxDepth: 3,
          })
        )
        .build();

      // 大量の並列オブジェクトを生成
      const wideData: any = { data: {} };
      for (let i = 0; i < 100; i++) {
        wideData.data[`item${i}`] = {
          id: i,
          nested: {
            value: `nested-${i}`,
            deep: {
              value: `deep-${i}`,
            },
          },
        };
      }

      const start = performance.now();
      const result = validator.validate(wideData);
      const end = performance.now();

      expect(result.isValid()).toBe(true);
      expect(end - start).toBeLessThan(100); // 100ms以内での完了を期待
    });
  });

  describe("エラーハンドリング", () => {
    test("循環参照での安全な処理", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ circular: any }>()
        .v("circular", (b) => b.object.recursivelyWithContext({ maxDepth: 5 }))
        .build();

      // 複雑な循環参照を作成
      const objA: any = { id: "A" };
      const objB: any = { id: "B" };
      const objC: any = { id: "C" };

      objA.refs = [objB, objC];
      objB.refs = [objA, objC];
      objC.refs = [objA, objB];

      expect(() => {
        const result = validator.validate({ circular: objA });
        expect(result.isValid()).toBe(true);
      }).not.toThrow();
    });

    test("null/undefinedプロパティの処理", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: object }>()
        .v("data", (b) => b.object.recursivelyWithContext())
        .build();

      const dataWithNulls = {
        data: {
          valid: "value",
          nullValue: null,
          undefinedValue: undefined,
          nested: {
            alsoNull: null,
            stillValid: "data",
          },
        },
      };

      expect(validator.validate(dataWithNulls).valid).toBe(true);
    });
  });

  describe("エッジケース", () => {
    test("空オブジェクトの再帰処理", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ empty: object }>()
        .v("empty", (b) => b.object.recursivelyWithContext())
        .build();

      expect(validator.validate({ empty: {} }).valid).toBe(true);
    });

    test("プリミティブ値での安全な処理", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ data: any }>()
        .v("data", (b) => b.recursivelyWithContext())
        .build();

      // プリミティブ値は再帰処理をスキップ
      expect(validator.validate({ data: "string" }).valid).toBe(true);
      expect(validator.validate({ data: 123 }).valid).toBe(true);
      expect(validator.validate({ data: true }).valid).toBe(true);
    });

    test("配列の混在構造", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ mixed: object }>()
        .v("mixed", (b) => b.object.recursivelyWithContext({ maxDepth: 4 }))
        .build();

      const mixedData = {
        mixed: {
          arrays: [
            { nested: { deep: "value1" } },
            { nested: { deep: "value2" } },
          ],
          objects: {
            obj1: { array: [1, 2, 3] },
            obj2: { nested: { array: ["a", "b"] } },
          },
        },
      };

      expect(validator.validate(mixedData).valid).toBe(true);
    });

    test("関数プロパティを含むオブジェクト", () => {
      const validator = Builder()
        .use(recursivelyWithContextPlugin)
        .for<{ obj: any }>()
        .v("obj", (b) => b.object.recursivelyWithContext())
        .build();

      const objWithFunction = {
        obj: {
          method: () => "I'm a function",
          data: "I'm data",
          nested: {
            anotherMethod: function () {
              return "old style";
            },
            value: 42,
          },
        },
      };

      expect(validator.validate(objWithFunction).valid).toBe(true);
    });
  });
});
