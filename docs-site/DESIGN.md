# Luq docs-site — Material Design 3

This is the authoring guide for the site's design system. **Read it before writing
a page.** If a page needs a colour, a radius, a shadow, a duration or a font size,
it comes from here — not from a hex code, not from a Tailwind default.

---

## Where things live

| File | What it is |
| --- | --- |
| `scripts/generate-md3-tokens.mjs` | Generator. Measures the brand seed from the logo, builds the MD3 tonal palettes, audits contrast, writes the two files below. |
| `src/styles/md3-tokens.css` | **Generated — do not hand-edit.** Colour roles, tonal palettes, shape, elevation, state, motion and type tokens, for both schemes. |
| `src/styles/md3-palette.json` | **Generated.** Palette tones, read by `tailwind.config.mjs`. |
| `src/styles/md3-components.css` | Hand-written MD3 component classes (`.md-*`). Plain CSS, no `@apply`. |
| `src/styles/global.css` | Font choice, base element styling, and the legacy `.luq-*` bridge. |
| `tailwind.config.mjs` | Exposes every token as a Tailwind utility. |

To change the theme, edit the generator and re-run it — never the CSS:

```bash
cd docs-site
npm i --no-save @material/material-color-utilities@0.4.0
node scripts/generate-md3-tokens.mjs
```

It prints the measured contrast and exits non-zero if any pair falls below WCAG AA.

---

## Colour

MD3 stores colour as **roles**, not as a palette. Never write `bg-purple-600`.
Pick the role that describes what the element *is*, and its `on-` partner for
anything drawn on top. The pairs are contrast-checked; mixing across pairs is not.

### The rule that matters

> Whenever you set a background, set the matching `on-` foreground.
> `bg-primary` → `text-on-primary`. `bg-surface-container` → `text-on-surface`.

### Available roles (Tailwind class ↔ CSS variable)

| Tailwind | Variable | Use for |
| --- | --- | --- |
| `primary` / `on-primary` | `--md-sys-color-primary` | The one high-emphasis action per view: filled buttons, active indicators. |
| `primary-container` / `on-primary-container` | … | A calmer primary surface: the docs FAB, callouts you want tied to the brand. |
| `secondary` / `on-secondary` | … | Focus rings. Rarely a fill. |
| `secondary-container` / `on-secondary-container` | … | **Selection state.** Active nav item, selected chip, active TOC entry. |
| `tertiary` / `on-tertiary` | … | The teal accent. Contrast against primary — the plugin card's method badge. |
| `tertiary-container` / `on-tertiary-container` | … | Tertiary equivalent of the above. |
| `error` / `on-error`, `error-container` / `on-error-container` | … | Failures, invalid examples, "this does not compile". |
| `surface` / `on-surface` | … | The page itself. `body` already sets both. |
| `on-surface-variant` | … | De-emphasised text: supporting copy, captions, inactive nav labels. |
| `surface-container-lowest` … `-highest` | … | Five stacked container tones. Higher = more prominent, no shadow needed. |
| `surface-dim`, `surface-bright` | … | Rarely needed. |
| `outline` | … | Borders that must be seen (outlined button, chip). |
| `outline-variant` | … | Dividers and decorative borders. |
| `inverse-surface` / `inverse-on-surface` | … | Snackbars, tooltips. |
| `scrim` | … | Modal backdrops, at 32%: `bg-scrim/[0.32]` (or use `.md-scrim`). |

Opacity modifiers work: `bg-on-surface/8` is a hover state layer, and
`text-on-surface/38` is the MD3 disabled foreground.

### Picking a container tone

Nesting containers goes **lowest → highest** as you go deeper, or use elevation
for the top layer. Do not stack shadows to express hierarchy inside a page.

| Depth | Class |
| --- | --- |
| Page | `bg-surface` (already on `body`) |
| A section band that should read as separate | `bg-surface-container` |
| A card on that band | `bg-surface-container-high` or `.md-card-outlined` |
| A code chip or inline token inside a card | `bg-surface-container-highest` |

### Dark mode

`darkMode: 'class'`; the `.dark` class is set on `<html>` before first paint by
`BaseLayout.astro`. **Do not write `dark:` variants for colour.** Every role
already resolves per scheme. `dark:` is only for the rare case where the *shape*
of a design must differ between schemes.

