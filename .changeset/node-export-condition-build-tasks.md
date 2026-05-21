---
"@sanity/pkg-utils": minor
---

feat: schedule JS build tasks for `node` export sub-conditions

Exports with a `node` sub-condition (`exports['.'].node.import` / `.require`) now generate JS build tasks under `runtime: 'node'` using `target.node`, symmetric to how `browser` sub-conditions are already handled. Previously these outputs only got `.d.ts` files emitted while the JS was never built, leaving the declared output paths dangling. Isomorphic packages can now ship a node-specific entry without relaxing the package-wide browserslist.
