// ===========================================================================
// L9 src/async/async-context.ts at RUNTIME.
//
// The whole contract of this file is: await a promise map once, hand back a
// frozen bag, and record what failed. Nothing here validates anything, so
// every assertion below is about resolution, not about rules.
// ===========================================================================
import {
  AsyncContextBuilder,
  createAsyncContext,
  readAsyncContext,
} from "../../../src/async/async-context";
import { readExternalContext } from "../../../src/plugin-kit/external-context";
import type { RuleContext } from "../../../src/types";

interface Quota {
  readonly remaining: number;
}

function isQuota(value: unknown): value is Quota {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof Reflect.get(value, "remaining") === "number"
  );
}

function neverSettles(): Promise<never> {
  return new Promise<never>(() => undefined);
}

describe("createAsyncContext().set(...).build()", () => {
  it("keys the resolved values by the names they were set under", async () => {
    const ctx = await createAsyncContext()
      .set("emailTaken", Promise.resolve(false))
      .set("remainingQuota", Promise.resolve(7))
      .build();
    expect(ctx.values).toEqual({ emailTaken: false, remainingQuota: 7 });
    expect(ctx.isReady).toBe(true);
    expect(ctx.hasErrors).toBe(false);
    expect(ctx.failures).toEqual([]);
  });

  it("hands back the resolved value by identity, not a copy", async () => {
    const resolved: Quota = { remaining: 3 };
    const ctx = await createAsyncContext()
      .set("quota", Promise.resolve(resolved))
      .build();
    expect(ctx.values["quota"]).toBe(resolved);
  });

  it("exposes the same object as `data` and as `values`", async () => {
    const ctx = await createAsyncContext()
      .set("remaining", Promise.resolve(2))
      .build();
    expect(ctx.data).toBe(ctx.values);
  });

  it("freezes the bag, so a rule cannot write back into the context", async () => {
    const ctx = await createAsyncContext()
      .set("remaining", Promise.resolve(2))
      .build();
    expect(Object.isFrozen(ctx.values)).toBe(true);
    expect(Object.isFrozen(ctx.failures)).toBe(true);
  });

  it("resolves each entry exactly once, however many times build() runs", async () => {
    let resolutions = 0;
    const source = new Promise<number>((resolve) => {
      resolutions += 1;
      resolve(7);
    });
    const pending = createAsyncContext().set("n", source);
    const first = await pending.build();
    const second = await pending.build();
    expect(resolutions).toBe(1);
    expect(first.values["n"]).toBe(7);
    expect(second.values["n"]).toBe(7);
    expect(first).not.toBe(second);
  });

  it("builds an empty context without complaint", async () => {
    const ctx = await createAsyncContext().build();
    expect(ctx.values).toEqual({});
    expect(ctx.isReady).toBe(true);
  });

  it("lets a later set() override an earlier one under the same key", async () => {
    const ctx = await createAsyncContext()
      .set("n", Promise.resolve(1))
      .set("n", Promise.resolve(2))
      .build();
    expect(ctx.values["n"]).toBe(2);
  });
});

describe("the builder is immutable, so a shared prefix is safe", () => {
  it("does not mutate the receiver of set()", async () => {
    const base = createAsyncContext().set("a", Promise.resolve(1));
    const branch = base.set("b", Promise.resolve(2));
    expect(branch).not.toBe(base);
    expect((await base.build()).values).toEqual({ a: 1 });
    expect((await branch.build()).values).toEqual({ a: 1, b: 2 });
  });

  it("does not mutate the receiver of withOptions()", async () => {
    const base = createAsyncContext().set("a", Promise.reject(new Error("no")));
    const lenient = base.withOptions({ continueOnError: true });
    expect(lenient).not.toBe(base);
    expect((await base.build()).isReady).toBe(false);
    expect((await lenient.build()).isReady).toBe(true);
  });

  it("merges successive withOptions() calls instead of replacing them", async () => {
    const ctx = await createAsyncContext()
      .set("a", neverSettles())
      .withOptions({ timeout: 5 })
      .withOptions({ continueOnError: true })
      .build();
    expect(ctx.hasErrors).toBe(true);
    expect(ctx.isReady).toBe(true);
    expect(ctx.failures[0]?.key).toBe("a");
  });
});

describe("a failing entry", () => {
  it("is recorded as a failure, is absent from the bag, and blocks readiness", async () => {
    const reason = new Error("lookup exploded");
    const ctx = await createAsyncContext()
      .set("ok", Promise.resolve(1))
      .set("bad", Promise.reject(reason))
      .build();
    expect(ctx.hasErrors).toBe(true);
    expect(ctx.isReady).toBe(false);
    expect(ctx.failures).toEqual([{ key: "bad", reason }]);
    expect(Object.prototype.hasOwnProperty.call(ctx.values, "bad")).toBe(false);
    expect(ctx.values["ok"]).toBe(1);
  });

  it("is substituted by defaultValues when one is offered", async () => {
    const ctx = await createAsyncContext()
      .set("bad", Promise.reject(new Error("nope")))
      .withOptions({ defaultValues: { bad: "fallback" } })
      .build();
    expect(ctx.values["bad"]).toBe("fallback");
    expect(ctx.hasErrors).toBe(true);
    expect(ctx.isReady).toBe(false);
  });

  it("still yields a ready context under continueOnError", async () => {
    const ctx = await createAsyncContext()
      .set("bad", Promise.reject(new Error("nope")))
      .withOptions({ continueOnError: true })
      .build();
    expect(ctx.isReady).toBe(true);
    expect(ctx.hasErrors).toBe(true);
  });

  it("times out per entry, naming the key that hung", async () => {
    const ctx = await createAsyncContext()
      .set("fast", Promise.resolve("here"))
      .set("slow", neverSettles())
      .withOptions({ timeout: 5 })
      .build();
    expect(ctx.values["fast"]).toBe("here");
    expect(ctx.failures).toHaveLength(1);
    expect(ctx.failures[0]?.key).toBe("slow");
    expect(String(ctx.failures[0]?.reason)).toContain(
      "Async context entry timed out: slow"
    );
  });

  it("does not time out an entry that settles inside the budget", async () => {
    const ctx = await createAsyncContext()
      .set("quick", Promise.resolve("here"))
      .withOptions({ timeout: 1000 })
      .build();
    expect(ctx.hasErrors).toBe(false);
    expect(ctx.values["quick"]).toBe("here");
  });
});

describe("readAsyncContext", () => {
  it("is the L2 read function, not a second implementation of it", () => {
    expect(readAsyncContext).toBe(readExternalContext);
  });

  it("returns the bag only when the caller's guard accepts it", async () => {
    const ctx = await createAsyncContext()
      .set("remaining", Promise.resolve(4))
      .build();
    const ruleContext: RuleContext = {
      root: {},
      path: "email",
      external: ctx.values,
    };
    expect(readAsyncContext(ruleContext, isQuota)).toBe(ctx.values);
    expect(
      readAsyncContext(ruleContext, (value): value is Quota => {
        void value;
        return false;
      })
    ).toBeUndefined();
    expect(
      readAsyncContext({ root: {}, path: "email" }, isQuota)
    ).toBeUndefined();
  });
});

describe("AsyncContextBuilder.start()", () => {
  it("is what createAsyncContext() returns", () => {
    expect(createAsyncContext()).toBeInstanceOf(AsyncContextBuilder);
    expect(AsyncContextBuilder.start()).toBeInstanceOf(AsyncContextBuilder);
  });
});
