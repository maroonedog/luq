import * as fs from "fs";
import * as path from "path";

/** 絶対パスの .ts ファイルを再帰収集する。存在しないディレクトリは空配列。 */
export function collectTypeScriptFiles(absoluteDirectory: string): string[] {
  if (!fs.existsSync(absoluteDirectory)) return [];
  const entries = fs
    .readdirSync(absoluteDirectory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  return entries.flatMap((entry) => {
    const fullPath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(fullPath);
    return entry.name.endsWith(".ts") ? [fullPath] : [];
  });
}

/** OS 依存の区切りを posix に正規化した、ルートからの相対パス。 */
export function toRepositoryRelativePosix(
  repositoryRoot: string,
  absolutePath: string
): string {
  return path.relative(repositoryRoot, absolutePath).split(path.sep).join("/");
}