---

## Type

MD3's fifteen-step scale. Two equivalent ways to apply it:

```html
<h1 class="md-display-small">…</h1>       <!-- component class -->
<h1 class="text-display-small">…</h1>     <!-- Tailwind utility -->
```

`text-*` sets size, line-height, tracking and weight together, so do not add
`font-bold` or `leading-tight` on top — that breaks the scale.

| Role | Use for |
| --- | --- |
| `display-large/medium/small` | The hero line on a landing page. At most one per site. |
| `headline-large/medium/small` | Page title (`h1`), then major sections (`h2`, `h3`). |
| `title-large/medium/small` | Card headings, sidebar section labels, table captions. |
| `body-large` | Default prose. Already on `body`. |
| `body-medium` | Supporting copy, table cells, card descriptions. |
| `body-small` | Footnotes, captions, footer copy. |
| `label-large/medium/small` | Buttons, chips, nav items, badges — anything on a control. |

Bare `h1`–`h6` already default to the headline/title roles in `global.css`, so
plain Markdown-shaped content is correct with no classes at all.

**Typeface: Inter, not Roboto.** MD3's default is Roboto; this site stays on
Inter (self-hosted, already bundled) because switching would add a dependency
and a second webfont payload for no reader-visible gain, Inter's x-height and
default tracking are close enough to Roboto's that the MD3 metrics above
transfer unchanged, and its disambiguated `l`/`I`/`1` read better in the API
tables and inline code that make up most of this site. Roboto stays in the stack
as a fallback. Code is JetBrains Mono (`font-mono`).

---

## Shape

Seven steps. **Do not give everything the same radius** — the radius is what
tells a reader whether something is a control, a container or a dialog.

| Class | Value | Use for |
| --- | --- | --- |
| `rounded-shape-none` | 0 | Full-bleed bands, table cells. |
| `rounded-shape-xs` | 4px | Inline code, small badges, the focus ring. |
| `rounded-shape-sm` | 8px | Chips, small tonal surfaces, text-link hit areas. |
| `rounded-shape-md` | 12px | **Cards, code blocks, callouts.** The default container radius. |
| `rounded-shape-lg` | 16px | Extended FAB, the navigation drawer's trailing edge, large panels. |
| `rounded-shape-xl` | 28px | Dialogs, bottom sheets, hero panels. |
| `rounded-shape-full` | pill | **Every button, every nav item, every avatar.** |

---

## Elevation

MD3 expresses height with a shadow **and** a surface tint (primary composited
over the surface). `.md-elevation-0` … `.md-elevation-5` apply both;
`shadow-elevation-*` applies only the shadow when the element already carries
its own container tone.

| Level | Where |
| --- | --- |
| 0 | Everything, at rest. The default. |
| 1 | Elevated card, elevated button, the modal navigation drawer. |
| 2 | The top app bar **once scrolled**, a card on hover. |
| 3 | FAB, the docs "Contents" button. |
| 4–5 | Reserved. If you reach for these, use a container tone instead. |

Prefer a container tone over elevation for static hierarchy. Elevation is for
things that float *over* content.

---

## State layers

Every interactive element gets one. Add `.md-state-layer` and the element paints
`currentColor` over itself at the MD3 opacities — hover 8%, focus 10%, pressed
10%, dragged 16%. Pair it with `.md-focus-ring` for keyboard focus.

```html
<a href="/docs" class="md-nav-drawer-item md-state-layer md-focus-ring">Docs</a>
```

`.md-state-layer` requires the element to be positioned (it sets
`position: relative` itself) and inherits `border-radius`, so put it on the same
element that carries the radius.

---

## Components

