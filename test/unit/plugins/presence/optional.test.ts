// optional は「無くてよい」であって「null でよい」ではない。その区別を実挙動で見る。
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
  it("欠損を通す", () => {
    expect(validateNickname.validate({ bio: "b" } as Profile).valid).toBe(true);
  });

  it("null を拒否し、既定メッセージで理由を説明する", () => {
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

  it("値があれば後続のチェックが走る", () => {
    const result = validateNickname.validate({
      nickname: "ab",
      bio: "b",
    } as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("欠損なら後続のチェックは走らない", () => {
    expect(validateNickname.validate({ bio: "b" } as Profile).valid).toBe(true);
  });

  // optional の emptyStringIsMissing は false。空文字は「値がある」。
  it("空文字は欠損ではないので後続チェックにかかる", () => {
    const result = validateNickname.validate({
      nickname: "",
      bio: "b",
    } as Profile);
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.issues[0]?.code).toBe("stringMin");
  });

  it("options.code と options.messageFactory を尊重する", () => {
    const validator = Builder()
      .use(optionalPlugin)
      .for<Profile>()
      .v("nickname", (b) =>
        b.string.optional({
          code: "NO_NULL",
          messageFactory: (context) => `${context.path} は null 不可`,
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
    expect(result.issues[0]?.message).toBe("nickname は null 不可");
  });
});
