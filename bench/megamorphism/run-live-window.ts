// ===========================================================================
// bench/megamorphism/run-live-window.ts — THE CHILD PROCESS.
//
// Measures exactly one window and prints it as one JSON object on stdout, then
// exits. Nothing else may be written to stdout, because the parent parses all
// of it; diagnostics go to stderr.
//
//   npx ts-node --project bench/tsconfig.json \
//     bench/megamorphism/run-live-window.ts --validators=40 --pool=4 --offset=0
//
// It is a whole process for one window because V8's inline caches are
// process-wide: see window-report.types.ts for why measuring two window sizes
// in one process cannot answer this question.
// ===========================================================================
import { measureLiveWindow } from "./measure-live-window";
import { parseWindowArguments } from "./window-arguments";

function run(): number {
  const request = parseWindowArguments(process.argv.slice(2));
  const report = measureLiveWindow(request);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = run();
  } catch (failure) {
    process.stderr.write(
      `${failure instanceof Error ? failure.message : String(failure)}\n`
    );
    process.exitCode = 1;
  }
}
