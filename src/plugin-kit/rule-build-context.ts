import type {
  IssueSeverity,
  MessageContext,
  MessageContextExtra,
  MessageFactory,
} from "../types";
import type { ResolvedGlobalConfig } from "../types/global-config";

export interface RuleBuildContext<
  C extends MessageContextExtra = MessageContextExtra,
> {
  /** Identity of the plugin whose build() is running. */
  readonly pluginName: string;
  /** Error code already resolved from options.code, falling back to pluginName. */
  readonly code: string;
  /** Message factory already resolved from options.messageFactory. */
  readonly messageFactory?: MessageFactory<C>;
  /**
   * Already resolved from options.severity, falling back to
   * config.defaultSeverity. Resolved ONCE, here, for the same reason
   * options.code is: two resolution sites is how an override stops working.
   */
  readonly severity: IssueSeverity;
  /**
   * The effective GlobalConfig for the builder that is building this rule.
   * This is the ONLY way a plugin sees it; nothing reads a process-wide
   * singleton at validation time.
   */
  readonly config: ResolvedGlobalConfig;
  /** The field this rule is attached to, in L1 grammar. */
  readonly fieldPath: string;
  /** Immediate child object keys declared underneath fieldPath, frozen by L4. */
  readonly declaredSiblingKeys: readonly string[];
}

export function renderMessage<C extends MessageContextExtra>(
  factory: MessageFactory<C> | undefined,
  ctx: MessageContext,
  extra: C,
  fallback: string
): string {
  return factory === undefined
    ? fallback
    : factory(Object.assign({}, ctx, extra));
}
