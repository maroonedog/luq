import {
  getGlobalConfig,
  resetGlobalConfig,
  setGlobalConfig,
} from "../../../src/builder/global-config-store";
import { Builder } from "../../../src/builder/field-builder.types";
import { DEFAULT_GLOBAL_CONFIG } from "../../../src/types/global-config";
import { stringMinPlugin } from "../../../src/plugins/string-min";
import { requiredPlugin } from "../../../src/plugins/required";

afterEach(() => {
  resetGlobalConfig();
});

describe("the process-wide store", () => {
  it("starts at the documented defaults", () => {
    expect(getGlobalConfig()).toEqual(DEFAULT_GLOBAL_CONFIG);
  });

  it("merges one override over the current value and keeps the rest", () => {
    setGlobalConfig({ defaultSeverity: "warning" });
    expect(getGlobalConfig().defaultSeverity).toBe("warning");
    expect(getGlobalConfig().dateFormat).toBe(DEFAULT_GLOBAL_CONFIG.dateFormat);
    setGlobalConfig({ trimStrings: true });
    expect(getGlobalConfig().defaultSeverity).toBe("warning");
    expect(getGlobalConfig().trimStrings).toBe(true);
  });

  it("returns a frozen value", () => {
    setGlobalConfig({ trimStrings: true });
    expect(Object.isFrozen(getGlobalConfig())).toBe(true);
  });

  it("resets back to the defaults", () => {
    setGlobalConfig({ defaultSeverity: "info" });
    resetGlobalConfig();
    expect(getGlobalConfig()).toEqual(DEFAULT_GLOBAL_CONFIG);
  });
});

describe("build() reads the store ONCE", () => {
  const buildValidator = () =>
    Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .for<{ readonly name: string }>()
      .v("name", (b) => b.string.required().min(5))
      .build();

  it("freezes the severity a validator was built under", () => {
    setGlobalConfig({ defaultSeverity: "warning" });
    const built = buildValidator();
    setGlobalConfig({ defaultSeverity: "error" });
    const outcome = built.validate({ name: "ada" });
    expect(outcome.issues.map((issue) => issue.severity)).toEqual(["warning"]);
    // A warning is an issue but does not reject: severity decides validity.
    expect(outcome.valid).toBe(true);
  });

  it("gives two validators built under different settings their own", () => {
    setGlobalConfig({ defaultSeverity: "warning" });
    const lenient = buildValidator();
    setGlobalConfig({ defaultSeverity: "error" });
    const strict = buildValidator();
    expect(lenient.validate({ name: "ada" }).valid).toBe(true);
    expect(strict.validate({ name: "ada" }).valid).toBe(false);
  });

  it("lets withConfig() win over the store", () => {
    setGlobalConfig({ defaultSeverity: "error" });
    const built = Builder()
      .use(requiredPlugin)
      .use(stringMinPlugin)
      .withConfig({ defaultSeverity: "info" })
      .for<{ readonly name: string }>()
      .v("name", (b) => b.string.required().min(5))
      .build();
    expect(built.validate({ name: "ada" }).issues[0]?.severity).toBe("info");
  });
});
