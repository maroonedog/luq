// ===========================================================================
// test/unit/json-schema/core/format-map.test.ts
//
// 1.x had THREE format tables and they disagreed. The acceptance condition for
// this file is therefore not "the table is right" but "the table is the only
// one": each format resolves to exactly one plugin, each of those plugins owns
// its grammar, and no second grammar for a format lives anywhere in src.
// ===========================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  draft07FormatMap,
  findFormatHandling,
  listFormatNames,
  type Draft07Format,
  type FormatHandling,
} from "../../../../src/json-schema/format-map";
import { unsupported } from "../../../../src/json-schema/bind-keyword";
import { countKeywordHandlings } from "../../../../src/json-schema/keyword-map";
import { stringKeywordMap } from "../../../../src/json-schema/keyword-map-string";

/** Draft-07 section 7.3, in the order the specification lists them. */
const DRAFT07_SPEC_FORMATS: readonly string[] = [
  "date-time",
  "date",
  "time",
  "email",
  "idn-email",
  "hostname",
  "idn-hostname",
  "ipv4",
  "ipv6",
  "uri",
  "uri-reference",
  "iri",
  "iri-reference",
  "uri-template",
  "json-pointer",
  "relative-json-pointer",
  "regex",
];

/** Names 1.x also served, kept because dropping them would break callers. */
const CARRIED_OVER_FORMATS: readonly string[] = ["url", "uuid", "duration"];

describe("there is one format table and it is complete", () => {
  it("decides on every Draft-07 format name", () => {
    for (const format of DRAFT07_SPEC_FORMATS) {
      expect([format, findFormatHandling(format)]).not.toEqual([
        format,
        undefined,
      ]);
    }
  });

  it("also decides on the three names carried over from 1.x", () => {
    for (const format of CARRIED_OVER_FORMATS) {
      expect([format, findFormatHandling(format)]).not.toEqual([
        format,
        undefined,
      ]);
    }
  });

  it("holds exactly those twenty names and no others", () => {
    expect([...listFormatNames()].sort()).toEqual(
      [...DRAFT07_SPEC_FORMATS, ...CARRIED_OVER_FORMATS].sort()
    );
  });

  it("binds all 20 and declares none out of scope", () => {
    expect(countKeywordHandlings(draft07FormatMap)).toEqual({
      bind: 20,
      structural: 0,
      unsupported: 0,
      total: 20,
    });
  });

  it("binds the four names step 24 had to leave out of scope", () => {
    // Until step 27 these four threw UnsupportedKeywordError at BUILD time,
    // because no plugin existed to bind them to. They cost 24 cases of the
    // official draft7 corpus; the plugins now exist and each one's header
    // states what its grammar does and does not check.
    const late: readonly (readonly [Draft07Format, string])[] = [
      ["idn-email", "stringIdnEmail"],
      ["idn-hostname", "stringIdnHostname"],
      ["uri-reference", "stringUriReference"],
      ["regex", "stringRegex"],
    ];
    for (const [format, pluginName] of late) {
      const handling = draft07FormatMap[format];
      expect([format, handling.handling]).toEqual([format, "bind"]);
      if (handling.handling !== "bind") continue;
      expect([format, handling.pluginName]).toEqual([format, pluginName]);
    }
  });

  it("does NOT reuse stringIriReference for uri-reference", () => {
    // An IRI-reference is a strict SUPERSET of a URI-reference, so binding it
    // would pass values the format forbids. Step 24 refused the binding for
    // that reason; the separate plugin is what makes the refusal repayable.
    const uriReference = draft07FormatMap["uri-reference"];
    const iriReference = draft07FormatMap["iri-reference"];
    expect(uriReference.handling).toBe("bind");
    if (uriReference.handling !== "bind" || iriReference.handling !== "bind") {
      return;
    }
    expect(uriReference.pluginName).not.toBe(iriReference.pluginName);
  });
});

