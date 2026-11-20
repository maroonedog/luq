import {
  createFieldRule,
  createPluginRegistry,
  useField,
  type ExtractFieldRuleValue,
} from "../../../src/field-rule";
import { requiredPlugin } from "../../../src/plugins/required";
import { transformPlugin } from "../../../src/plugins/transform";
import type { Assert, Equals } from "../../support/config-model";

type Order = { currency: string; rows: { amount: string }[] };
type DataOf<R> = R extends { valid: true; data: infer D } ? D : never;
const registry = createPluginRegistry().use(transformPlugin);
const amount = registry.createFieldRule((b) => b.string.transform(Number));
const builder = registry
  .toBuilder()
  .for<Order>()
  .v("currency", (b) => b.string.transform((s) => ({ code: s })));
const reusable = useField(builder, "rows[*].amount", amount).build();
const direct = builder
  .v("rows[*].amount", (b) => b.string.transform(Number))
  .build();

export type SameParsedShape = Assert<
  Equals<
    DataOf<ReturnType<typeof reusable.parse>>,
    DataOf<ReturnType<typeof direct.parse>>
  >
>;
export type ParsedShape = Assert<
  Equals<
    DataOf<ReturnType<typeof reusable.parse>>,
    { currency: { code: string }; rows: { amount: number }[] }
  >
>;
export type OriginalShape = Assert<
  Equals<DataOf<ReturnType<typeof reusable.validate>>, Order>
>;
export type StandaloneOutput = Assert<
  Equals<DataOf<ReturnType<typeof amount.parse>>, number>
>;
export type RuleInput = Assert<
  Equals<ExtractFieldRuleValue<typeof amount>, string>
>;

const parsed = reusable.parse({ currency: "JPY", rows: [{ amount: "1200" }] });
if (parsed.valid) {
  // @ts-expect-error the parsed amount no longer has string methods
  parsed.data.rows[0]?.amount.trim();
}

// @ts-expect-error the rule accepts strings even though it produces a number
amount.parse(1200);
// @ts-expect-error this path supplies a number to a string rule
useField(registry.toBuilder().for<{ amount: number }>(), "amount", amount);

const label = createFieldRule(registry.toBuilder().use(requiredPlugin), (b) =>
  b.number
    .required()
    .transform((n) => n.toFixed(2))
    .refineString()
    .transform((s) => ({ text: s.trim() }))
);
export type FreeRuleInput = Assert<
  Equals<ExtractFieldRuleValue<typeof label>, number>
>;
export type FreeRuleOutput = Assert<
  Equals<DataOf<ReturnType<typeof label.parse>>, { text: string }>
>;

// @ts-expect-error the default is supplied before transformation
registry.createFieldRule((b) => b.string.transform(Number), {
  fieldOptions: { default: 10 },
});
