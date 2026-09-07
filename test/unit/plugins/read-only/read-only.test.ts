// readOnly: 「更新の書き込みでは値を持ってはいけない」。
// 操作は RuleContext.external で渡す (旧実装の第3引数 context はどの実行パスも
// 渡していなかった)。
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
  it("外部コンテキストが無ければ通る", () => {
    expect(validator.validate(RECORD).valid).toBe(true);
  });

  it("新規作成 (isUpdate なし) の書き込みでは通る", () => {
    expect(
      validator.validate(RECORD, { external: { operation: "write" } }).valid
    ).toBe(true);
  });

  it("更新の書き込みで値を持っていれば落ちる", () => {
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

  it("operation を書かなければ write 扱い (旧実装の既定)", () => {
    const result = validator.validate(RECORD, {
      external: { isUpdate: true },
    });
    expect(result.valid).toBe(false);
  });

  it("更新でも値が無ければ通る", () => {
    const result = validator.validate({ name: "ada" } as unknown as Row, {
      external: { operation: "write", isUpdate: true },
    });
    expect(result.valid).toBe(true);
  });

  it("読み出しでは通る", () => {
    expect(
      validator.validate(RECORD, {
        external: { operation: "read", isUpdate: true },
      }).valid
    ).toBe(true);
  });

  it("options.code と messageFactory を尊重する", () => {
    const custom = Builder()
      .use(readOnlyPlugin)
      .for<Row>()
      .v("id", (b) =>
        b.string.readOnly({
          code: "READ_ONLY",
          messageFactory: (msgCtx) => `${msgCtx.path} は変更できません`,
        })
      )
      .build();
    const result = custom.validate(RECORD, {
      external: { operation: "write", isUpdate: true },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("READ_ONLY");
    expect(result.issues[0]?.message).toBe("id は変更できません");
  });
});
