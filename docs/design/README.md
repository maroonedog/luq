# The design of this implementation (settled)

**Strategy**: a marker-typed descriptor pipeline — one path grammar, one plugin contract, one collector, one compile step, one branch-free engine

**Strategy in one line**: one path grammar, one plugin contract, one collector, one compile step, one branch-free engine.

| Document | Contents |
|---|---|
| [core-types.md](core-types.md) | The core type specification, verified by actually compiling it |
| [build-order.md](build-order.md) | The order of implementation, and how each step is verified |
| [modules.md](modules.md) | Every module, its single responsibility and its estimated size |
| [test-strategy.md](test-strategy.md) | Where tests live, how type tests are written, and the tooling |
| [how-any-is-avoided.md](how-any-is-avoided.md) | How the types are made to work without `any` |
| [verification.md](verification.md) | The blockers that were resolved and the risks that remain |

The inherited specification is in [../legacy-spec/](../legacy-spec/); the published surface is in [../legacy-public-surface.md](../legacy-public-surface.md).
