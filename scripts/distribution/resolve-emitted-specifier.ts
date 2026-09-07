import * as fs from "fs";
import * as path from "path";
import { DECLARATION_EXTENSION } from "./dist-layout";

/**
 * Resolves a relative specifier the way the runtime that loads the file does,
 * against a tree of EMITTED files rather than against src.
 *
 * `./x` may mean `x<ext>` or `x/index<ext>`; that is the whole of Node's
 * relative resolution for these two formats, and it is also exactly what
 * tsc's declaration resolution does for `.d.ts`. Anything it cannot resolve is
 * a broken shipped specifier — the defect that shipped in 1.x as
 * `dist/plugins/jsonSchemaFullFeature.d.ts` importing a doubled path.
 */
export function resolveEmittedSpecifier(
  fromFile: string,
  specifier: string,
  extension: string
): string | undefined {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = specifier.endsWith(extension)
    ? [base]
    : [`${base}${extension}`, path.join(base, `index${extension}`)];
  return candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );
}

/** The extension a shipped file's own specifiers resolve against. */
export function extensionOf(file: string): string {
  if (file.endsWith(DECLARATION_EXTENSION)) return DECLARATION_EXTENSION;
  return path.extname(file);
}
