// ===========================================================================
// L9 src/async/async-validator.ts at RUNTIME.
//
// The documented 1.x line — await validator.withAsyncContext(ctx).validate(x)
// — running against the REAL builder, the REAL compiler and the REAL engine.
// Nothing here is stubbed, because the claim under test is precisely that the
// resolved bag reaches a rule, and a stub cannot show that.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { optionalPlugin } from "../../../src/plugins/optional";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { externalFlagPlugin } from "../../support/probe-config-plugins";
import { createAsyncContext } from "../../../src/async/async-context";
import {
  ASYNC_CONTEXT_ISSUE_CODE,
  addAsyncSupport,
  withAsyncContext,
} from "../../../src/async/async-validator";
import {
  contextSpyPlugin,
  observedContexts,
  resetObservedContexts,
} from "./context-spy-plugin";

interface Signup {
  readonly email: string;
  readonly nick: string;
}

const signupValidator = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(stringMinPlugin)
  .use(externalFlagPlugin)
  .use(contextSpyPlugin)
  .for<Signup>()
  .v("email", (b) =>
    b.string.required().externalFlag("emailAvailable", true).contextSpy()
  )
  .v("nick", (b) => b.string.required().min(3))
  .build();

const validSignup: Signup = { email: "ada@example.com", nick: "ada" };

function buildReadyContext() {
  return createAsyncContext()
    .set("emailAvailable", Promise.resolve(true))
    .build();
}

beforeEach(() => {
  resetObservedContexts();
});

describe("the resolved bag reaches a rule through ValidateOptions.external", () => {
  it("closes the 1.x defect: required fromContext used to always fail", async () => {
    const withoutContext = signupValidator.validate(validSignup);
    expect(withoutContext.valid).toBe(false);

    const ctx = await buildReadyContext();
    const outcome = await withAsyncContext(signupValidator, ctx).validate(
      validSignup
    );
    expect(outcome.valid).toBe(true);
  });

  it("puts the very entries the context resolved on RuleContext.external", async () => {
    const ctx = await buildReadyContext();
    await withAsyncContext(signupValidator, ctx).validate(validSignup);
    expect(observedContexts).toHaveLength(1);
    expect(observedContexts[0]?.external).toEqual({ emailAvailable: true });
  });

  it("runs every user rule exactly once per validate()", async () => {
    const ctx = await buildReadyContext();
    const bound = withAsyncContext(signupValidator, ctx);
    await bound.validate(validSignup);
    await bound.validate(validSignup);
    expect(observedContexts).toHaveLength(2);
  });

  it("resolves the promise map once, not once per validate()", async () => {
    let resolutions = 0;
    const lookup = new Promise<boolean>((resolve) => {
      resolutions += 1;
      resolve(true);
    });
    const ctx = await createAsyncContext()
      .set("emailAvailable", lookup)
      .build();
    const bound = withAsyncContext(signupValidator, ctx);
    await bound.validate(validSignup);
    await bound.validate(validSignup);
    expect(resolutions).toBe(1);
  });
});

describe("merging with the caller's own options", () => {
  it("keeps caller-supplied external keys the context did not set", async () => {
    const ctx = await buildReadyContext();
    await withAsyncContext(signupValidator, ctx).validate(validSignup, {
      external: { unrelatedFlag: false },
    });
    expect(observedContexts[0]?.external).toEqual({
      emailAvailable: true,
      unrelatedFlag: false,
    });
  });

  it("lets the resolved context win a key collision", async () => {
    const ctx = await buildReadyContext();
    const outcome = await withAsyncContext(signupValidator, ctx).validate(
      validSignup,
      { external: { emailAvailable: false } }
    );
    expect(observedContexts[0]?.external).toEqual({ emailAvailable: true });
    expect(outcome.valid).toBe(true);
  });

  it("forwards abortEarly untouched: it still changes the issue count", async () => {
    const ctx = await buildReadyContext();
    const broken = { email: "", nick: "x" };
    const early = await withAsyncContext(signupValidator, ctx).validate(broken);
    const all = await withAsyncContext(signupValidator, ctx).validate(broken, {
      abortEarly: false,
    });
    expect(early.issues.map((issue) => issue.path)).toEqual(["email"]);
    expect(all.issues.map((issue) => issue.path)).toEqual(["email", "nick"]);
  });
});

