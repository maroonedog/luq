/**
 * The shared exit path when run as a CLI.
 *
 * A malformed catalog — a missing entry, an invalid name — is raised as an
 * exception, but what CI should show is the message and not a stack trace, so
 * it is folded here.
 */
export function runCheckAndExit(run: () => number): void {
  try {
    process.exit(run());
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
