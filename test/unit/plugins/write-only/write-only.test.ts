// writeOnly: a field must carry no value on a read. The equal counterpart of
// readOnly, which a previous release left unpublished and unreachable.
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
  it("passes when there is no external context", () => {
    expect(validator.validate(CREDENTIALS).valid).toBe(true);
  });

  it("permits a value on a write", () => {
    expect(
      validator.validate(CREDENTIALS, { external: { operation: "write" } })
        .valid
    ).toBe(true);
  });

  it("fails when a read carries a value", () => {
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

  it("passes a read carrying no value", () => {
    const result = validator.validate(
      { user: "ada" } as unknown as Credentials,
      {
        external: { operation: "read" },
      }
    );
    expect(result.valid).toBe(true);
  });

  it("is a separate symbol and method from readOnly", () => {
    expect(writeOnlyPlugin.name).toBe("writeOnly");
    expect(writeOnlyPlugin.method).toBe("writeOnly");
  });
});
