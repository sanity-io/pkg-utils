# @sanity/vanilla-extract-rolldown-plugin

A [rolldown](https://rolldown.rs) plugin for [vanilla-extract](https://vanilla-extract.style),
built for bundling libraries that ship pre-extracted CSS. Unlike
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
it doesn't declare `rollup` as a peer dependency, so it doesn't pull a second bundler into
rolldown projects. It also declares
[plugin hook filters](https://rolldown.rs/apis/plugin-api#plugin-hook-filters), so rolldown skips
the Rust ↔ JS roundtrip for modules that aren't vanilla-extract related
([vanilla-extract#1641](https://github.com/vanilla-extract-css/vanilla-extract/issues/1641)).
Head-to-head numbers against the official Rollup pipeline (across minify/target variants) live in
the [vanilla-extract benchmarks](https://github.com/sanity-io/pkg-utils/tree/main/benchmarks/vanilla-extract#latest-results).

The plugin compiles all `.css.ts` modules and extracts their CSS into a single file (`bundle.css`
by default), optionally lowered and minified with [lightningcss](https://lightningcss.dev),
following the same architecture (and option vocabulary and defaults) as
[`@tsdown/css`](https://tsdown.dev/options/css).

Two independent options control what happens to the extracted CSS, both disabled by default like
`css.inject` in `@tsdown/css`:

- **`inject`** prepends an import of the CSS to every entry chunk that uses vanilla-extract styles,
  through rolldown's native magic-string, so sourcemaps stay intact.
- **`exports`** publishes the CSS as the `"./bundle.css"` export subpath of the package. Any
  injected import then uses the self-referential `"<pkg>/bundle.css"` bare specifier instead of a
  relative path.

`exports: true` declares a plain `"./bundle.css": "./dist/bundle.css"` export, which is enough for
packages that only ever run in browsers or bundlers. `exports: {nodeCompat: true}` declares a
conditional export instead, and emits a no-op `bundle-css.js` shim (plus `bundle-css.d.ts` for the
export's `types` condition) for its `node`/`default` conditions to point at, so the subpath stays
resolvable in runtimes that cannot import `.css` files. The shim is named with a hyphen
(`bundle-css.js`) rather than a `.css.js` suffix so it does not match vanilla-extract's
`cssFileFilter`.

Writing the export to `package.json` is the host tool's job — with tsdown,
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme)
maintains it automatically.

> [!NOTE]
> `inject: {nodeCompat: true}` is deprecated. It means `{inject: true, exports: {nodeCompat: true}}`
> and still works, with a warning: `nodeCompat` configures how the CSS file is published, not how
> the import is injected, so it moved to `exports`.

## Usage

```sh
pnpm add --save-dev @sanity/vanilla-extract-rolldown-plugin @vanilla-extract/css
```

```ts
// rolldown.config.ts
import {vanillaExtractPlugin} from '@sanity/vanilla-extract-rolldown-plugin'
import {defineConfig} from 'rolldown'

export default defineConfig({
  input: 'src/index.ts',
  plugins: [vanillaExtractPlugin()],
})
```

If you're bundling with [tsdown](https://tsdown.dev), prefer
[`@sanity/vanilla-extract-tsdown-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-tsdown-plugin#readme):
it wraps this plugin with tsdown's config hooks, defaulting the CSS syntax lowering `target` to
tsdown's top-level `target` and writing the conditional `"./bundle.css"` export to `package.json`
through tsdown's [`exports` feature](https://tsdown.dev/options/package-exports). With
[`@sanity/tsdown-config`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/tsdown-config#vanilla-extract),
its `vanillaExtract` option wires all of that up with the defaults most Sanity libraries want.

The extract model is for library builds: from Vite it only makes sense in build-only library
setups (`build.rolldownOptions.plugins`), not as an application plugin — Vite's dev server never
runs the output-phase hooks the extraction relies on. For Vite 8 apps, use
[`@sanity/vanilla-extract-vite-plugin`](https://github.com/sanity-io/pkg-utils/tree/main/packages/@sanity/vanilla-extract-vite-plugin#readme),
which feeds the CSS through Vite's own pipeline (with HMR and SSR support) instead.

## Options

The options are modeled after the [`css` options of `@tsdown/css`](https://tsdown.dev/options/css),
so they feel familiar in a rolldown-based toolchain:

```ts
vanillaExtractPlugin({
  /**
   * Formatting of identifiers (class names, keyframes, CSS vars, etc).
   * @defaultValue 'short'
   */
  identifiers: 'short',
  /**
   * Name of the emitted CSS file, like `css.fileName` (which defaults to 'style.css').
   * @defaultValue 'bundle.css'
   */
  fileName: 'bundle.css',
  /**
   * Minify the extracted CSS with lightningcss, matching `css.minify`.
   * @defaultValue false
   */
  minify: false,
  /**
   * CSS syntax lowering target, in esbuild-style strings like `css.target`. Matching
   * `@tsdown/css`, lowering is skipped when no target is configured, or when the targets
   * don't include any browsers (e.g. `'node20'`, which speaks to the JS runtime, not the
   * browsers the CSS runs in). Set to `false` to disable lowering explicitly.
   * (`@sanity/tsdown-config` layers a `@sanity/browserslist-config` default on top for
   * browserless targets, through `lightningcss.targets`.)
   */
  target: 'chrome90',
  /**
   * Options passed through to lightningcss's `transform()`, like `css.lightningcss`.
   * `lightningcss.targets` takes precedence over the esbuild-style `target`, while the
   * plugin-managed fields (`minify`, `cssModules`) win over their lightningcss counterparts.
   */
  lightningcss: {errorRecovery: true},
  /**
   * Inject an import of the extracted CSS into the JS output, like `css.inject` (and matching
   * its default of `false`). The specifier is relative unless `exports` publishes the CSS,
   * in which case it is the self-referential `import "<pkg>/<fileName>"`.
   * @defaultValue false
   */
  inject: true,
  /**
   * Publish the CSS as the `"./<fileName>"` export subpath. `true` declares a plain string
   * export; `{nodeCompat: true}` declares a conditional export and emits the no-op JS shim
   * plus its `.d.ts`, so the subpath also resolves in runtimes that cannot load `.css`.
   * @defaultValue false
   */
  exports: {nodeCompat: true},
  /**
   * How `.css.ts` modules are compiled: one child compilation per module (like the upstream
   * plugins), or every module under `roots` compiled, evaluated and rendered once as a whole
   * program. See below.
   * @defaultValue 'per-module'
   */
  compilation: 'whole-program',
  /**
   * The directories scanned for `.css.ts` modules in whole-program mode, relative to the
   * working directory. `node_modules`, `dist` and `.git` are skipped.
   * @defaultValue the directories of the build's input entries
   */
  roots: ['src'],
  /**
   * Render the declarations of `style()` rules as shared single-declaration classes. See
   * below. `{report: true}` logs a summary of the pass at the end of the build.
   * @defaultValue false
   */
  atomic: {report: true},
})
```

CSS sourcemaps are not emitted, matching `@tsdown/css` — which
[intentionally skips them](https://github.com/rolldown/tsdown/issues/472#issuecomment-4017224099)
on the grounds that Vite's build mode doesn't support CSS sourcemaps either
([vitejs/vite#2830](https://github.com/vitejs/vite/issues/2830)).

## Whole-program compilation

By default every `.css.ts` module is bundled with its dependency graph, evaluated and rendered on
its own as the bundler reaches it — the model of `@vanilla-extract/rollup-plugin`. Shared modules
(themes, tokens) are compiled once per importer, and the CSS is concatenated in module order.

`compilation: 'whole-program'` discovers every `.css.ts` module under `roots` up front (at
`buildStart`), bundles them into **one** child compilation through a synthetic entry that
re-exports each module as a namespace (rolldown's scope hoisting deconflicts colliding bindings,
shared modules are compiled and evaluated once), evaluates it with one adapter and renders one
stylesheet, routed into `bundle.css` through a single virtual module. Each module's JS is still
serialized from its own exports, so class names, exports, tree-shaking and recipes' serialized
imports are identical to per-module compilation. What changes is the CSS order:

- modules render in dependency order (a module's `.css.ts` dependencies before it), then
  discovery order (sorted paths) — the same order `@sanity/vanilla-extract-vite-plugin`
  produces in its whole-program mode, so `vite dev` and the library build agree;
- `@font-face`, `@property`, `@keyframes` and `@layer` declarations are hoisted once;
- every conditional block (`@media`, `@supports`, `@container`, `@layer`, `@scope`,
  `@starting-style`) follows every unconditional rule, so a later module's base rule can no
  longer beat an earlier module's media rule.

Modules the bundler reaches outside `roots` fall back to per-module compilation with a
warning; discovered modules the build never imports are reported at the end of the build (their
CSS is still part of the stylesheet — keep `roots` to source directories). The program is
memoized across a host's per-format builds and recompiled when a watched file changes.

## Atomic classes

`atomic: true` renders every declaration of a `style()` rule whose selector targets the style's
own class once (`.a`, `.a:hover`, `.a.a`, `.parent .a`) as a single-declaration class, and
expands the exported class list with those classes — identity class first, the same classlist
shape as vanilla-extract's own style composition (`style([base, {…}])` → `'base primary'`):

```ts
export const a = style({display: 'block', padding: 0}) // 'a1 display_block__… padding_0__…'
export const b = style({display: 'inline', padding: 0}) // 'b1 display_inline__… padding_0__…'
```

```css
.display_block__… {
  display: block;
}
.padding_0__… {
  padding: 0;
} /* shared by a and b */
.display_inline__… {
  display: inline;
}
```

Because the identity class stays (first) in every class list, `${a} &` selectors in other
modules, `globalStyle(`${a} svg`)` and recipes' `classNames.base` keep working, and debug
identifiers stay visible in the DOM. An identity class with nothing left on it emits no rule.

**Sharing is exact, not heuristic.** Two identical declarations (same conditions, selector
shape, property and value) share one class only when no declaration whose property _overlaps_
theirs — the same property, a shorthand and one of its longhands (`padding` / `paddingBottom`),
two shorthands with a common longhand (`border` / `borderColor`), or a logical and a physical
longhand (`marginInlineStart` / `marginLeft`) — is rendered between them in the same cascade
layer with the same importance. That is the precise condition under which every combination of
classes on one element (`clsx(a, b)`, a `className` prop next to a recipe result) keeps
resolving to the same winner as without the pass, whichever way you combine them. It is also
why the pass shares less than an atomic CSS framework would:

```ts
const a = style({display: 'block'})
const b = style({display: 'inline'})
const c = style({display: 'block'}) // cannot share a's class: b sits between them
```

Sharing `display: block` between `a` and `c` would have to put one rule both before and after
`b`'s — `clsx(a, b)` and `clsx(b, c)` cannot both keep their current winner. StyleX and Tailwind
resolve this at runtime (`stylex.props`, `tailwind-merge`); vanilla-extract composes plain class
strings, so the pass refuses instead. The same applies to a `paddingBottom` between two
`padding` declarations. The property overlap table is generated from `mdn-data` and
cross-checked against StyleX's resolution tables; the cascade-equivalence test renders random
style sets in Chromium with and without the pass and compares every element's computed styles.

Complex selectors (`& + &`, selector lists), `globalStyle`, `createTheme` and keyframes stay as
they are — and count as barriers. Per module, classes are shared within a `.css.ts` module's
file scope; with `compilation: 'whole-program'`, across the whole program.

## Adapter API

Host-specific adapters can provide resolved defaults through the plugin's
[`api`](https://rolldown.rs/apis/plugin-api) property — this is how
`@sanity/vanilla-extract-tsdown-plugin` forwards tsdown's resolved config:

```ts
const plugin = vanillaExtractPlugin(options)
plugin.api.setBuildContext({
  // Default for the `target` option (e.g. the host's resolved top-level target)
  target: ['chrome90'],
  // Package name for the self-referential import of `exports`
  packageName: 'my-library',
  // Working directory the `.css.ts` modules are compiled from
  cwd: process.cwd(),
})
```

## Acknowledgements

The plugin combines a port of
[`@vanilla-extract/rollup-plugin`](https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin)
(MIT licensed, Copyright (c) 2021 SEEK) with the CSS collection and emission architecture of
[`@tsdown/css`](https://github.com/rolldown/tsdown/tree/main/packages/css) (MIT licensed,
Copyright (c) 2025-present VoidZero Inc. & Contributors, Copyright (c) 2024 Kevin Deng). The full
combined license notices are in this package's [LICENSE](./LICENSE) file.
