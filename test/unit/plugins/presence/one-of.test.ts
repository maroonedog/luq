// This oneOf is a set of permitted values, and is a different thing from JSON
// Schema's composition keyword of the same name.
import { Builder } from "../../../../src/index";
import { oneOfPlugin } from "../../../../src/plugins/one-of";
import { PluginArgumentError } from "../../../../src/plugin-kit/plugin-definition";

type Ticket = { status: string; priority: number };

const validateStatus = Builder()
  .use(oneOfPlugin)
  .for<Ticket>()
  .v("status", (b) => b.string.oneOf(["open", "closed"]))
  .build();

describe("oneOf", () => {
  it("accepts a value in the set", () => {
    expect(validateStatus.validate({ status: "open", priority: 1 }).valid).toBe(
      true
    );
  });

  it("rejects one that is not, listing the candidates in the default message", () => {
    const result = validateStatus.validate({ status: "draft", priority: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "status",
      code: "oneOf",
      message: 'Value must be one of: "open", "closed"',
      severity: "error",
    });
  });

  it("judges by strict equality, so a string is not in a set of numbers", () => {
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("priority", (b) => b.number.oneOf([1, 2, 3]))
      .build();
    expect(validator.validate({ status: "s", priority: 2 }).valid).toBe(true);
    expect(validator.validate({ status: "s", priority: 4 }).valid).toBe(false);
  });

  // Past a certain size it switches to a Set. Both routes must answer alike.
  it("judges the same past that size", () => {
    const many = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("status", (b) => b.string.oneOf(many))
      .build();
    expect(validator.validate({ status: "i", priority: 1 }).valid).toBe(true);
    expect(validator.validate({ status: "z", priority: 1 }).valid).toBe(false);
  });

  it("fails an empty candidate list at build time, with PluginArgumentError", () => {
    expect(() =>
      Builder()
        .use(oneOfPlugin)
        .for<Ticket>()
        .v("status", (b) => b.string.oneOf([]))
        .build()
    ).toThrow(PluginArgumentError);
  });

  it("honours options.messageFactory", () => {
    const validator = Builder()
      .use(oneOfPlugin)
      .for<Ticket>()
      .v("status", (b) =>
        b.string.oneOf(["open", "closed"], {
          code: "BAD_STATUS",
          messageFactory: (context) => `${context.path}: ${context.code}`,
        })
      )
      .build();
    const result = validator.validate({ status: "draft", priority: 1 });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.message).toBe("status: BAD_STATUS");
  });
});
