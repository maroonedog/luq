import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/presence-plugins";
import {
  numberMinPlugin,
  stringMinPlugin,
} from "../../../src/plugins/check-plugins";
import { arrayContainsPlugin } from "../../../src/plugins/composite-plugins";
import type { User } from "../../support/model";

const b0 = Builder()
  .use(requiredPlugin)
  .use(stringMinPlugin)
  .use(numberMinPlugin)
  .use(arrayContainsPlugin)
  .for<User>();

// A-7: a NARROW message factory reaches the rule with no cast, and the
// callback parameter carries both MessageContext and the plugin's own extra.
b0.v("name", (b) =>
  b.string.required().min(3, {
    code: "name.tooShort",
    messageFactory: (ctx) =>
      `${ctx.path}: wanted ${String(ctx.min)}, got ${String(ctx.actual)} (${ctx.code})`,
  })
);

// NEGATIVE: a member the plugin's context does not declare.
b0.v("name", (b) =>
  b.string.required().min(3, {
    // @ts-expect-error `maximum` is not in stringMin's message context
    messageFactory: (ctx) => String(ctx.maximum),
  })
);

// NEGATIVE: the wrong plugin's context members.
b0.v("age", (b) =>
  b.number.required().min(3, {
    // @ts-expect-error numberMin's context has `min` but no `actual`
    messageFactory: (ctx) => String(ctx.actual),
  })
);

// The options object is genuinely OPTIONAL, on markered plugins too.
b0.v("tags", (b) => b.array.contains((eb) => eb.string.min(1)));
b0.v("tags", (b) =>
  b.array.contains(
    (eb) => eb.string.min(1),
    { min: 2 },
    { code: "tags.contains" }
  )
);

// Nested element chains: matrix is readonly (readonly number[])[].
b0.v("matrix", (b) =>
  b.array.contains((outer) =>
    outer.array.contains((inner) => inner.number.min(0))
  )
);

b0.v("matrix", (b) =>
  b.array.contains((outer) =>
    outer.array.contains((inner) =>
      // @ts-expect-error the innermost element is a number, not a string
      inner.string.min(0)
    )
  )
);
