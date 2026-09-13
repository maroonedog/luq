// ===========================================================================
// bench/competitors/subject-arguments.ts
//
// The command line the parent writes and the child reads, in ONE file so the
// two cannot drift. A parent spelling a flag one way and a child reading it
// another would not fail loudly: the child would measure some default and the
// parent would record the answer under the label it meant to ask for.
//
// The same argument bench/megamorphism/window-arguments.ts makes, for the same
// reason.
// ===========================================================================
import type {
  CodeGeneration,
  SubjectPool,
  SubjectRequest,
} from "./subject-report.types";

const SHAPE = "--shape=";
const SUBJECT = "--subject=";
const AGAINST = "--against=";
const POOL = "--pool=";
const CODEGEN = "--codegen=";

const POOLS: readonly SubjectPool[] = Object.freeze([
  "mixed",
  "accepted",
  "rejected",
]);

export class SubjectArgumentError extends Error {}

function readText(argv: readonly string[], flag: string): string {
  const found = argv.find((argument) => argument.startsWith(flag));
  if (found === undefined) {
    throw new SubjectArgumentError(`missing ${flag}<name>`);
  }
  const value = found.slice(flag.length);
  if (value.length === 0) {
    throw new SubjectArgumentError(`${flag} wants a name, got nothing`);
  }
  return value;
}

function isPool(value: string): value is SubjectPool {
  return POOLS.some((pool) => pool === value);
}

function isCodeGeneration(value: string): value is CodeGeneration {
  return value === "allowed" || value === "blocked";
}

export function formatSubjectArguments(
  request: SubjectRequest
): readonly string[] {
  return [
    `${SHAPE}${request.shape}`,
    `${SUBJECT}${request.subject}`,
    `${AGAINST}${request.against}`,
    `${POOL}${request.pool}`,
    `${CODEGEN}${request.codeGeneration}`,
  ];
}

export function parseSubjectArguments(argv: readonly string[]): SubjectRequest {
  const pool = readText(argv, POOL);
  if (!isPool(pool)) {
    throw new SubjectArgumentError(
      `${POOL} wants one of ${POOLS.join(", ")}, got "${pool}"`
    );
  }
  const codeGeneration = readText(argv, CODEGEN);
  if (!isCodeGeneration(codeGeneration)) {
    throw new SubjectArgumentError(
      `${CODEGEN} wants allowed or blocked, got "${codeGeneration}"`
    );
  }
  return {
    codeGeneration,
    shape: readText(argv, SHAPE),
    against: readText(argv, AGAINST),
    subject: readText(argv, SUBJECT),
    pool,
  };
}
