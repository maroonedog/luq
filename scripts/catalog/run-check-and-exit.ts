/**
 * CLI として実行されたときの共通の出口。
 * カタログの構成ミス (index.ts が無い、名前が不正) は例外で表現されるが、
 * CI に見せたいのはスタックトレースではなくメッセージなので、ここで畳む。
 */
export function runCheckAndExit(run: () => number): void {
  try {
    process.exit(run());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
