// プリセットは「名前 -> プラグイン」のオブジェクトそのものである。
//
// ここで固定するのは三つ。束が実際に使えること、混ぜても衝突しないこと、
// そして **中身が偶然変わらないこと** — プリセットはバイト数を払うものなので、
// 誰かが1個足したらサイズ予算に出るべきで、テストが黙っていてはいけない。
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
    // use() と同じ first-wins。プリセットが既に入っているものを黙って
    // 置き換えることはない。
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
  // 中身を数えるのではなく名前で固定する。増減はサイズ予算に出るので、
  // ここが「増えたことに気づかない」経路にならないようにする。
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
    // 名前がずれると use() の first-wins が効かなくなる (別名で二重登録
    // されてしまう) ので、キーと plugin.name の一致を固定する。
    for (const [key, plugin] of Object.entries(everydayRules)) {
      expect(plugin.name).toBe(key);
    }
  });
});
