/**
 * Execution Strategy Selector (Refactored)
 * Uses integrated StrategyFactory - eliminates duplicate logic
 * 
 * Before: 84 lines with strategy analysis duplication
 * After: ~25 lines using unified core systems
 */

import { 
  analyzeFields,
  StrategyAnalysis,
  ValidationStrategy
} from './core/strategy-factory';

/**
 * Determine execution strategy for all fields (simplified)
 * Delegates duplicated strategy analysis logic to StrategyFactory
 */
export function selectOptimalStrategies(
  fieldDefinitions: Array<{
    path: string;
    builderFunction: Function;
  }>,
  plugins: Record<string, any>
): Map<string, StrategyAnalysis> {
  
  // Use unified strategy factory for analysis
  const overallAnalysis = analyzeFields(fieldDefinitions, plugins);
  
  // Create analysis map for backward compatibility
  const strategies = new Map<string, StrategyAnalysis>();
  
  // For now, assign the same strategy to all fields
  // TODO: Support per-field strategy analysis
  for (const fieldDef of fieldDefinitions) {
    strategies.set(fieldDef.path, overallAnalysis);
  }

  // Output overall optimization statistics (optional)
  logOptimizationStats(strategies);

  return strategies;
}

/**
 * Group fields by strategy (simplified)
 */
export function groupByStrategy(strategies: Map<string, StrategyAnalysis>): {
  fastFields: string[];
  slowFields: string[];
} {
  const fastFields: string[] = [];
  const slowFields: string[] = [];

  strategies.forEach((analysis, fieldPath) => {
    if (analysis.strategy === ValidationStrategy.FAST_SEPARATED) {
      fastFields.push(fieldPath);
    } else {
      slowFields.push(fieldPath);
    }
  });

  return { fastFields, slowFields };
}

/**
 * Display percentage of optimizable fields (optional)
 */
function logOptimizationStats(
  strategies: Map<string, StrategyAnalysis>
): void {
  // Production builds should not include debug logs
  // These logs are removed to reduce bundle size
  // Uncomment for development debugging:
  /*
  const total = strategies.size;
  const optimizable = Array.from(strategies.values()).filter(s => s.canOptimize).length;
  
  if (total > 0) {
    console.log(`[LUQ Optimization] ${optimizable}/${total} fields can use fast execution (${Math.round(optimizable/total*100)}%)`);
  }
  */
}