// How required behaves through the public builder. What is watched is the
// result of validating, not the declaration.
import { Builder } from "../../../../src/index";
import { requiredPlugin } from "../../../../src/plugins/required";
import { nullablePlugin } from "../../../../src/plugins/nullable";
import { optionalPlugin } from "../../../../src/plugins/optional";

type Shape = {
  text: string;
  count: number;
  flag: boolean;
  list: string[];
  nested: Record<string, string>;
};

const validateText = Builder()
  .use(requiredPlugin)
  .for<Shape>()
  .v("text", (b) => b.string.required())
  .build();

function issuesOf(input: Partial<Shape>): readonly string[] {
  const result = validateText.validate(input as Shape);
  return result.valid ? [] : result.issues.map((issue) => issue.code);
}

describe("required: what counts as missing", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["the empty string", ""],
  ])("rejects %s", (_label, value) => {
    expect(issuesOf({ text: value as string })).toEqual(["required"]);
  });

  it("rejects a missing key as well", () => {
    expect(issuesOf({})).toEqual(["required"]);
  });

  it("accepts a whitespace-only string as present", () => {
    expect(issuesOf({ text: " " })).toEqual([]);
  });
});

describe("required: falsy is still a value", () => {
  const validateAll = Builder()
    .use(requiredPlugin)
    .for<Shape>()
    .v("count", (b) => b.number.required())
    .v("flag", (b) => b.boolean.required())
    .v("list", (b) => b.array.required())
    .v("nested", (b) => b.object.required())
    .build();

  it("accepts 0, false, [] and {} alike", () => {
    const result = validateAll.validate({
      text: "x",
      count: 0,
      flag: false,
      list: [],
      nested: {},
    } as Shape);
    expect(result.valid).toBe(true);
  });
});

describe("required: the code and the message", () => {
  it("defaults the code to the plugin name and the message to `<path> is required`", () => {
    const result = validateText.validate({} as Shape);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "text",
      code: "required",
      message: "text is required",
      severity: "error",
    });
  });

  it("honours options.code and options.messageFactory", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Shape>()
      .v("text", (b) =>
        b.string.required({
          code: "TEXT_MISSING",
          messageFactory: (context) =>
            `${context.path}/${context.code} is needed`,
        })
      )
      .build();
    const result = validator.validate({} as Shape);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("TEXT_MISSING");
    expect(result.issues[0]?.message).toBe("text/TEXT_MISSING is needed");
  });

  // Severity alone decides validity: a warning is reported as an issue and
  // does not reject the value.
  it("honours options.severity", () => {
    const validator = Builder()
      .use(requiredPlugin)
      .for<Shape>()
      .v("text", (b) => b.string.required({ severity: "warning" }))
      .build();
    const result = validator.validate({} as Shape);
    expect(result.valid).toBe(true);
    expect(result.issues.map((issue) => issue.severity)).toEqual(["warning"]);
  });
});

describe("composing presence does not depend on order", () => {
  function build(order: "required-first" | "nullable-first") {
    return Builder()
      .use(requiredPlugin)
      .use(nullablePlugin)
      .use(optionalPlugin)
      .for<Shape>()
      .v("text", (b) =>
        order === "required-first"
          ? b.string.required().nullable()
          : b.string.nullable().required()
      )
      .build();
  }

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["the empty string", ""],
    ["a present value", "abc"],
  ])("judges %s the same in either order", (_label, value) => {
    const first = build("required-first").validate({ text: value } as Shape);
    const second = build("nullable-first").validate({ text: value } as Shape);
    expect(second.valid).toBe(first.valid);
  });

  it("has required().nullable() permit null and reject undefined", () => {
    const validator = build("required-first");
    expect(validator.validate({ text: null } as unknown as Shape).valid).toBe(
      true
    );
    expect(validator.validate({} as Shape).valid).toBe(false);
  });
});
