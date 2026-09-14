// ===========================================================================
// bench/compare/measure-side.ts — one checkout, one reading, as JSON.
//
// Prints a line per shape and nothing else, so the comparator that spawns it
// can read stdout without parsing a report. It measures THIS checkout: the
// comparator runs it once per side per round, alternating, and the sides are
// two working trees of the same repository at different commits.
//
// Why a separate entry rather than `bench:record`: recording writes a baseline
// file and gates against floors, which is a different question. This one
// answers "how fast is this tree, right now, on this machine", and is only
// meaningful next to another reading taken minutes later on the same machine.
// ===========================================================================
import { BENCH_SHAPES } from "../shapes";
import { measureThroughput } from "../measure-throughput";

function main(): void {
  for (const shape of BENCH_SHAPES) {
    const validator = shape.buildValidator();
    const value = shape.acceptedValue;
    const measurement = measureThroughput(
      shape.name,
      () => validator.validate(value).valid
    );
    process.stdout.write(
      `${JSON.stringify({
        shape: shape.name,
        opsPerSecond: measurement.opsPerSecond,
        relativeSpreadPercent: measurement.relativeSpreadPercent,
        isQuiet: measurement.isQuiet,
      })}\n`
    );
  }
}

main();
