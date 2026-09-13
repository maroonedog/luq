// ===========================================================================
// docs-site/src/i18n/locale-of-path.ts
//
// Which language a URL is in, and where its counterpart lives.
//
// This is the ONE derivation. The language switch needs it to decide where to
// point, the layout needs it to set `lang` on <html>, and the head needs it to
// emit hreflang — and if those three each worked it out for themselves they
// could disagree, which shows up as a page whose switch says Japanese and
// whose markup says English. A screen reader believes the markup.
//
// The scheme is the one astro.config.mjs configures: the default locale has no
// prefix, every other locale is a path prefix. `/` and `/plugins` are English;
// `/ja` and `/ja/plugins` are Japanese.
// ===========================================================================
import { TRANSLATED_PATHS } from "./translated-paths";

export type Locale = "en" | "ja";

/** The locale served without a path prefix. */
export const DEFAULT_LOCALE: Locale = "en";

/** The prefix each non-default locale is served under. */
const JA_PREFIX = "/ja";

/** The language a path is served in. */
export function localeOfPath(pathname: string): Locale {
  return pathname === JA_PREFIX || pathname.startsWith(`${JA_PREFIX}/`)
    ? "ja"
    : "en";
}

/** The English path for a path in any locale. */
export function englishPathOf(pathname: string): string {
  if (localeOfPath(pathname) === "en") return pathname;
  const stripped = pathname.slice(JA_PREFIX.length);
  return stripped === "" ? "/" : stripped;
}

/**
 * Where the Japanese version of an English path WOULD live.
 *
 * Would, not does — the route only exists if it is in TRANSLATED_PATHS, and
 * linking to one that is not there is a 404. Callers that link somewhere must
 * go through `japaneseTranslationOf`.
 */
export function japanesePathCandidate(pathname: string): string {
  const english = englishPathOf(pathname);
  return english === "/" ? JA_PREFIX : `${JA_PREFIX}${english}`;
}

/** The Japanese page for a path, or null when nobody has written one. */
export function japaneseTranslationOf(pathname: string): string | null {
  const candidate = japanesePathCandidate(pathname);
  return TRANSLATED_PATHS.includes(candidate) ? candidate : null;
}
