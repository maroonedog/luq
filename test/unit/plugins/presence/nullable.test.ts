// nullable mirrors optional: it permits null and refuses absence.
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
  it("accepts null and runs none of the later checks", () => {
    const result = validateNote.validate({
      note: null,
      id: "x",
    } as unknown as Row);
    expect(result.valid).toBe(true);
  });

  it("rejects a missing value", () => {
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

  it("runs the later checks when a value is present", () => {
    const result = validateNote.validate({ note: "ab", id: "x" } as Row);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("honours options.code", () => {
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
