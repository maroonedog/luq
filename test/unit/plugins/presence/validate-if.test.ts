// validateIf is a gate. Closed, neither a check nor a transform runs for that
// field.
import { Builder } from "../../../../src/index";
import { validateIfPlugin } from "../../../../src/plugins/validate-if";
import { stringMinPlugin } from "../../../../src/plugins/string-min";
import { transformPlugin } from "../../../../src/plugins/transform";

type Draft = { published: boolean; title: string };

describe("validateIf", () => {
  const validateTitle = Builder()
    .use(validateIfPlugin)
    .use(stringMinPlugin)
    .for<Draft>()
    .v("title", (b) => b.string.validateIf((root) => root.published).min(5))
    .build();

  it("runs the later checks when the condition is true", () => {
    const result = validateTitle.validate({ published: true, title: "ab" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("runs none of them when it is false", () => {
    expect(
      validateTitle.validate({ published: false, title: "ab" }).valid
    ).toBe(true);
  });

  // Implemented as a break in the validator loop, the result depended on
  // where in the chain it was written.
  it("does not depend on its position in the chain", () => {
    const gateLast = Builder()
      .use(validateIfPlugin)
      .use(stringMinPlugin)
      .for<Draft>()
      .v("title", (b) => b.string.min(5).validateIf((root) => root.published))
      .build();
    expect(gateLast.validate({ published: false, title: "ab" }).valid).toBe(
      true
    );
    expect(gateLast.validate({ published: true, title: "ab" }).valid).toBe(
      false
    );
  });

  it("has a closed gate stop transforms as well", () => {
    const validator = Builder()
      .use(validateIfPlugin)
      .use(transformPlugin)
      .for<Draft>()
      .v("title", (b) =>
        b.string
          .validateIf((root) => root.published)
          .transform((value) => value.toUpperCase())
      )
      .build();
    const closed = validator.parse({ published: false, title: "ab" });
    expect(closed.valid).toBe(true);
    if (!closed.valid) return;
    expect(closed.data.title).toBe("ab");
    const open = validator.parse({ published: true, title: "ab" });
    expect(open.valid).toBe(true);
    if (!open.valid) return;
    expect(open.data.title).toBe("AB");
  });

  it("has the gate itself report no issue", () => {
    const result = validateTitle.validate({ published: false, title: "" });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
