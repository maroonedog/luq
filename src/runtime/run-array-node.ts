// ===========================================================================
// L5  src/runtime/run-array-node.ts
// LOOP INTERCHANGE, executed. The array behind a node is read ONCE however
// many element fields the node carries, and the elements are then walked once,
// applying every field to each. compileArrayNode already grouped the
// declarations, so this file contains no decision about which field belongs to
// which array.
//
// The legacy tree walked the array once per declared element field and rebuilt
// its batch validator inside validate(), giving back the optimisation it had
// just made. Here the only per-element allocation is the ArrayItemContext the
// plugin contract requires, plus the context object carrying it.
//
// Every index this loop opens is pushed on the ONE index stack and popped
// again before the next element, so an issue raised three levels down renders
// `grid[0][2].name` and never the declaration pattern.
// ===========================================================================
import { isArray } from "../types";
import type { ArrayItemContext } from "../types";
import type { ArrayNode } from "../compile/validation-plan.types";
import { formatIssuePath } from "../path/format-issue-path";
import { runField } from "./run-field";
import type { FieldRunContext } from "./run-field";
import {
  NO_WRITE_TARGETS,
  replaceElement,
  writeFieldValue,
} from "./output-writer";
import type { ArrayWriteTarget } from "./output-writer";

/** A node template never contains a wildcard: the grouping cut it off. */
const NO_INDICES: readonly number[] = Object.freeze([]);

/**
 * `targets` mirrors `nodes` by position and is EMPTY on every run that produces
 * no output. Zipping by index needs no lookup and no identity check, because
 * output-writer derives one list from the other by the same recursion.
 */
export function runArrayNodes(
  nodes: readonly ArrayNode[],
  subject: unknown,
  context: FieldRunContext,
  targets: readonly ArrayWriteTarget[]
): unknown {
  let current = subject;
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node === undefined) continue;
    current = runArrayNode(node, current, context, targets[i]);
    if (context.sink.shouldStopPlan()) return current;
  }
  return current;
}

/**
 * A subject with no array at this path is not an error: createArrayReader
 * decided that at the boundary, and asserting that the container IS an array is
 * a separate declared rule on the container path. An empty array is an array,
 * so the element loop simply runs zero times.
 */
function runArrayNode(
  node: ArrayNode,
  subject: unknown,
  context: FieldRunContext,
  target: ArrayWriteTarget | undefined
): unknown {
  const array = node.read(subject);
  if (!isArray(array)) return subject;
  const rebuilt = runElements(node, array, context, target);
  if (rebuilt === array || target === undefined) return subject;
  return target.write(subject, rebuilt);
}

function runElements(
  node: ArrayNode,
  array: readonly unknown[],
  context: FieldRunContext,
  target: ArrayWriteTarget | undefined
): readonly unknown[] {
  const nodePath = formatIssuePath(node.template, NO_INDICES);
  const elementSink = context.sink.forArrayElements();
  const nested = target === undefined ? NO_WRITE_TARGETS : target.nested;
  let rebuilt = array;
  for (let index = 0; index < array.length; index += 1) {
    const elementContext: FieldRunContext = {
      ...context,
      sink: elementSink,
      item: describeItem(array, index),
    };
    context.indices.push(nodePath, index);
    const element = runNested(
      node,
      runElementFields(node, array[index], elementContext),
      elementContext,
      nested
    );
    context.indices.pop();
    rebuilt = replaceElement(rebuilt, index, element);
    if (context.sink.shouldStopPlan()) return rebuilt;
  }
  return rebuilt;
}

/** The stack frame for this element is still open, so `sub` pushes onto it. */
function runNested(
  node: ArrayNode,
  element: unknown,
  elementContext: FieldRunContext,
  nested: readonly ArrayWriteTarget[]
): unknown {
  if (node.nested.length === 0) return element;
  return runArrayNodes(node.nested, element, elementContext, nested);
}

function runElementFields(
  node: ArrayNode,
  element: unknown,
  elementContext: FieldRunContext
): unknown {
  let current = element;
  for (const field of node.elementFields) {
    const outcome = runField(field, current, elementContext);
    current = writeFieldValue(
      field,
      current,
      outcome,
      elementContext.shouldApplyTransforms
    );
    if (elementContext.sink.shouldStopPlan()) return current;
  }
  return current;
}

/** The ArrayItemContext a plugin reads on RuleContext.item. */
function describeItem(
  array: readonly unknown[],
  index: number
): ArrayItemContext {
  return { index, item: array[index], array };
}
