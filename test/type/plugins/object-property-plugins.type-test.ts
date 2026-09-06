// ===========================================================================
// test/type/plugins/object-property-plugins.type-test.ts
//
// THE POINT OF THIS FILE: every assertion below is a CALL, not a declaration.
// The defect the final review found (conditionalSchema declared with
// ElementChain) survived a full type-check pass because the only fixture that
// existed was the plugin's own definition, and RuntimeArgs collapses every
// sub-chain marker to `readonly Rule[]`. A declaration therefore cannot fail.
// Nothing here is allowed to be a declaration-only test.
// ===========================================================================
import { ab } from "../../support/object-fixtures";

// ==================== objectPatternProperties (call site) ==================
ab.v("labels", (b) =>
  b.object.required().patternProperties({
    "^env$": (pb) => pb.string.required().min(1),
    "^tier$": (pb) => pb.string.required().min(2),
  })
);
// The subject follows the FIELD, not the plugin: number-valued object here.
ab.v("metrics", (b) =>
  b.object
    .required()
    .patternProperties({ "^hit": (pb) => pb.number.required().min(0) })
);
ab.v("labels", (b) =>
  b.object.required().patternProperties({
    // @ts-expect-error Labels' property values are string, so b.number is a mismatch
    "^env$": (pb) => pb.number.min(1),
  })
);
ab.v("metrics", (b) =>
  b.object.required().patternProperties({
    // @ts-expect-error Metrics' property values are number, so b.string is a mismatch
    "^hit": (pb) => pb.string.min(1),
  })
);
ab.v("labels", (b) =>
  b.object.required().patternProperties({
    // @ts-expect-error the sub-chain must be a function of the sub-builder, not a literal
    "^env$": "not-a-sub-chain",
  })
);

// ==================== objectPropertyNames (call site) ======================
ab.v("labels", (b) =>
  b.object.required().propertyNames((kb) => kb.string.required().min(2))
);
// A property NAME is a string even when the property VALUES are numbers.
ab.v("metrics", (b) =>
  b.object.required().propertyNames((kb) => kb.string.required().min(2))
);
ab.v("labels", (b) =>
  b.object.required().propertyNames((kb) =>
    // @ts-expect-error property names are always string; the number slot is a mismatch
    kb.number.min(2)
  )
);
ab.v("metrics", (b) =>
  b.object.required().propertyNames((kb) =>
    // @ts-expect-error the key chain does NOT follow the property value type
    kb.number.min(2)
  )
);

// ==================== objectAdditionalProperties (call site) ===============
// The BOOLEAN form. Marker-free on purpose so L8 can bind the keyword.
ab.v("labels", (b) => b.object.required().additionalProperties(false));
ab.v("labels", (b) => b.object.required().additionalProperties(true));
ab.v("labels", (b) => b.object.required().additionalProperties(false, ["env"]));
// @ts-expect-error the first argument is the boolean flag, not a key list
ab.v("labels", (b) => b.object.required().additionalProperties(["env"]));
// @ts-expect-error allowedProperties is a string list, not a boolean
ab.v("labels", (b) => b.object.required().additionalProperties(false, true));
ab.v("labels", (b) =>
  // @ts-expect-error the sub-chain form lives on its own method now
  b.object.required().additionalProperties(true, (pb) => pb.string.required())
);

// ============= objectAdditionalPropertiesSchema (call site) ================
// The SCHEMA form. Its subject is the VALUE behind an unlisted key.
ab.v("labels", (b) =>
  b.object
    .required()
    .additionalPropertiesSchema((pb) => pb.string.required().min(1))
);
ab.v("labels", (b) =>
  b.object
    .required()
    .additionalPropertiesSchema((pb) => pb.string.required().min(1), ["env"])
);
ab.v("labels", (b) =>
  b.object.required().additionalPropertiesSchema((pb) =>
    // @ts-expect-error additional property values are string here
    pb.boolean.required()
  )
);
// @ts-expect-error the schema form takes a sub-chain, not a boolean
ab.v("labels", (b) => b.object.required().additionalPropertiesSchema(false));

// ==================== objectDependentSchemas (call site) ===================
// The sub-chain constrains the SAME object, so its subject is Present<TValue>.
ab.v("labels", (b) =>
  b.object.required().dependentSchemas({
    env: (sb) => sb.object.required().propertyNames((kb) => kb.string.min(1)),
  })
);
ab.v("labels", (b) =>
  b.object.required().dependentSchemas({
    // @ts-expect-error the dependent sub-chain sees Labels, not one of its values
    env: (sb) => sb.string.min(1),
  })
);
