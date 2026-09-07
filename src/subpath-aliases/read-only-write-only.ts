// ===========================================================================
// src/subpath-aliases/read-only-write-only.ts
// The 1.x subpath `@maroonedog/luq/plugins/readOnlyWriteOnly` kept alive.
//
// It has no plugin directory of its own — readOnly and writeOnly are two
// directories now — so it lives here, where the catalog does not look for
// plugins, and SUBPATH_ALIASES publishes it only because this file exists.
// Deprecated: import ./plugins/readOnly and ./plugins/writeOnly instead.
// ===========================================================================
export { readOnlyPlugin } from "../plugins/read-only/index";
export { writeOnlyPlugin } from "../plugins/write-only/index";
