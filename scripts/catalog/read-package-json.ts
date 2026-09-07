import * as fs from "fs";
import * as path from "path";
import type { PackageExportMap } from "./plugin-catalog.types";

export function readPackageJsonText(repositoryRoot: string): string {
  return fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8");
}

function parsePackageJson(repositoryRoot: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readPackageJsonText(repositoryRoot));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("package.json がオブジェクトではありません。");
  }
  return parsed as Record<string, unknown>;
}

export function readPackageName(repositoryRoot: string): string {
  const name = parsePackageJson(repositoryRoot)["name"];
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("package.json に name がありません。");
  }
  return name;
}

/** 現在 package.json が公開している exports。未定義なら空マップ。 */
export function readPublishedExportMap(
  repositoryRoot: string
): PackageExportMap {
  const exportsMember = parsePackageJson(repositoryRoot)["exports"];
  if (exportsMember === undefined) return {};
  if (
    typeof exportsMember !== "object" ||
    exportsMember === null ||
    Array.isArray(exportsMember)
  ) {
    throw new Error("package.json#/exports がオブジェクトではありません。");
  }
  const published: Record<string, PackageExportMap[string]> = {};
  for (const [key, value] of Object.entries(exportsMember)) {
    published[key] = toExportTarget(key, value);
  }
  return published;
}

function toExportTarget(
  key: string,
  value: unknown
): PackageExportMap[string] {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`package.json#/exports/${key} の形が不正です。`);
  }
  const conditions = value as Record<string, unknown>;
  const types = conditions["types"];
  const importTarget = conditions["import"];
  const requireTarget = conditions["require"];
  if (
    typeof types !== "string" ||
    typeof importTarget !== "string" ||
    typeof requireTarget !== "string"
  ) {
    throw new Error(
      `package.json#/exports/${key} に types/import/require が揃っていません。`
    );
  }
  return { types, import: importTarget, require: requireTarget };
}
