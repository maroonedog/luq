export interface KeySegment {
  readonly key: string;
}
export interface EachSegment {
  readonly each: true;
}
export type Segment = KeySegment | EachSegment;

/** Splits one dot-free head such as `items[*][*]` into its segments. */
type ParseHead<H extends string> = H extends `${infer K}[*]`
  ? [...ParseHead<K>, EachSegment]
  : [{ readonly key: H }];

export type ParsePath<P extends string> = P extends `${infer H}.${infer R}`
  ? [...ParseHead<H>, ...ParsePath<R>]
  : ParseHead<P>;

type HasEmptyKey<S extends readonly Segment[]> = S extends readonly [
  infer H,
  ...infer R extends readonly Segment[],
]
  ? H extends { readonly key: "" }
    ? true
    : HasEmptyKey<R>
  : false;

export type IsWellFormedPath<P extends string> =
  ParsePath<P> extends readonly [Segment, ...Segment[]]
    ? HasEmptyKey<ParsePath<P>> extends true
      ? false
      : true
    : false;

/** The runtime segment shape parseFieldPath produces (same vocabulary). */
export type PathSegment =
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "each" };
