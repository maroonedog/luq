// ===========================================================================
// L7  src/plugins/object-additional-properties/object-additional-properties-schema.ts
// Draft-07's SCHEMA form: every key the sibling declarations did not name must
// satisfy the given sub-chain. The subject of that sub-chain is the VALUE
// behind an unlisted key, so the argument is a PropertyValueChain — which is
// exactly why this form cannot be bound from a JSON document and had to leave
// the boolean form's module.
// ===========================================================================
import { PASS, fail, isPlainObject, isStringArray } from "../../types";
import { branch, composite } from "../../plugin-kit/create-rule";
import { definePlugin } from "../../plugin-kit/plugin-definition";
import type { CompositeBranch } from "../../plugin-kit/compiled-rule";
import type {
  PropertyValueChain,
  Unchanged,
} from "../../plugin-kit/marker.types";
import type { UnexpectedPropertiesExtra } from "./object-additional-properties";

/**
 * WHICH argument positions carry a sub-chain cannot be recovered from a
 * plugin's type at run time — a NarrowedChain and a RootPredicate are both
 * plain functions once erased — so src/chain/collect-branch-rules.ts reads it
 * from this declared field. definePlugin's spec does not carry it yet (see
 * needsFromOthers), which is why it is spread on rather than passed in.
 */
export const objectAdditionalPropertiesSchemaPlugin =
  /*#__PURE__*/ definePlugin<{
    args: readonly [
      schema: PropertyValueChain,
      allowedProperties?: readonly string[],
    ];
    out: Unchanged;
    context: UnexpectedPropertiesExtra;
  }>()({
    name: "objectAdditionalPropertiesSchema",
    method: "additionalPropertiesSchema",
    slots: ["object"] as const,
    build: (ctx, schema, allowedProperties) => {
      const known: ReadonlySet<string> = new Set(
        allowedProperties ?? ctx.declaredSiblingKeys
      );
      const branches: readonly CompositeBranch[] = [
        branch("additional", schema),
      ];
      return composite<UnexpectedPropertiesExtra>({
        code: ctx.code,
        messageFactory: ctx.messageFactory,
        severity: ctx.severity,
        branches,
        combine: (runners) => (value, runCtx) => {
          if (!isPlainObject(value)) return PASS;
          const extra = Object.keys(value).filter((key) => !known.has(key));
          if (extra.length === 0) return PASS;
          const runner = runners[0];
          if (runner === undefined) return PASS;
          const failing = extra.filter(
            (key) => !runner.run(value[key], runCtx).ok
          );
          return failing.length === 0 ? PASS : fail({ actual: failing });
        },
        describe: (detail) => `Unexpected properties: ${String(detail.actual)}`,
        buildMessageContext: (detail) => ({
          extraProperties: isStringArray(detail.actual) ? detail.actual : [],
        }),
      });
    },
    subChainArguments: [0],
  });
