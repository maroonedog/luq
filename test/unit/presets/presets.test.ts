// A preset is exactly an object mapping names to plugins.
//
// Three things: that a bundle is actually usable, that mixing bundles does not
// collide, and that **the membership does not change by accident**. A preset
// costs bytes, so adding one plugin should show up in the size budget, and the
// tests must not stay quiet about it.
import { Builder } from "../../../src/index";
import {
  arrays,
  everydayRules,
  numbers,
  presence,
  strings,
} from "../../../src/presets";

interface User {
  name: string;
  age: number;
  tags: string[];
}

describe("a preset is a plugin bag", () => {
  it("registers every plugin it names", () => {
    const validator = Builder()
      .useAll(everydayRules)
      .for<User>()
      .v("name", (b) => b.string.required().min(2).max(50))
      .v("age", (b) => b.number.required().min(0).integer())
      .v("tags", (b) => b.array.optional().minLength(1))
      .build();

    expect(validator.validate({ name: "Jo", age: 30, tags: ["x"] }).valid).toBe(
      true
    );
    expect(validator.validate({ name: "J", age: 30, tags: ["x"] }).valid).toBe(
      false
    );
  });

  it("can be combined, and a duplicate does not replace what is registered", () => {
    // First-wins, as use() is. A preset silently replaces nothing already
    // registered.
    const validator = Builder()
      .useAll(presence)
      .useAll(strings)
      .useAll(presence)
      .for<User>()
      .v("name", (b) => b.string.required().min(2))
      .build();

    expect(validator.validate({ name: "Jo" } as User).valid).toBe(true);
    expect(validator.validate({ name: "J" } as User).valid).toBe(false);
  });

  it("mixes with use() for a plugin the preset does not carry", () => {
    const validator = Builder()
      .useAll(presence)
      .useAll(numbers)
      .for<User>()
      .v("age", (b) => b.number.required().min(18))
      .build();

    expect(validator.validate({ age: 20 } as User).valid).toBe(true);
    expect(validator.validate({ age: 5 } as User).valid).toBe(false);
  });
});

describe("what each preset carries", () => {
  // Pinned by name rather than by count, so this cannot become the route by
  // which an addition goes unnoticed.
  it("presence", () => {
    expect(Object.keys(presence).sort()).toEqual([
      "nullable",
      "optional",
      "required",
    ]);
  });

  it("strings", () => {
    expect(Object.keys(strings).sort()).toEqual([
      "stringEmail",
      "stringMax",
      "stringMin",
      "stringPattern",
    ]);
  });

  it("numbers", () => {
    expect(Object.keys(numbers).sort()).toEqual([
      "numberInteger",
      "numberMax",
      "numberMin",
    ]);
  });

  it("arrays", () => {
    expect(Object.keys(arrays).sort()).toEqual([
      "arrayEach",
      "arrayMaxLength",
      "arrayMinLength",
    ]);
  });

  it("everydayRules is exactly the other four, with nothing extra", () => {
    expect(Object.keys(everydayRules).sort()).toEqual(
      [
        ...Object.keys(presence),
        ...Object.keys(strings),
        ...Object.keys(numbers),
        ...Object.keys(arrays),
      ].sort()
    );
  });

  it("names every plugin under the key the plugin calls itself", () => {
    // A key that disagrees with the plugin's own name registers it twice
    // under two names and defeats first-wins, so the two are pinned equal.
    for (const [key, plugin] of Object.entries(everydayRules)) {
      expect(plugin.name).toBe(key);
    }
  });
});
