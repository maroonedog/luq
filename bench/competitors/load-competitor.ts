// ===========================================================================
// bench/competitors/load-competitor.ts
//
// One competitor, loaded by name and ONLY when it is asked for.
//
// ./index.ts imports all four eagerly, which is right for the agreement pass
// and wrong for a child process measuring one of them under blocked code
// generation: ajv builds its validators at module load through `new Function`,
// so importing the index to reach zod threw before zod was ever touched. One
// library's inability to start is a result about that library, and it must not
// take the measurement of another one down with it.
//
// `require` rather than `import` on purpose. The children run as CommonJS
// through ts-node, and the point is to defer the load past the module's own
// evaluation — which a static import cannot do.
// ===========================================================================
import type { Competitor } from "./competitor.types";

/** Module path and export name, for each competitor ./index.ts lists. */
const COMPETITOR_MODULES: Readonly<Record<string, readonly [string, string]>> =
  Object.freeze({
    zod: ["./zod-subjects", "ZOD_COMPETITOR"],
    valibot: ["./valibot-subjects", "VALIBOT_COMPETITOR"],
    ajv: ["./ajv-subjects", "AJV_COMPETITOR"],
    yup: ["./yup-subjects", "YUP_COMPETITOR"],
  });

export class UnknownCompetitorError extends Error {}

function isCompetitor(value: unknown): value is Competitor {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    typeof record["name"] === "string" &&
    typeof record["version"] === "string" &&
    typeof record["subjects"] === "object"
  );
}

/**
 * The named competitor, or a throw the caller can report as "cannot run here".
 *
 * A module that throws while evaluating — ajv with `new Function` forbidden —
 * throws out of here, which is what puts the reason in the child's report
 * instead of in a stack trace nobody reads.
 */
export function loadCompetitor(name: string): Competitor {
  const entry = COMPETITOR_MODULES[name];
  if (entry === undefined) {
    throw new UnknownCompetitorError(`no competitor "${name}"`);
  }
  const [modulePath, exportName] = entry;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const loaded: unknown = require(modulePath)[exportName];
  if (!isCompetitor(loaded)) {
    throw new UnknownCompetitorError(
      `${modulePath} does not export a competitor called ${exportName}`
    );
  }
  return loaded;
}