| Class | MD3 component | Notes |
| --- | --- | --- |
| `.md-button` + `.md-button-filled` | Filled button | The one primary action. |
| `.md-button` + `.md-button-tonal` | Filled tonal button | Secondary action next to a filled one. |
| `.md-button` + `.md-button-elevated` | Elevated button | On a busy or coloured background. |
| `.md-button` + `.md-button-outlined` | Outlined button | Medium emphasis. |
| `.md-button` + `.md-button-text` | Text button | Lowest emphasis, in dense rows. |
| `.md-icon-button` (+ `-filled` / `-tonal` / `-outlined`) | Icon button | 40dp target; always give it an `aria-label`. |
| `.md-card` + `.md-card-elevated` | Elevated card | A card that stands alone. |
| `.md-card` + `.md-card-filled` | Filled card | A card inside an already-elevated surface. |
| `.md-card` + `.md-card-outlined` | Outlined card | **Default for grids of many cards** — elevation competes across a dense collection. |
| `.md-chip` (+ `.is-selected` / `aria-selected`) | Assist / filter chip | Interactive. |
| `.md-chip` + `.md-chip-static` | — | Non-interactive label, e.g. a plugin's slot list. |
| `.md-top-app-bar` (+ `.is-scrolled`) | Small top app bar | Already in `Header.astro`. |
| `.md-nav-drawer`, `.md-nav-drawer-modal` | Navigation drawer | Standard and modal. |
| `.md-nav-drawer-headline` | Drawer section label | `title-small` on `on-surface-variant`. |
| `.md-nav-drawer-item` (+ `-dense`, + `aria-current="page"`) | Drawer item | Active state is `secondary-container`. |
| `.md-list-item`, `-headline`, `-supporting` | List item | |
| `.md-divider`, `-inset`, `-vertical` | Divider | 1px `outline-variant`. |
| `.md-scrim` | Scrim | `scrim` at 32%. |
| `.md-code-surface`, `.md-code-toolbar` | — | Code. Use the `CodeBlock.astro` component instead of these directly. |

Buttons must be 40dp tall and pill-shaped; the classes handle it. Do not resize
them with `h-*` or `py-*`.

---

## Icons

Material Symbols Outlined, loaded once in `BaseLayout.astro`. Write the icon
name as the element's text:

```html
<span class="md-icon" aria-hidden="true">check_circle</span>
<span class="md-icon md-icon-sm" aria-hidden="true">extension</span>  <!-- 20dp -->
<span class="md-icon md-icon-filled" aria-hidden="true">star</span>   <!-- filled -->
```

Always `aria-hidden="true"` — the ligature text is not a label. If the icon is
the control's only content, put the label in `aria-label` on the control.

The font is loaded with `display=block`, so the glyph slot stays blank rather
than flashing the literal word while it loads. Do not add a second icon set.

---

## Motion

Use the MD3 easings and durations, never `ease-in-out` or a raw `300ms`.

```html
<div class="transition-colors duration-short-4 ease-standard">
<div class="transition-transform duration-medium-4 ease-emphasized-decelerate">
```

| Easing | For |
| --- | --- |
| `ease-standard` | Small state changes: colour, opacity, hover. |
| `ease-emphasized` | The default for anything the eye follows. `cubic-bezier(0.2, 0, 0, 1)` |
| `ease-emphasized-decelerate` | Elements **entering** the screen (drawer opening). |
| `ease-emphasized-accelerate` | Elements **leaving** the screen. |

Durations: `duration-short-1` (50ms) … `duration-long-4` (600ms). Short for
state, medium for transitions within a view, long for full-screen changes.

`prefers-reduced-motion: reduce` collapses every transition and animation
site-wide; nothing extra is needed per component.

---

## Layout rules that bite

1. **`<main class="flex-1">` needs no `min-w-0`** — `global.css` sets
   `main { min-width: 0 }` — but **any other flex or grid item that contains a
   code block does.** A flex/grid item defaults to `min-width: auto`, so its
   widest unbreakable child inflates the whole page. Add `min-w-0` to grid
   children on the landing page.
2. Code blocks are already immune: `.md-code-surface` sets
   `contain: inline-size`, so a long line scrolls instead of widening the page.
3. Wide tables need their own `overflow-x-auto` wrapper.
4. The top app bar is 64dp and sticky; `html` already carries
   `scroll-padding-top: 5rem` so anchored headings clear it.

---

## Accessibility

- Every `on-`/background pair in the token set is measured at generation time.
  The floor is **6.11:1 (light)** and **7.19:1 (dark)** across 20 text pairs;
  non-text pairs (`outline` on `surface`) clear 3:1. If you invent a pairing
  outside the table above, you own its contrast.
- Syntax colours in code blocks are MD3 tones measured against the code surface;
  the lowest is **6.25:1** (comments). Their ratios are recorded inline in
  `md3-tokens.css`.
