import {
  describeViolations,
  findDependentRequiredViolations,
  readViolations,
} from "../../../../src/plugins/object-dependent-required/dependent-required-violation";

describe("findDependentRequiredViolations", () => {
  it("returns nothing when no trigger is present", () => {
    expect(findDependentRequiredViolations({ a: 1 }, { b: ["c"] })).toEqual([]);
  });

  it("reports only the keys that are missing", () => {
    expect(
      findDependentRequiredViolations({ b: 1, c: 2 }, { b: ["c", "d"] })
    ).toEqual([{ trigger: "b", missing: ["d"] }]);
  });

  it("counts an explicit undefined as absent", () => {
    expect(
      findDependentRequiredViolations({ b: undefined }, { b: ["c"] })
    ).toEqual([]);
    expect(
      findDependentRequiredViolations({ b: 1, c: undefined }, { b: ["c"] })
    ).toEqual([{ trigger: "b", missing: ["c"] }]);
  });

  it("ignores inherited keys", () => {
    const inherited: Record<string, unknown> = Object.create({
      b: 1,
    }) as Record<string, unknown>;
    expect(findDependentRequiredViolations(inherited, { b: ["c"] })).toEqual(
      []
    );
  });
});

describe("readViolations", () => {
  it("accepts only what this plugin put into the detail", () => {
    expect(readViolations([{ trigger: "b", missing: ["c"] }])).toEqual([
      { trigger: "b", missing: ["c"] },
    ]);
    expect(readViolations("nonsense")).toEqual([]);
    expect(readViolations([{ trigger: 1 }])).toEqual([]);
  });
});

describe("describeViolations", () => {
  it("joins several violations with '; '", () => {
    expect(
      describeViolations([
        { trigger: "a", missing: ["x"] },
        { trigger: "b", missing: ["y", "z"] },
      ])
    ).toBe(
      "When 'a' is present, the following properties are required: x; " +
        "When 'b' is present, the following properties are required: y, z"
    );
  });
});
