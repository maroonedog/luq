// readOnly: a field must carry no value on an update write. The operation
// arrives through the external context. A previous release declared a third
// parameter for it that no path ever passed.
import { Builder } from "../../../../src/index";
import { readOnlyPlugin } from "../../../../src/plugins/read-only/index";

interface Row {
  id: string;
  name: string;
}

const RECORD: Row = { id: "r-1", name: "ada" };

const validator = Builder()
  .use(readOnlyPlugin)
  .for<Row>()
  .v("id", (b) => b.string.readOnly())
  .build();

describe("readOnly", () => {
  it("passes when there is no external context", () => {
    expect(validator.validate(RECORD).valid).toBe(true);
  });

  it("passes on a create write, where nothing says update", () => {
    expect(
      validator.validate(RECORD, { external: { operation: "write" } }).valid
    ).toBe(true);
  });

  it("fails when an update write carries a value", () => {
    const result = validator.validate(RECORD, {
      external: { operation: "write", isUpdate: true },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("id");
    expect(result.issues[0]?.code).toBe("readOnly");
    expect(result.issues[0]?.message).toBe(
      "id is read-only and cannot be modified"
    );
  });

  it("treats an unstated operation as a write, as it always did", () => {
    const result = validator.validate(RECORD, {
      external: { isUpdate: true },
    });
    expect(result.valid).toBe(false);
  });

  it("passes on an update carrying no value", () => {
    const result = validator.validate({ name: "ada" } as unknown as Row, {
      external: { operation: "write", isUpdate: true },
    });
    expect(result.valid).toBe(true);
  });

  it("passes on a read", () => {
    expect(
      validator.validate(RECORD, {
        external: { operation: "read", isUpdate: true },
      }).valid
    ).toBe(true);
  });

  it("honours options.code and messageFactory", () => {
    const custom = Builder()
      .use(readOnlyPlugin)
      .for<Row>()
      .v("id", (b) =>
        b.string.readOnly({
          code: "READ_ONLY",
          messageFactory: (msgCtx) => `${msgCtx.path} cannot be changed`,
        })
      )
      .build();
    const result = custom.validate(RECORD, {
      external: { operation: "write", isUpdate: true },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("READ_ONLY");
    expect(result.issues[0]?.message).toBe("id cannot be changed");
  });
});
