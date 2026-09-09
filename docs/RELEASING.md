# Releasing

Everything in this file is what actually happens, not what should. Where a step
is manual, it says so, because a manual step is a thing that can stop happening.

## Before anything

```bash
npm run verify
```

Five minutes, and it is the same command CI runs. `prepublishOnly` runs it again
at publish time, so a red tree cannot reach npm by accident.

## Version numbers

**SemVer, and the major is cheap.** A breaking change is a major, not a
`2.x` with a note. There is no plan to avoid majors by making the API vague.

**2.0.0 stays published.** There was a temptation to re-tag it as an alpha to
signal "still young". Doing so would be worse than useless: `2.0.0-alpha.1`
sorts *below* `2.0.0`, so nobody on `^2.0.0` would receive it, and a release
history that goes forward and then back reads as a retraction. If the API needs
to move, that is what `3.0.0` is for. What "still young" actually deserves is a
sentence in the README, which is where it is.

**Experimental work goes to the `next` tag,** not into `latest` behind a flag:

```bash
npm publish --tag next     # e.g. 3.0.0-alpha.1
```

`latest` keeps pointing at the stable line while the next one is built in the
open.

## Deprecation policy

1. Breaking changes happen in a major, and only there.
2. An API being removed is deprecated one major ahead, and says what to use.
3. Each major ships with whatever codemod is needed to cross it.

Written down because 2.x was a full rewrite. The promise that matters after a
rewrite is the one about the next one.

## Steps

1. `npm run verify`
2. bump `version` in `package.json` — the docs site reads it from there, so
   nothing else needs editing
3. `npm run generate` — regenerates the manifest, barrel, exports and lock
4. commit, PR to `develop`, merge; PR `develop` → `master`, merge
   (**check `baseRefName` before merging**; a PR was once merged to the wrong
   base because nobody looked)
5. tag on `master`: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
6. `npm publish --access public --tag latest` — **manual**, and needs an OTP
7. confirm: `npm view @maroonedog/luq version`
8. the push to `master` deploys the docs site; confirm the run went green

## What CI covers

Four jobs on every push and every pull request: `verify` (the command above),
`bench` (the throughput ratio gate), `docs` (the site build), and
`competitors` (zod / valibot / ajv / yup — agreement gated, speed recorded and
uploaded as an artifact). The competitor numbers from a neutral runner are
therefore available for every commit, not only the ones measured on the author's
machine.

## Known weaknesses in this process

**Publishing is manual.** Steps 6 and 7 are typed by a human with a 2FA code.
That is a single point of failure and it is not yet automated; changesets plus
npm provenance would fix it and neither is set up.

**No provenance attestation.** The published tarball is not signed, so a
consumer cannot verify it was built from this repository by CI.

Both are listed rather than left implicit, because "how does this get released"
is a question a person deciding whether to depend on a package is entitled to
ask.
