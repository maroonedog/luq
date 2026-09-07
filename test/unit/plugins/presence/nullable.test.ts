// nullable は optional の鏡像: null を許し、欠損を拒否する。
import { Builder } from "../../../../src/index";
import { nullablePlugin } from "../../../../src/plugins/nullable";
import { stringMinPlugin } from "../../../../src/plugins/string-min";

type Row = { note: string; id: string };

const validateNote = Builder()
  .use(nullablePlugin)
  .use(stringMinPlugin)
  .for<Row>()
  .v("note", (b) => b.string.nullable().min(3))
  .build();

describe("nullable", () => {
  it("null を通し、後続のチェックを走らせない", () => {
    const result = validateNote.validate({
      note: null,
      id: "x",
    } as unknown as Row);
    expect(result.valid).toBe(true);
  });

  it("欠損を拒否する", () => {
    const result = validateNote.validate({ id: "x" } as Row);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "note",
      code: "nullable",
      message: "note cannot be undefined (use null for nullable fields)",
      severity: "error",
    });
  });

  it("値があれば後続のチェックが走る", () => {
    const result = validateNote.validate({ note: "ab", id: "x" } as Row);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("options.code を尊重する", () => {
    const validator = Builder()
      .use(nullablePlugin)
      .for<Row>()
      .v("note", (b) => b.string.nullable({ code: "NOTE_MISSING" }))
      .build();
    const result = validator.validate({ id: "x" } as Row);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("NOTE_MISSING");
  });
});
