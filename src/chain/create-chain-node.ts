// ===========================================================================
// L3  src/chain/create-chain-node.ts — the IMMUTABLE chain node.
//
// A node owns exactly one thing: the ordered rule list built so far. Calling a
// slot method builds ONE rule and returns a NEW frozen node; the receiver is
// never touched, so two chains branched from the same `b` cannot contaminate
// each other.
//
// The declared argument count comes from `plugin.build.length - 1` (build's own
// parameters minus `ctx`), which is how the trailing `options?: RuleOptions` of
// ChainMethod is separated from a trailing DECLARED optional argument. A plugin
// whose build uses a default value or a rest parameter breaks that count; the
// plugin contract forbids both.
//
// The rule list is held in a WeakMap rather than on the node, so the node
// carries exactly the members its type declares and reading the rules back
// needs no assertion and no runtime shape check.
// ===========================================================================
import { isPlainObject, isString } from "../types";
import type {
  IssueSeverity,
  MessageContextExtra,
  MessageFactory,
  TypeName,
} from "../types";
import type { ResolvedGlobalConfig } from "../types/global-config";
import type { Rule } from "../plugin-kit/compiled-rule";
import { presence } from "../plugin-kit/create-rule";
import type { RuleBuildContext } from "../plugin-kit/rule-build-context";
import type { AnyPlugin } from "../plugin-kit/plugin-definition";
import type { PluginBag } from "./plugin-bag.types";
import { REFINE_METHOD_SLOTS } from "./refine-methods.types";
import { attachSlotMethods } from "./attach-slot-methods";

const chainRulesByNode = new WeakMap<object, readonly Rule[]>();
const EMPTY_RECORD: Readonly<Record<string, unknown>> = Object.freeze({});

export const EMPTY_RULES: readonly Rule[] = Object.freeze([]);

/** What a chain needs to build a rule, independent of which slot it is on. */
export interface ChainBuildContext {
  readonly fieldPath: string;
  readonly declaredSiblingKeys: readonly string[];
  readonly config: ResolvedGlobalConfig;
}

/**
 * The parts a node cannot make for itself. `resolveArguments` is injected so
 * that create-field-slots owns the recursive knot (a sub-chain needs slots,
 * slots need nodes, a node needs sub-chains) and no import cycle forms.
 */
export interface ChainNodeWiring {
  readonly bag: PluginBag;
  readonly context: ChainBuildContext;
  resolveArguments(plugin: AnyPlugin, declared: readonly unknown[]): unknown[];
}

function isIssueSeverity(value: unknown): value is IssueSeverity {
  return value === "error" || value === "warning" || value === "info";
}

function isMessageFactory(
  value: unknown
): value is MessageFactory<MessageContextExtra> {
  return typeof value === "function";
}

function buildRuleContext(
  wiring: ChainNodeWiring,
  plugin: AnyPlugin,
  rawOptions: unknown
): RuleBuildContext {
  const options = isPlainObject(rawOptions) ? rawOptions : EMPTY_RECORD;
  const code = options["code"];
  const severity = options["severity"];
  const messageFactory = options["messageFactory"];
  return {
    pluginName: plugin.name,
    code: isString(code) ? code : plugin.name,
    severity: isIssueSeverity(severity)
      ? severity
      : wiring.context.config.defaultSeverity,
    messageFactory: isMessageFactory(messageFactory)
      ? messageFactory
      : undefined,
    config: wiring.context.config,
    fieldPath: wiring.context.fieldPath,
    declaredSiblingKeys: wiring.context.declaredSiblingKeys,
  };
}

/**
 * The presence rule a `judgesNull` plugin brings with it. It forbids
 * NOTHING — it only says that null must reach the checks instead of ending
 * the field, which is the one thing a check cannot say for itself.
 */
function nullIsAValue(severity: IssueSeverity): Rule {
  return presence({
    code: "type",
    severity,
    allowUndefined: true,
    allowNull: true,
    emptyStringIsMissing: false,
    nullIsValue: true,
    describe: (messageContext) => `${messageContext.path} must not be null`,
    buildMessageContext: () => ({}),
  });
}

function createSlotMethod(
  wiring: ChainNodeWiring,
  slot: TypeName,
  rules: readonly Rule[],
  plugin: AnyPlugin
): (...args: readonly unknown[]) => unknown {
  const arity = Math.max(plugin.build.length - 1, 0);
  return (...args) => {
    const rawOptions = args.length > arity ? args[arity] : undefined;
    const resolved = wiring.resolveArguments(plugin, args.slice(0, arity));
    const rule = plugin.build(
      buildRuleContext(wiring, plugin, rawOptions),
      ...resolved
    );
    const added =
      plugin.judgesNull === true
        ? [nullIsAValue(wiring.context.config.defaultSeverity), rule]
        : [rule];
    return createChainNode(wiring, slot, [...rules, ...added]);
  };
}

function attachRefineMethods(
  target: Record<string, unknown>,
  wiring: ChainNodeWiring,
  rules: readonly Rule[]
): void {
  for (const [methodName, slot] of Object.entries(REFINE_METHOD_SLOTS)) {
    target[methodName] = (): unknown => createChainNode(wiring, slot, rules);
  }
}

/** The runtime value behind FieldChain. Erased to its type by its callers. */
export function createChainNode(
  wiring: ChainNodeWiring,
  slot: TypeName,
  rules: readonly Rule[]
): Readonly<Record<string, unknown>> {
  const node: Record<string, unknown> = {};
  attachRefineMethods(node, wiring, rules);
  attachSlotMethods(node, wiring.bag, slot, (plugin) =>
    createSlotMethod(wiring, slot, rules, plugin)
  );
  chainRulesByNode.set(node, rules);
  return Object.freeze(node);
}

/** The one way back out of a chain: undefined when the value is not a node. */
export function readChainRules(
  candidate: unknown
): readonly Rule[] | undefined {
  if (typeof candidate !== "object" || candidate === null) return undefined;
  return chainRulesByNode.get(candidate);
}
