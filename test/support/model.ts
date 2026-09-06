export type Expect<T extends true> = T;
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
    ? true
    : false;

export interface Cat {
  readonly kind: "cat";
  readonly lives: number;
}
export interface Dog {
  readonly kind: "dog";
  readonly breed: string;
}
export type Pet = Cat | Dog;

export function isCat(value: unknown): value is Cat {
  return (
    typeof value === "object" && value !== null && (value as Cat).kind === "cat"
  );
}
export function isDog(value: unknown): value is Dog {
  return (
    typeof value === "object" && value !== null && (value as Dog).kind === "dog"
  );
}

export interface Address {
  readonly street: string;
  readonly zip: string;
}

export interface Item {
  readonly name: string;
  readonly qty: number;
}

export interface Profile {
  readonly address: Address;
}

export interface User {
  readonly name: string;
  readonly nick?: string;
  readonly age: number;
  readonly when: Date;
  readonly tags: readonly string[];
  readonly scores: readonly number[];
  readonly items: readonly Item[];
  readonly matrix: readonly (readonly number[])[];
  readonly user: Profile;
  readonly pet: Pet;
  readonly opt?: Address;
  readonly loose: Record<string, unknown>;
}

/** A self-referential model: the depth budget must make this terminate. */
export interface TreeNode {
  readonly label: string;
  readonly children: readonly TreeNode[];
}
