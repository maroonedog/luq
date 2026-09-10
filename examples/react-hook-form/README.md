# Luq + react-hook-form

A signup form whose rules are declared against the `Signup` type and handed to
react-hook-form as a Standard Schema.

```bash
npm install
npm run dev
```

## The integration

One line. react-hook-form takes any Standard Schema, and `toStandardSchema`
turns a built Luq validator into one:

```ts
const { register, handleSubmit, formState } = useForm<Signup>({
  resolver: standardSchemaResolver(signupSchema),
});
```

`toStandardSchema` adds a `~standard` property and changes nothing else, so the
same value is still the validator — `validate`, `parse`, `pick` and `pickAll`
are all still there for the rest of the app.

## What the example shows

**Rules are declared against a type you already have.** `Signup` is an ordinary
TypeScript type. A rule written on the wrong slot — `b.string` on `age` — is a
compile error, not a rule that quietly never fires.

**`normalize` tidies the value before any rule judges it.** A form hands over
whatever the user left in the field, so the schema trims the name, lowercases
the email, and turns the number input's string into a number:

```ts
.v("age", (b) => b.number.required().min(18).max(120), {
  normalize: (value) =>
    typeof value === "string" && value.trim() !== "" ? Number(value) : value,
})
```

Two things follow from that, both visible in the running form:

- Submitting `"  Ada Lovelace  "`, `"  ADA@Example.COM "` and `"31"` puts
  `{ name: "Ada Lovelace", email: "ada@example.com", age: 31 }` into
  `handleSubmit`'s callback. The resolver reads the value Luq wrote back, so
  the payload is normalized without `valueAsNumber` or a `setValueAs` per field.
- A name of `"  "` trims to `""`, which presence reads as missing, so
  `required` reports it rather than `min(2)` passing two spaces.

`normalize` is never called for `undefined` or `null`, so a normalizer needs no
null check of its own.

## Reading errors

Standard Schema carries `message` and `path`, which is what react-hook-form
renders as `formState.errors.<field>.message`. Luq's own `code` and `severity`
do not survive that boundary — the spec has no field for them. If you want
them, call the validator's `validate()` directly; `signupSchema` is still the
validator.

## Files

| File | What is in it |
|---|---|
| `src/signup-schema.ts` | the type, the rules, and `toStandardSchema` |
| `src/SignupForm.tsx` | the form, and the one `resolver` line |
| `src/main.tsx` | mounting |

## The dependency on Luq

`package.json` installs `@maroonedog/luq` from the repository root
(`file:../..`) so the example exercises this checkout. `normalize` is not in
the published 2.2.0; once the release carrying it is out, change that line to a
version range and nothing else about the example moves:

```json
"@maroonedog/luq": "^2.2.0"
```

In your own project the imports are identical to the ones here.
