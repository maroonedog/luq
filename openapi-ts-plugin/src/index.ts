// ===========================================================================
// openapi-ts-plugin/src/index.ts — re-exports only. Nothing is defined here.
//
// The one entry point this package publishes. Every module beside it is
// reachable only through what is named below, so moving or splitting one of
// them is not a breaking change for anybody.
// ===========================================================================
export { generateValidatorModule } from "./generate/generate-validator-module";
export type { GenerateOptions } from "./generate/generate-validator-module";
export type {
  ChainCall,
  FieldChain,
  GeneratedModule,
  SkippedKeyword,
} from "./generate/chain-call.types";
