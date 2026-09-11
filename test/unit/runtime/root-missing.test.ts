// ===========================================================================
// What `validate(null)` reports, and whether a caller can change it.
//
// A null or undefined subject fails before the plan runs — without that every
// reader would answer undefined, absence would be permitted everywhere, and
// `validate(null)` would report success for a schema that declares nothing
// required. The short-circuit is right; what it SAID was not.
//
// It carried 1.x's wording and 1.x's code verbatim. `REQUIRED` in
// SCREAMING_SNAKE is the spelling docs/migration/breaking-changes.md says 2.x
// replaced with the plugin name, so a caller switching on `issue.code` saw
// `required` when a field was missing and `REQUIRED` when the whole subject
// was — the same condition under two spellings. And the message was a
// constant with no route to override it, in a library where every other
// message has one.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { resetGlobalConfig } from "../../../src/builder/global-config-store";

interface Model {
  readonly name: string;
}

const build = (): ReturnType<typeof makeValidator> => makeValidator();

function makeValidator() {
  return Builder()
    .use(requiredPlugin)
    .use(stringMinPlugin)
    .for<Model>()
    .v("name", (b) => b.string.required().min(2))
    .build();
}

afterEach(() => {
  resetGlobalConfig();
});

describe("a null or undefined subject", () => {
  it.each([null, undefined])(
    "is rejected AT THE ROOT, not by whichever field noticed: %p",
    (subject) => {
      // Asserting only `valid === false` would pass either way: with the
      // short-circuit removed, reading any path out of an absent subject
      // yields undefined and `required` on a field reports it. The issue this
      // has to produce is the ROOT one — a single issue at the empty path —
      // and that is what says the subject itself was missing rather than one
      // of its fields.
      const result = build().validate(subject as never);
      expect(result.valid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.path).toBe("");
    }
  );

  it("reports the code a missing field reports, not a second spelling of it", () => {
    // The field-level answer for the same condition is `required`. Two
    // spellings mean a caller matching on code handles one and misses the
    // other, and which one they meet depends on how much of the subject is
    // missing.
    const rootIssue = build().validate(null as never).issues[0];
    const fieldIssue = build().validate({} as never).issues[0];
    expect(fieldIssue?.code).toBe("required");
    expect(rootIssue?.code).toBe("required");
  });

  it("reports it at the root path", () => {
    expect(build().validate(null as never).issues[0]?.path).toBe("");
  });

  it("rejects, whatever the configured default severity is", () => {
    // The severity here is deliberately not the configurable one. If a caller
    // set `warning` as their default and it applied here, `validate(null)`
    // would report VALID for a schema that declares nothing required, which
    // is the outcome this short-circuit exists to prevent.
    const lenient = Builder()
      .withConfig({ defaultSeverity: "warning" })
      .use(requiredPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required())
      .build();
    expect(lenient.validate(null as never).valid).toBe(false);
    expect(lenient.validate(null as never).issues[0]?.severity).toBe("error");
  });
});

describe("the wording of that rejection", () => {
  it("has a default a caller can read", () => {
    expect(build().validate(null as never).issues[0]?.message).toBe(
      "Value is required"
    );
  });

  it("can be replaced through the builder's config", () => {
    // Every other message in the library can be overridden at its call site.
    // This one has no call site — it is emitted before any rule runs — so the
    // config is where it has to be said.
    const custom = Builder()
      .withConfig({ rootMissingMessage: "リクエストボディがありません" })
      .use(requiredPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required())
      .build();
    expect(custom.validate(null as never).issues[0]?.message).toBe(
      "リクエストボディがありません"
    );
  });

  it("leaves another builder's wording alone", () => {
    // The config is resolved once per build(), so two validators built under
    // different settings keep their own. A module-level singleton read at
    // validation time would not.
    const custom = Builder()
      .withConfig({ rootMissingMessage: "no body" })
      .use(requiredPlugin)
      .for<Model>()
      .v("name", (b) => b.string.required())
      .build();
    expect(custom.validate(null as never).issues[0]?.message).toBe("no body");
    expect(build().validate(null as never).issues[0]?.message).toBe(
      "Value is required"
    );
  });
});
