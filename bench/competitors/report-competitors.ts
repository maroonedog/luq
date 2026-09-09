// ===========================================================================
// bench/competitors/report-competitors.ts
//
// 競合比較を実行し、config/competitor-baseline.json に書く。
//
//   npx ts-node --project bench/tsconfig.json bench/competitors/report-competitors.ts
//
// 記録するのは勝ちだけではない。負けている項目も、判定が食い違った件数も、
// 同じ表に入る。負けを載せたベンチは、勝ちだけ載せたベンチより信用される —
// というより、勝ちだけ載せたベンチは何も証明しない。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { describeMachine } from "../describe-machine";
import { BENCH_SHAPES } from "../shapes/index";
import { COMPETITORS } from "./index";
import { measureAllAgreement } from "./measure-agreement";
import { measureCompetitorRatio } from "./measure-competitor-ratio";

const OUTPUT = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "competitor-baseline.json"
);

/**
 * 測り終えた一致を、報告書に入る形へ整える。**測らない** — 測定を引数で
 * 受けるのは、呼び出し側が判定に使ったのと同じ測定を書き出せるようにする
 * ためである。ここで測り直すと、判定した数字と記録した数字が別物になる。
 */
export function summariseAgreement(
  measured: ReturnType<typeof measureAllAgreement>
): readonly unknown[] {
  return measured.map((entry) => ({
    shape: entry.shape,
    competitor: entry.competitor,
    agreedValues: entry.agreedValues.length,
    disagreements: entry.disagreements.map((one) => ({
      luqSaid: one.luqSaid,
      value: JSON.stringify(one.value)?.slice(0, 200) ?? String(one.value),
    })),
  }));
}

/** 全形状 x 全競合の比。undefined を返した組は落とす。 */
export function measureAllRatios(): readonly MeasuredRatio[] {
  const measured: MeasuredRatio[] = [];
  for (const shape of BENCH_SHAPES) {
    for (const competitor of COMPETITORS) {
      const ratio = measureCompetitorRatio(shape, competitor);
      if (ratio !== undefined) measured.push(ratio);
    }
  }
  return measured;
}

export interface MeasuredRatio {
  readonly shape: string;
  readonly competitor: string;
  readonly ratio: number;
}

/**
 * 測り終えたものから報告書を組んで書く。
 *
 * 測定と書き出しを割ってあるのは、check-competitors が同じ測定を必要とする
 * からである。以前は両方が独立に測っていて、CI の competitors ジョブは
 * 16対戦をまるごと二度測っていた — ジョブ時間の約半分が二度目だった。
 */
export function writeCompetitorReport(
  agreement: readonly unknown[],
  measured: readonly MeasuredRatio[]
): void {
  const report = {
    note: [
      "Luq と競合ライブラリを同一プロセスで交互に測ったもの。bench/competitors/ が生成する。",
      "ratio は luq_ops / competitor_ops のペアごとの中央値。1 より大きければ Luq が速い。",
      "時間を測ったのは両者の判定が一致した値だけである。食い違った値は agreement 欄に残してある。",
      "ajv が速いのは検証関数をコードとして生成するからで、数字だけを比べても意味は取れない。",
      "ただし『ajv は CSP 厳格な環境で使えない』は誤りである: ajv/dist/standalone で事前に",
      "コンパイルすれば、生成物に new Function も eval も含まれない (実際に生成して確認した)。",
      "差が出るのはスキーマが実行時に届く場合だけである — サーバから来る、DB に入っている、",
      "利用者が書く。そのとき事前コンパイルは原理的にできず、ajv は実行時のコード生成に戻る。",
      "Luq は実行時の文書をルールに変換するだけでコードを生成しないので、そこでも動く。",
    ],
    machine: describeMachine(),
    competitors: COMPETITORS.map((one) => ({
      name: one.name,
      version: one.version,
    })),
    agreement,
    measured,
  };

  fs.writeFileSync(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(
    `config/competitor-baseline.json: ${measured.length} 件を記録した
`
  );
}

function run(): void {
  writeCompetitorReport(
    summariseAgreement(measureAllAgreement(COMPETITORS)),
    measureAllRatios()
  );
}

// **入口としてのときだけ走る。** この門が無いと、check-competitors が
// measureAllRatios を import した瞬間にここが実行され、全部測り直した上で
// config/ を上書きする — 直そうとしていた二重計測そのものになる。
// scripts/check-*.ts が同じ書き方をしている。
if (require.main === module) {
  run();
}
