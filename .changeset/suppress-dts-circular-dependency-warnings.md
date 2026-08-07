---
'@sanity/tsdown-config': minor
---

Suppress `CIRCULAR_DEPENDENCY` warnings from the declaration bundling pass by default, and add a `suppressWarnings` option.

`defineConfig` enables Rolldown's `checks.circularDependency`, which also reports cycles between the emitted `.d.ts` modules. Those imports are type-only and erased at runtime, so the cycles carry none of the hazards the check exists to surface, and they're unavoidable for mutually referencing public types — in [sanity-io/sanity#13753](https://github.com/sanity-io/sanity/pull/13753) 109 of 136 cycle warnings were declaration-only, drowning out the 27 real ones. The config now sets tsdown's `suppressWarnings` to drop warnings whose **entire** cycle consists of declaration files (`.d.ts`/`.d.mts`/`.d.cts`); a cycle that includes even one runtime module still warns. Consumers that filtered these out themselves (like `@repo/tsdown.config` in `sanity-io/sanity`) can drop their own predicate.

The new `suppressWarnings` option takes tsdown's own value shapes (strings matched with `includes`, regular expressions matched with `test`, or a predicate) and is OR'd with the built-in suppression, so per-package suppressions can't silently undo it. Merging `suppressWarnings` over the returned config still replaces the default entirely (`mergeConfig` replaces functions), which is the escape hatch for restoring every warning: `mergeConfig(await defineConfig(), {suppressWarnings: () => false})`.

tsdown added `suppressWarnings` in `0.22.7`, so the `tsdown` peer range is raised from `^0.22.5` to `^0.22.7`. On `0.22.5`/`0.22.6` the option is silently ignored (the cycle warnings keep appearing) and the `UserConfig['suppressWarnings']` indexed access in the published declarations does not resolve.
