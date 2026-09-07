import * as fs from "fs";
import * as path from "path";
import { toRepositoryRelativePosix } from "../catalog/collect-typescript-files";
import type { DocExampleViolation } from "./doc-example.types";
import { collectMarkdownFiles } from "./read-doc-examples";

/** `[text](target)` の target 部分。画像の `![...]` も同じ形で拾える。 */
const LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

function isExternal(target: string): boolean {
  return (
    target.startsWith("http://") ||
    target.startsWith("https://") ||
    target.startsWith("mailto:") ||
    target.startsWith("#")
  );
}

/** アンカー (#section) とクエリを落として、ファイルとして存在するかだけを見る。 */
function toFilePart(target: string): string {
  const withoutAnchor = target.split("#")[0] ?? "";
  return withoutAnchor.split("?")[0] ?? "";
}

/**
 * ドキュメント同士のリンクが実在するファイルを指しているか。
 * リンク切れは「読んだ人が次に進めない」という形で必ず表に出る欠陥なので、
 * コード例と同じゲートで落とす。外部 URL は検査しない (ネットワークを踏まない)。
 */
export function findBrokenLinks(
  repositoryRoot: string,
  docRoots: readonly string[]
): readonly DocExampleViolation[] {
  return docRoots
    .flatMap((docRoot) =>
      collectMarkdownFiles(path.join(repositoryRoot, docRoot))
    )
    .flatMap((absoluteFile) => {
      const file = toRepositoryRelativePosix(repositoryRoot, absoluteFile);
      const lines = fs.readFileSync(absoluteFile, "utf8").split(/\r?\n/);
      return lines.flatMap((line, index) =>
        [...line.matchAll(LINK)]
          .map((match) => match[1] ?? "")
          .filter((target) => target.length > 0 && !isExternal(target))
          .map(toFilePart)
          .filter((filePart) => filePart.length > 0)
          .filter(
            (filePart) =>
              !fs.existsSync(path.resolve(path.dirname(absoluteFile), filePart))
          )
          .map((filePart) => ({
            file,
            startLine: index + 1,
            kind: "brokenLink" as const,
            detail: `リンク先が存在しません: "${filePart}"`,
          }))
      );
    });
}
