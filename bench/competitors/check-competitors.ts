// ===========================================================================
// bench/competitors/check-competitors.ts — CI が回すほう。
//
// 二つを分けている。**片方はゲートで、片方は記録である。**
//
//   判定の一致   決定的である。zod のメールの厳しさが版で変われば、一致した
//                値の数が変わる。機械に依らないのでゲートにできるし、するべき
//                である — 食い違ったまま速度を測ると、比較の意味が静かに壊れる。
//
//   速度比       ランナーに依る。config/perf-baseline.ci.json が存在するのは、
//                「比率が機械を相殺する」という前提がこのリポジトリで一度
//                反証されたからで、同じ誤りをもう一度書かない。CI では測って
//                **印字する** が、落としはしない。
//
// 記録された比率と CI の比率は並べて出す。桁が違えば人間が気づく。閾値を置か
// ないのは、置いた瞬間にその閾値の正しさを別途証明しなければならなくなるから
// である。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { COMPETITORS } from "./index";
import { measureAllAgreement } from "./measure-agreement";
import {
  measureAllRatios,
  summariseAgreement,
  writeCompetitorReport,
} from "./report-competitors";
import type { MeasuredRatio } from "./report-competitors";

const BASELINE = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "competitor-baseline.json"
);

interface RecordedAgreement {
  readonly shape: string;
  readonly competitor: string;
  readonly agreedValues: number;
  readonly disagreements: readonly unknown[];
}

interface RecordedRatio {
  readonly shape: string;
  readonly competitor: string;
  readonly ratio: number;
}

interface Baseline {
  readonly agreement: readonly RecordedAgreement[];
  readonly measured: readonly RecordedRatio[];
}

function readBaseline(): Baseline {
  return JSON.parse(fs.readFileSync(BASELINE, "utf8")) as Baseline;
}

function keyOf(shape: string, competitor: string): string {
  return `${shape}/${competitor}`;
}

/** 一致だけを見る。ここが違えば、比較そのものが別物になっている。 */
function checkAgreement(
  baseline: Baseline,
  measuredAgreement: ReturnType<typeof measureAllAgreement>
): readonly string[] {
  const recorded = new Map(
    baseline.agreement.map((entry) => [
      keyOf(entry.shape, entry.competitor),
      entry,
    ])
  );
  const problems: string[] = [];

  for (const measured of measuredAgreement) {
    const key = keyOf(measured.shape, measured.competitor);
    const before = recorded.get(key);
    if (before === undefined) {
      problems.push(`${key}: 記録に無い組み合わせが現れた`);
      continue;
    }
    if (before.agreedValues !== measured.agreedValues.length) {
      problems.push(
        `${key}: 一致した値が ${before.agreedValues} から ` +
          `${measured.agreedValues.length} に変わった。判定の食い違いが` +
          `増減している — 速度を比べる前に、何が変わったかを見ること`
      );
    }
    for (const disagreement of measured.disagreements) {
      const shown = JSON.stringify(disagreement.value)?.slice(0, 120);
      problems.push(
        `  ${key}: Luq=${String(disagreement.luqSaid)} 相手=${String(!disagreement.luqSaid)} ${shown ?? ""}`
      );
    }
  }
  return problems;
}

function run(): void {
  const baseline = readBaseline();
  const recordedRatios = new Map(
    baseline.measured.map((entry) => [
      keyOf(entry.shape, entry.competitor),
      entry.ratio,
    ])
  );

  // 測るのはここ一度だけ。判定にも、--write の書き出しにも、同じ測定を使う。
  // 以前は check と report がそれぞれ測っていて、CI の competitors ジョブは
  // 16対戦をまるごと二度測っていた — ジョブ時間の約半分が二度目だった。
  const measuredAgreement = measureAllAgreement(COMPETITORS);
  const measuredRatios: readonly MeasuredRatio[] = measureAllRatios();

  const problems = checkAgreement(baseline, measuredAgreement);
  const disagreementsOnly = problems.every((line) => line.startsWith("  "));

  process.stdout.write("競合との判定一致:\n");
  if (problems.length === 0) {
    process.stdout.write("  記録どおり、食い違いは無い\n");
  } else {
    for (const line of problems) process.stdout.write(`${line}\n`);
  }

  process.stdout.write("\n速度比 (このランナー / 記録された値):\n");
  for (const measured of measuredRatios) {
    const key = keyOf(measured.shape, measured.competitor);
    const before = recordedRatios.get(key) ?? 0;
    process.stdout.write(
      `  ${key.padEnd(24)} ×${measured.ratio.toFixed(2)} / ×${before.toFixed(2)}\n`
    );
  }
  process.stdout.write(
    "\n比率は落としの条件ではない。ランナーが変われば動く数だからで、" +
      "config/perf-baseline.ci.json が存在するのと同じ理由である。\n"
  );

  // 落とすのは「一致が記録と変わった」ときだけ。食い違いそのものは記録済みで
  // あれば正常なので、その行だけなら通す。
  if (problems.length > 0 && !disagreementsOnly) {
    process.exitCode = 1;
  }

  // --write: 判定に使ったその測定を、そのまま config/ に書き出す。CI はこれで
  // artifact を上げる。判定と記録が別々の測定だと、artifact の数字が「落ちな
  // かった数字」であるとは限らなくなる。
  if (process.argv.includes("--write")) {
    writeCompetitorReport(
      summariseAgreement(measuredAgreement),
      measuredRatios
    );
  }
}

run();
