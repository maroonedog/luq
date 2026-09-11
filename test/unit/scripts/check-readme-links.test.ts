// ===========================================================================
// README.md is read in two places and only one of them has its neighbours.
//
// In the repository a relative link works. In the npm tarball and in
// node_modules it does not: npm ships README.md, LICENSE, package.json and
// whatever `files` names, which here is `dist`. Four targets in this file had
// been broken that way for some time — a logo, CONTRIBUTING, SECURITY and the
// releasing guide — because the copy the author reads is the copy that works.
// ===========================================================================
import { findBrokenLinks } from "../../../scripts/check-readme-links";

const PUBLISHED = ["dist"];

describe("check-readme-links finds what a consumer cannot reach", () => {
  it("passes an absolute URL", () => {
    const doc = "[guide](https://luq.dev/docs) and [x](http://a.example/b)";
    expect(findBrokenLinks(doc, PUBLISHED)).toEqual([]);
  });

  it("passes an in-page anchor and a mailto", () => {
    const doc = "[top](#install) [mail](mailto:a@b.example)";
    expect(findBrokenLinks(doc, PUBLISHED)).toEqual([]);
  });

  it("rejects a sibling file that is not published", () => {
    const broken = findBrokenLinks(
      "[contributing](CONTRIBUTING.md)",
      PUBLISHED
    );
    expect(broken.map((entry) => entry.target)).toEqual(["CONTRIBUTING.md"]);
  });

  it("rejects a path under a directory that is not published", () => {
    const broken = findBrokenLinks("[rel](docs/RELEASING.md)", PUBLISHED);
    expect(broken.map((entry) => entry.target)).toEqual(["docs/RELEASING.md"]);
  });

  it("rejects a relative image, in markdown and in html alike", () => {
    // The logo was the html form, which a markdown-only reader would miss.
    const doc =
      '![logo](./public/img/a.png)\n<img src="./public/img/b.png" width="3" />';
    expect(findBrokenLinks(doc, PUBLISHED).map((e) => e.target)).toEqual([
      "./public/img/a.png",
      "./public/img/b.png",
    ]);
  });

  it("accepts a target that IS published", () => {
    // `files` names dist, so something inside it travels with the README.
    expect(findBrokenLinks("[types](dist/index.d.ts)", PUBLISHED)).toEqual([]);
    expect(findBrokenLinks("[licence](LICENSE)", PUBLISHED)).toEqual([]);
  });

  it("ignores the query and fragment when judging a relative target", () => {
    expect(findBrokenLinks("[a](dist/index.d.ts#L3)", PUBLISHED)).toEqual([]);
    expect(
      findBrokenLinks("[a](docs/x.md#L3)", PUBLISHED).map((e) => e.target)
    ).toEqual(["docs/x.md#L3"]);
  });

  it("does not mistake a prefix for a directory", () => {
    // "distant/" starts with "dist" as a string but is not inside it.
    const broken = findBrokenLinks("[a](distant/x.md)", PUBLISHED);
    expect(broken.map((entry) => entry.target)).toEqual(["distant/x.md"]);
  });
});

describe("check-readme-links and the fragment on a published target", () => {
  it("reaches a published file that carries a fragment", () => {
    // The fragment has to come off before the name is compared. A target
    // INSIDE a published directory survives without stripping — the prefix
    // test does not look at the tail — so only an exact filename shows it.
    expect(findBrokenLinks("[licence](LICENSE#mit)", ["dist"])).toEqual([]);
    expect(findBrokenLinks("[readme](README.md?plain=1)", ["dist"])).toEqual(
      []
    );
  });
});
