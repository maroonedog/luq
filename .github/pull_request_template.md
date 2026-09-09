<!--
Written in English so the diff and the discussion around it read the same way
to everyone. Delete any section that genuinely does not apply, and say why
rather than leaving it blank — an empty section reads as "not considered".
-->

## Summary

<!-- What this changes, and why, in two or three sentences. Lead with the
problem, not the patch: a reviewer who knows nothing about the branch should be
able to decide whether the change is worth making before reading the diff. -->

## Changes

<!-- What actually moved, grouped so a reviewer can follow the diff. Name the
files or the areas. Call out anything that is load-bearing but easy to miss:
a changed default, a removed guard, a widened type. -->

-

## Verification

<!-- How you know. `npm run verify` is the same command CI runs; a green tree is
the floor, not the evidence. If the change is about behaviour, say which test
would fail without it. If it is about performance, say what was measured, with
what, and how many times — a single run of a benchmark is not a measurement. -->

- [ ] `npm run verify` passes locally
- [ ] New behaviour is covered by a test that fails without the change
- [ ] Existing tests were updated rather than deleted where behaviour moved,
      and the commit message says what changed and why
- [ ] Performance claims, if any, come from repeated interleaved runs and name
      the shape they were measured on

## Documentation

<!-- Figures published in README.md and docs-site/ are generated from
config/*.json. If a measurement moved, regenerate rather than hand-edit —
`npm run generate:perf-figures` — or `check:perf-figures` will fail. -->

- [ ] README and `docs/` reflect the change, including any example that is now
      written the old way
- [ ] Generated figures were regenerated, not hand-edited
- [ ] Public API changes are described in `docs/migration/` if they affect an
      existing caller

## Compatibility

<!-- Anything a consumer or a plugin author could observe. "None" is a fine
answer; a missing answer is not. Breaking changes belong in a major — see
docs/RELEASING.md. -->

- [ ] No breaking change, or the change is targeted at a major release
- [ ] Bundle size stays within `config/size-budget.json`, or the ceiling was
      raised with the reason recorded in that file
