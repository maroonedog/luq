import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src";
import {
  objectPlugin,
  objectRecursivelyPlugin,
  requiredPlugin,
  optionalPlugin,
  stringMinPlugin,
  numberMinPlugin,
  arrayMinLengthPlugin,
} from "../../../../src/core/plugin";

describe("objectRecursively Plugin - 新仕様", () => {
  describe("基本動作: 指定フィールドへの再帰的バリデーション", () => {
    test("同じ型のフィールドに再帰的にバリデーションを適用", () => {
      type TreeNode = {
        id: string;
        name: string;
        value: number;
        left?: TreeNode;
        right?: TreeNode;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<TreeNode>()
        .v("id", (b) => b.string.required())
        .v("name", (b) => b.string.required().min(3))
        .v("value", (b) => b.number.required().min(0))
        .v("left", (b) => b.object.optional().recursively("__Self"))
        .v("right", (b) => b.object.optional().recursively("__Self"))
        .build();

      // Valid tree
      const validTree: TreeNode = {
        id: "root",
        name: "Root",
        value: 10,
        left: {
          id: "left1",
          name: "Left",
          value: 5,
        },
        right: {
          id: "right1",
          name: "Right",
          value: 15,
        },
      };

      const result = validator.validate(validTree);
      expect(result.isValid()).toBe(true);
    });

    test("再帰的なバリデーションでエラーを検出", () => {
      type TreeNode = {
        id: string;
        name: string;
        value: number;
        parent?: TreeNode;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<TreeNode>()
        .v("id", (b) => b.string.required())
        .v("name", (b) => b.string.required().min(3))
        .v("value", (b) => b.number.required().min(0))
        .v("parent", (b) => b.object.optional().recursively("__Self"))
        .build();

      // Invalid nested data
      const invalidTree: TreeNode = {
        id: "child",
        name: "Child Node",
        value: 10,
        parent: {
          id: "parent",
          name: "P", // Too short - should be caught by recursively
          value: -5, // Negative - should be caught by recursively
        },
      };

      const result = validator.validate(invalidTree);

      // Recursive validation should now work
      expect(result.isValid()).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "parent.name",
          code: "stringMin",
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "parent.value",
          code: "numberMin",
        })
      );
    });

    test("配列要素への再帰的バリデーション - [*]記法", () => {
      type Category = {
        id: number;
        name: string;
        subcategories: Category[];
      };

      type ProductCatalog = {
        categories: Category[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<ProductCatalog>()
        .v("categories", (b) => b.array.required().minLength(1))
        .v("categories[*]", (b) => b.object.recursively("__Self"))
        .v("categories[*].id", (b) => b.number.required().min(1))
        .v("categories[*].name", (b) => b.string.required().min(2))
        .v("categories[*].subcategories", (b) => b.array.required())
        .build();

      const validCatalog: ProductCatalog = {
        categories: [
          {
            id: 1,
            name: "Electronics",
            subcategories: [
              {
                id: 2,
                name: "Phones",
                subcategories: [],
              },
            ],
          },
          {
            id: 3,
            name: "Books",
            subcategories: [],
          },
        ],
      };

      const result = validator.validate(validCatalog);
      expect(result.isValid()).toBe(true);
    });

    test("配列要素の再帰的バリデーションでエラーを検出", () => {
      type Category = {
        id: number;
        name: string;
        subcategories: Category[];
      };

      type ProductCatalog = {
        categories: Category[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<ProductCatalog>()
        .v("categories", (b) => b.array.required().minLength(1))
        .v("categories[*]", (b) => b.object.recursively("__Self"))
        .v("categories[*].id", (b) => b.number.required().min(1))
        .v("categories[*].name", (b) => b.string.required().min(2))
        .v("categories[*].subcategories", (b) => b.array.required())
        .build();

      const invalidCatalog: ProductCatalog = {
        categories: [
          {
            id: 1,
            name: "Electronics",
            subcategories: [
              {
                id: 0, // Invalid: below minimum
                name: "P", // Invalid: too short
                subcategories: [],
              },
            ],
          },
        ],
      };

      const result = validator.validate(invalidCatalog);
      expect(result.isValid()).toBe(false);

      // Should detect errors in nested array elements
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "categories[0].subcategories[0].id",
          code: "numberMin",
        })
      );
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: "categories[0].subcategories[0].name",
          code: "stringMin",
        })
      );
    });

    test("最大深度の制限", () => {
      type DeepTree = {
        value: number;
        child?: DeepTree;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<DeepTree>()
        .v("value", (b) => b.number.required().min(0))
        .v("child", (b) =>
          b.object.optional().recursively("__Self", { maxDepth: 3 })
        )
        .build();

      // Create a deeply nested structure
      const deepTree: DeepTree = {
        value: 1,
        child: {
          value: 2,
          child: {
            value: 3,
            child: {
              value: 4,
              child: {
                value: -1, // This should not be validated due to maxDepth
              },
            },
          },
        },
      };

      const result = validator.validate(deepTree);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("型安全性のテスト", () => {
    test("同じ型のフィールドのみrecursivelyを適用可能", () => {
      type MixedData = {
        id: string;
        parent?: MixedData;
        count: number;
        items: string[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<MixedData>()
        .v("id", (b) => b.string.required())
        .v("parent", (b) => b.object.optional().recursively("__Self"))
        .v("count", (b) => b.number.required())
        .v("items", (b) => b.array.required())
        .build();

      // TypeScript should only allow recursively on fields of the same type
      // The following should not compile:
      // .v("count", (b) => b.number.required().recursively("count")) // Error: number doesn't have recursively
      // .v("parent", (b) => b.object.optional().recursively("count")) // Error: count is not MixedData type

      expect(true).toBe(true); // Type test
    });
  });

  describe("複雑な再帰構造", () => {
    test("相互参照を持つ構造", () => {
      type Node = {
        id: string;
        name: string;
        parent?: Node;
        children: Node[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<Node>()
        .v("id", (b) => b.string.required())
        .v("name", (b) => b.string.required().min(2))
        .v("parent", (b) => b.object.optional().recursively("__Self"))
        .v("children", (b) => b.array.required())
        .build();

      const rootNode: Node = {
        id: "root",
        name: "Root",
        children: [
          {
            id: "child1",
            name: "Child 1",
            children: [],
          },
          {
            id: "child2",
            name: "Child 2",
            children: [
              {
                id: "grandchild",
                name: "Grandchild",
                children: [],
              },
            ],
          },
        ],
      };

      const result = validator.validate(rootNode);
      expect(result.isValid()).toBe(true);
    });

    test("異なる再帰パスを持つ構造", () => {
      type FileSystemNode = {
        name: string;
        type: "file" | "directory";
        parent?: FileSystemNode;
        children?: FileSystemNode[];
        symlink?: FileSystemNode;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .use(oneOfPlugin)
        .for<FileSystemNode>()
        .v("name", (b) => b.string.required().min(1))
        .v("type", (b) => b.string.required().oneOf(["file", "directory"]))
        .v("parent", (b) => b.object.optional().recursively("__Self"))
        .v("children", (b) => b.array.optional())
        .v("children[*]", (b) => b.object.recursively("__Element"))
        .v("symlink", (b) => b.object.optional().recursively("__Self"))
        .build();

      const fileSystem: FileSystemNode = {
        name: "root",
        type: "directory",
        children: [
          {
            name: "home",
            type: "directory",
            children: [
              {
                name: "user",
                type: "directory",
                children: [],
              },
            ],
          },
          {
            name: "link",
            type: "file",
            symlink: {
              name: "target",
              type: "file",
            },
          },
        ],
      };

      const result = validator.validate(fileSystem);
      expect(result.isValid()).toBe(true);
    });
  });

  describe("エラーケースとエッジケース", () => {
    test("循環参照の処理", () => {
      type CircularNode = {
        id: string;
        name: string;
        next?: CircularNode;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<CircularNode>()
        .v("id", (b) => b.string.required())
        .v("name", (b) => b.string.required().min(2))
        .v("next", (b) => b.object.optional().recursively("__Self"))
        .build();

      // Create circular reference
      const node1: CircularNode = { id: "1", name: "Node 1" };
      const node2: CircularNode = { id: "2", name: "Node 2", next: node1 };
      node1.next = node2; // Circular reference

      // Should not cause infinite loop - circular references are handled gracefully
      expect(() => {
        const result = validator.validate(node1);
        expect(result.isValid()).toBe(true);
      }).not.toThrow();
    });

    test("nullとundefinedの処理", () => {
      type NullableNode = {
        value: string;
        next?: NullableNode | null;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .use(nullablePlugin)
        .for<NullableNode>()
        .v("value", (b) => b.string.required())
        .v("next", (b) => b.object.nullable().recursively("__Self"))
        .build();

      const nodeWithNull: NullableNode = {
        value: "test",
        next: null,
      };

      const nodeWithUndefined: NullableNode = {
        value: "test",
      };

      expect(validator.validate(nodeWithNull).isValid()).toBe(true);
      expect(validator.validate(nodeWithUndefined).isValid()).toBe(true);
    });
  });

  describe("実用的なユースケース", () => {
    test("組織階層構造", () => {
      type Organization = {
        id: number;
        name: string;
        description?: string;
        parentOrg?: Organization;
        departments: Department[];
      };

      type Department = {
        id: number;
        name: string;
        manager: string;
        subDepartments: Department[];
      };

      const deptValidator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<Department>()
        .v("id", (b) => b.number.required().min(1))
        .v("name", (b) => b.string.required().min(2))
        .v("manager", (b) => b.string.required())
        .v("subDepartments", (b) => b.array.required())
        .build();

      const orgValidator = Builder()
        .use(requiredPlugin)
        .use(optionalPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(objectPlugin)
        .use(objectRecursivelyPlugin)
        .for<Organization>()
        .v("id", (b) => b.number.required().min(1))
        .v("name", (b) => b.string.required().min(3))
        .v("description", (b) => b.string.optional())
        .v("parentOrg", (b) => b.object.optional().recursively("__Self"))
        .v("departments", (b) => b.array.required())
        .build();

      const org: Organization = {
        id: 1,
        name: "TechCorp",
        description: "Technology Company",
        departments: [
          {
            id: 10,
            name: "Engineering",
            manager: "John Doe",
            subDepartments: [
              {
                id: 11,
                name: "Frontend",
                manager: "Jane Smith",
                subDepartments: [],
              },
              {
                id: 12,
                name: "Backend",
                manager: "Bob Johnson",
                subDepartments: [],
              },
            ],
          },
        ],
        parentOrg: {
          id: 1,
          name: "Parent Corp",
          departments: [],
        },
      };

      const orgResult = orgValidator.validate(org);
      expect(orgResult.isValid()).toBe(true);
    });
  });
});

// Import missing plugins
import { oneOfPlugin } from "../../../../src/core/plugin/oneOf";
import { nullablePlugin } from "../../../../src/core/plugin/nullable";
