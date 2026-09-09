# Security

## Reporting a vulnerability

Open a [private security advisory](https://github.com/maroonedog/luq/security/advisories/new)
rather than a public issue. If GitHub advisories are not available to you, email
the address on the npm package page.

There is one maintainer, so there is no on-call rotation to promise. What is
promised: an acknowledgement within a week, and a public advisory once a fix
ships, whether or not the report turns out to be exploitable.

## What this package is, from a security point of view

**No runtime dependencies.** `npm pack` ships `dist/`, the LICENSE, the README
and `package.json` — nothing else, and nothing it pulls in. The `dependencies`
field is empty and a test asserts it stays that way.

**No dynamic code.** `eval` and `new Function` appear nowhere in the published
artifact. `npm run check:no-dynamic-code` scans every emitted `.js` and `.mjs`
on every build and an empty scan is a failure, not a pass. This is the property
that lets a validator run under a strict Content-Security-Policy — including one
whose JSON Schema arrives at run time, where a code-generating validator has to
build a function in the browser and cannot.

**Prototype pollution.** A declared path may contain `__proto__`, and writing
one does not reach `Object.prototype`. The writer uses `Object.defineProperty`,
which creates an own property, rather than assignment, which would run the
inherited setter. `test/unit/path/prototype-pollution.test.ts` proves both
halves — that the key is declarable, and that `Object.prototype` is clean
afterwards — and reverting the write to an assignment makes it fail.

**No network.** Nothing in this package opens a socket. External `$ref` in a
JSON Schema is resolved against a map of documents the caller supplies
(`jsonSchemaFullFeature(document, { externalDocuments })`); a URI written inside
a schema can never cause a fetch. That is a deliberate refusal, not a missing
feature — it is what keeps a hostile schema from turning into an SSRF.

**Regular expressions.** `pattern` and the `format` keywords compile the
schema's own expressions. A schema you do not control can therefore contain a
pathological expression, and Luq does not analyse it for catastrophic
backtracking. If you validate against schemas from untrusted sources, treat the
regular expressions in them as you would any other untrusted input.

## Supported versions

| Version | Supported |
|---|---|
| 2.x | Yes |
| 1.x, 0.1.x | No — a different implementation, unmaintained |
