// ===========================================================================
// test/integration/published-package-shape.test.ts
//
// SECURITY.md が「実行時依存ゼロ」「dist/ 以外は出荷しない」と書いている。
// 書いてあるだけでは守られないので、ここで固定する。
//
// 依存ゼロは security の主張であって好みではない: 依存が1つ増えれば、その
// 依存の依存まで含めて、利用者が監査する対象が増える。増やすなら意識的に
// 増やすべきで、`npm install --save` の副作用で増えてはいけない。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");

function readManifest(): Readonly<Record<string, unknown>> {
  const raw = fs.readFileSync(
    path.join(REPOSITORY_ROOT, "package.json"),
    "utf8"
  );
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("package.json did not parse to an object");
  }
  return parsed as Readonly<Record<string, unknown>>;
}

function namesIn(field: unknown): readonly string[] {
  if (typeof field !== "object" || field === null) return [];
  return Object.keys(field);
}

describe("the published package carries nothing at run time", () => {
  it("declares no dependencies", () => {
    // SECURITY.md: "No runtime dependencies."
    expect(namesIn(readManifest()["dependencies"])).toEqual([]);
  });

  it("declares no peer dependencies either", () => {
    // peer も「利用者が入れなければならないもの」なので、同じ主張の範囲。
    expect(namesIn(readManifest()["peerDependencies"])).toEqual([]);
  });

  it("declares no optional dependencies", () => {
    expect(namesIn(readManifest()["optionalDependencies"])).toEqual([]);
  });
});

describe("what npm pack would include", () => {
  it("ships dist and the three files named in SECURITY.md, and nothing else", () => {
    const files = readManifest()["files"];
    expect(Array.isArray(files)).toBe(true);
    if (!Array.isArray(files)) return;
    // LICENSE / README.md / package.json は npm が常に入れるので files には
    // 書かない。ここで見るのは「他のものを足していないか」である。
    expect(files).toEqual(["dist"]);
  });
});
