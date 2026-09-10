// ===========================================================================
// L7  src/presets/presets.ts — predefined plugin bundles.
//
// Why they exist. Importing plugins one at a time is the very mechanism behind
// "you only ship what you used", but making someone write fifteen use() lines
// for their first validator is imposing that correctness on them.
//
// Why several small ones rather than one big one. A single everything-bundle
// bills the person who needs five plugins for forty. A bundle is just a
// `PluginBag`, so useAll() takes only the ones wanted, and mixing them is
// first-wins rather than a collision:
//
//     Builder().useAll(presence).useAll(strings).for<User>()
//
// Membership was chosen from how often each plugin is actually used across
// this repository, most-used first.
//
// What a bundle costs in bytes is measured by the size budget. A preset trades
// bytes for convenience, so the price should be measured rather than asserted.
// ===========================================================================
import { requiredPlugin } from "../plugins/required";
import { optionalPlugin } from "../plugins/optional";
import { nullablePlugin } from "../plugins/nullable";

import { stringMinPlugin } from "../plugins/string-min";
import { stringMaxPlugin } from "../plugins/string-max";
import { stringPatternPlugin } from "../plugins/string-pattern";
import { stringEmailPlugin } from "../plugins/string-email";

import { numberMinPlugin } from "../plugins/number-min";
import { numberMaxPlugin } from "../plugins/number-max";
import { numberIntegerPlugin } from "../plugins/number-integer";

import { arrayMinLengthPlugin } from "../plugins/array-min-length";
import { arrayMaxLengthPlugin } from "../plugins/array-max-length";
import { arrayEachPlugin } from "../plugins/array-each";

/**
 * Present, absent, null. Nearly every declaration uses one of the three.
 */
export const presence = Object.freeze({
  required: requiredPlugin,
  optional: optionalPlugin,
  nullable: nullablePlugin,
});

/** The everyday string checks. */
export const strings = Object.freeze({
  stringMin: stringMinPlugin,
  stringMax: stringMaxPlugin,
  stringPattern: stringPatternPlugin,
  stringEmail: stringEmailPlugin,
});

/** The everyday number checks. */
export const numbers = Object.freeze({
  numberMin: numberMinPlugin,
  numberMax: numberMaxPlugin,
  numberInteger: numberIntegerPlugin,
});

/** The everyday array checks. Per-element rules ride on arrayEach. */
export const arrays = Object.freeze({
  arrayMinLength: arrayMinLengthPlugin,
  arrayMaxLength: arrayMaxLengthPlugin,
  arrayEach: arrayEachPlugin,
});

/**
 * The four bundles above, together.
 *
 * Not called "common", because that name says nothing — and lint bans it. It
 * holds presence plus the everyday string, number and array checks, and the
 * name is the claim that this is the range people write day to day.
 *
 * Still not everything. For everything there is the `@maroonedog/luq/plugins`
 * barrel, which costs accordingly.
 */
export const everydayRules = Object.freeze({
  ...presence,
  ...strings,
  ...numbers,
  ...arrays,
});
