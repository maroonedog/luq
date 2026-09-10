// ===========================================================================
// test/type/plugins/presence-plugins.type-test.ts
//
// Type tests from the caller's side. No declaration-only assertion belongs
// here: a plugin definition loses its markers going through RuntimeArgs, so
// type-checking the declaration never checks an argument type at all. Every
// line must be a real b.<slot>.xxx(...) call.
// ===========================================================================
import { Builder } from "../../../src/index";
import { requiredPlugin } from "../../../src/plugins/required";
import { optionalPlugin } from "../../../src/plugins/optional";
import { nullablePlugin } from "../../../src/plugins/nullable";
import { requiredIfPlugin } from "../../../src/plugins/required-if";
import { optionalIfPlugin } from "../../../src/plugins/optional-if";
import { validateIfPlugin } from "../../../src/plugins/validate-if";
import { skipPlugin } from "../../../src/plugins/skip";
import { orFailPlugin } from "../../../src/plugins/or-fail";
import { literalPlugin } from "../../../src/plugins/literal";
import { oneOfPlugin } from "../../../src/plugins/one-of";
import { customPlugin } from "../../../src/plugins/custom";

type Shape = {
  name: string;
  maybe?: string | null;
  count: number;
  flag: boolean;
  meta: Record<string, string>;
  rows: { serial: string }[];
};

const pb = Builder()
  .use(requiredPlugin)
  .use(optionalPlugin)
  .use(nullablePlugin)
  .use(requiredIfPlugin)
  .use(optionalIfPlugin)
  .use(validateIfPlugin)
  .use(skipPlugin)
  .use(orFailPlugin)
  .use(literalPlugin)
  .use(oneOfPlugin)
  .use(customPlugin)
  .for<Shape>();

// ==================== presence moves the type state ========================
// The slot value of `maybe` is string | null | undefined, and custom's
// argument is Present<TValue, TState>, so declaring presence shows up directly
// in the argument type.
pb.v("maybe", (b) =>
  // @ts-expect-error with no presence declared, value is string | null | undefined
  b.string.custom((value) => value.length > 0)
);
pb.v("maybe", (b) => b.string.required().custom((value) => value.length > 0));
pb.v("maybe", (b) =>
  // @ts-expect-error after nullable, null remains in value
  b.string.nullable().custom((value) => value.length > 0)
);
pb.v("maybe", (b) =>
  // @ts-expect-error optional permits undefined, so undefined remains in value
  b.string.optional().custom((value) => value.length > 0)
);
// Order does not matter: once required, neither null nor undefined remains.
pb.v("maybe", (b) =>
  b.string
    .nullable()
    .required()
    .custom((value) => value.length > 0)
);

// ==================== presence options =====================================
pb.v("name", (b) => b.string.required({ code: "NAME_REQUIRED" }));
pb.v("name", (b) => b.string.required({ severity: "warning" }));
// @ts-expect-error code is a string
pb.v("name", (b) => b.string.required({ code: 1 }));
// @ts-expect-error a key RuleOptions does not have is not accepted
pb.v("name", (b) => b.string.required({ allowNull: true }));
// @ts-expect-error required takes no argument; the first parameter is options
pb.v("name", (b) => b.string.required("nope"));

// ============ conditionals: the predicate receives a typed root ============
pb.v("name", (b) => b.string.requiredIf((root) => root.flag));
pb.v("name", (b) => b.string.optionalIf((root) => root.count > 0));
pb.v("name", (b) => b.string.validateIf((root) => root.flag));
pb.v("name", (b) => b.string.skip((root) => root.flag));
pb.v("name", (b) => b.string.orFail((root) => root.count > 3));
// @ts-expect-error Shape has no nope
pb.v("name", (b) => b.string.requiredIf((root) => root.nope));
// @ts-expect-error the predicate returns a boolean
pb.v("name", (b) => b.string.validateIf((root) => root.name));
// @ts-expect-error the condition is a function, not a value
pb.v("name", (b) => b.string.skip(true));

// The array element context is the optional second parameter.
pb.v("rows[*].serial", (b) =>
  b.string.requiredIf((_root, item) => item !== undefined && item.index === 0)
);
pb.v("rows[*].serial", (b) =>
  b.string.requiredIf(
    // @ts-expect-error ArrayItemContext has no position
    (_root, item) => item !== undefined && item.position === 0
  )
);

// ============ oneOf: the candidates are bound by the field's type ==========
pb.v("name", (b) => b.string.oneOf(["a", "b"]));
pb.v("count", (b) => b.number.oneOf([1, 2, 3]));
// @ts-expect-error a number candidate does not fit a string field
pb.v("name", (b) => b.string.oneOf([1, 2]));
// @ts-expect-error a string candidate does not fit a number field
pb.v("count", (b) => b.number.oneOf(["1"]));
// @ts-expect-error oneOf appears only on the string, number and boolean slots
pb.v("meta", (b) => b.object.oneOf(["a"]));
// @ts-expect-error the candidates are an array
pb.v("name", (b) => b.string.oneOf("a"));

// ==================== literal ============================================
pb.v("name", (b) => b.string.literal("user"));
pb.v("count", (b) => b.number.literal(3));
pb.v("flag", (b) => b.boolean.literal(true));
// @ts-expect-error the second parameter is options and there is no third
pb.v("name", (b) => b.string.literal("user", {}, {}));

// ==================== custom =============================================
pb.v("count", (b) => b.number.custom((value) => value > 0));
pb.v("name", (b) => b.string.custom((value) => ({ valid: value !== "" })));
pb.v("name", (b) =>
  b.string.custom((value) => ({ valid: false, message: value }))
);
// @ts-expect-error a number has no .length
pb.v("count", (b) => b.number.custom((value) => value.length > 0));
// @ts-expect-error the predicate returns a boolean or a { valid } object
pb.v("name", (b) => b.string.custom((value) => value));
pb.v("name", (b) =>
  // @ts-expect-error custom's predicate receives only the value; the root is compareField's and stitch's business
  b.string.custom((value, root) => value !== root.name)
);
