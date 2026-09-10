// Pins that the corpus digest does not depend on line endings.
//
// The suite submodule sits outside this repository's .gitattributes, so what
// gets checked out is platform-dependent: CRLF on Windows, LF on a Linux
// runner. Hashing the raw bytes therefore makes a digest recorded on one
// platform disagree on the other, and the check reports "the corpus moved"
// when nothing did.
//
// A failure here means the corpus reader stopped normalising line endings.
import * as crypto from "crypto";

/** The same normalisation the corpus reader does. Diverging here makes this pointless. */
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

describe("the corpus digest is independent of line endings", () => {
  it("gives LF and CRLF the same digest", () => {
    expect(digestOf(CRLF_FILES)).toBe(digestOf(LF_FILES));
  });

  it("gives different digests without normalising, proving this check works", () => {
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

  it("changes the digest when the content really changes", () => {
    const changed = [
      LF_FILES[0]!,
      { name: "ref.json", text: '[\n  { "description": "CHANGED" }\n]\n' },
    ];
    expect(digestOf(changed)).not.toBe(digestOf(LF_FILES));
  });

  it("changes the digest when a file name changes", () => {
    const renamed = [
      LF_FILES[0]!,
      { name: "other.json", text: LF_FILES[1]!.text },
    ];
    expect(digestOf(renamed)).not.toBe(digestOf(LF_FILES));
  });
});
