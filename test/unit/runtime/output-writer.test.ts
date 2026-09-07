// ===========================================================================
// The output side. Every assertion here is about IDENTITY, because the whole
// promise of copy-on-write is that untouched things keep theirs.
// ===========================================================================
import {
  NO_WRITE_TARGETS,
  createArrayWriteTargets,
  createPlanWriteTargets,
  replaceElement,
  writeFieldValue,
} from "../../../src/runtime/output-writer";
import { FIELD_VALUE_UNCHANGED } from "../../../src/runtime/run-field";
import { makeTransform } from "../compile/rule-fixtures";
import { planOf } from "./plan/engine-fixtures";

const WRITTEN = { hasWriteBack: true, value: "written" } as const;

describe("createPlanWriteTargets", () => {
  it("returns null when the plan has neither a transform nor a default", () => {
    expect(createPlanWriteTargets(planOf([{ path: "name", rules: [] }]))).toBe(
      null
    );
  });

  it("returns targets when a transform exists", () => {
    const plan = planOf([{ path: "name", rules: [makeTransform()] }]);
    expect(createPlanWriteTargets(plan)).not.toBe(null);
  });

  it("returns targets when only a DEFAULT exists", () => {
    const plan = planOf([
      { path: "role", rules: [], defaultOf: () => "guest" },
    ]);
    expect(createPlanWriteTargets(plan)).not.toBe(null);
  });
});

describe("createArrayWriteTargets", () => {
  it("mirrors the node tree by position and by nesting", () => {
    const plan = planOf([
      { path: "items[*].name", rules: [makeTransform()] },
      { path: "items[*].sub[*].x", rules: [makeTransform()] },
      { path: "tags[*]", rules: [makeTransform()] },
    ]);
    const targets = createArrayWriteTargets(plan.arrays);
    expect(targets).toHaveLength(plan.arrays.length);
    expect(targets).toHaveLength(2);
    expect(targets[0]?.nested).toHaveLength(
      plan.arrays[0]?.nested.length ?? -1
    );
    expect(targets[0]?.nested).toHaveLength(1);
    expect(targets[1]?.nested).toHaveLength(0);
  });

  it("shares one frozen empty list when there is no array at all", () => {
    expect(createArrayWriteTargets([])).toBe(NO_WRITE_TARGETS);
    expect(Object.isFrozen(NO_WRITE_TARGETS)).toBe(true);
  });

  it("writes a rebuilt array back at the node's own path", () => {
    const plan = planOf([{ path: "a.b[*]", rules: [makeTransform()] }]);
    const target = createArrayWriteTargets(plan.arrays)[0];
    const root = { a: { b: [1, 2] }, keep: { untouched: true } };
    const written = target?.write(root, [9, 9]);
    expect(written).toEqual({ a: { b: [9, 9] }, keep: { untouched: true } });
    expect(root.a.b).toEqual([1, 2]);
  });
});

describe("writeFieldValue", () => {
  const field = planOf([{ path: "name", rules: [makeTransform()] }]).fields[0];

  it("returns the subject by identity when shouldWrite is false", () => {
    const subject = { name: "ada" };
    expect(field).toBeDefined();
    if (field === undefined) return;
    expect(writeFieldValue(field, subject, WRITTEN, false)).toBe(subject);
  });

  it("returns the subject by identity when there was no write-back", () => {
    const subject = { name: "ada" };
    if (field === undefined) return;
    expect(writeFieldValue(field, subject, FIELD_VALUE_UNCHANGED, true)).toBe(
      subject
    );
  });

  it("returns the subject by identity when the field has no writer", () => {
    const readOnlyField = planOf([{ path: "name", rules: [] }]).fields[0];
    const subject = { name: "ada" };
    expect(readOnlyField?.write).toBe(null);
    if (readOnlyField === undefined) return;
    expect(writeFieldValue(readOnlyField, subject, WRITTEN, true)).toBe(
      subject
    );
  });

  it("produces a NEW subject and leaves the original alone", () => {
    const subject = { name: "ada", other: {} };
    if (field === undefined) return;
    const written = writeFieldValue(field, subject, WRITTEN, true);
    expect(written).not.toBe(subject);
    expect(written).toEqual({ name: "written", other: subject.other });
    expect(subject.name).toBe("ada");
  });
});

describe("replaceElement", () => {
  it("returns the same array when the element came back by identity", () => {
    const element = { a: 1 };
    const array = [element, { b: 2 }];
    expect(replaceElement(array, 0, element)).toBe(array);
  });

  it("copies once and leaves the original untouched", () => {
    const array = [{ a: 1 }, { b: 2 }];
    const replaced = replaceElement(array, 1, "new");
    expect(replaced).not.toBe(array);
    expect(replaced).toEqual([array[0], "new"]);
    expect(replaced[0]).toBe(array[0]);
    expect(array[1]).toEqual({ b: 2 });
  });
});
