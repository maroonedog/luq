// ===========================================================================
// test/type/plugins/object-collection-plugins.type-test.ts
// object / minProperties / maxProperties / dependentRequired / recursively,
// all at the CALL site. The sub-chain-carrying object plugins
// (patternProperties, propertyNames, additionalProperties x2,
// dependentSchemas) have their own fixture in object-property-plugins.
// ===========================================================================
import { cb } from "../../support/collection-fixtures";

// ==================== object ===============================================
cb.v("loose", (b) => b.object.present().object());
cb.v("user", (b) => b.object.object());
// @ts-expect-error object() takes no positional argument
cb.v("loose", (b) => b.object.object("plain"));
// @ts-expect-error the object slot does not accept a string field
cb.v("name", (b) => b.object.object());

// ==================== objectMinProperties / objectMaxProperties ============
cb.v("loose", (b) => b.object.minProperties(1));
cb.v("loose", (b) => b.object.maxProperties(20));
cb.v("user", (b) => b.object.minProperties(1).maxProperties(1));
// @ts-expect-error the bound is a number
cb.v("loose", (b) => b.object.minProperties("1"));
// @ts-expect-error the bound is a number
cb.v("loose", (b) => b.object.maxProperties(null));
cb.v("loose", (b) =>
  b.object.minProperties(1, {
    messageFactory: (context) => `${context.path}: ${String(context.actual)}`,
  })
);

// ==================== objectDependentRequired ==============================
// Marker-free plain data, which is what lets the Draft-07 keyword table bind
// `dependentRequired` straight to it.
cb.v("loose", (b) => b.object.dependentRequired({ card: ["holder", "cvc"] }));
cb.v("loose", (b) => b.object.dependentRequired({}));
// @ts-expect-error the dependency value is a LIST of keys, not one key
cb.v("loose", (b) => b.object.dependentRequired({ card: "holder" }));
// @ts-expect-error the dependencies are a keyed record, not an array
cb.v("loose", (b) => b.object.dependentRequired(["card"]));
cb.v("loose", (b) =>
  // @ts-expect-error the legacy `{ required, message }` form is gone
  b.object.dependentRequired({ card: { required: ["cvc"] } })
);

// ==================== objectRecursively ====================================
cb.v("user", (b) => b.object.recursively("self"));
cb.v("user", (b) => b.object.recursively("self", { maxDepth: 3 }));
cb.v("items", (b) => b.array.recursively("element"));
// @ts-expect-error the target is the closed RecursionTarget vocabulary
cb.v("user", (b) => b.object.recursively("__Self"));
// @ts-expect-error maxDepth is a number
cb.v("user", (b) => b.object.recursively("self", { maxDepth: "3" }));
