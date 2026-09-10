// Checks the conformance-figure check itself.
//
// That check exists because a stale figure is self-consistent: the old
// numerator really does give the old percentage. So what matters here is not
// whether a figure is consistent but whether it equals the CURRENT one — and,
// on the other side, that a percentage over a different corpus is left alone.
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  allowedFigures,
  findFigureViolations,
  readPinCounts,
  toPercent,
} from "../../../scripts/check-conformance-figures";
import { REPOSITORY_ROOT } from "../../../scripts/catalog/plugin-source-roots";

const PIN = {
  caseCount: 929,
  passingCases: 855,
  validCases: 551,
  invalidCases: 378,
  passingValidCases: 523,
  passingInvalidCases: 332,
};

function withFile(contents: string, run: (relative: string) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "luq-figures-"));
  const absolute = path.join(directory, "doc.md");
  fs.writeFileSync(absolute, contents, "utf8");
  try {
    run(path.relative(REPOSITORY_ROOT, absolute));
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe("toPercent", () => {
  it("rounds to two places, which is how every published figure is written", () => {
    // Written by hand, this pass rate was once rounded up by a hundredth.
    expect(toPercent(855, 929)).toBe("92.03");
    expect(toPercent(551, 929)).toBe("59.31");
  });
});

describe("findFigureViolations", () => {
  it("accepts the figure the pin records", () => {
    withFile("It passes **855 / 929 = 92.03%**.", (relative) => {
      expect(findFigureViolations(REPOSITORY_ROOT, [relative], PIN)).toEqual(
        []
      );
    });
  });

  it("rejects a stale figure even though it is arithmetically correct", () => {
    withFile("It passes **828 / 929 = 89.13%**.", (relative) => {
      const violations = findFigureViolations(REPOSITORY_ROOT, [relative], PIN);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.detail).toContain("855 / 929");
    });
  });

  it("rejects a stale breakdown written as `N (P%)`", () => {
    withFile("| this release | 508 (92.19%) |", (relative) => {
      expect(
        findFigureViolations(REPOSITORY_ROOT, [relative], PIN)
      ).toHaveLength(1);
    });
  });

  it("ignores a percentage that belongs to another corpus", () => {
    // A comparison table over a different corpus takes 289 as its
    // denominator. That is not this pass rate, so it is left alone.
    withFile("| passing / 289 | 155 (53.63%) | 229 (79.24%) |", (relative) => {
      expect(findFigureViolations(REPOSITORY_ROOT, [relative], PIN)).toEqual(
        []
      );
    });
  });

  it("keeps the recorded 1.x figures, which are history and do not move", () => {
    withFile(
      "| previous release | 536 (57.70%) | 512 (92.92%) | 24 (6.35%) |",
      (relative) => {
        expect(findFigureViolations(REPOSITORY_ROOT, [relative], PIN)).toEqual(
          []
        );
      }
    );
  });
});

describe("allowedFigures", () => {
  it("derives every current figure from the pin, naming a reason for each", () => {
    const allowed = allowedFigures(PIN);
    expect(allowed.every((figure) => figure.why.trim().length > 0)).toBe(true);
    expect(allowed).toContainEqual(
      expect.objectContaining({ numerator: 855, denominator: 929 })
    );
  });
});

describe("readPinCounts", () => {
  it("reads the repository's own pin", () => {
    const pin = readPinCounts(REPOSITORY_ROOT);
    expect(pin.passingValidCases + pin.passingInvalidCases).toBe(
      pin.passingCases
    );
    expect(pin.validCases + pin.invalidCases).toBe(pin.caseCount);
  });
});
