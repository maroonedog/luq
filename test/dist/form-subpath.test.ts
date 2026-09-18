import { execFileSync } from "node:child_process";
import { REPOSITORY_ROOT } from "./read-built-package";

describe("built form entry", () => {
  it.each(["commonjs", "module"])(
    "shares plans with the %s root entry",
    (mode) => {
      const imports =
        mode === "module"
          ? `import { Builder } from '@maroonedog/luq';
         import { validateFields, createPartialValidator } from '@maroonedog/luq/form';
         import { requiredPlugin } from '@maroonedog/luq/plugins/required';
         import { toStandardSchema } from '@maroonedog/luq/standard-schema';`
          : `const { Builder } = require('@maroonedog/luq');
         const { validateFields, createPartialValidator } = require('@maroonedog/luq/form');
         const { requiredPlugin } = require('@maroonedog/luq/plugins/required');
         const { toStandardSchema } = require('@maroonedog/luq/standard-schema');`;
      const script = `${imports}
      const validator = Builder().use(requiredPlugin).for()
        .v('name', b => b.string.required())
        .v('other', b => b.string.required()).build();
      const values = { name: 'Ada' };
      const single = validateFields(validator, values, ['name']);
      const repeated = createPartialValidator(toStandardSchema(validator), ['name']);
      if (!single.valid || !repeated.validate(values).valid || validator.validate(values).valid)
        throw new Error('The built entry did not isolate selected declarations');
      if ('data' in single) throw new Error('Partial result certifies full values');
      process.stdout.write('ok');`;
      expect(
        execFileSync(process.execPath, [`--input-type=${mode}`, "-e", script], {
          cwd: REPOSITORY_ROOT,
          encoding: "utf8",
        })
      ).toBe("ok");
    }
  );
});
