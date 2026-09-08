// 適合率の表記検査そのものを検査する。
//
// この検査は「古い数字は自己整合している」という性質のために存在する
// (828 / 929 は本当に 89.13% である)。したがってここで確かめるべきは
// 「整合しているか」ではなく「今の値と一致しているか」であり、
// 逆に別コーパスの割合を巻き込まないことである。
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
    // 手で書いていた頃 855/929 は 92.04% と書かれていた。実際は 92.0344…%。
    expect(toPercent(855, 929)).toBe("92.03");
    expect(toPercent(551, 929)).toBe("59.31");
  });
});

describe("findFigureViolations", () => {
  it("accepts the figure the pin records", () => {
    withFile("合格は **855 / 929 = 92.03%** である。", (relative) => {
      expect(findFigureViolations(REPOSITORY_ROOT, [relative], PIN)).toEqual(
        []
      );
    });
  });

  it("rejects a stale figure even though it is arithmetically correct", () => {
    withFile("合格は **828 / 929 = 89.13%** である。", (relative) => {
      const violations = findFigureViolations(REPOSITORY_ROOT, [relative], PIN);
      expect(violations).toHaveLength(1);
      expect(violations[0]?.detail).toContain("855 / 929");
    });
  });

  it("rejects a stale breakdown written as `N (P%)`", () => {
    withFile("| 新実装 | 508 (92.19%) |", (relative) => {
      expect(
        findFigureViolations(REPOSITORY_ROOT, [relative], PIN)
      ).toHaveLength(1);
    });
  });

  it("ignores a percentage that belongs to another corpus", () => {
    // 前口 2つの比較表は 289 を分母に取る。929 の話ではないので触らない。
    withFile("| 合格 / 289 | 155 (53.63%) | 229 (79.24%) |", (relative) => {
      expect(findFigureViolations(REPOSITORY_ROOT, [relative], PIN)).toEqual(
        []
      );
    });
  });

  it("keeps the recorded 1.x figures, which are history and do not move", () => {
    withFile(
      "| 旧実装 | 536 (57.70%) | 512 (92.92%) | 24 (6.35%) |",
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
