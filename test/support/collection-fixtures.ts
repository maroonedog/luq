// ===========================================================================
// test/support/collection-fixtures.ts
// The bag the array / object / tuple / union type fixtures share: every
// collection plugin plus the three probes from ./probe-plugins.ts. Nothing
// here asserts, so the call sites in the sibling type-test files stay the only
// thing being read.
// ===========================================================================
import { Builder } from "../../src/builder/field-builder.types";
import { arrayMinLengthPlugin } from "../../src/plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../../src/plugins/array-max-length";
import { arrayUniquePlugin } from "../../src/plugins/array-unique";
import { arrayIncludesPlugin } from "../../src/plugins/array-includes";
import { arrayContainsPlugin } from "../../src/plugins/array-contains";
import { arrayEachPlugin } from "../../src/plugins/array-each";
import { objectPlugin } from "../../src/plugins/object";
import { objectMinPropertiesPlugin } from "../../src/plugins/object-min-properties";
import { objectMaxPropertiesPlugin } from "../../src/plugins/object-max-properties";
import { objectDependentRequiredPlugin } from "../../src/plugins/object-dependent-required";
import { objectRecursivelyPlugin } from "../../src/plugins/object-recursively";
import { tupleBuilderPlugin } from "../../src/plugins/tuple-builder";
import { unionGuardPlugin } from "../../src/plugins/union-guard";
import {
  probeAtLeastPlugin,
  probeMinCharsPlugin,
  probePresentPlugin,
} from "./probe-plugins";
import type { User } from "./model";

export const collectionBuilder = Builder()
  .use(probeAtLeastPlugin)
  .use(probeMinCharsPlugin)
  .use(probePresentPlugin)
  .use(arrayMinLengthPlugin)
  .use(arrayMaxLengthPlugin)
  .use(arrayUniquePlugin)
  .use(arrayIncludesPlugin)
  .use(arrayContainsPlugin)
  .use(arrayEachPlugin)
  .use(objectPlugin)
  .use(objectMinPropertiesPlugin)
  .use(objectMaxPropertiesPlugin)
  .use(objectDependentRequiredPlugin)
  .use(objectRecursivelyPlugin)
  .use(tupleBuilderPlugin)
  .use(unionGuardPlugin);

export const cb = collectionBuilder.for<User>();
