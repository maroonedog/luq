import { Builder } from "../../../../src/index";
import { uuidPlugin } from "../../../../src/plugins/uuid";
import {
  NON_STRINGS,
  firstIssue,
  isAccepted,
  type StringModel,
} from "./string-model";

const anyVersion = Builder()
  .use(uuidPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.uuid())
  .build();

const versionFour = Builder()
  .use(uuidPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.uuid(4))
  .build();

const oneOrFour = Builder()
  .use(uuidPlugin)
  .for<StringModel>()
  .v("text", (b) => b.string.uuid([1, 4]))
  .build();

const V1 = "c232ab00-9414-11ec-b3c8-9f6bdeced846";
const V4 = "9f1b8f6c-3c7f-4a3e-9b1a-2f2e1d0c9a8b";
const V7 = "018f0c9e-0000-7000-8000-000000000000";

describe("uuid", () => {
  it.each([
    [V1, true],
    [V4, true],
    [V7, true],
    ["9F1B8F6C-3C7F-4A3E-9B1A-2F2E1D0C9A8B", true],
    ["00000000-0000-0000-0000-000000000000", false],
    ["9f1b8f6c-3c7f-4a3e-cb1a-2f2e1d0c9a8b", false],
    ["9f1b8f6c3c7f4a3e9b1a2f2e1d0c9a8b", false],
    ["", false],
  ] as const)("%p is accepted: %p", (value, expected) => {
    expect(isAccepted(anyVersion, value)).toBe(expected);
  });

  it.each(NON_STRINGS)("passes a wrong-typed value through: %p", (value) => {
    expect(isAccepted(anyVersion, value)).toBe(true);
  });

  it("pins the version nibble when a version is named", () => {
    expect(isAccepted(versionFour, V4)).toBe(true);
    expect(isAccepted(versionFour, V1)).toBe(false);
  });

  it("accepts any listed version when given a list", () => {
    expect(isAccepted(oneOrFour, V1)).toBe(true);
    expect(isAccepted(oneOrFour, V4)).toBe(true);
    expect(isAccepted(oneOrFour, V7)).toBe(false);
  });

  it("emits ONE code whether or not a version was given", () => {
    // 1.x emitted "uuid" with no argument and "uuidVersion" with one, so the
    // caller's error handling depended on how the rule had been configured.
    expect(firstIssue(anyVersion, "nope").code).toBe("uuid");
    expect(firstIssue(versionFour, V1).code).toBe("uuid");
  });

  it("names the versions in the message", () => {
    expect(firstIssue(anyVersion, "nope").message).toBe(
      "Value must be a valid UUID format"
    );
    expect(firstIssue(versionFour, V1).message).toBe(
      "Value must be a valid UUID v4 format"
    );
    expect(firstIssue(oneOrFour, V7).message).toBe(
      "Value must be a valid UUID v1, v4 format"
    );
  });

  it("honours options.code and options.messageFactory", () => {
    const custom = Builder()
      .use(uuidPlugin)
      .for<StringModel>()
      .v("text", (b) =>
        b.string.uuid(4, {
          code: "BAD_UUID",
          messageFactory: (context) => `v${context.versions.join("/")}`,
        })
      )
      .build();
    const issue = firstIssue(custom, "nope");
    expect(issue.code).toBe("BAD_UUID");
    expect(issue.message).toBe("v4");
  });

  it("refuses an unsupported version at BUILD time", () => {
    expect(() =>
      Builder()
        .use(uuidPlugin)
        .for<StringModel>()
        .v("text", (b) => b.string.uuid(2 as unknown as 4))
        .build()
    ).toThrow(/invalid argument "version"/);
  });
});
