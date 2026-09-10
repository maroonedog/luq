// The validator, and the Standard Schema face react-hook-form consumes.
//
// Nothing here imports React or react-hook-form: the rules are declared
// against the Signup type and handed to the form as a Standard Schema, so the
// same value works anywhere else that takes one.
import { Builder } from "@maroonedog/luq";
import { numberMaxPlugin } from "@maroonedog/luq/plugins/numberMax";
import { numberMinPlugin } from "@maroonedog/luq/plugins/numberMin";
import { requiredPlugin } from "@maroonedog/luq/plugins/required";
import { stringEmailPlugin } from "@maroonedog/luq/plugins/stringEmail";
import { stringMinPlugin } from "@maroonedog/luq/plugins/stringMin";
import { toStandardSchema } from "@maroonedog/luq/standard-schema";

/**
 * The type comes first. In a real project this is the type you already have —
 * generated from an OpenAPI document, a Prisma schema, or a protobuf — and the
 * rules below are declared against its field paths.
 */
export type Signup = {
  name: string;
  email: string;
  age: number;
};

const signupValidator = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(stringEmailPlugin)
  .use(numberMinPlugin)
  .use(numberMaxPlugin)
  .for<Signup>()
  // A form field carries whatever the user left in it, spaces included.
  // normalize runs before any rule judges the value, so `min(2)` sees the
  // trimmed string and "  " reaches `required` as empty rather than as two
  // characters that pass.
  .v("name", (b) => b.string.required().min(2), {
    normalize: (value) => (typeof value === "string" ? value.trim() : value),
  })
  .v("email", (b) => b.string.required().email(), {
    normalize: (value) =>
      typeof value === "string" ? value.trim().toLowerCase() : value,
  })
  // <input type="number"> hands over a string. Coercing here rather than with
  // react-hook-form's valueAsNumber keeps the coercion in the schema, where
  // every consumer of it gets the same behaviour.
  .v("age", (b) => b.number.required().min(18).max(120), {
    normalize: (value) =>
      typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : value,
  })
  .build();

/**
 * `toStandardSchema` adds a `~standard` property and changes nothing else, so
 * `signupSchema` is still the validator — `validate`, `parse`, `pick` and
 * `pickAll` are all still there if the rest of the app wants them.
 */
export const signupSchema = toStandardSchema(signupValidator);
