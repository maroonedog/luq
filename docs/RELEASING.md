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
3. give the top entry in `CHANGELOG.md` its number and its date. The entry is
   written as the work lands, under a heading that says **not yet released**;
   this step is only the two edits that turn it into a released one. Nothing
   checks that the heading and `package.json` agree, so it is easy to skip and
   worth doing before the commit rather than after the tag. What an entry is
   for is below.
4. `npm run generate` — regenerates the manifest, barrel, exports and lock
5. commit, PR to `develop`, merge; PR `develop` → `master`, merge
   (**check `baseRefName` before merging**; a PR was once merged to the wrong
   base because nobody looked)
6. tag on `master`: `git tag -a vX.Y.Z -m "vX.Y.Z" && git push origin vX.Y.Z`
7. **that is the last manual step.** The tag starts `.github/workflows/publish.yml`,
   which publishes to npm. Nothing is typed, and there is no OTP.
8. the push to `master` deploys the docs site through `deploy-docs.yml`; confirm
   the run went green
9. paste the `CHANGELOG.md` entry into the GitHub release for the tag. The
   entry is the source and the release page is a copy of it. It used to be the
   other way round, which is how the version history came to exist only on
   github.com.

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

## The changelog

`CHANGELOG.md` is the version history. Before it existed, the only record of
what a release contained was its GitHub release page — readable in exactly one
place, not readable at a tag, and not diffable.

An entry is written **when the work lands**, not at release time, under a
heading that says *not yet released*. Writing them all at the tag turns the
question into "what went into the last eleven merges", which is how a changelog
becomes a list of commit subjects.

What an entry says is what a **caller** sees change. Which file moved is in the
commit. The shape is [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) —
Added / Changed / Deprecated / Removed / Fixed / Security — newest first.

**It does not ship to npm, and that is deliberate.** `files` is `["dist"]`, and
npm adds only `README.md`, `LICENSE` and `package.json` to that; `npm pack
--dry-run` lists those three and nothing else at the root. So a *relative* link
to it from `README.md` would be dead in `node_modules`, and
`check:readme-links` refuses one — the link in the README is absolute for the
same reason the CONTRIBUTING and SECURITY links are.

**Nothing gates it.** No check compares the top heading to `package.json`, and
none will notice a release that added no entry. It is a manual step, which is
why it is numbered in the sequence above rather than described as a habit.

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

## The second package: @maroonedog/luq-codegen

`luq-codegen/` publishes separately, on its own version and its own tag.

| | Library | Generator |
|---|---|---|
| Package | `@maroonedog/luq` | `@maroonedog/luq-codegen` |
| Tag | `v2.4.0` | `codegen-v0.1.0` |
| Workflow | `publish.yml` | `publish-codegen.yml` |

Two tag patterns, because the two version independently: a single `v*` pattern
would mean both, and pushing one tag would publish a generator whose version
nobody chose. Two workflow files, because npm registers a trusted publisher per
package **and per workflow filename**, so one file cannot be registered for
both.

**Order is not optional.** The generator's `peerDependencies` names
`@maroonedog/luq` at or above the release that carries `./schema-tooling`.
Until that version is on npm, installing the generator fails with `ETARGET` for
anyone. Nothing local catches it: every install in this repository resolves the
library over a `file:` link, and npm does not enforce a peer range across one.
So the library goes first, always.

Its own one-time npm setup is the same five steps as above, against the
`@maroonedog/luq-codegen` package and the workflow filename
`publish-codegen.yml`.

**The first publish of a package npm has never seen cannot use trusted
publishing**, because the settings page a publisher is registered on belongs to
a package that does not exist yet. It has to be bootstrapped by hand once:

```bash
cd luq-codegen && npm publish
```

That works because the generator asks for provenance in the **workflow**
(`npm publish --provenance`) rather than in `publishConfig`, which is where the
library asks for it. The difference is deliberate and was learned the hard way:
provenance is generated from a CI provider's OIDC identity, so `publishConfig`
provenance makes `npm publish` refuse to run anywhere else at all —

```
npm ERR! code EUSAGE
npm ERR! Automatic provenance generation not supported for provider: null
```

— and `--no-provenance` does not get past it, because `publishConfig` wins over
the flag. A package that must be bootstrapped by hand once therefore cannot
carry provenance in `publishConfig`, or the bootstrap requires editing
package.json to get through it.

The bootstrap release ships without provenance. Every release after it goes
through the workflow and carries it.

Then register the trusted publisher against the package that now exists, and
the workflow has every release after this one.

## What CI covers

Eight workflow files. Four of them gate, and are the table below; `publish.yml`
and `publish-codegen.yml` are the two above; `deploy-docs.yml` publishes the
site from `master` and gates nothing; `megamorphism.yml` measures how throughput
moves when many validators are alive, and gates on nothing because there is
nothing deterministic there to gate on — it records a rate, uploads it, and on
`master` proposes it as a pull request for a person to read.

Each of the four watches what it can actually be affected by. `push` is
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

## The branch rules

Both branches are governed by repository **rulesets**, not by the older branch
protection API. `gh api repos/maroonedog/luq/branches/develop/protection`
answers `404 Branch not protected`, which says nothing about whether rules
exist; `gh api repos/maroonedog/luq/rulesets` is the one that answers.

**`DevelopBranchRule`** — `refs/heads/develop`, enforcement active:

- deletion blocked
- non-fast-forward blocked, so no force-push
- **`verify` is a required status check, and the only one.** A required check
  that a path filter skips stays pending forever and blocks every pull request
  that does not touch its paths, which is why the three filtered workflows are
  not on this list.
- `strict_required_status_checks_policy` is off, so a branch does not have to
  be up to date with `develop` before it merges.

**`ProtectedBranchRule`** — the default branch, `master`, enforcement active:

- deletion and non-fast-forward blocked
- a pull request is required, with **one approving review** and **code-owner
  review** — `.github/CODEOWNERS` is `* @maroonedog`
- stale reviews are dismissed on push, and the last push must itself be
  approved
- merge, squash and rebase are all allowed
- no required status check of its own. `develop` is where `verify` is
  mandatory, and `master` receives only what has already been through it.

Both rulesets grant **bypass to the admin role, always**. That is not an
oversight: it is what makes step 5 possible in a repository with one
maintainer, who cannot obtain the approving review `ProtectedBranchRule` asks
for. It also means neither ruleset constrains the person releasing.

## Known weaknesses in this process

**The version number is chosen by hand.** Nothing derives it from what actually
changed, so "this was a breaking change and went out as a minor" is a mistake
this process can still make. changesets would fix it and is not set up.

**One person can release.** There is one maintainer, so the tag that starts a
publish is pushed by one person and reviewed by nobody. `ProtectedBranchRule`
asks `master` for an approving review and a code-owner review, and the same
person holds the admin bypass that satisfies both — so the rule records the
intent rather than enforcing it. The workflow's two checks catch a wrong
version, not a wrong decision.

**Nothing keeps `CHANGELOG.md` honest.** Step 3 is manual and ungated: a
release that forgot it is indistinguishable from one that had nothing to say.

Listed rather than left implicit, because "how does this get released" is a
question a person deciding whether to depend on a package is entitled to ask.

Two weaknesses that used to be on this list are gone. Publishing is no longer
typed by a human with a 2FA code, and the tarball now carries a **provenance
attestation** — npm records which commit and which workflow run built it, and a
consumer can verify that.
