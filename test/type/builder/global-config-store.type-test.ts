// Builder().withConfig() — placement and typing, at the call site.
import { Builder } from "../../../src/builder/field-builder.types";
import { requiredPlugin } from "../../../src/plugins/required";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { stringTruthyPlugin } from "../../support/probe-config-plugins";
import type { Account, Assert, Equals } from "../../support/config-model";
import type { Validator } from "../../../src/builder/validator.types";

/** withConfig is order-free among use() calls and does not disturb the bag. */
export const configuredBuilder = Builder()
  .use(stringMinPlugin)
  .withConfig({ trimStrings: true })
  .use(requiredPlugin)
  .use(stringTruthyPlugin)
  .withConfig({ caseSensitive: false, defaultSeverity: "warning" })
  .for<Account>();

export const configuredValidator = configuredBuilder
  .v("name", (b) => b.string.required().min(1).truthy())
  .build();

export type BuildReturnsValidator = Assert<
  Equals<typeof configuredValidator, Validator<Account>>
>;

// @ts-expect-error a GlobalConfig member that does not exist is not silently accepted
Builder().withConfig({ trimStrings: true, unknownKnob: 1 });
// @ts-expect-error defaultSeverity shares the IssueSeverity vocabulary
Builder().withConfig({ defaultSeverity: "critical" });
// @ts-expect-error withConfig comes before for<T>(); the field builder has no such method
configuredBuilder.withConfig({ trimStrings: false });
