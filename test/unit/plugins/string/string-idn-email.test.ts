// ===========================================================================
// test/unit/plugins/string/string-idn-email.test.ts
// The Draft-07 `idn-email` format (RFC 6531). The plugin header names exactly
// what it enforces and what it does not; these tables pin BOTH, because a
// format that looks supported and asserts nothing is the failure this rewrite
// exists to end.
// ===========================================================================
import { Builder } from "../../../../src/index";
import { stringIdnEmailPlugin } from "../../../../src/plugins/string-idn-email";
import { stringEmailPlugin } from "../../../../src/plugins/string-email";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  passesThrough,
  type StringModel,
} from "./string-model";

const idnEmail = Builder()
  .use(stringIdnEmailPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.idnEmail())
  .build();

const asciiEmail = Builder()
  .use(stringEmailPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.email())
  .build();

describe("stringIdnEmail", () => {
  it.each([
    ["someone@example.com", true],
    ["first.last@example.co.jp", true],
    ["山田@例え.テスト", true],
    ["user+tag@example.com", true],
    ['"quoted local"@example.com', true],
    ["", false],
    ["no-at-sign", false],
    ["@example.com", false],
    ["someone@", false],
    [".leading@example.com", false],
    ["trailing.@example.com", false],
    ["double..dot@example.com", false],
    ["has space@example.com", false],
    ["a<b@example.com", false],
    ["someone@exa mple.com", false],
    ["someone@example..com", false],
    ["someone@-example.com", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(idnEmail, value)).toBe(expected);
  });

  it("is WIDER than the ASCII email format, which is why it exists", () => {
    expect(isAccepted(asciiEmail, "山田@例え.テスト")).toBe(false);
    expect(isAccepted(idnEmail, "山田@例え.テスト")).toBe(true);
  });

  it("splits at the LAST @, so an @ inside a quoted local part survives", () => {
    expect(isAccepted(idnEmail, '"a@b"@example.com')).toBe(true);
    expect(isAccepted(idnEmail, "a@b@example.com")).toBe(false);
  });

  it("caps the local part at 64 code points and the domain at 253", () => {
    expect(isAccepted(idnEmail, `${"a".repeat(64)}@example.com`)).toBe(true);
    expect(isAccepted(idnEmail, `${"a".repeat(65)}@example.com`)).toBe(false);
    const domain = `${"a".repeat(50)}.`.repeat(5).slice(0, -1);
    expect(domain.length).toBe(254);
    expect(isAccepted(idnEmail, `a@${domain}`)).toBe(false);
  });

  it("does NOT accept an address literal — the header says so", () => {
    expect(isAccepted(idnEmail, "someone@[192.0.2.1]")).toBe(false);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(passesThrough(idnEmail, value)).toBe(true);
  });

  it("reports an overridable code and the documented message", () => {
    expect(firstIssue(idnEmail, "no-at-sign").code).toBe("stringIdnEmail");
    expect(firstIssue(idnEmail, "no-at-sign").message).toBe(
      "Value must be a valid internationalized email address (RFC 6531)"
    );
  });
});
