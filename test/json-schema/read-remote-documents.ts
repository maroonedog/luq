// ===========================================================================
// test/json-schema/read-remote-documents.ts
//
// スイートが `http://localhost:1234/...` で配るスキーマを、**ディスクから**
// 読んで地図にする。
//
// これはハーネス側のコードであって、ライブラリのコードではない。そこが要点で、
// Luq は外部 `$ref` を「呼び出し側が渡した文書」としてしか解決しない
// (src/json-schema/extensions/json-schema/json-schema.ts の
// JsonSchemaOptions)。だから公式スイートの外部参照 57件を、
// **ネットワークに一切触れずに** 通せる。取りに行くのは呼び出し側の仕事で、
// ここではそれがファイルシステムだというだけである。
//
// スイートの remotes/ は URL のパスをそのままディレクトリ構造にしているので、
// 相対パスをそのまま URL に読み替えられる。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { repositoryRoot } from "./read-suite-corpus";

/** スイートが配信に使うオリジン。remotes/ の中身がこの下にぶら下がる。 */
const REMOTES_ORIGIN = "http://localhost:1234";

function listJsonFiles(directory: string): readonly string[] {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listJsonFiles(full);
    return entry.name.endsWith(".json") ? [full] : [];
  });
}

function toUrl(remotesRoot: string, file: string): string {
  const relative = path.relative(remotesRoot, file).split(path.sep).join("/");
  return `${REMOTES_ORIGIN}/${relative}`;
}

/**
 * `http://localhost:1234/<path>` から文書への地図。
 *
 * 読めない JSON は黙って落とす。コーパスには他ドラフトのスキーマも入って
 * いて、それが1つ壊れているだけで 57件全部が測れなくなるのは割に合わない。
 */
/**
 * Draft-07 のメタスキーマ。コーパスの `{"$ref":"http://json-schema.org/draft-07/schema#"}`
 * がこれを要求する。スイートの remotes/ には入っておらず、公式のハーネスは
 * どれも自分で登録している — このハーネスも同じことをする。
 *
 * ファイルは test/fixtures/well-known/ に置いてある。dev 依存 (ajv) の
 * node_modules から読むこともできたが、他人のパッケージの内部レイアウトに
 * 適合率がぶら下がるのは割に合わない。
 */
const METASCHEMA_URI = "http://json-schema.org/draft-07/schema";

function readMetaschema(): Readonly<Record<string, unknown>> {
  const file = path.join(
    repositoryRoot(),
    "test",
    "fixtures",
    "well-known",
    "json-schema-draft-07.json"
  );
  if (!fs.existsSync(file)) return {};
  try {
    return { [METASCHEMA_URI]: JSON.parse(fs.readFileSync(file, "utf8")) };
  } catch {
    return {};
  }
}

export function readRemoteDocuments(): Readonly<Record<string, unknown>> {
  const remotesRoot = path.join(
    repositoryRoot(),
    "test",
    "fixtures",
    "json-schema-suite",
    "remotes"
  );
  const documents: Record<string, unknown> = { ...readMetaschema() };
  for (const file of listJsonFiles(remotesRoot)) {
    try {
      documents[toUrl(remotesRoot, file)] = JSON.parse(
        fs.readFileSync(file, "utf8")
      );
    } catch {
      // 読めないものは無いものとして扱う。参照されれば $ref が落ちる。
    }
  }
  return Object.freeze(documents);
}
