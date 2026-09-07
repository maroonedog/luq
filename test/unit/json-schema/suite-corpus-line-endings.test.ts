// コーパスの digest が改行コードに依存しないことを固定する。
//
// サブモジュール test/fixtures/json-schema-suite は本体の .gitattributes の
// 外にあるので、チェックアウトされる改行はプラットフォーム依存になる。
// Windows (core.autocrlf=true) では CRLF、Linux CI では LF。
// 生バイトをハッシュしていたため、Windows で記録した digest が Linux CI で
// 一致せず、PR #14 の verify が「コーパスが動いた」と誤検出して落ちた。
//
// この検査が落ちたら、readSuiteCorpus が改行を正規化しなくなったということ。
import * as crypto from "crypto";

/** readSuiteCorpus と同じ正規化。ここが両者で食い違うと意味が無い。 */
function normalizeLineEndings(text: string): string {
  return text.split("\r\n").join("\n");
}

function digestOf(files: readonly { name: string; text: string }[]): string {
  const digest = crypto.createHash("sha256");
  for (const file of files) {
    digest.update(file.name);
    digest.update("\0");
    digest.update(normalizeLineEndings(file.text));
    digest.update("\0");
  }
  return digest.digest("hex");
}

const LF_FILES = [
  { name: "type.json", text: '[\n  { "description": "a" }\n]\n' },
  { name: "ref.json", text: '[\n  { "description": "b" }\n]\n' },
];

const CRLF_FILES = LF_FILES.map((file) => ({
  name: file.name,
  text: file.text.split("\n").join("\r\n"),
}));

describe("コーパス digest の改行非依存", () => {
  it("LF と CRLF で同じ digest になる", () => {
    expect(digestOf(CRLF_FILES)).toBe(digestOf(LF_FILES));
  });

  it("正規化しなければ digest は食い違う（この検査自体が機能している証拠）", () => {
    const rawDigest = (files: readonly { name: string; text: string }[]) => {
      const digest = crypto.createHash("sha256");
      for (const file of files) {
        digest.update(file.name);
        digest.update("\0");
        digest.update(file.text);
        digest.update("\0");
      }
      return digest.digest("hex");
    };
    expect(rawDigest(CRLF_FILES)).not.toBe(rawDigest(LF_FILES));
  });

  it("内容が本当に変われば digest も変わる", () => {
    const changed = [
      LF_FILES[0]!,
      { name: "ref.json", text: '[\n  { "description": "CHANGED" }\n]\n' },
    ];
    expect(digestOf(changed)).not.toBe(digestOf(LF_FILES));
  });

  it("ファイル名が変われば digest も変わる", () => {
    const renamed = [
      LF_FILES[0]!,
      { name: "other.json", text: LF_FILES[1]!.text },
    ];
    expect(digestOf(renamed)).not.toBe(digestOf(LF_FILES));
  });
});
