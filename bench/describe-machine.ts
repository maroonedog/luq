// ===========================================================================
// bench/describe-machine.ts
// An ops/sec figure without the machine that produced it is not a measurement,
// it is a rumour. 1.x got this right (it named "AMD Ryzen 7 5825U / Node
// v22.12.0") and this keeps it right by recording the machine automatically
// instead of asking a human to remember to.
// ===========================================================================
import { arch, cpus, platform, totalmem } from "os";
import type { MachineDescription } from "./perf-baseline.types";

const BYTES_PER_GIGABYTE = 1024 * 1024 * 1024;

export function describeMachine(): MachineDescription {
  const processors = cpus();
  const first = processors[0];
  return {
    cpuModel: first === undefined ? "unknown" : first.model.trim(),
    logicalCores: processors.length,
    platform: platform(),
    arch: arch(),
    nodeVersion: process.version,
    totalMemoryGb: Math.round((totalmem() / BYTES_PER_GIGABYTE) * 10) / 10,
  };
}
