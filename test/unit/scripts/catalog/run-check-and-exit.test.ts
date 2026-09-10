import { runCheckAndExit } from "../../../../scripts/catalog/run-check-and-exit";

type ExitSpy = jest.SpyInstance<never, [code?: number | string | null]>;

describe("runCheckAndExit", () => {
  let exitSpy: ExitSpy;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    exitSpy = jest
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("uses the return value as the exit code", () => {
    runCheckAndExit(() => 0);
    expect(exitSpy).toHaveBeenCalledWith(0);
    runCheckAndExit(() => 1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints only the message for an exception and exits 1", () => {
    runCheckAndExit(() => {
      throw new Error("src/plugins/array: no index.ts.");
    });
    expect(errorSpy).toHaveBeenCalledWith("src/plugins/array: no index.ts.");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits 1 for a thrown value that is not an Error", () => {
    runCheckAndExit(() => {
      throw "broken";
    });
    expect(errorSpy).toHaveBeenCalledWith("broken");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints no stack trace", () => {
    runCheckAndExit(() => {
      throw new Error("boom");
    });
    const printed = errorSpy.mock.calls.flat().join("\n");
    expect(printed).not.toContain("at ");
  });
});
