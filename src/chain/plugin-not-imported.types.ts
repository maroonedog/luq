/**
 * What a chain method resolves to when its plugin was never passed to `.use()`.
 *
 * The method is real and it belongs on this slot — it is simply not in this
 * builder's bag. Without this the reader gets `Property 'min' does not exist on
 * type 'FieldChain<...>'`, which is equally true of a typo, of a method meant
 * for another type, and of a forgotten import, and those have three different
 * fixes. This has no call signature, so calling it fails, and the type
 * arguments printed in that failure name the symbol to import and the subpath
 * to import it from.
 *
 * A typo still gets `Property ... does not exist`: only a method the slot
 * really offers appears here, so the two messages stay distinguishable.
 */
export interface PluginNotImported<
  TMethod extends string,
  TSymbol extends string,
  TSubpath extends string,
> {
  readonly luqError: "pluginNotImported";
  readonly message: "This method needs its plugin. Import the symbol below and pass it to .use().";
  readonly method: TMethod;
  readonly importSymbol: TSymbol;
  readonly importFrom: TSubpath;
}

/**
 * Returned instead of the rule when a builder is missing plugins the rule was
 * minted from, naming the ones it lacks.
 *
 * `useField` used to state that requirement structurally: the rule's bag sat in
 * a parameter position, so the builder's slots had to be assignable to the
 * rule's, and a builder carrying MORE plugins was accepted because more members
 * are assignable to fewer. That stopped being true once a slot began carrying a
 * member for every method it does NOT have: a missing method is
 * `PluginNotImported` on one side and a real function on the other, and those
 * are not assignable either way. The requirement is written out directly now,
 * which is also what it always meant — the builder must carry what the rule
 * needs — rather than a consequence of how two object types compared.
 */
export interface FieldRuleNeedsPlugins<TMissing> {
  readonly luqError: "fieldRuleNeedsPlugins";
  readonly message: "This builder is missing plugins the rule was minted from. Pass them to .use() as well.";
  readonly missing: TMissing;
}
