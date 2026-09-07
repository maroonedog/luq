// ===========================================================================
// L9  src/async/async-context.ts
// RESIDUAL 4 / item 1, first half. Legacy public shape, preserved verbatim:
//   await createAsyncContext<C>().set(key, promise).build()
// (docs/legacy-spec/documented-promises.md:226).
//
// This layer RESOLVES PROMISES AND NOTHING ELSE. No rule runs here; the
// resolved bag leaves as a plain Readonly<Record<string, unknown>> and enters
// validation through ValidateOptions.external, which L5 already forwards to
// RuleContext.external. That is the whole async story: one await, then the
// existing synchronous engine.
// ===========================================================================
import { eraseAssembledRecord } from "../core/type-erasure";
import { readExternalContext } from "../plugin-kit/external-context";

/**
 * The 1.x `getAsyncContext(context)` accessor, kept under a verb-phrase name.
 * The mechanism lives at L2 (see l2-external-context.ts) because plugins need
 * it and a plugin may not import this layer; this is the public alias.
 */
export const readAsyncContext = readExternalContext;

export interface AsyncContextOptions {
  /** Per-entry timeout in milliseconds. */
  readonly timeout?: number;
  /** Substituted when an entry rejects or times out. */
  readonly defaultValues?: Readonly<Record<string, unknown>>;
  /** When true, a failed entry still yields a ready context. */
  readonly continueOnError?: boolean;
}

export interface AsyncContextFailure {
  readonly key: string;
  readonly reason: unknown;
}

export interface AsyncContext<C extends object> {
  /** The typed view. */
  readonly data: C;
  /** The same object, as the untyped bag ValidateOptions.external accepts. */
  readonly values: Readonly<Record<string, unknown>>;
  readonly isReady: boolean;
  readonly hasErrors: boolean;
  readonly failures: readonly AsyncContextFailure[];
}

interface PendingEntry {
  readonly key: string;
  readonly promise: Promise<unknown>;
}

function raceWithTimeout(
  promise: Promise<unknown>,
  timeout: number,
  key: string
): Promise<unknown> {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => {
      setTimeout(
        () => reject(new Error(`Async context entry timed out: ${key}`)),
        timeout
      );
    }),
  ]);
}

/** Immutable: every `set` returns a new builder, so a shared prefix is safe. */
export class AsyncContextBuilder<C extends object> {
  private constructor(
    private readonly entries: readonly PendingEntry[],
    private readonly options: AsyncContextOptions
  ) {}

  static start(): AsyncContextBuilder<Record<never, never>> {
    return new AsyncContextBuilder([], {});
  }

  set<K extends string, V>(
    key: K,
    promise: Promise<V>
  ): AsyncContextBuilder<C & { readonly [P in K]: V }> {
    return new AsyncContextBuilder(
      [...this.entries, { key, promise }],
      this.options
    );
  }

  withOptions(options: AsyncContextOptions): AsyncContextBuilder<C> {
    return new AsyncContextBuilder(this.entries, {
      ...this.options,
      ...options,
    });
  }

  async build(): Promise<AsyncContext<C>> {
    const values: Record<string, unknown> = {};
    const failures: AsyncContextFailure[] = [];
    const timeout = this.options.timeout;
    const settled = await Promise.allSettled(
      this.entries.map((entry) =>
        timeout === undefined
          ? entry.promise
          : raceWithTimeout(entry.promise, timeout, entry.key)
      )
    );
    settled.forEach((outcome, index) => {
      const entry = this.entries[index];
      if (entry === undefined) return;
      if (outcome.status === "fulfilled") {
        values[entry.key] = outcome.value;
        return;
      }
      failures.push({ key: entry.key, reason: outcome.reason });
      const fallback = this.options.defaultValues?.[entry.key];
      if (fallback !== undefined) values[entry.key] = fallback;
    });
    const frozen = Object.freeze(values);
    return {
      data: eraseAssembledRecord<C>(frozen),
      values: frozen,
      isReady: failures.length === 0 || this.options.continueOnError === true,
      hasErrors: failures.length > 0,
      failures: Object.freeze(failures),
    };
  }
}

export function createAsyncContext(): AsyncContextBuilder<
  Record<never, never>
> {
  return AsyncContextBuilder.start();
}
