import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { SeedFileTree } from "./seed-plugin-tree";

/**
 * 種ツリーを一時ディレクトリに実体化する。
 * 実 src/ を一切触らないので、他ステップのエージェントと衝突しない。
 */
export function writeSeedTree(tree: SeedFileTree): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "luq-seed-"));
  for (const [relativePath, contents] of Object.entries(tree)) {
    writeSeedFile(root, relativePath, contents);
  }
  return root;
}

export function writeSeedFile(
  root: string,
  relativePath: string,
  contents: string
): string {
  const absolutePath = path.join(root, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, contents, "utf8");
  return absolutePath;
}

export function readSeedFile(root: string, relativePath: string): string {
  return fs.readFileSync(path.join(root, ...relativePath.split("/")), "utf8");
}

/** 一時ツリーを作って run に渡し、必ず片付ける。 */
export function withSeedTree<T>(
  tree: SeedFileTree,
  run: (root: string) => T
): T {
  const root = writeSeedTree(tree);
  try {
    return run(root);
  } finally {
    removeSeedTree(root);
  }
}

export function removeSeedTree(root: string): void {
  fs.rmSync(root, { recursive: true, force: true });
}
