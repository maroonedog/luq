// skip is validateIf with its polarity inverted, and nothing more.
import { Builder } from "../../../../src/index";
import { skipPlugin } from "../../../../src/plugins/skip";
import { stringMinPlugin } from "../../../../src/plugins/string-min";

type Draft = { isDraft: boolean; title: string };

const validateTitle = Builder()
  .use(skipPlugin)
  .use(stringMinPlugin)
  .for<Draft>()
  .v("title", (b) => b.string.skip((root) => root.isDraft).min(5))
  .build();

describe("skip", () => {
  it("validates nothing when the condition is true", () => {
    expect(validateTitle.validate({ isDraft: true, title: "ab" }).valid).toBe(
      true
    );
  });

  it("validates when it is false", () => {
    const result = validateTitle.validate({ isDraft: false, title: "ab" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("does not depend on its position, as validateIf does not", () => {
    const gateLast = Builder()
      .use(skipPlugin)
      .use(stringMinPlugin)
      .for<Draft>()
      .v("title", (b) => b.string.min(5).skip((root) => root.isDraft))
      .build();
    expect(gateLast.validate({ isDraft: true, title: "ab" }).valid).toBe(true);
  });

  it("decides per element on an array", () => {
    type Bag = { rows: { skipMe: boolean; name: string }[] };
    const validator = Builder()
      .use(skipPlugin)
      .use(stringMinPlugin)
      .for<Bag>()
      .v("rows[*].name", (b) =>
        b.string
          .skip((_root, item) => item !== undefined && item.index === 0)
          .min(5)
      )
      .build();
    const result = validator.validate(
      {
        rows: [
          { skipMe: true, name: "a" },
          { skipMe: false, name: "b" },
        ],
      },
      { abortEarly: false }
    );
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues.map((issue) => issue.path)).toEqual(["rows[1].name"]);
  });
});
