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

function run(): void {
  const agreement = measureAllAgreement(COMPETITORS).map((entry) => ({
    shape: entry.shape,
    competitor: entry.competitor,
    agreedValues: entry.agreedValues.length,
    disagreements: entry.disagreements.map((one) => ({
      luqSaid: one.luqSaid,
      value: JSON.stringify(one.value)?.slice(0, 200) ?? String(one.value),
    })),
  }));

  const measured = [];
  for (const shape of BENCH_SHAPES) {
    for (const competitor of COMPETITORS) {
      const ratio = measureCompetitorRatio(shape, competitor);
      if (ratio !== undefined) measured.push(ratio);
    }
  }

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

run();
