// validateIf はゲート。閉じたらそのフィールドの check も transform も走らない。
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

  it("条件が真なら後続の check が走る", () => {
    const result = validateTitle.validate({ published: true, title: "ab" });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("条件が偽なら後続の check が走らない", () => {
    expect(
      validateTitle.validate({ published: false, title: "ab" }).valid
    ).toBe(true);
  });

  // 旧実装は validator ループの break だったので、チェーン上の位置で結果が変わった。
  it("チェーン上の位置に依存しない", () => {
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

  it("閉じたゲートは transform も止める", () => {
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

  it("ゲート自身は issue を出さない", () => {
    const result = validateTitle.validate({ published: false, title: "" });
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
