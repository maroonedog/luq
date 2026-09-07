// skip は validateIf の極性を反転しただけのゲート。
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
  it("条件が真なら検証しない", () => {
    expect(validateTitle.validate({ isDraft: true, title: "ab" }).valid).toBe(
      true
    );
  });

  it("条件が偽なら検証する", () => {
    const result = validateTitle.validate({ isDraft: false, title: "ab" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("validateIf と同じく位置に依存しない", () => {
    const gateLast = Builder()
      .use(skipPlugin)
      .use(stringMinPlugin)
      .for<Draft>()
      .v("title", (b) => b.string.min(5).skip((root) => root.isDraft))
      .build();
    expect(gateLast.validate({ isDraft: true, title: "ab" }).valid).toBe(true);
  });

  it("配列要素では要素ごとに判定できる", () => {
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
