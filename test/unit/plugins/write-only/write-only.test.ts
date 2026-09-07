// writeOnly: 「読み出しでは値を持ってはいけない」。readOnly の対等な相方で、
// 旧実装では公開されておらず到達不能だった。
import { Builder } from "../../../../src/index";
import { writeOnlyPlugin } from "../../../../src/plugins/write-only/index";

interface Credentials {
  user: string;
  secret: string;
}

const CREDENTIALS: Credentials = { user: "ada", secret: "s3cret" };

const validator = Builder()
  .use(writeOnlyPlugin)
  .for<Credentials>()
  .v("secret", (b) => b.string.writeOnly())
  .build();

describe("writeOnly", () => {
  it("外部コンテキストが無ければ通る", () => {
    expect(validator.validate(CREDENTIALS).valid).toBe(true);
  });

  it("書き込みでは値を持っていて構わない", () => {
    expect(
      validator.validate(CREDENTIALS, { external: { operation: "write" } })
        .valid
    ).toBe(true);
  });

  it("読み出しで値を持っていれば落ちる", () => {
    const result = validator.validate(CREDENTIALS, {
      external: { operation: "read" },
    });
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.path).toBe("secret");
    expect(result.issues[0]?.code).toBe("writeOnly");
    expect(result.issues[0]?.message).toBe(
      "secret is write-only and cannot be read"
    );
  });

  it("読み出しでも値が無ければ通る", () => {
    const result = validator.validate(
      { user: "ada" } as unknown as Credentials,
      {
        external: { operation: "read" },
      }
    );
    expect(result.valid).toBe(true);
  });

  it("readOnly とは独立した symbol / method である", () => {
    expect(writeOnlyPlugin.name).toBe("writeOnly");
    expect(writeOnlyPlugin.method).toBe("writeOnly");
  });
});
