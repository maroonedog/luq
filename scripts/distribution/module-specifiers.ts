/**
 * The module specifiers a shipped file names, and a way to rewrite them.
 *
 * Both directions read the SAME four forms, so the build's rewrite and the
 * layout gate's resolution check can never disagree about what a specifier is.
 * The input is always tsc's own emit or a shim this repository writes, never
 * hand-written code, so line-anchored matching is exact rather than heuristic:
 * a `from "..."` inside a JSDoc block never starts a line with `import`.
 */

/** `import ... from "x"` / `export ... from "x"`, statement at line start. */
const IMPORT_FROM = /^(?:import|export)\b[^\n]*?\bfrom\s*(['"])([^'"\n]+)\1/gm;

/** `import "x"` — a side-effect import. Shipped code should have none. */
const BARE_IMPORT = /^import\s*(['"])([^'"\n]+)\1/gm;

/** `require("x")` in the CommonJS emit. */
const REQUIRE_CALL = /\brequire\(\s*(['"])([^'"\n]+)\1\s*\)/g;

/** `import("x")` — a dynamic import, and the form tsc uses in .d.ts types. */
const IMPORT_CALL = /\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g;

const SPECIFIER_FORMS = [
  IMPORT_FROM,
  BARE_IMPORT,
  REQUIRE_CALL,
  IMPORT_CALL,
] as const;

export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/** Every module specifier the text names, in no particular order, deduped. */
export function readModuleSpecifiers(text: string): readonly string[] {
  const found = new Set<string>();
  for (const form of SPECIFIER_FORMS) {
    for (const match of text.matchAll(new RegExp(form.source, form.flags))) {
      const specifier = match[2];
      if (specifier !== undefined) found.add(specifier);
    }
  }
  return [...found].sort();
}

export function readRelativeSpecifiers(text: string): readonly string[] {
  return readModuleSpecifiers(text).filter(isRelativeSpecifier);
}

/**
 * Rewrites every RELATIVE specifier through `rewrite`, leaving bare package
 * specifiers untouched. The quote character and the surrounding syntax are
 * preserved byte for byte.
 */
export function rewriteRelativeSpecifiers(
  text: string,
  rewrite: (specifier: string) => string
): string {
  return SPECIFIER_FORMS.reduce(
    (current, form) =>
      current.replace(
        new RegExp(form.source, form.flags),
        (whole: string, quote: string, specifier: string) =>
          isRelativeSpecifier(specifier)
            ? whole.replace(
                `${quote}${specifier}${quote}`,
                `${quote}${rewrite(specifier)}${quote}`
              )
            : whole
      ),
    text
  );
}
