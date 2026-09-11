import * as fs from "fs";
import * as path from "path";
import type { PackageExportMap } from "./plugin-catalog.types";

export function readPackageJsonText(repositoryRoot: string): string {
  return fs.readFileSync(path.join(repositoryRoot, "package.json"), "utf8");
}

function parsePackageJson(repositoryRoot: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readPackageJsonText(repositoryRoot));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("package.json is not an object.");
  }
  return parsed as Record<string, unknown>;
}

/** The `files` list, i.e. what npm puts in the tarball besides its own three. */
export function readPublishedFiles(repositoryRoot: string): readonly string[] {
  const files = parsePackageJson(repositoryRoot)["files"];
  if (!Array.isArray(files)) return [];
  return files.filter((entry): entry is string => typeof entry === "string");
}

export function readPackageName(repositoryRoot: string): string {
  const name = parsePackageJson(repositoryRoot)["name"];
  if (typeof name !== "string" || name.length === 0) {
    throw new Error("package.json has no name.");
  }
  return name;
}

/** What package.json currently publishes. An empty map when undefined. */
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
    throw new Error("package.json#/exports is not an object.");
  }
  const published: Record<string, PackageExportMap[string]> = {};
  for (const [key, value] of Object.entries(exportsMember)) {
    published[key] = toExportTarget(key, value);
  }
  return published;
}

function toExportTarget(key: string, value: unknown): PackageExportMap[string] {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`package.json#/exports/${key} has an invalid shape.`);
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
      `package.json#/exports/${key} is missing types, import or require.`
    );
  }
  return { types, import: importTarget, require: requireTarget };
}
