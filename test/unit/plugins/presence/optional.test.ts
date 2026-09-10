// optional means "may be absent", not "may be null". The distinction is
// checked by running it.
import { Builder } from "../../../../src/index";
import { optionalPlugin } from "../../../../src/plugins/optional";
import { stringMinPlugin } from "../../../../src/plugins/string-min";

type Profile = { nickname: string; bio: string };

const validateNickname = Builder()
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .for<Profile>()
  .v("nickname", (b) => b.string.optional().min(3))
  .build();

describe("optional", () => {
  it("accepts a missing value", () => {
    expect(validateNickname.validate({ bio: "b" } as Profile).valid).toBe(true);
  });

  it("rejects null, explaining why in the default message", () => {
    const result = validateNickname.validate({
      nickname: null,
      bio: "b",
    } as unknown as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]).toEqual({
      path: "nickname",
      code: "optional",
      message: "nickname cannot be null (use undefined for optional fields)",
      severity: "error",
    });
  });

  it("runs the later checks when a value is present", () => {
    const result = validateNickname.validate({
      nickname: "ab",
      bio: "b",
    } as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("runs none of them when the value is missing", () => {
    expect(validateNickname.validate({ bio: "b" } as Profile).valid).toBe(true);
  });

  // optional does not count the empty string as missing: it is a value.
  it("puts the empty string through the later checks, absence it is not", () => {
    const result = validateNickname.validate({
      nickname: "",
      bio: "b",
    } as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("honours options.code and options.messageFactory", () => {
    const validator = Builder()
      .use(optionalPlugin)
      .for<Profile>()
      .v("nickname", (b) =>
        b.string.optional({
          code: "NO_NULL",
          messageFactory: (context) => `${context.path} may not be null`,
        })
      )
      .build();
    const result = validator.validate({
      nickname: null,
      bio: "b",
    } as unknown as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("NO_NULL");
    expect(result.issues[0]?.message).toBe("nickname may not be null");
  });
});
