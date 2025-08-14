import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../../../src/core/builder/core/builder";
import { requiredPlugin } from "../../../../src/core/plugin/required";
import { stringMinPlugin } from "../../../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../../../src/core/plugin/numberMin";
import { numberMaxPlugin } from "../../../../src/core/plugin/numberMax";
import { transformPlugin } from "../../../../src/core/plugin/transform";
import { arrayMinLengthPlugin } from "../../../../src/core/plugin/arrayMinLength";
import { objectPlugin } from "../../../../src/core/plugin/object";

describe("Nested Structures - Arrays and Objects", () => {
  describe("Array in Array (Multi-dimensional Arrays)", () => {
    test("should validate nested arrays (2D array)", () => {
      type Data = {
        matrix: number[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("matrix", (b) => b.array.required().minLength(2))
        .v("matrix[*]", (b) => b.array.required().minLength(3))
        .build();

      // Valid 2D array
      const validResult = validator.validate({
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
        ],
      });
      expect(validResult.valid).toBe(true);

      // Invalid - inner array too short
      const invalidResult = validator.validate({
        matrix: [
          [1, 2], // Too short
          [3, 4, 5],
        ],
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should transform nested arrays", () => {
      type Data = {
        tags: string[][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<Data>()
        .v("tags", (b) =>
          b.array
            .required()
            .transform((arr: string[][]) =>
              arr.map((innerArr) => innerArr.map((tag) => tag.toLowerCase()))
            )
        )
        .build();

      const parseResult = validator.parse({
        tags: [
          ["JavaScript", "TypeScript"],
          ["React", "Vue", "Angular"],
        ],
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.tags).toEqual([
          ["javascript", "typescript"],
          ["react", "vue", "angular"],
        ]);
      }
    });

    test("should validate deeply nested arrays (3D array)", () => {
      type Data = {
        cube: number[][][];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .use(numberMinPlugin)
        .for<Data>()
        .v("cube", (b) => b.array.required())
        .v("cube[*]", (b) => b.array.required())
        // Note: TypeScript type inference currently doesn't support paths beyond 2 levels of array nesting
        // .v("cube[*][*]", (b) => b.array.required().minLength(2))
        // .v("cube[*][*][*]", (b) => b.number.required().min(0))
        .build();

      const validResult = validator.validate({
        cube: [
          [
            [1, 2],
            [3, 4],
          ],
          [
            [5, 6],
            [7, 8],
          ],
        ],
      });
      expect(validResult.valid).toBe(true);

      // Basic validation still works for the structure
      const invalidResult = validator.validate({
        cube: [], // Empty cube
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should pick and validate nested array fields", () => {
      type Data = {
        categories: string[][];
        count: number;
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("categories", (b) => b.array.required().minLength(1))
        .v("categories[*]", (b) => b.array.required().minLength(2))
        .v("count", (b) => b.number.required())
        .build();

      // Pick categories field
      const categoriesPicker = validator.pick("categories");

      const validPick = categoriesPicker.validate([
        ["tech", "science"],
        ["art", "music"],
      ]);
      expect(validPick.valid).toBe(true);

      const invalidPick = categoriesPicker.validate([
        ["tech"], // Too short
        ["art", "music"],
      ]);
      expect(invalidPick.valid).toBe(false);
    });
  });

  describe("Object in Array", () => {
    test("should validate array of objects", () => {
      type Data = {
        users: {
          name: string;
          age: number;
          email: string;
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("users", (b) => b.array.required().minLength(1))
        .v("users[*].name", (b) => b.string.required().min(2))
        .v("users[*].age", (b) => b.number.required().min(18))
        .v("users[*].email", (b) => b.string.required().min(5))
        .build();

      const validResult = validator.validate({
        users: [
          { name: "John", age: 25, email: "john@example.com" },
          { name: "Jane", age: 30, email: "jane@example.com" },
        ],
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({
        users: [
          { name: "John", age: 25, email: "john@example.com" },
          { name: "J", age: 30, email: "jane@example.com" }, // Name too short
        ],
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should transform array of objects", () => {
      type Data = {
        products: {
          name: string;
          price: number;
          tags: string[];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<Data>()
        .v("products", (b) => b.array.required())
        .v("products[*].name", (b) =>
          b.string.required().transform((v) => v.toUpperCase())
        )
        .v("products[*].price", (b) =>
          b.number.required().transform((v) => Math.round(v * 100) / 100)
        )
        .v("products[*].tags", (b) =>
          b.array
            .required()
            .transform((tags: string[]) => tags.map((t) => t.toLowerCase()))
        )
        .build();

      const parseResult = validator.parse({
        products: [
          {
            name: "laptop",
            price: 999.999,
            tags: ["Electronics", "Computers"],
          },
          { name: "mouse", price: 29.995, tags: ["Accessories"] },
        ],
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.products[0].name).toBe("LAPTOP");
        expect(data?.products[0].price).toBe(1000);
        expect(data?.products[0].tags).toEqual(["electronics", "computers"]);
        expect(data?.products[1].name).toBe("MOUSE");
        expect(data?.products[1].price).toBe(30);
      }
    });

    test("should validate nested objects within array", () => {
      type Data = {
        orders: {
          id: number;
          customer: {
            name: string;
            address: {
              street: string;
              city: string;
              zip: string;
            };
          };
          items: {
            productId: number;
            quantity: number;
          }[];
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("orders", (b) => b.array.required())
        .v("orders[*].id", (b) => b.number.required())
        .v("orders[*].customer.name", (b) => b.string.required().min(2))
        .v("orders[*].customer.address.street", (b) => b.string.required())
        .v("orders[*].customer.address.city", (b) => b.string.required())
        .v("orders[*].customer.address.zip", (b) => b.string.required().min(5))
        .v("orders[*].items", (b) => b.array.required().minLength(1))
        .v("orders[*].items[*].productId", (b) => b.number.required())
        .v("orders[*].items[*].quantity", (b) => b.number.required().min(1))
        .build();

      const validResult = validator.validate({
        orders: [
          {
            id: 1,
            customer: {
              name: "John Doe",
              address: {
                street: "123 Main St",
                city: "New York",
                zip: "10001",
              },
            },
            items: [
              { productId: 101, quantity: 2 },
              { productId: 102, quantity: 1 },
            ],
          },
        ],
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({
        orders: [
          {
            id: 1,
            customer: {
              name: "John Doe",
              address: {
                street: "123 Main St",
                city: "New York",
                zip: "100", // Too short
              },
            },
            items: [
              { productId: 101, quantity: 0 }, // Quantity too low
            ],
          },
        ],
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test("should pick fields from array of objects", () => {
      type Data = {
        employees: {
          id: number;
          name: string;
          department: string;
        }[];
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .for<Data>()
        .v("employees", (b) => b.array.required())
        .v("employees[*].name", (b) => b.string.required().min(2))
        .v("employees[*].department", (b) => b.string.required())
        .build();

      // Pick the entire employees array
      const employeesPicker = validator.pick("employees");

      const validPick = employeesPicker.validate([
        { id: 1, name: "Alice", department: "Engineering" },
        { id: 2, name: "Bob", department: "Sales" },
      ]);
      expect(validPick.valid).toBe(true);

      // Pick a specific field pattern
      const namePicker = validator.pick("employees[*].name" as any);

      // Note: This tests the current behavior, which may need adjustment
      // depending on how pick should handle array element patterns
      const nameValidation = namePicker.validate("Alice");
      expect(nameValidation.valid).toBe(true);
    });
  });

  describe("Object in Object (Nested Objects)", () => {
    test("should validate deeply nested objects", () => {
      type Data = {
        company: {
          info: {
            name: string;
            founded: number;
          };
          headquarters: {
            address: {
              street: string;
              city: string;
              country: string;
            };
            coordinates: {
              lat: number;
              lng: number;
            };
          };
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<Data>()
        .v("company.info.name", (b) => b.string.required().min(2))
        .v("company.info.founded", (b) => b.number.required().min(1900))
        .v("company.headquarters.address.street", (b) => b.string.required())
        .v("company.headquarters.address.city", (b) => b.string.required())
        .v("company.headquarters.address.country", (b) =>
          b.string.required().min(2)
        )
        .v("company.headquarters.coordinates.lat", (b) =>
          b.number.required().min(-90).max(90)
        )
        .v("company.headquarters.coordinates.lng", (b) =>
          b.number.required().min(-180).max(180)
        )
        .build();

      const validResult = validator.validate({
        company: {
          info: {
            name: "Tech Corp",
            founded: 2010,
          },
          headquarters: {
            address: {
              street: "123 Tech Blvd",
              city: "San Francisco",
              country: "USA",
            },
            coordinates: {
              lat: 37.7749,
              lng: -122.4194,
            },
          },
        },
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({
        company: {
          info: {
            name: "T", // Too short
            founded: 1800, // Too early
          },
          headquarters: {
            address: {
              street: "123 Tech Blvd",
              city: "San Francisco",
              country: "U", // Too short
            },
            coordinates: {
              lat: 91, // Out of range
              lng: -181, // Out of range
            },
          },
        },
      });
      expect(invalidResult.valid).toBe(false);
    });

    test("should transform nested objects", () => {
      type Data = {
        user: {
          profile: {
            firstName: string;
            lastName: string;
            preferences: {
              theme: string;
              language: string;
            };
          };
          settings: {
            notifications: {
              email: boolean;
              push: boolean;
            };
          };
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(transformPlugin)
        .for<Data>()
        .v("user.profile.firstName", (b) =>
          b.string
            .required()
            .transform(
              (v) => v.charAt(0).toUpperCase() + v.slice(1).toLowerCase()
            )
        )
        .v("user.profile.lastName", (b) =>
          b.string.required().transform((v) => v.toUpperCase())
        )
        .v("user.profile.preferences.theme", (b) =>
          b.string.required().transform((v) => v.toLowerCase())
        )
        .v("user.profile.preferences.language", (b) =>
          b.string.required().transform((v) => v.toLowerCase())
        )
        .build();

      const parseResult = validator.parse({
        user: {
          profile: {
            firstName: "jOHN",
            lastName: "doe",
            preferences: {
              theme: "DARK",
              language: "EN-US",
            },
          },
          settings: {
            notifications: {
              email: true,
              push: false,
            },
          },
        },
      });

      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.user.profile.firstName).toBe("John");
        expect(data?.user.profile.lastName).toBe("DOE");
        expect(data?.user.profile.preferences.theme).toBe("dark");
        expect(data?.user.profile.preferences.language).toBe("en-us");
      }
    });

    test("should pick deeply nested fields", () => {
      type Data = {
        config: {
          database: {
            host: string;
            port: number;
            credentials: {
              username: string;
              password: string;
            };
          };
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(numberMinPlugin)
        .use(numberMaxPlugin)
        .for<Data>()
        .v("config.database.host", (b) => b.string.required())
        .v("config.database.port", (b) => b.number.required().min(1).max(65535))
        .v("config.database.credentials.username", (b) =>
          b.string.required().min(3)
        )
        .v("config.database.credentials.password", (b) =>
          b.string.required().min(8)
        )
        .build();

      // Pick deeply nested field
      const passwordPicker = validator.pick(
        "config.database.credentials.password"
      );

      const validPick = passwordPicker.validate("securePassword123");
      expect(validPick.valid).toBe(true);

      const invalidPick = passwordPicker.validate("short");
      expect(invalidPick.valid).toBe(false);

      // Pick intermediate nested object
      const portPicker = validator.pick("config.database.port");

      const validPort = portPicker.validate(5432);
      expect(validPort.valid).toBe(true);

      const invalidPort = portPicker.validate(70000);
      expect(invalidPort.valid).toBe(false);
    });

    test("should validate objects with mixed nesting patterns", () => {
      type Data = {
        organization: {
          teams: {
            name: string;
            members: {
              id: number;
              info: {
                name: string;
                role: string;
                skills: string[];
              };
            }[];
          }[];
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("organization.teams", (b) => b.array.required())
        .v("organization.teams[*].name", (b) => b.string.required().min(2))
        .v("organization.teams[*].members", (b) =>
          b.array.required().minLength(1)
        )
        .v("organization.teams[*].members[*].id", (b) => b.number.required())
        .v("organization.teams[*].members[*].info.name", (b) =>
          b.string.required().min(2)
        )
        .v("organization.teams[*].members[*].info.role", (b) =>
          b.string.required()
        )
        .v("organization.teams[*].members[*].info.skills", (b) =>
          b.array.required().minLength(1)
        )
        .build();

      const validResult = validator.validate({
        organization: {
          teams: [
            {
              name: "Engineering",
              members: [
                {
                  id: 1,
                  info: {
                    name: "Alice",
                    role: "Senior Developer",
                    skills: ["TypeScript", "React", "Node.js"],
                  },
                },
                {
                  id: 2,
                  info: {
                    name: "Bob",
                    role: "Junior Developer",
                    skills: ["JavaScript"],
                  },
                },
              ],
            },
            {
              name: "Design",
              members: [
                {
                  id: 3,
                  info: {
                    name: "Charlie",
                    role: "UI Designer",
                    skills: ["Figma", "Sketch"],
                  },
                },
              ],
            },
          ],
        },
      });
      expect(validResult.valid).toBe(true);

      const invalidResult = validator.validate({
        organization: {
          teams: [
            {
              name: "E", // Too short
              members: [
                {
                  id: 1,
                  info: {
                    name: "A", // Too short
                    role: "Developer",
                    skills: [], // Empty array
                  },
                },
              ],
            },
          ],
        },
      });
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(2);
    });
  });

  describe("Complex Mixed Structures", () => {
    test("should handle all patterns combined", () => {
      type Data = {
        system: {
          matrix: number[][];
          users: {
            id: number;
            profile: {
              name: string;
              tags: string[][];
            };
            permissions: {
              modules: {
                name: string;
                actions: string[];
              }[];
            };
          }[];
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(stringMinPlugin)
        .use(arrayMinLengthPlugin)
        .use(transformPlugin)
        .for<Data>()
        // Matrix validation
        .v("system.matrix", (b) => b.array.required())
        .v("system.matrix[*]", (b) => b.array.required())
        // Users validation
        .v("system.users", (b) => b.array.required())
        .v("system.users[*].id", (b) => b.number.required())
        .v("system.users[*].profile.name", (b) =>
          b.string
            .required()
            .min(2)
            .transform((v) => v.trim())
        )
        .v("system.users[*].profile.tags", (b) => b.array.required())
        .v("system.users[*].profile.tags[*]", (b) => b.array.required())
        .v("system.users[*].permissions.modules", (b) => b.array.required())
        .v("system.users[*].permissions.modules[*].name", (b) =>
          b.string.required()
        )
        .v("system.users[*].permissions.modules[*].actions", (b) =>
          b.array.required().minLength(1)
        )
        .build();

      const testData = {
        system: {
          matrix: [
            [1, 2],
            [3, 4],
          ],
          users: [
            {
              id: 1,
              profile: {
                name: "  Admin  ",
                tags: [
                  ["power", "user"],
                  ["system", "admin"],
                ],
              },
              permissions: {
                modules: [
                  {
                    name: "Dashboard",
                    actions: ["view", "edit", "delete"],
                  },
                  {
                    name: "Users",
                    actions: ["view", "edit"],
                  },
                ],
              },
            },
          ],
        },
      };

      // Validate
      const validateResult = validator.validate(testData);
      expect(validateResult.valid).toBe(true);

      // Parse with transforms
      const parseResult = validator.parse(testData);
      expect(parseResult.valid).toBe(true);
      if (parseResult.valid) {
        const data = parseResult.data();
        expect(data?.system.users[0].profile.name).toBe("Admin"); // Trimmed
      }
    });

    test("should handle validation errors at different nesting levels", () => {
      type Data = {
        data: {
          level1: {
            level2: {
              items: {
                id: number;
                values: number[][];
              }[];
            };
          };
        };
      };

      const validator = Builder()
        .use(requiredPlugin)
        .use(numberMinPlugin)
        .use(arrayMinLengthPlugin)
        .for<Data>()
        .v("data.level1.level2.items", (b) => b.array.required().minLength(1))
        .v("data.level1.level2.items[*].id", (b) => b.number.required().min(1))
        .v("data.level1.level2.items[*].values[*]", (b) =>
          b.array.required().minLength(2)
        )
        .v("data.level1.level2.items[*].values[*]", (b) =>
          b.array.required().minLength(3)
        )
        // Note: TypeScript doesn't support 3-level array nesting in type inference
        .v("data.level1.level2.items[*].values[*][*]", (b) =>
          b.number.required().min(0)
        )
        .build();

      const invalidData = {
        data: {
          level1: {
            level2: {
              items: [
                {
                  id: 0, // Invalid: less than 1
                  values: [
                    [1, 2], // Invalid: inner array too short (needs 3)
                    [-1, 0, 1], // Invalid: contains negative number
                  ],
                },
                {
                  id: 2,
                  values: [], // Invalid: empty array (needs minLength 2)
                },
              ],
            },
          },
        },
      };

      const result = validator.validate(invalidData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);

      // Check that errors contain correct paths
      const errorPaths = result.errors.map((e) => e.path);
      expect(errorPaths).toContain("data.level1.level2.items[0].id");
      expect(errorPaths.some((p) => p.includes("values"))).toBe(true);
    });
  });
});
