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

  it("戻り値をそのまま終了コードにする", () => {
    runCheckAndExit(() => 0);
    expect(exitSpy).toHaveBeenCalledWith(0);
    runCheckAndExit(() => 1);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("例外はメッセージだけ出して 1 で終わる", () => {
    runCheckAndExit(() => {
      throw new Error("src/plugins/array: index.ts がありません。");
    });
    expect(errorSpy).toHaveBeenCalledWith(
      "src/plugins/array: index.ts がありません。"
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("Error でない値が投げられても 1 で終わる", () => {
    runCheckAndExit(() => {
      throw "壊れた";
    });
    expect(errorSpy).toHaveBeenCalledWith("壊れた");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("スタックトレースは出さない", () => {
    runCheckAndExit(() => {
      throw new Error("boom");
    });
    const printed = errorSpy.mock.calls.flat().join("\n");
    expect(printed).not.toContain("at ");
  });
});
