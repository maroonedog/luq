// ===========================================================================
// scripts/check-perf-figures.ts
//
// README の性能表が config/perf-baseline.json と一致していることを検査する。
// `--write` で書き戻す。
//
//   npm run generate:perf-figures    書き戻す
//   npm run check:perf-figures       ずれていたら exit 1 (CI 用)
//
// なぜ検査が要るか。適合率で一度やった失敗と同じで、README の数字は**自己
// 整合している**。29,963 ops/sec も ×0.11 も、書かれた当時は本当だった。
// 矛盾を探す検査では捕まらず、捕まえるには「今の値は何か」を知っている必要が
// ある。ここが知っているのは config/perf-baseline.json ただ一つで、それを
// 書くのは bench:record だけである。
//
// 表は生成の印で囲む。囲まれた内側だけを置き換えるので、表の前後に書かれた
// 説明文 — なぜ 1.x に負けているのか、何を確かめたのか — は人間が書いたまま
// 残る。数字が自動で、解釈が手書きである。
// ===========================================================================
import * as fs from "fs";
import * as path from "path";
import { REPOSITORY_ROOT } from "./catalog/plugin-source-roots";
import { runCheckAndExit } from "./catalog/run-check-and-exit";
import {
  renderLegacyTable,
  renderSpreadRange,
  renderThroughputTable,
} from "./perf-figures/render-perf-tables";
import type { PerfBaseline } from "./perf-figures/render-perf-tables";

export const README = "README.md";
const BASELINE = path.join("config", "perf-baseline.json");

interface GeneratedBlock {
  readonly name: string;
  readonly render: (baseline: PerfBaseline) => string;
  /** 文の途中に埋まる印。改行を足すと段落が崩れるので、そのまま差し込む。 */
  readonly isInline?: boolean;
}

const BLOCKS: readonly GeneratedBlock[] = [
  { name: "perf-throughput", render: renderThroughputTable },
  { name: "perf-legacy", render: renderLegacyTable },
  { name: "perf-spread", render: renderSpreadRange, isInline: true },
];

function openMarker(name: string): string {
  return `<!-- generated:${name} -->`;
}

function closeMarker(name: string): string {
  return `<!-- /generated:${name} -->`;
}

export function readBaseline(repositoryRoot: string): PerfBaseline {
  const file = path.join(repositoryRoot, BASELINE);
  return JSON.parse(fs.readFileSync(file, "utf8")) as PerfBaseline;
}

/**
 * 印が無い、あるいは片方しか無いのは違反である。黙って素通りさせると、印を
 * 消しただけで検査が効かなくなる — ゲートを外す一番簡単な方法を残さない。
 */
function replaceBlock(
  contents: string,
  name: string,
  rendered: string,
  isInline: boolean
): string {
  const open = openMarker(name);
  const close = closeMarker(name);
  const from = contents.indexOf(open);
  const to = contents.indexOf(close);
  if (from === -1 || to === -1 || to < from) {
    throw new Error(`${README} に ${open} … ${close} が対で見つからない`);
  }
  const head = contents.slice(0, from + open.length);
  const tail = contents.slice(to);
  return isInline
    ? `${head}${rendered}${tail}`
    : `${head}\n${rendered}\n${tail}`;
}

export function renderReadme(
  repositoryRoot: string,
  baseline: PerfBaseline
): string {
  const file = path.join(repositoryRoot, README);
  let contents = fs.readFileSync(file, "utf8");
  for (const block of BLOCKS) {
    contents = replaceBlock(
      contents,
      block.name,
      block.render(baseline),
      block.isInline === true
    );
  }
  return contents;
}

export function checkPerfFigures(repositoryRoot: string): number {
  const baseline = readBaseline(repositoryRoot);
  const expected = renderReadme(repositoryRoot, baseline);
  const actual = fs.readFileSync(path.join(repositoryRoot, README), "utf8");
  if (expected === actual) {
    console.error(`性能表の表記検査: ${README} は実測と一致`);
    return 0;
  }
  console.error(
    `${README} の性能表が ${BASELINE} とずれている。` +
      "npm run generate:perf-figures で書き戻すこと。"
  );
  return 1;
}

export function writePerfFigures(repositoryRoot: string): number {
  const baseline = readBaseline(repositoryRoot);
  fs.writeFileSync(
    path.join(repositoryRoot, README),
    renderReadme(repositoryRoot, baseline),
    "utf8"
  );
  console.error(`生成: ${README} の性能表`);
  return 0;
}

if (require.main === module) {
  const shouldWrite = process.argv.includes("--write");
  runCheckAndExit(() =>
    shouldWrite
      ? writePerfFigures(REPOSITORY_ROOT)
      : checkPerfFigures(REPOSITORY_ROOT)
  );
}
