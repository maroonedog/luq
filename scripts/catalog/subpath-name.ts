import type { PluginTier } from "./plugin-catalog.types";

/**
 * ディレクトリ名 (kebab) と公開サブパス名 (camel) の唯一の対応表。
 *
 * 原則は kebab <-> camel の機械変換で、往復が一致しない名前は不正として落とす。
 * 例外は3件だけ:
 *   - json-schema / json-schema-full-feature は extension 段のバンドルで、
 *     公開サブパス名が 1.x で凍結済み。派生ではなく宣言でなければならない。
 *   - read-only-write-only はディレクトリを持たない互換エイリアスのファイル名。
 * `uuid` は意図的にこの表に無い。uuid は機械変換で往復するので上書きが要らない
 * (string-uuid へのリネーム案は撤回済み)。
 */
export const SUBPATH_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  "json-schema": "jsonSchema",
  "json-schema-full-feature": "jsonSchemaFullFeature",
  "read-only-write-only": "readOnlyWriteOnly",
};

const KEBAB_DIRECTORY = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export class IrregularDirectoryNameError extends Error {
  constructor(directoryName: string, reason: string) {
    super(`プラグインディレクトリ名 "${directoryName}" は不正です: ${reason}`);
    this.name = "IrregularDirectoryNameError";
  }
}

export function toCamelCase(directoryName: string): string {
  return directoryName.replace(/-([a-z0-9])/g, (_, character: string) =>
    character.toUpperCase()
  );
}

export function toKebabCase(subpathName: string): string {
  return subpathName.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * ディレクトリ名から公開サブパス名を決める。
 * extension 段は必ず上書き表に載っていなければならない (公開名が凍結されているため)。
 */
export function toSubpathName(
  directoryName: string,
  tier: PluginTier = "isolated"
): string {
  const override = SUBPATH_NAME_OVERRIDES[directoryName];
  if (override !== undefined) return override;
  if (tier === "extension") {
    throw new IrregularDirectoryNameError(
      directoryName,
      "extension 段の公開サブパス名は SUBPATH_NAME_OVERRIDES で宣言してください"
    );
  }
  if (!KEBAB_DIRECTORY.test(directoryName)) {
    throw new IrregularDirectoryNameError(
      directoryName,
      "kebab-case ではありません"
    );
  }
  const camel = toCamelCase(directoryName);
  const roundTripped = toKebabCase(camel);
  if (roundTripped !== directoryName) {
    throw new IrregularDirectoryNameError(
      directoryName,
      `kebab<->camel の往復が一致しません ("${camel}" -> "${roundTripped}")`
    );
  }
  return camel;
}