describe("a context that did not resolve", () => {
  it("rejects without running a single rule", async () => {
    const ctx = await createAsyncContext()
      .set("emailAvailable", Promise.reject(new Error("registry down")))
      .build();
    const outcome = await withAsyncContext(signupValidator, ctx).validate(
      validSignup
    );
    expect(outcome.valid).toBe(false);
    expect(observedContexts).toHaveLength(0);
    expect(outcome.issues).toEqual([
      {
        path: "emailAvailable",
        code: ASYNC_CONTEXT_ISSUE_CODE,
        message: 'Async context entry "emailAvailable" did not resolve.',
        severity: "error",
      },
    ]);
  });

  it("reports one issue per failed entry", async () => {
    const ctx = await createAsyncContext()
      .set("a", Promise.reject(new Error("x")))
      .set("b", Promise.reject(new Error("y")))
      .build();
    const outcome = await withAsyncContext(signupValidator, ctx).parse(
      validSignup
    );
    expect(outcome.valid).toBe(false);
    expect(outcome.issues.map((issue) => issue.path)).toEqual(["a", "b"]);
    expect(observedContexts).toHaveLength(0);
  });

  it("proceeds anyway under continueOnError, with the entry simply absent", async () => {
    const ctx = await createAsyncContext()
      .set("emailAvailable", Promise.reject(new Error("registry down")))
      .withOptions({ continueOnError: true })
      .build();
    const outcome = await withAsyncContext(signupValidator, ctx).validate(
      validSignup,
      { abortEarlyOnEachField: false }
    );
    expect(outcome.valid).toBe(false);
    expect(observedContexts).toHaveLength(1);
    expect(observedContexts[0]?.external).toEqual({});
  });

  it("uses a defaultValues substitute as if it had resolved", async () => {
    const ctx = await createAsyncContext()
      .set("emailAvailable", Promise.reject(new Error("registry down")))
      .withOptions({
        continueOnError: true,
        defaultValues: { emailAvailable: true },
      })
      .build();
    const outcome = await withAsyncContext(signupValidator, ctx).validate(
      validSignup
    );
    expect(outcome.valid).toBe(true);
  });
});

describe("parse() goes through the same door", () => {
  it("returns the parsed value with the context applied", async () => {
    const ctx = await buildReadyContext();
    const outcome = await withAsyncContext(signupValidator, ctx).parse(
      validSignup
    );
    expect(outcome.valid).toBe(true);
    expect(outcome.valid && outcome.data).toEqual(validSignup);
  });
});

describe("addAsyncSupport decorates without replacing", () => {
  it("adds withAsyncContext and keeps the four core methods", () => {
    const decorated = addAsyncSupport(signupValidator);
    expect(typeof decorated.validate).toBe("function");
    expect(typeof decorated.parse).toBe("function");
    expect(typeof decorated.pick).toBe("function");
    expect(typeof decorated.pickAll).toBe("function");
    expect(typeof decorated.withAsyncContext).toBe("function");
  });

  it("delegates the undecorated methods to the wrapped validator", async () => {
    const decorated = addAsyncSupport(signupValidator);
    expect(decorated.validate(validSignup).valid).toBe(false);
    expect(decorated.pick("nick").path).toBe("nick");
    expect(decorated.pick("nick").validate("ada").valid).toBe(true);
    expect(decorated.pick("nick").validate("x").valid).toBe(false);
    expect(decorated.pickAll(["nick"]).paths).toEqual(["nick"]);
  });

  it("exposes the bound context so the caller need not keep it", async () => {
    const ctx = await buildReadyContext();
    const bound = addAsyncSupport(signupValidator).withAsyncContext(ctx);
    expect(bound.context).toBe(ctx);
    expect(bound.context.data.emailAvailable).toBe(true);
  });

  it("returns a promise from the bound validate, not a settled result", async () => {
    const ctx = await buildReadyContext();
    const pending = addAsyncSupport(signupValidator)
      .withAsyncContext(ctx)
      .validate(validSignup);
    expect(pending).toBeInstanceOf(Promise);
    expect((await pending).valid).toBe(true);
  });
});
