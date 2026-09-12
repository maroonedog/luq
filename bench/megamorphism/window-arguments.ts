// ===========================================================================
// bench/megamorphism/window-arguments.ts
//
// The command line the parent writes and the child reads, in ONE file, so the
// two cannot drift apart. A parent that spelled a flag one way and a child that
// read it another would not fail: the child would fall back to its default,
// measure a window nobody asked for, and the parent would record the answer
// under the label it intended.
// ===========================================================================
import type { WindowRequest } from "./window-report.types";

const VALIDATORS = "--validators=";
const POOL = "--pool=";
const OFFSET = "--offset=";

export class WindowArgumentError extends Error {}

function readNumber(argv: readonly string[], flag: string): number {
  const found = argv.find((argument) => argument.startsWith(flag));
  if (found === undefined) {
    throw new WindowArgumentError(`missing ${flag}<number>`);
  }
  // `Number("")` is 0, so an empty value would otherwise be read as a window of
  // zero validators and measured as though it had been asked for.
  const raw = found.slice(flag.length);
  const value = raw.length === 0 ? Number.NaN : Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new WindowArgumentError(
      `${flag} wants a non-negative whole number, got "${raw}"`
    );
  }
  return value;
}

export function formatWindowArguments(
  request: WindowRequest
): readonly string[] {
  return [
    `${VALIDATORS}${request.validatorCount}`,
    `${POOL}${request.poolSize}`,
    `${OFFSET}${request.offset}`,
  ];
}

export function parseWindowArguments(argv: readonly string[]): WindowRequest {
  return {
    validatorCount: readNumber(argv, VALIDATORS),
    poolSize: readNumber(argv, POOL),
    offset: readNumber(argv, OFFSET),
  };
}
