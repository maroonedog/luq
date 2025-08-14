import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src/core/builder/core/builder";
import { requiredPlugin } from "../../src/core/plugin/required";
import { stringMinPlugin } from "../../src/core/plugin/stringMin";
import { numberMinPlugin } from "../../src/core/plugin/numberMin";

describe("Array Element Validation Debug", () => {
  test("debug array validation with minimal case", () => {
    type Data = {
      items: Array<{
        name: string;
        value: number;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Data>()
      .v("items", (b) => b.array.required())
      .v("items.name", (b) => b.string.required().min(2))
      .v("items.value", (b) => b.number.required().min(10))
      .build();

    // Test with invalid data
    const data: Data = {
      items: [
        { name: "A", value: 5 }, // Both invalid
        { name: "OK", value: 15 }, // Both valid
      ],
    };

    const result = validator.validate(data);

    // We expect 2 errors: items[0].name and items[0].value
    expect(result.isValid()).toBe(false);
    expect(result.errors.length).toBe(2);

    const errorPaths = result.errors.map((e) => e.path).sort();

    expect(errorPaths).toContain("items[0].name");
    expect(errorPaths).toContain("items[0].value");
  });

  test("debug with abortEarly false", () => {
    type Data = {
      users: Array<{
        id: string;
        age: number;
      }>;
    };

    const validator = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .use(numberMinPlugin)
      .for<Data>()
      .v("users", (b) => b.array.required())
      .v("users.id", (b) => b.string.required().min(3))
      .v("users.age", (b) => b.number.required().min(18))
      .build();

    const data: Data = {
      users: [
        { id: "U1", age: 10 }, // Both invalid
        { id: "U2", age: 15 }, // Both invalid
        { id: "USER3", age: 25 }, // Both valid
      ],
    };

    const result = validator.validate(data, { abortEarly: false });

    // We expect 4 errors total
    expect(result.isValid()).toBe(false);
    expect(result.errors.length).toBe(4);
  });
});
