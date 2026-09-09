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
  renderCoreShare,
  renderLegacySimpleOps,
  renderLegacyTable,
  renderSizeTable,
  renderSpreadRange,
  renderThroughputTable,
} from "./perf-figures/render-perf-tables";
import type {
  PerfBaseline,
  SizeBudget,
} from "./perf-figures/render-perf-tables";

export const README = "README.md";
const BASELINE = path.join("config", "perf-baseline.json");
const SIZE_BUDGET = path.join("config", "size-budget.json");

/** 生成物が読む出所。どちらも実測が書いたファイルで、手で書く場所ではない。 */
interface Sources {
  readonly baseline: PerfBaseline;
  readonly budget: SizeBudget;
}

interface GeneratedBlock {
  readonly name: string;
  readonly render: (sources: Sources) => string;
  /** 文の途中に埋まる印。改行を足すと段落が崩れるので、そのまま差し込む。 */
  readonly isInline?: boolean;
}

const BLOCKS: readonly GeneratedBlock[] = [
  { name: "perf-throughput", render: (s) => renderThroughputTable(s.baseline) },
  { name: "perf-legacy", render: (s) => renderLegacyTable(s.baseline) },
  {
    name: "perf-spread",
    render: (s) => renderSpreadRange(s.baseline),
    isInline: true,
  },
  {
    name: "perf-legacy-simple",
    render: (s) => renderLegacySimpleOps(s.baseline),
    isInline: true,
  },
  { name: "bundle-size", render: (s) => renderSizeTable(s.budget) },
  {
    name: "bundle-core-share",
    render: (s) => renderCoreShare(s.budget),
    isInline: true,
  },
];

function openMarker(name: string): string {
  return `<!-- generated:${name} -->`;
}

function closeMarker(name: string): string {
  return `<!-- /generated:${name} -->`;
}

export function readSources(repositoryRoot: string): Sources {
  return {
    baseline: JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, BASELINE), "utf8")
    ) as PerfBaseline,
    budget: JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, SIZE_BUDGET), "utf8")
    ) as SizeBudget,
  };
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

export function renderReadme(repositoryRoot: string, sources: Sources): string {
  const file = path.join(repositoryRoot, README);
  let contents = fs.readFileSync(file, "utf8");
  for (const block of BLOCKS) {
    contents = replaceBlock(
      contents,
      block.name,
      block.render(sources),
      block.isInline === true
    );
  }
  return contents;
}

export function checkPerfFigures(repositoryRoot: string): number {
  const expected = renderReadme(repositoryRoot, readSources(repositoryRoot));
  const actual = fs.readFileSync(path.join(repositoryRoot, README), "utf8");
  if (expected === actual) {
    console.error(`性能表の表記検査: ${README} は実測と一致`);
    return 0;
  }
  console.error(
    `${README} の数字が ${BASELINE} / ${SIZE_BUDGET} とずれている。` +
      "npm run generate:perf-figures で書き戻すこと。"
  );
  return 1;
}

export function writePerfFigures(repositoryRoot: string): number {
  fs.writeFileSync(
    path.join(repositoryRoot, README),
    renderReadme(repositoryRoot, readSources(repositoryRoot)),
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