describe("each format resolves to exactly one plugin", () => {
  it("gives every bound format a single plugin name and method", () => {
    for (const format of listFormatNames()) {
      const handling = draft07FormatMap[format];
      if (handling.handling !== "bind") continue;
      expect([format, handling.slot]).toEqual([format, "string"]);
      expect([format, typeof handling.pluginName]).toEqual([format, "string"]);
      expect([format, handling.toArguments("format")]).toEqual([format, []]);
    }
  });

  it("maps uri and url onto the one URL plugin, on purpose", () => {
    const uri = draft07FormatMap.uri;
    const url = draft07FormatMap.url;
    expect(uri.handling).toBe("bind");
    if (uri.handling !== "bind" || url.handling !== "bind") return;
    expect(uri.pluginName).toBe("stringUrl");
    expect(url.pluginName).toBe(uri.pluginName);
    expect(url.method).toBe(uri.method);
  });

  it("gives the other eighteen bound formats a plugin of their own", () => {
    const bound = listFormatNames()
      .map((format) => draft07FormatMap[format])
      .filter((handling) => handling.handling === "bind");
    const names = bound.map((handling) =>
      handling.handling === "bind" ? handling.pluginName : ""
    );
    // 20 bindings, 19 distinct plugins: only stringUrl serves two names.
    expect(names).toHaveLength(20);
    expect(new Set(names).size).toBe(19);
  });
});

describe("an unknown format is an annotation, not an error", () => {
  // Draft-07 section 7.2 and a must-preserve contract from 1.x: a name the
  // table does not know passes. 1.x's error generator did the opposite and
  // contradicted its own validator.
  it("returns undefined rather than throwing", () => {
    expect(findFormatHandling("phone-number")).toBeUndefined();
    expect(findFormatHandling("")).toBeUndefined();
  });

  it("does not answer for a prototype member", () => {
    expect(findFormatHandling("toString")).toBeUndefined();
    expect(findFormatHandling("constructor")).toBeUndefined();
  });

  // The shipped table now binds all twenty names, so it holds no example of
  // the OTHER answer. The distinction still has to be pinned — 1.x's whole
  // format bug was treating "not in the table" and "declared out of scope" as
  // the same thing — so the second answer is exercised against a table built
  // here. If FormatHandling ever loses the unsupported arm, this stops
  // compiling; if a lookup ever collapses the two, it stops passing.
  it("keeps that separate from a format declared unsupported", () => {
    const declared: FormatHandling = unsupported("no plugin exists for it");
    const table: Readonly<Record<string, FormatHandling>> = {
      "invented-format": declared,
    };
    expect(table["invented-format"]).toBeDefined();
    expect(table["invented-format"]?.handling).toBe("unsupported");
    expect(findFormatHandling("invented-format")).toBeUndefined();
  });
});

describe("the format keyword itself is structural", () => {
  it("says so, and points at this table", () => {
    const handling = stringKeywordMap.format;
    expect(handling.handling).toBe("structural");
    if (handling.handling !== "structural") return;
    expect(handling.note).toContain("format-map");
  });
});

// ---------------------------------------------------------------------------
// The "no second grammar" check. It reads src, so a future file that
// re-implements a format's regex fails this suite instead of silently becoming
// the fourth disagreeing table.
// ---------------------------------------------------------------------------
function listSourceFiles(directory: string): readonly string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return listSourceFiles(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

describe("the json-schema layer owns no format grammar of its own", () => {
  const sourceRoot = join(__dirname, "..", "..", "..", "..", "src");
  const jsonSchemaFiles = listSourceFiles(join(sourceRoot, "json-schema"));

  it("finds the layer's files", () => {
    expect(jsonSchemaFiles.length).toBeGreaterThanOrEqual(12);
  });

  // A grammar needs character classes and escapes. If none of these appear in
  // the layer, the layer cannot be validating a format itself, which is what
  // made 1.x's second and third format tables possible.
  it("contains no character class or regex escape anywhere", () => {
    const grammarMarkers = ["[0-9", "[a-z", "[A-Z", "\\d", "\\w", "\\s{"];
    for (const file of jsonSchemaFiles) {
      const text = readFileSync(file, "utf8");
      for (const marker of grammarMarkers) {
        expect([file, marker, text.includes(marker)]).toEqual([
          file,
          marker,
          false,
        ]);
      }
    }
  });

  // The single exception, and it compiles the SCHEMA's own `pattern` source
  // rather than a grammar of Luq's: one file, one call.
  it("constructs exactly one RegExp, in the pattern binding", () => {
    const constructors = jsonSchemaFiles.filter((file) =>
      readFileSync(file, "utf8").includes("new RegExp(")
    );
    expect(constructors.map((file) => file.split(/[\\/]/).pop())).toEqual([
      "keyword-map-string.ts",
    ]);
  });

  it("keeps the format table free of any regex literal", () => {
    const text = readFileSync(
      join(sourceRoot, "json-schema", "format-map.ts"),
      "utf8"
    );
    expect(text).not.toContain("RegExp");
    expect(text).not.toContain("test(");
  });
});
