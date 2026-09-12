import { readCodeSites } from "../../../../scripts/issue-codes/read-code-sites";
import type { CodeSite } from "../../../../scripts/issue-codes/issue-code.types";

function sitesOf(source: string): readonly CodeSite[] {
  return readCodeSites("src/sample.ts", source);
}

function codesOf(source: string): readonly string[] {
  return sitesOf(source)
    .flatMap((site) => site.codes)
    .sort();
}

describe("a literal at a code-bearing position", () => {
  it("reads `code:` in an object literal", () => {
    expect(codesOf('check({ code: "stringMin", severity: "error" });')).toEqual(
      ["stringMin"]
    );
  });

  it("reads a module-level constant", () => {
    expect(
      codesOf(
        'const ROOT_MISSING_CODE = "required";\ncreateIssue({ code: ROOT_MISSING_CODE });'
      )
    ).toEqual(["required"]);
  });

  it("reads both sides of a conditional, since either can be reported", () => {
    expect(
      codesOf('presence({ code: isRequired ? "required" : "type" });')
    ).toEqual(["required", "type"]);
  });

  it("reads the JSON Schema layer's code override", () => {
    expect(
      codesOf('plugin.build(context.ruleContextFor(plugin.name, "enum"));')
    ).toEqual(["enum"]);
  });
});

describe("a code that arrived from somewhere else", () => {
  it("forwards `ctx.code` rather than inventing a name for it", () => {
    const sites = sitesOf("check({ code: ctx.code });");
    expect(sites).toHaveLength(1);
    expect(sites[0]?.resolution).toBe("forwarded");
    expect(sites[0]?.codes).toEqual([]);
  });

  it("forwards a build context handed to another plugin", () => {
    const sites = sitesOf("jsonSchemaPlugin.build(ctx, document, bag);");
    expect(sites).toHaveLength(1);
    expect(sites[0]?.kind).toBe("issue");
    expect(sites[0]?.resolution).toBe("forwarded");
  });

  it("forwards the re-packaging of a rule's own code", () => {
    expect(sitesOf("return { code: rule.code };")[0]?.resolution).toBe(
      "forwarded"
    );
  });
});

describe("a code decided by a caller of a local helper", () => {
  // `composeBranches` is the only helper in src standing between a keyword and
  // `composite()`. Without following its parameter to the call sites, the four
  // composition keywords would be one unreadable site instead of four codes.
  const source = [
    "function composeBranches(code: string, branches: unknown) {",
    "  return composite({ code, branches });",
    "}",
    'composeBranches("allOf", a);',
    'composeBranches("anyOf", b);',
    'composeBranches("oneOf", c);',
    'composeBranches("not", d);',
  ].join("\n");

  it("collects every literal its call sites pass", () => {
    expect(codesOf(source)).toEqual(["allOf", "anyOf", "not", "oneOf"]);
  });

  it("stops at a helper that passes its own parameter to itself", () => {
    const recursive = [
      "function loop(code: string) {",
      "  loop(code);",
      "  return check({ code });",
      "}",
    ].join("\n");
    expect(sitesOf(recursive)[0]?.resolution).toBe("forwarded");
  });
});

describe("a gate's code is recorded apart", () => {
  it("marks argument 0 of gate() as a gate site", () => {
    const sites = sitesOf('gate("skip", () => true);');
    expect(sites).toHaveLength(1);
    expect(sites[0]?.kind).toBe("gate");
    expect(sites[0]?.codes).toEqual(["skip"]);
  });
});

describe("a code nothing can be made of", () => {
  it("records the expression instead of dropping the site", () => {
    const sites = sitesOf("check({ code: `${slot}Type` });");
    expect(sites[0]?.resolution).toBe("unresolved");
    expect(sites[0]?.expression).toBe("`${slot}Type`");
    expect(sites[0]?.line).toBe(1);
  });

  it("makes a conditional unresolved when either side is", () => {
    expect(
      sitesOf('check({ code: flag ? "a" : `${x}` });')[0]?.resolution
    ).toBe("unresolved");
  });
});

describe("positions that are not codes", () => {
  it("ignores a `code` type member, which declares rather than decides", () => {
    expect(sitesOf("interface RuleOptions { readonly code?: string }")).toEqual(
      []
    );
  });

  it("ignores a property named something else", () => {
    expect(sitesOf('check({ pluginCode: "stringMin" });')).toEqual([]);
  });
});
