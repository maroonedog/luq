import { describe, test, expect } from "@jest/globals";
import { Builder } from "../../src";
import * as plugins from "../../src/core/plugin";

describe("basic behavior verification for null/undefined", () => {
  test("using nullable on string type field", () => {
    // Make type definition explicit
    type Data = {
      name: string | null;
    };

    const validator = Builder()
      .use(plugins.nullablePlugin)
      .use(plugins.stringMinPlugin)
      .for<Data>()
      .v("name", (b) => b.string.nullable().min(3))
      .build();

    // null is allowed
    const result1 = validator.validate({ name: null });
    console.log("null validation:", result1);

    // valid string
    const result2 = validator.validate({ name: "John" });
    console.log("valid string validation:", result2);

    // string too short
    const result3 = validator.validate({ name: "Jo" });
    console.log("short string validation:", result3);
  });

  test("using optional on string type field", () => {
    // optional field
    type Data = {
      nickname?: string;
    };

    const validator = Builder()
      .use(plugins.optionalPlugin)
      .use(plugins.stringMinPlugin)
      .for<Data>()
      .v("nickname", (b) => b.string.optional().min(3))
      .build();

    // field does not exist
    const result1 = validator.validate({});
    console.log("missing field validation:", result1);

    // undefined
    const result2 = validator.validate({ nickname: undefined });
    console.log("undefined validation:", result2);

    // valid string
    const result3 = validator.validate({ nickname: "Johnny" });
    console.log("valid string validation:", result3);
  });

  test("basic behavior of required", () => {
    type Data = {
      id: string;
    };

    const validator = Builder()
      .use(plugins.requiredPlugin)
      .for<Data>()
      .v("id", (b) => b.string.required())
      .build();

    // valid value
    const result1 = validator.validate({ id: "123" });
    console.log("valid required field:", result1);

    // verify behavior when field does not exist
    const result2 = validator.validate({} as Data);
    console.log("missing required field:", result2);
  });
});
