// ===========================================================================
// bench/competitors/read-installed-version.ts
//
// 比較相手のバージョンを、**インストールされている実物から** 読む。
//
// `require("zod/package.json")` は動くが valibot では動かない — exports に
// "./package.json" が無いパッケージがあるためで、そこで分岐を書くと
// 「読めなかったライブラリだけバージョン不明」という穴になる。ディスクから
// 読めば全員同じ経路になる。
//
// package.json の devDependencies を読まないのは、そこに書いてあるのは範囲
// (`^4.0.14`) であって、実際に測ったものではないからである。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");

export function readInstalledVersion(packageName: string): string {
  const manifest = path.join(
    REPOSITORY_ROOT,
    "node_modules",
    packageName,
    "package.json"
  );
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(manifest, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof (parsed as { version: unknown }).version === "string"
    ) {
      return (parsed as { version: string }).version;
    }
  } catch {
    // 読めなければ「不明」と書く。黙って空文字を報告に出すよりよい。
  }
  return "unknown";
}
