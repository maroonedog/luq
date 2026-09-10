// The compatibility module behind the older ./plugins/readOnlyWriteOnly
// subpath. All that is checked is that both plugins arrive as the same values.
import {
  readOnlyPlugin,
  writeOnlyPlugin,
} from "../../../src/subpath-aliases/read-only-write-only";
import { readOnlyPlugin as fromOwnSubpath } from "../../../src/plugins/read-only/index";
import { writeOnlyPlugin as writeFromOwnSubpath } from "../../../src/plugins/write-only/index";

describe("the readOnlyWriteOnly compatibility subpath", () => {
  it("re-exports both readOnly and writeOnly", () => {
    expect(readOnlyPlugin).toBe(fromOwnSubpath);
    expect(writeOnlyPlugin).toBe(writeFromOwnSubpath);
  });

  it("makes writeOnly reachable, which a previous release did not", () => {
    expect(writeOnlyPlugin.method).toBe("writeOnly");
    expect(readOnlyPlugin.method).toBe("readOnly");
  });
});
