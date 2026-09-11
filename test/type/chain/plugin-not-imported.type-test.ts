// ===========================================================================
// Calling a method whose plugin was never imported says WHICH plugin.
//
// `Property 'min' does not exist on type 'FieldChain<...>'` is equally true of
// a typo, of a method meant for another type, and of a forgotten import — and
// those have three different fixes, so the reader is left to work out which one
// they are looking at. The three cases are separated here, and each is pinned
// to the message it must produce.
// ===========================================================================
import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/required";
import { numberMinPlugin } from "../../../src/plugins/number-min";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import type { PluginNotImported } from "../../../src/chain/plugin-not-imported.types";
import type { User } from "../../support/model";

const withoutStringMin = Builder().use(requiredPlugin).for<User>();
const withNumberMin = Builder()
  .use(requiredPlugin)
  .use(numberMinPlugin)
  .for<User>();
const withStringMin = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .for<User>();

// ===========================================================================
// The method is present on the chain, and its type names the import.
//
// Read off the REAL chain the builder hands the callback, so this fails if the
// member ever stops being there (it becomes `Property 'min' does not exist`,
// an error with no `@ts-expect-error` to absorb it) and equally if its type
// stops naming stringMinPlugin. Asserting only that the CALL fails would not:
// "does not exist" and "not callable" both fail a call, and the first is the
// state this exists to replace.
// ===========================================================================
export const namesTheImport = withoutStringMin.v("name", (b) => {
  const proof: PluginNotImported<
    "min",
    "stringMinPlugin",
    "@maroonedog/luq/plugins/stringMin"
  > = b.string.min;
  void proof;
  return b.string.required();
});

// The same member, on a builder that imported the number one instead. The
// answer is the STRING plugin: that is the fix, and `does not exist` was
// actively misleading here, because the reader had imported a `min`.
export const namesTheRightImport = withNumberMin.v("name", (b) => {
  const proof: PluginNotImported<
    "min",
    "stringMinPlugin",
    "@maroonedog/luq/plugins/stringMin"
  > = b.string.min;
  void proof;
  return b.string.required();
});

// 1. Not callable, so the mistake is caught where it is made.
// @ts-expect-error min needs stringMinPlugin from @maroonedog/luq/plugins/stringMin
withoutStringMin.v("name", (b) => b.string.required().min(2));

// 2. The wrong min plugin is still the same mistake.
// @ts-expect-error numberMin does not put .min on the string slot
withNumberMin.v("name", (b) => b.string.required().min(2));

// 3. A typo is NOT this error. No slot offers `mim`, so it stays the plain
//    "property does not exist", which is the right message for a misspelling.
// @ts-expect-error there is no such method on any slot
withStringMin.v("name", (b) => b.string.required().mim(2));

// 4. The imported method keeps its real signature: the catalog half of the
//    intersection must not shadow it.
export const works = withStringMin
  .v("name", (b) => b.string.required().min(2))
  .build();

// 5. ...including its argument types.
// @ts-expect-error min takes a number
withStringMin.v("name", (b) => b.string.required().min("2"));
