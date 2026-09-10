// ===========================================================================
// luq-codegen/src/generate/chain-call.types.ts
//
// The intermediate form of one generated chain. Going through it instead of
// concatenating strings is what makes the set of plugins to import countable
// afterwards. Built by concatenation, a missing import first shows up in the
// user's compiler rather than here.
// ===========================================================================

/** One call of one method on the chain. */
export interface ChainCall {
  /** The method to call, e.g. "min". */
  readonly method: string;
  /** The argument source, emitted verbatim, e.g. ["3"]. Empty gives `.min()`. */
  readonly args: readonly string[];
  /**
   * The export name of the plugin carrying this method, e.g.
   * "stringMinPlugin". The import statements are built by collecting these.
   */
  readonly pluginExport: string;
  /** The subpath to import it from, e.g. "@maroonedog/luq/plugins/stringMin". */
  readonly pluginSubpath: string;
}

/** One field's declaration, becoming `.v(path, b => b.<slot>....)`. */
export interface FieldChain {
  /** The first argument of `.v()`, e.g. "items[*].sku". */
  readonly path: string;
  /** The slot name following `b.`, e.g. "string". */
  readonly slot: string;
  readonly calls: readonly ChainCall[];
  /**
   * The keywords not emitted, with reasons. Carried through so that dropping
   * one is never silent, and printed in a comment in the output.
   */
  readonly skipped: readonly SkippedKeyword[];
}

export interface SkippedKeyword {
  readonly keyword: string;
  readonly reason: string;
}

export interface GeneratedModule {
  readonly source: string;
  /** The export names of the plugins used, deduplicated and sorted. */
  readonly pluginExports: readonly string[];
  /** Everything skipped, across all fields, for the caller to report. */
  readonly skipped: readonly (SkippedKeyword & { readonly path: string })[];
}
