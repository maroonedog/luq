import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../src/core/builder";
import { requiredPlugin } from "../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../src/core/plugin/numberMin";
import { stringEmailPlugin } from "../../../src/core/plugin/stringEmail";
import { arrayMinLengthPlugin } from "../../../src/core/plugin/arrayMinLength";
import { stringPatternPlugin } from "../../../src/core/plugin/stringPattern";
import { transformPlugin } from "../../../src/core/plugin/transform";

describe("Nested Array Batching Tests", () => {
  test("should handle nested arrays - users[].addresses[].street", () => {
    // データ構造: ユーザーの配列、各ユーザーは住所の配列を持つ
    type UserWithAddresses = {
      users: Array<{
        name: string;
        addresses: Array<{
          street: string;
          city: string;
          zip: string;
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<UserWithAddresses>()
      .v("users", (b) => b.array.required().minLength(1))
      .v("users[*].name", (b) => b.string.required().min(2))
      .v("users[*].addresses", (b) => b.array.required().minLength(1))
      .v("users[*].addresses[*].street", (b) => b.string.required().min(5))
      .v("users[*].addresses[*].city", (b) => b.string.required().min(2))
      .v("users[*].addresses[*].zip", (b) => b.string.required().min(5))
      .build();

    // 有効なデータ
    const validData: UserWithAddresses = {
      users: [
        {
          name: "John Doe",
          addresses: [
            {
              street: "123 Main Street",
              city: "New York",
              zip: "10001",
            },
            {
              street: "456 Park Avenue",
              city: "Brooklyn",
              zip: "11201",
            },
          ],
        },
        {
          name: "Jane Smith",
          addresses: [
            {
              street: "789 Broadway",
              city: "Queens",
              zip: "11372",
            },
          ],
        },
      ],
    };

    const validResult = validator.validate(validData);
    expect(validResult.isValid()).toBe(true);

    // 無効なデータ - ネストした配列内のフィールドエラー
    const invalidData = {
      users: [
        {
          name: "John Doe",
          addresses: [
            {
              street: "123", // Too short (min 5)
              city: "NY",
              zip: "10001",
            },
            {
              street: "456 Park Avenue",
              city: "B", // Too short (min 2)
              zip: "112", // Too short (min 5)
            },
          ],
        },
        {
          name: "J", // Too short (min 2)
          addresses: [], // Empty array (min length 1)
        },
      ],
    };

    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
    const errors = invalidResult.errors;

    // エラーパスが正しく生成されているか確認
    const errorPaths = errors.map((e) => e.path).sort();
    expect(errorPaths).toContain("users[0].addresses[0].street");
    expect(errorPaths).toContain("users[0].addresses[1].city");
    expect(errorPaths).toContain("users[0].addresses[1].zip");
    expect(errorPaths).toContain("users[1].name");
    expect(errorPaths).toContain("users[1].addresses");
  });

  test("should handle triple nested arrays - departments[].teams[].members[].skills", () => {
    // 3階層のネストした配列
    type Organization = {
      departments: Array<{
        name: string;
        teams: Array<{
          name: string;
          members: Array<{
            name: string;
            email: string;
            skills: string[];
          }>;
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringEmailPlugin)
      .use(arrayMinLengthPlugin)
      .for<Organization>()
      .v("departments", (b) => b.array.required().minLength(1))
      .v("departments[*].name", (b) => b.string.required().min(3))
      .v("departments[*].teams", (b) => b.array.required().minLength(1))
      .v("departments[*].teams[*].name", (b) => b.string.required().min(3))
      .v("departments[*].teams[*].members", (b) =>
        b.array.required().minLength(1)
      )
      .v("departments[*].teams[*].members[*].name", (b) =>
        b.string.required().min(2)
      )
      .v("departments[*].teams[*].members[*].email", (b) =>
        b.string.required().email()
      )
      .v("departments[*].teams[*].members[*].skills", (b) =>
        b.array.required().minLength(1)
      )
      .build();

    const validData: Organization = {
      departments: [
        {
          name: "Engineering",
          teams: [
            {
              name: "Frontend",
              members: [
                {
                  name: "Alice",
                  email: "alice@example.com",
                  skills: ["React", "TypeScript"],
                },
              ],
            },
          ],
        },
      ],
    };

    const result = validator.validate(validData);
    expect(result.isValid()).toBe(true);

    // 3階層目でのエラー
    const invalidData = {
      departments: [
        {
          name: "Eng",
          teams: [
            {
              name: "FE", // Too short
              members: [
                {
                  name: "A", // Too short
                  email: "invalid-email", // Invalid email
                  skills: [], // Empty array
                },
              ],
            },
          ],
        },
      ],
    };

    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);
    const errors = invalidResult.errors;

    const errorPaths = errors.map((e) => e.path).sort();
    expect(errorPaths).toContain("departments[0].teams[0].name");
    expect(errorPaths).toContain("departments[0].teams[0].members[0].name");
    expect(errorPaths).toContain("departments[0].teams[0].members[0].email");
    expect(errorPaths).toContain("departments[0].teams[0].members[0].skills");
  });

  test("should handle mixed array and object nesting", () => {
    // 配列とオブジェクトが混在したネスト
    type ComplexData = {
      company: {
        name: string;
        locations: Array<{
          address: {
            street: string;
            buildings: Array<{
              name: string;
              floors: number;
            }>;
          };
        }>;
      };
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .use(arrayMinLengthPlugin)
      .for<ComplexData>()
      .v("company.name", (b) => b.string.required().min(3))
      .v("company.locations", (b) => b.array.required().minLength(1))
      .v("company.locations[*].address.street", (b) =>
        b.string.required().min(5)
      )
      .v("company.locations[*].address.buildings", (b) =>
        b.array.required().minLength(1)
      )
      .v("company.locations[*].address.buildings[*].name", (b) =>
        b.string.required().min(2)
      )
      .v("company.locations[*].address.buildings[*].floors", (b) =>
        b.number.required().min(1)
      )
      .build();

    const validData: ComplexData = {
      company: {
        name: "Tech Corp",
        locations: [
          {
            address: {
              street: "123 Tech Street",
              buildings: [
                {
                  name: "Building A",
                  floors: 10,
                },
                {
                  name: "Building B",
                  floors: 5,
                },
              ],
            },
          },
        ],
      },
    };

    const result = validator.validate(validData);
    expect(result.isValid()).toBe(true);
  });

  test("array batch optimizer should correctly identify nested array paths", () => {
    // 内部的なバッチング最適化が正しく動作するかテスト
    type TestData = {
      level1: Array<{
        level2: Array<{
          field1: string;
          field2: number;
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<TestData>()
      .v("level1[*].level2[*].field1", (b) => b.string.required().min(3))
      .v("level1[*].level2[*].field2", (b) => b.number.required().min(0))
      .build();

    const data: TestData = {
      level1: [
        {
          level2: [
            { field1: "abc", field2: 10 },
            { field1: "de", field2: -5 }, // field1 too short, field2 negative
          ],
        },
        {
          level2: [{ field1: "xyz", field2: 20 }],
        },
      ],
    };

    const result = validator.validate(data);
    expect(result.isValid()).toBe(false);

    const errors = result.errors;
    const errorPaths = errors.map((e) => e.path);

    // 配列バッチング処理では、配列インデックスは抽象化される
    // 個々のインデックスではなく、配列フィールドのパスが返される
    expect(errorPaths).toContain("level1.level2.field1");
    expect(errorPaths).toContain("level1.level2.field2");
  });

  test("should handle nested array with object containing multiple transform strategies", () => {
    // Array -> Array -> Object with different transform/validation orders
    type ComplexNestedData = {
      departments: Array<{
        teams: Array<{
          code: string; // Transform then validate: lowercase -> pattern check
          name: string; // Validate then transform: length check -> uppercase
          prefix: string; // Multiple transforms: trim -> lowercase -> validate pattern
        }>;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(stringPatternPlugin)
      .use(arrayMinLengthPlugin)
      .use(transformPlugin)
      .for<ComplexNestedData>()
      .v("departments", (b) => b.array.required().minLength(1))
      .v("departments[*].teams", (b) => b.array.required().minLength(1))
      // code: transform to lowercase first, then validate pattern
      .v(
        "departments[*].teams[*].code",
        (b) =>
          b.string
            .required()
            .transform((v) => v.toLowerCase()) // Transform first
            .pattern(/^[a-z]{3}-[0-9]{3}$/) // Then validate
      )
      // name: validate length first, then transform to uppercase
      .v(
        "departments[*].teams[*].name",
        (b) =>
          b.string
            .required()
            .min(3) // Validate first
            .transform((v) => v.toUpperCase()) // Then transform
      )
      // prefix: multiple transforms and validation
      .v(
        "departments[*].teams[*].prefix",
        (b) =>
          b.string
            .required()
            .transform((v) => v.trim()) // First transform: trim
            .transform((v) => v.toLowerCase()) // Second transform: lowercase
            .pattern(/^[a-z]+$/) // Then validate
      )
      .build();

    // Data that passes validation without transform
    const validDataForValidate: ComplexNestedData = {
      departments: [
        {
          teams: [
            {
              code: "abc-123", // Already lowercase, passes pattern
              name: "team", // Passes min length
              prefix: "dept", // Already trimmed and lowercase
            },
            {
              code: "xyz-456",
              name: "engineering",
              prefix: "eng",
            },
          ],
        },
      ],
    };

    // Test validation (no transforms applied)
    const validationResult = validator.validate(validDataForValidate);
    expect(validationResult.isValid()).toBe(true);

    // Data for parse test (will be transformed)
    const dataForParse: ComplexNestedData = {
      departments: [
        {
          teams: [
            {
              code: "ABC-123", // Will be lowercased to abc-123
              name: "team", // Will be uppercased to TEAM
              prefix: "  DEPT  ", // Will be trimmed and lowercased to "dept"
            },
            {
              code: "XYZ-456",
              name: "engineering",
              prefix: " ENG ",
            },
          ],
        },
        {
          teams: [
            {
              code: "DEF-789",
              name: "ops",
              prefix: " OPS ",
            },
          ],
        },
      ],
    };

    // Test parse with transforms
    const parseResult = validator.parse(dataForParse);
    expect(parseResult.isValid()).toBe(true);

    const transformed = parseResult.unwrap();

    // Verify transforms were applied correctly
    // First department, first team
    expect(transformed.departments[0].teams[0].code).toBe("abc-123");
    expect(transformed.departments[0].teams[0].name).toBe("TEAM");
    expect(transformed.departments[0].teams[0].prefix).toBe("dept");

    // First department, second team
    expect(transformed.departments[0].teams[1].code).toBe("xyz-456");
    expect(transformed.departments[0].teams[1].name).toBe("ENGINEERING");
    expect(transformed.departments[0].teams[1].prefix).toBe("eng");

    // Second department, first team
    expect(transformed.departments[1].teams[0].code).toBe("def-789");
    expect(transformed.departments[1].teams[0].name).toBe("OPS");
    expect(transformed.departments[1].teams[0].prefix).toBe("ops");

    // Test invalid data
    const invalidData: ComplexNestedData = {
      departments: [
        {
          teams: [
            {
              code: "INVALID", // Won't match pattern even after lowercase
              name: "ab", // Too short (< 3)
              prefix: "123", // Contains numbers, won't match [a-z]+ pattern
            },
          ],
        },
      ],
    };

    const invalidResult = validator.validate(invalidData);
    expect(invalidResult.isValid()).toBe(false);

    // Check specific validation errors
    const errorPaths = invalidResult.errors.map((e) => e.path);
    expect(errorPaths).toContain("departments[0].teams[0].code");
    expect(errorPaths).toContain("departments[0].teams[0].name");
    expect(errorPaths).toContain("departments[0].teams[0].prefix");
  });
});
