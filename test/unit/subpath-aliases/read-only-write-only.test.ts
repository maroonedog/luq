// 旧サブパス ./plugins/readOnlyWriteOnly が指す互換モジュール。
// 2つのプラグインが同じ実体として届くことだけを見る。
import {
  readOnlyPlugin,
  writeOnlyPlugin,
} from "../../../src/subpath-aliases/read-only-write-only";
import { readOnlyPlugin as fromOwnSubpath } from "../../../src/plugins/read-only/index";
import { writeOnlyPlugin as writeFromOwnSubpath } from "../../../src/plugins/write-only/index";

describe("readOnlyWriteOnly 互換サブパス", () => {
  it("readOnly と writeOnly の両方を再 export する", () => {
    expect(readOnlyPlugin).toBe(fromOwnSubpath);
    expect(writeOnlyPlugin).toBe(writeFromOwnSubpath);
  });

  it("旧実装と違い writeOnly も到達可能", () => {
    expect(writeOnlyPlugin.method).toBe("writeOnly");
    expect(readOnlyPlugin.method).toBe("readOnly");
  });
});
