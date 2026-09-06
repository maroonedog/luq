// ===========================================================================
// L7  src/plugins/object/additional-properties-schema.ts
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
import type { UnexpectedPropertiesExtra } from "./additional-properties";

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
  });
