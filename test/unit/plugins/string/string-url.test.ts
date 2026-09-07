import { Builder } from "../../../../src/index";
import { stringUrlPlugin } from "../../../../src/plugins/string-url";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const anyProtocol = Builder()
  .use(stringUrlPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.url())
  .build();

const httpsOnly = Builder()
  .use(stringUrlPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.url({ protocols: ["https:"] }))
  .build();

const bare = Builder()
  .use(stringUrlPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.url({ allowWithoutProtocol: true }))
  .build();

describe("stringUrl", () => {
  it.each([
    ["https://example.com", true],
    ["http://example.com/a?b=c#d", true],
    ["mailto:john@example.com", true],
    ["tel:+81-3-0000-0000", true],
    ["ftp://example.com/f", true],
    ["example.com", false],
    ["not a url", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(anyProtocol, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(anyProtocol, value)).toBe(true);
  });

  it("protocols are matched WITH the colon, as in 1.x", () => {
    expect(isAccepted(httpsOnly, "https://example.com")).toBe(true);
    expect(isAccepted(httpsOnly, "http://example.com")).toBe(false);
    expect(isAccepted(httpsOnly, "mailto:john@example.com")).toBe(false);
  });

  it("allowWithoutProtocol prepends https:// only when there is no ://", () => {
    expect(isAccepted(bare, "example.com/path")).toBe(true);
    expect(isAccepted(anyProtocol, "example.com/path")).toBe(false);
    expect(isAccepted(bare, "https://example.com")).toBe(true);
  });

  it("defaults its code to the plugin name with the 1.x message", () => {
    const issue = firstIssue(anyProtocol, "not a url");
    expect(issue.code).toBe("stringUrl");
    expect(issue.message).toBe("Invalid URL format");
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(stringUrlPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.url(
          { protocols: ["https:"] },
          {
            code: "BAD_URL",
            messageFactory: (context) => `got ${context.protocol}`,
          }
        )
      )
      .build();
    const issue = firstIssue(custom, "http://example.com");
    expect(issue.code).toBe("BAD_URL");
    expect(issue.message).toBe("got http:");
  });
});