- Use `.md-focus-ring` on anything focusable that is not a native control; bare
  `:focus-visible` already gets the MD3 3dp secondary ring.
- Icon-only controls need `aria-label`. Active navigation needs
  `aria-current="page"` — the drawer and app bar style from it.

---

## Migrating a page off the 1.x classes

`global.css` still defines `.luq-card`, `.luq-button-primary`, `.luq-code`,
`.luq-feature-card`, `.luq-gradient-text` and friends, re-pointed at MD3 roles
so an untouched page is not broken. **They are a bridge, not an API.** When you
rewrite a page, replace them:

| Legacy | Replacement |
| --- | --- |
| `luq-card` | `md-card md-card-outlined` |
| `luq-feature-card` | `md-card md-card-filled` |
| `luq-button luq-button-primary` | `md-button md-button-filled md-state-layer` |
| `luq-button luq-button-secondary` | `md-button md-button-tonal md-state-layer` |
| `luq-code` | the `CodeBlock.astro` component |
| `bg-luq-neutral-50 dark:bg-luq-neutral-900` | `bg-surface-container` |
| `text-luq-neutral-600 dark:text-luq-neutral-400` | `text-on-surface-variant` |
| `text-luq-purple-600 dark:text-luq-teal-400` | `text-primary` |
| `border-luq-neutral-200 dark:border-luq-neutral-800` | `border-outline-variant` |
| `rounded-lg` / `rounded-xl` on a card | `rounded-shape-md` |
| `shadow-md` / `shadow-luq` | `shadow-elevation-1` |

The `luq.*` Tailwind scales still exist and now resolve to real MD3 palette
tones, so a half-migrated page is coherent rather than two-toned.

---

## Navigation is data, not markup

- **Primary nav**: the `navItems` array exported from `src/components/Header.astro`.
  `MobileMenuOverlay.astro` renders the same array. Add a page in one place.
- **Docs tree**: the `sections` array in `src/components/DocsSidebar.astro`.
- **Footer**: `footerLinks` in `src/components/Footer.astro`.

Nothing checks these links at build time. Every `href` must be a page that
exists. The 1.x versions pointed at `/generator` (twice) and `/docs/changelog`,
neither of which was ever a page here; those entries are gone.

`DocsSidebar`'s `Reference` group links `/plugins`, `/json-schema` and
`/benchmarks`, so the three top-level reference pages are reachable from inside
the docs tree and not only from the top app bar. Its `Guides` group carries
"Porting from 1.x", which points at `/docs/api/validator#porting` rather than at
a page of its own: the 1.x-to-now mapping lives beside the API it maps onto, and
there is no separate migration page. `aria-current` is set by exact path
equality, so that anchored entry never highlights — which is correct, since the
Validator page's own entry does.

---

## Component props you will use

```astro
<CodeBlock
  code={source}
  language="typescript"   /* default */
  fileName="user.ts"      /* optional; shown in the toolbar */
  showCopy={true}         /* default; toolbar appears if any of these is set */
/>

<PluginCard plugin={{
  name: 'stringMin',                              /* camelCase subpath name */
  symbol: 'stringMinPlugin',                      /* the exported symbol */
  subpath: '@maroonedog/luq/plugins/stringMin',   /* full import specifier */
  method: 'min',            /* chain method, no parentheses */
  slots: ['string'],        /* field types the method may be used on */
  description: '…',
}} href="/plugins#stringMin" selectable={false} />

<DocsSidebar currentPath="/docs/getting-started" tableOfContents={toc} />
<OnThisPage tableOfContents={toc} />   /* toc: { id, title, level }[] */
```

`PluginCard` takes `method` and `slots`. It does **not** take `category` or
`bundleSize` — 1.x had both and neither exists in the rewrite's plugin metadata.

`symbol` and `subpath` are **required** and are not derived inside the component.
`symbol` is usually `name + "Plugin"`, but `objectAdditionalProperties` exports
`objectAdditionalPropertiesSchemaPlugin`, so deriving it would be wrong for that
one and silently wrong for any future pair. `selectable` is optional and adds the
"add to builder" checkbox and the details button; the catalogue page passes it,
a card embedded in prose does not. `src/data/plugins.ts` is generated by
`scripts/generate-plugin-data.mjs` and already emits exactly this shape.

