import * as fs from "fs";
import * as path from "path";
import type {
  BarrelEquivalenceBudget,
  BundleBudget,
  PluginSelection,
  SizeBudget,
  TreeShakingBudget,
} from "./size-budget.types";

/**
 * Reads the size budget and checks its shape.
 *
 * Importing JSON gives the shape TypeScript inferred, not the shape the file
 * actually has. The budget is edited by hand, so a misspelling is caught here,
 * before the gate runs on it.
 */
export const SIZE_BUDGET_PATH = "config/size-budget.json";

function readRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${SIZE_BUDGET_PATH}: ${where} is not an object`);
  }
  return value as Record<string, unknown>;
}

function readNumber(
  source: Record<string, unknown>,
  key: string,
  where: string
): number {
  const found = source[key];
  if (typeof found !== "number" || !Number.isFinite(found)) {
    throw new Error(`${SIZE_BUDGET_PATH}: ${where}.${key} is not a number`);
  }
  return found;
}

function readString(
  source: Record<string, unknown>,
  key: string,
  where: string
): string {
  const found = source[key];
  if (typeof found !== "string") {
    throw new Error(`${SIZE_BUDGET_PATH}: ${where}.${key} is not a string`);
  }
  return found;
}

function readStringArray(
  source: Record<string, unknown>,
  key: string,
  where: string
): readonly string[] {
  const found = source[key];
  if (!Array.isArray(found) || found.some((one) => typeof one !== "string")) {
    throw new Error(
      `${SIZE_BUDGET_PATH}: ${where}.${key} is not an array of strings`
    );
  }
  return found as readonly string[];
}

function readPluginSelection(
  source: Record<string, unknown>,
  where: string
): PluginSelection {
  if (source["plugins"] === "all") return "all";
  return readStringArray(source, "plugins", where);
}

function readBundleBudget(value: unknown, index: number): BundleBudget {
  const where = `budgets[${String(index)}]`;
  const record = readRecord(value, where);
  const legacy = record["legacyGzipBytes"];
  const budget: BundleBudget = {
    id: readString(record, "id", where),
    description: readString(record, "description", where),
    plugins: readPluginSelection(record, where),
    gzipCeilingBytes: readNumber(record, "gzipCeilingBytes", where),
    recordedGzipBytes: readNumber(record, "recordedGzipBytes", where),
  };
  if (legacy === undefined) return budget;
  return {
    ...budget,
    legacyGzipBytes: readNumber(record, "legacyGzipBytes", where),
  };
}

function readTreeShakingBudget(value: unknown): TreeShakingBudget {
  const record = readRecord(value, "treeShaking");
  return {
    orderedByPluginCount: readStringArray(
      record,
      "orderedByPluginCount",
      "treeShaking"
    ),
    minGzipBytesPerAddedPlugin: readNumber(
      record,
      "minGzipBytesPerAddedPlugin",
      "treeShaking"
    ),
    maxCoreShareOfFullPercent: readNumber(
      record,
      "maxCoreShareOfFullPercent",
      "treeShaking"
    ),
  };
}

function readBarrelEquivalenceBudget(value: unknown): BarrelEquivalenceBudget {
  const record = readRecord(value, "barrelEquivalence");
  return {
    plugins: readStringArray(record, "plugins", "barrelEquivalence"),
    maxDivergencePercent: readNumber(
      record,
      "maxDivergencePercent",
      "barrelEquivalence"
    ),
  };
}

export function readSizeBudget(repositoryRoot: string): SizeBudget {
  const absolutePath = path.join(repositoryRoot, SIZE_BUDGET_PATH);
  const parsed: unknown = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const root = readRecord(parsed, "root");
  const budgets = root["budgets"];
  if (!Array.isArray(budgets) || budgets.length === 0) {
    throw new Error(`${SIZE_BUDGET_PATH}: budgets is empty`);
  }
  return {
    budgets: budgets.map(readBundleBudget),
    treeShaking: readTreeShakingBudget(root["treeShaking"]),
    barrelEquivalence: readBarrelEquivalenceBudget(root["barrelEquivalence"]),
  };
}
