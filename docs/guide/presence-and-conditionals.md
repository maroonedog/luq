# Presence and conditionals

## The order rules run in

For every field, always, whatever order you wrote the chain in:

```text
default  ->  presence  ->  gates  ->  checks  ->  transforms  ->  recursion
```

`build()` sorts the chain into those buckets, so `.min(3).validateIf(c)` and
`.validateIf(c).min(3)` mean the same thing. In 1.x the answer depended on
where in the chain the call sat.

Two consequences worth stating:

- **A closed gate silences the whole field**, not the rules after it.
- **A rejected presence gate ends the field with exactly one issue**, under the
  presence rule's own code. No check and no transform on that field runs.
- Transforms run in `parse()` only, and only when every check passed.

## Absence is decided once

"Absent" is decided by the field's presence policy before any check sees the
value. A check therefore never has to re-decide whether `null` is acceptable —
which is why `stringMin` passes a non-string through instead of failing it.

| Declared | `undefined` | `null` | `""` | present |
|---|---|---|---|---|
| `.required()` | rejected | rejected | rejected | checks run |
| `.optional()` | accepted, field ends | rejected | checks run | checks run |
| `.nullable()` | rejected | accepted, field ends | checks run | checks run |
| nothing | accepted, field ends | accepted, field ends | checks run | checks run |

The last row is the one to notice: **a field with no presence rule is not
implicitly required.** A missing value ends the field silently. That is one
uniform answer replacing 1.x's split, where adding an array elsewhere in the
schema switched implicit-required on for unrelated fields.

`.required()` treating `""` as absent is 1.x behaviour kept deliberately: it is
a form-oriented choice, and `0`, `false`, `[]` and `{}` all count as present.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { optionalPlugin } from "@maroonedog/luq/plugins/optional";
import { nullablePlugin } from "@maroonedog/luq/plugins/nullable";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Member = {
  id: string;
  nickname?: string;
  deletedAt: string | null;
};

export const memberValidator = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(stringMinPlugin)
  .for<Member>()
  .v("id", (b) => b.string.required().min(1))
  .v("nickname", (b) => b.string.optional().min(2))
  .v("deletedAt", (b) => b.string.nullable())
  .build();
```

### Both at once

`.required()` narrows out `null` as well as `undefined`, so 1.x's
`.required({ allowNull: true })` has no option to pass. Chain the two:

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { nullablePlugin } from "@maroonedog/luq/plugins/nullable";

type Row = { closedAt: string | null };

export const rowValidator = Builder()
  .use(requiredPlugin)
  .use(nullablePlugin)
  .for<Row>()
  // present or explicitly null, but never missing
  .v("closedAt", (b) => b.string.required().nullable())
  .build();
```

## Conditional presence

`requiredIf` and `optionalIf` are presence rules, not checks. They take a
predicate over the **root** object (and, inside an array, the element context).
Later conditionals override earlier ones on the same field, the way a later
assignment wins.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredIfPlugin } from "@maroonedog/luq/plugins/requiredIf";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Ticket = { kind: string; reason?: string };

export const ticketValidator = Builder()
  .use(requiredIfPlugin)
  .use(stringMinPlugin)
  .for<Ticket>()
  .v("kind", (b) => b.string.min(1))
  .v("reason", (b) =>
    b.string.requiredIf((root) => (root as Ticket).kind === "other").min(5)
  )
  .build();
```

Measured behaviour of that validator:

| Input | Issues |
|---|---|
| `{ kind: "other" }` | `reason` / `requiredIf` — and **`stringMin` does not run** |
| `{ kind: "other", reason: "ab" }` | `reason` / `stringMin` |
| `{ kind: "a" }` | none — the unmet condition has no opinion, so a plain `.required()` or `.optional()` on the same field would still govern |

That first row is the behaviour change: because `requiredIf` is now the gate
rather than a check, a field that fails it produces one issue, not one issue per
remaining rule.

The predicate's argument is the root value typed as `unknown`, so narrow it
yourself. Reading another field's value in a *typed* way is `compareField`'s and
`stitch`'s job.

## Gates: `validateIf`, `skip`

A gate answers one question — should this field be validated at all — and never
reports anything. `validateIf(when)` runs the field only when `when` is true;
`skip(when)` is the same predicate with the opposite sign.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { validateIfPlugin } from "@maroonedog/luq/plugins/validateIf";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";

type Payment = { method: string; cardNumber?: string };

export const paymentValidator = Builder()
  .use(requiredPlugin)
  .use(validateIfPlugin)
  .use(stringMinPlugin)
  .for<Payment>()
  .v("method", (b) => b.string.required())
  // Position in the chain is irrelevant: every gate is asked before any check.
  .v("cardNumber", (b) =>
    b.string.min(12).validateIf((root) => (root as Payment).method === "card")
  )
  .build();
```

## `orFail`: the negative

"If this condition holds, the field must not carry a value." Deprecated fields,
debug fields that must not reach production, fields a role forbids.

```ts
import { Builder } from "@maroonedog/luq";
import { orFailPlugin } from "@maroonedog/luq/plugins/orFail";

type Request = { role: string; debugToken?: string };

export const requestValidator = Builder()
  .use(orFailPlugin)
  .for<Request>()
  .v("debugToken", (b) =>
    b.string.orFail((root) => (root as Request).role !== "admin", {
      messageFactory: () => "debugToken is not allowed for this role",
    })
  )
  .build();
```

1.x accepted a raw `message: string` option beside `messageFactory`, with a
precedence rule between them. There is one message channel now.

## Cross-field rules

`compareField` reads one other declared path; `stitch` reads several and hands
them to a predicate as a bundle keyed by the path string.

```ts
import { Builder } from "@maroonedog/luq";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stitchPlugin } from "@maroonedog/luq/plugins/stitch";

type Booking = { start: string; end: string };

export const bookingValidator = Builder()
  .use(requiredPlugin)
  .use(stitchPlugin)
  .for<Booking>()
  .v("start", (b) => b.string.required())
  .v("end", (b) =>
    b.string.required().stitch(["start"], (fieldValues, value) => ({
      valid: String(value) > String(fieldValues.start),
      message: "end must come after start",
    }))
  )
  .build();
```

The predicate runs **once**. 1.x ran it a second time to build the message, so a
predicate with a cost or a side effect ran twice; here the message travels with
the outcome. 1.x also shipped three implementations of this — `stitch`,
`stitchTyped`, `stitchSimple` — all claiming the same method name. There is one.

## `custom`: an arbitrary predicate

```ts
import { Builder } from "@maroonedog/luq";
import { customPlugin } from "@maroonedog/luq/plugins/custom";

type Coupon = { code: string };

export const couponValidator = Builder()
  .use(customPlugin)
  .for<Coupon>()
  .v("code", (b) =>
    // The predicate receives the VALUE only.
    b.string.custom((value) =>
      typeof value === "string" && value.startsWith("CPN-")
        ? true
        : { valid: false, message: "coupon codes start with CPN-" }
    )
  )
  .build();
```

Three differences from 1.x: the predicate takes the value alone (use
`compareField` or `stitch` to reach other fields), it runs exactly once rather
than twice, and a predicate that **throws** is a failed validation carrying the
thrown message rather than a crashed `validate()`.
