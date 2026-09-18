# Partial validation for forms

Import `validateFields` and `createPartialValidator` from
`@maroonedog/luq/form`. They execute only selected declarations. Existing
`pick()` and `pickAll()` still execute the full plan and filter its result.

```ts
import { Builder } from "@maroonedog/luq";
import { createPartialValidator, validateFields } from "@maroonedog/luq/form";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { compareFieldPlugin } from "@maroonedog/luq/plugins/compareField";

type Signup = { email: string; password: string; confirm: string };
const signup = Builder()
  .use(requiredPlugin)
  .use(compareFieldPlugin)
  .for<Signup>()
  .v("email", b => b.string.required())
  .v("password", b => b.string.required())
  .v("confirm", b => b.string.required().compareField("password"))
  .build();

const values = { email: "", password: "secret", confirm: "different" };

// A one-off blur/change check. Supply the current full form values.
const emailResult = validateFields(signup, values, ["email"]);

// Build once outside the event handler; reuse with each new form snapshot.
const passwordFields = createPartialValidator(signup, ["password", "confirm"]);
const passwordResult = passwordFields.validate(values);

// Submission always validates the entire form and can produce parsed output.
const submission = signup.parse(values, {
  abortEarly: false,
  abortEarlyOnEachField: false,
});
```

Both functions return `{ valid, issues }`. Partial success does not certify the
whole form, so the result has no `data` member or full-form type narrowing.
Warnings remain in `issues` without making `valid` false. Both abort options
default to `false`; pass `ValidateOptions` to override them or supply `external`.
Defaults and normalizers run only for selected declarations. Transforms do not
run, and validation does not write back into the input.

## Paths and dependent fields

- `profile.name` selects that declaration; `profile` includes declarations
  below it as well as a declaration on the container itself.
- `rows[*].name` selects that field on every row. `rows[2].name` and
  `rows.2.name` select only the third row and retain `rows[2].name` in issues.
  Nested arrays and mixed wildcard/index paths are supported.
- Repeated or overlapping selections execute each declaration once per row,
  in the validator's normal execution order. The supplied path list is copied
  when creating a partial validator.
- A selected field does not implicitly select its ancestors, siblings, root
  rules, or fields that depend on it. When a password changes, select both
  `password` and `confirm` to refresh their errors. Dependencies read the
  current original full input, not normalized values from other fields.
- A declaration containing a composite, custom, or recursive validator is an
  indivisible rule: selecting it can execute its nested validation. Selecting
  an undeclared nested path cannot split that rule.
- Malformed paths and paths matching no declaration throw during selection.
  Indices must be nonnegative integers. A missing/non-array container, an
  empty array, or an index beyond its length runs no element rules. Select
  the array container too when its presence or size must be checked.
- An empty selection executes no declarations. A `null` or `undefined` root
  still reports the configured missing-root issue.

When updating form state, replace errors only for the selected fields (and
their selected descendants), including clearing their stale errors after a
successful check. Keep unrelated errors until those fields are checked.

These functions accept Luq-built validators and the built-in Standard Schema,
Standard JSON Schema, and `addAsyncSupport` wrappers. Arbitrary copies or
third-party `Validator` implementations have no accessible execution plan and
are rejected. Partial validation is synchronous; provide already-resolved
external context when needed.

Using a Standard Schema resolver alone still invokes full validation. To use
partial execution on change/blur, call these functions from the form's event
integration and retain full `validate()` or `parse()` for submission.
