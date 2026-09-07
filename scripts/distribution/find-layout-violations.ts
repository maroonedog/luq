import * as fs from "fs";
import * as path from "path";
import { readPublishedExportMap } from "../catalog/read-package-json";
import type { ExportTarget } from "../catalog/plugin-catalog.types";
import { listFilesRecursively } from "./dist-layout";
import { findUnresolvedSpecifiers, readModuleGraph } from "./read-module-graph";

export interface LayoutViolation {
  readonly rule: string;
  readonly subject: string;
  readonly detail: string;
}

/** Nothing test-shaped, benchmark-shaped or internal-only may be published. */
const PRIVATE_ARTIFACT_PATTERNS: readonly RegExp[] = [
  /(^|\/)__tests__\//,
  /(^|\/)fixtures\//,
  /\.test\.[cm]?[jt]s$/,
  /\.spec\.[cm]?[jt]s$/,
  /\.type-test\.[cm]?[jt]s$/,
  /(^|\/)bench\//,
  /(^|\/)test\//,
];

/**
 * Every published subpath points at three files that EXIST.
 *
 * 1.x published 58 keys and documented two more that were in no map at all, so
 * `import ... from "@maroonedog/luq/plugins"` threw
 * ERR_PACKAGE_PATH_NOT_EXPORTED for every user who followed the README.
 */
export function findMissingExportTargets(
  repositoryRoot: string
): readonly LayoutViolation[] {
  const exportMap = readPublishedExportMap(repositoryRoot);
  return Object.entries(exportMap).flatMap(([subpath, target]) =>
    readTargetPaths(target)
      .filter((relative) => !fs.existsSync(path.join(repositoryRoot, relative)))
      .map((relative) => ({
        rule: "missing-export-target",
        subject: subpath,
        detail: `${relative} がありません`,
      }))
  );
}

function readTargetPaths(target: ExportTarget): readonly string[] {
  if (typeof target === "string") return [target];
  return [target.types, target.import, target.require];
}

export function findBrokenSpecifiers(
  distRoot: string
): readonly LayoutViolation[] {
  const files = listFilesRecursively(distRoot).filter(
    (file) =>
      file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".d.ts")
  );
  return findUnresolvedSpecifiers(distRoot, files).map((unresolved) => ({
    rule: "unresolved-specifier",
    subject: unresolved.file,
    detail: `"${unresolved.specifier}" が解決できません`,
  }));
}

/**
 * A plugin subpath must REACH the shared core, not carry a copy of it.
 *
 * The check is structural: walk the ESM graph from the plugin's entry file and
 * require it to leave dist/plugins/. A bundle that inlined plugin-kit would
 * have nothing outside its own directory to import, and fails here.
 */
export function findInlinedCores(
  distRoot: string,
  pluginSubpaths: readonly string[]
): readonly LayoutViolation[] {
  return pluginSubpaths.flatMap((subpath) => {
    const entryFile = `plugins/${subpath.slice("./plugins/".length)}.mjs`;
    if (!fs.existsSync(path.join(distRoot, entryFile))) return [];
    const graph = readModuleGraph(distRoot, entryFile);
    const shared = graph.filter((file) => !file.startsWith("plugins/"));
    return shared.length > 0
      ? []
      : [
          {
            rule: "inlined-core",
            subject: subpath,
            detail:
              `${entryFile} の依存グラフ ${graph.length} モジュールが ` +
              "すべて dist/plugins/ の中にあります (コアを内側に取り込んでいます)",
          },
        ];
  });
}

export function findPrivateArtifacts(
  distRoot: string
): readonly LayoutViolation[] {
  return listFilesRecursively(distRoot)
    .filter((file) =>
      PRIVATE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(file))
    )
    .map((file) => ({
      rule: "private-artifact",
      subject: file,
      detail: "公開してはならない成果物が dist/ にあります",
    }));
}

/** `files` decides the tarball; anything but ["dist"] widens it silently. */
export function findFilesFieldViolations(
  repositoryRoot: string
): readonly LayoutViolation[] {
  const manifest: unknown = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8")
  );
  const files =
    typeof manifest === "object" && manifest !== null && "files" in manifest
      ? manifest.files
      : undefined;
  if (Array.isArray(files) && files.length === 1 && files[0] === "dist") {
    return [];
  }
  return [
    {
      rule: "files-field",
      subject: "package.json#/files",
      detail: `["dist"] でなければなりません (実際: ${JSON.stringify(files)})`,
    },
  ];
}
