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
6. **that is the last manual step.** The tag starts `.github/workflows/publish.yml`,
   which publishes to npm. Nothing is typed, and there is no OTP.
7. the push to `master` deploys the docs site; confirm the run went green

The publish workflow refuses to run before it has checked two things, because
both are mistakes only the person who pushed the tag can undo:

- the tag and `version` in `package.json` say the same thing. Otherwise a tag
  reading `v2.2.0` puts some other version on npm.
- that version is not already on npm. npm versions are immutable, so a second
  publish of the same number cannot succeed — better to say so in five seconds
  than after a five-minute `verify`.

`npm publish` runs `prepublishOnly`, which is `npm run verify`. The workflow
does **not** also call verify itself; calling it twice is the same waste the
competitors job used to carry.

`access` and `provenance` live in `publishConfig` in `package.json` rather
than as CLI flags, so a publish typed by hand gets the same treatment as one
run by CI.

## One-time npm setup (trusted publishing)

The workflow authenticates with OIDC — npm's **trusted publishing** — so there
is no token in this repository's secrets and no 2FA prompt. Nothing is stored,
so nothing can leak. It has to be told once, on npmjs.com, that this workflow is
allowed to publish:

1. npmjs.com → the `@maroonedog/luq` package → **Settings** → **Trusted publisher**
2. Publisher: **GitHub Actions**
3. Organization or user: `maroonedog`, Repository: `luq`
4. Workflow filename: `publish.yml`
5. Environment: `npm` (the workflow declares this; leaving it blank here while
   the workflow declares one will not match)

Until that exists the workflow fails at the publish step with npm's own error,
and **nothing is published** — a failed release, not a wrong one.

The same is true of every earlier step. The first run of this workflow, on the
`v2.2.0` tag, failed while upgrading npm: `npm@latest` had moved to a major
that requires a newer Node than the runner has. Nothing reached npm, the tag
stayed where it was, and the fix was to pin npm rather than to undo anything.
That is the shape a release failure should have.

**To retry a tag that failed**, do not delete and re-push it. Run the workflow
by hand from `master` — Actions → publish → Run workflow — and give it the tag
name. `workflow_dispatch` takes the *workflow definition* from the branch you
run it on and the *code* from the tag you name, so a fixed workflow can publish
an unchanged tag.

If trusted publishing is ever unavailable, the fallback is an automation token
(`NPM_TOKEN` secret, and `registry-url` on `setup-node`). It works, and it is
worse: it is a long-lived credential that publishes as you, stored in a place
that is not npm.

## What CI covers

Four workflows, each watching what it can actually be affected by. `push` is
subscribed on `master` and `develop` only; work in progress is seen through
`pull_request`. Subscribing to both for every branch ran the whole set twice
per commit.

| workflow | what it watches | what it gates on |
|---|---|---|
| `verify` | everything — no path filter | any difference, on any machine |
| `bench` | `src/`, `bench/`, the recorded floors | the throughput RATIO, never an absolute |
| `docs` | `docs-site/` and what it reads | the site building at all |
| `competitors` | `src/`, `bench/competitors/`, `package-lock.json` | agreement only; speed is recorded |

`verify` has no path filter on purpose. A one-line README change makes
`check:doc-examples` recompile that example, and touching `config/*.json` makes
`check:perf-figures` compare the published figures against it. "I did not touch
the code" is not a safe assumption here, by design.

`competitors` watches `package-lock.json` because that is where a competitor's
version moves — if zod changes how strict its email check is, the agreement
count changes and this is what notices.

If required status checks are ever configured, make **`verify` the only one**.
A required check that a path filter skips stays pending forever, and blocks
every pull request that does not touch its paths.

## Known weaknesses in this process

**The version number is chosen by hand.** Nothing derives it from what actually
changed, so "this was a breaking change and went out as a minor" is a mistake
this process can still make. changesets would fix it and is not set up.

**One person can release.** There is one maintainer, so the tag that starts a
publish is pushed by one person and reviewed by nobody. The workflow's two
checks catch a wrong version, not a wrong decision.

Listed rather than left implicit, because "how does this get released" is a
question a person deciding whether to depend on a package is entitled to ask.

Two weaknesses that used to be on this list are gone. Publishing is no longer
typed by a human with a 2FA code, and the tarball now carries a **provenance
attestation** — npm records which commit and which workflow run built it, and a
consumer can verify that.