---

## Every TypeScript block on this site is compiled

`npm run check:docs` at the repository root now covers `docs-site/src` as well
as the Markdown docs. `scripts/doc-examples/read-astro-examples.ts` reads the
`.astro` frontmatter, takes every `const xExample = ` template literal that a
`<CodeBlock>` renders with `language="typescript"` (the component's default), and
hands it to the same checker the README goes through: a scratch consumer whose
only view of the package is `package.json#exports` and `dist/*.d.ts`, compiled
under `moduleResolution: node16`. An import specifier that is not an export key
fails there, which is how `@maroonedog/luq/core` cannot come back.

This is the gate that did not exist while the 1.x site shipped `result.isValid()`
in 31 places. It is verified by mutation: rewriting a page's `result.valid` to
`result.isValid()`, swapping one plugin subpath for an unpublished one, and
making a `must-fail` block compile are each reported and each fail the build.

Three directives, written as a comment line immediately above the declaration.
All three require a reason; a directive without one is itself a violation, so
there is no silent way to switch the check off.

| Directive | Means |
|---|---|
| `// luq-example: must-fail — <reason>` | must NOT compile. Use it for every "does not compile" block, so the page's claim is checked in the direction it is made. |
| `// luq-example: skip — <reason>` | not checked. Fragments only: a caret annotation, a bare `.v(...)` line. |
| `// luq-example: with <otherConst> — <reason>` | compile this block with that block's code in front of it. The page still shows the short excerpt; the compiler sees the whole program. |

Blocks whose template literal contains a real `${…}` interpolation are computed
at build time and cannot be checked statically, so they are counted as skipped
automatically — `PluginCard`'s import line is the only one today, and
`scripts/verify-plugin-examples.mjs` compiles all 77 of its expansions instead.

Practical consequence when writing a page: a TypeScript block is expected to
stand on its own. Give it its imports and its type declaration, or point it at
the block above with `with`.

---

## Two tools that are configured but not enforced

**Prettier.** `.prettierrc.json` registers `prettier-plugin-astro`, which the
site's devDependencies carried without a config, so `prettier` could not parse a
single `.astro` file. It can now — `npx prettier --check "src/**/*.astro"` runs.
It is deliberately not a build step and not clean: the pages are hand-wrapped at
about 90 columns and Prettier at 100 rewraps their prose, and it splits a `<code>`
that sits at a line boundary into the `<code\n>text</code\n>` form, which is
uglier than what is there. Use it on a file you are already rewriting, not across
the tree.

**`@material/material-color-utilities`.** Installed with `npm i --no-save` and
therefore in no lockfile. That is on purpose: it is needed only to re-run
`scripts/generate-md3-tokens.mjs`, whose output (`md3-tokens.css`,
`md3-palette.json`) is committed, so neither the build nor a fresh `npm ci`
needs it. Re-run the install line at the top of this file before regenerating.

---

## What the build checks about the pages themselves

`npm run build` ends with `scripts/check-built-pages.mjs`, which reads the
emitted HTML in `dist/` and fails the build on three things nothing else sees.
Each one is verified by mutation — breaking the built HTML the corresponding way
makes it report and exit non-zero.

1. **Foster-parented `<code></code>`.** Writing `{'literal'}` inside a `<table>`
   makes the HTML parser hoist the expression out of the table, leaving an empty
   `<code></code>` and a blank cell. `astro check` reported 0 errors while five
   pages had this. Keep `{…}` expressions out of table markup, or wrap the
   region in `not-prose`/a plain string.
2. **1.x API inside a `<pre>`.** `result.isValid()`, `result.errors`,
   `unwrapOr`, `Result.ok`, `LuqValidationException` may appear in prose that
   says they are gone — the Validator page's porting table is exactly that — but
   never inside a code block, where they read as an instruction. The
   repository's `check:docs` compiles the TypeScript blocks; this catches the
   same mistake in a block that is not TypeScript.
3. **Dead internal links, including anchors.** Every root-relative `href` must
   resolve to a built page or a shipped asset, and a `#fragment` must match an
   `id` on the target page. This is the check the three navigation arrays never
   had. Note that it runs on the OUTPUT, so it also covers links written inside
   page prose, not only the nav data.
