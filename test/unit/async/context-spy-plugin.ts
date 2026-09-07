// A check plugin that records the RuleContext it was handed and always passes.
// It is the instrument the ./async tests measure with: if it never runs, no
// rule ran; if it runs twice, something executes the plan twice.
import { definePlugin } from "../../../src/plugin-kit/plugin-definition";
import { check } from "../../../src/plugin-kit/create-rule";
import { PASS } from "../../../src/types";
import type { MessageContextExtra, RuleContext } from "../../../src/types";
import type { Unchanged } from "../../../src/plugin-kit/marker.types";

export const observedContexts: RuleContext[] = [];

export function resetObservedContexts(): void {
  observedContexts.length = 0;
}

export const contextSpyPlugin = definePlugin<{
  args: readonly [];
  out: Unchanged;
  context: MessageContextExtra;
}>()({
  name: "contextSpy",
  method: "contextSpy",
  slots: ["string"] as const,
  build: (ctx) =>
    check({
      code: ctx.code,
      messageFactory: ctx.messageFactory,
      severity: ctx.severity,
      run: (_value, runContext) => {
        observedContexts.push(runContext);
        return PASS;
      },
      describe: () => "records the RuleContext it was handed",
      buildMessageContext: () => ({}),
    }),
});
