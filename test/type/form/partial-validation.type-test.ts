import { Builder } from "../../../src/index";
import { createPartialValidator, validateFields } from "../../../src/form";
import { requiredPlugin } from "../../../src/plugins/required";

const validator = Builder()
  .use(requiredPlugin)
  .for<{
    email: string;
    lines: { name: string }[];
    grid: string[][];
  }>()
  .v("email", (b) => b.string.required())
  .build();

validateFields(validator, {}, ["email"]);
validateFields(validator, {}, [
  "lines[*].name",
  "lines[2].name",
  "lines.2.name",
]);
validateFields(validator, {}, ["grid[0][1]", "grid.0.1", "grid[*].0"]);
createPartialValidator(validator, ["email"]);
// @ts-expect-error unknown field
validateFields(validator, {}, ["missing"]);
// @ts-expect-error array member requires a wildcard or index
validateFields(validator, {}, ["lines.name"]);
// @ts-expect-error selected row has no such field
createPartialValidator(validator, ["lines[1].missing"]);
const outcome = validateFields(validator, {}, ["email"]);
// @ts-expect-error partial success never proves the full form type
outcome.data;
