// The parent writes this command line and the child reads it. A drift between
// the two would not fail — the child would measure a window nobody asked for
// and the parent would file the answer under the window it meant — so the
// round trip is pinned, and every malformed form throws rather than defaulting.
import {
  formatWindowArguments,
  parseWindowArguments,
} from "../../../../bench/megamorphism/window-arguments";

describe("window arguments", () => {
  it("round-trips a request through the command line", () => {
    const request = { validatorCount: 40, poolSize: 4, offset: 21 };
    expect(parseWindowArguments(formatWindowArguments(request))).toEqual(
      request
    );
  });

  it("reads the flags in any order and ignores the interpreter's own arguments", () => {
    expect(
      parseWindowArguments([
        "--offset=3",
        "--pool=16",
        "--validators=1",
        "--inspect",
      ])
    ).toEqual({ validatorCount: 1, poolSize: 16, offset: 3 });
  });

  it("throws when a flag is missing instead of measuring a default window", () => {
    expect(() => parseWindowArguments(["--pool=4", "--offset=0"])).toThrow(
      "--validators="
    );
    expect(() =>
      parseWindowArguments(["--validators=1", "--offset=0"])
    ).toThrow("--pool=");
    expect(() => parseWindowArguments(["--validators=1", "--pool=4"])).toThrow(
      "--offset="
    );
  });

  it("throws on a value that is not a non-negative whole number", () => {
    const rest = ["--pool=4", "--offset=0"];
    expect(() => parseWindowArguments(["--validators=two", ...rest])).toThrow(
      "--validators="
    );
    expect(() => parseWindowArguments(["--validators=1.5", ...rest])).toThrow(
      "--validators="
    );
    expect(() => parseWindowArguments(["--validators=-1", ...rest])).toThrow(
      "--validators="
    );
    expect(() => parseWindowArguments(["--validators=", ...rest])).toThrow(
      "--validators="
    );
  });
});
