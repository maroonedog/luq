import * as fs from "fs";
import * as path from "path";

export const GENERATED_BANNER = [
  "// GENERATED FILE - 手で編集しないでください。",
  "// 生成元: プラグインディレクトリ構造 (scripts/catalog/build-plugin-catalog.ts)。",
].join("\n");

/** 親ディレクトリを作ってから書く。内容が同じなら書かない (mtime を動かさない)。 */
export function writeGeneratedFile(
  repositoryRoot: string,
  relativePath: string,
  contents: string
): boolean {
  const absolutePath = path.join(repositoryRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (
    fs.existsSync(absolutePath) &&
    fs.readFileSync(absolutePath, "utf8") === contents
  ) {
    return false;
  }
  fs.writeFileSync(absolutePath, contents, "utf8");
  return true;
}
