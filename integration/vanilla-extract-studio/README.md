# @integration/vanilla-extract-studio

Integration suite that runs a real Sanity Studio fixture through the `sanity` CLI with
`@sanity/vanilla-extract-vite-plugin` (the fork) and with `@vanilla-extract/vite-plugin` (the
upstream original), and compares their output. **The upstream plugin is the reference**: for
every command and option variant, the fork's output must match it exactly.

The suite exists because the fork initially shipped without CLI-level coverage and regressed in
ways its unit tests couldn't see (missing CSS in `sanity build` output, a crash in
`sanity schema extract`) while `sanity dev` kept working — see
[sanity-io/pkg-utils#3073](https://github.com/sanity-io/pkg-utils/issues/3073).

## What's covered

Commands, each across the shared option matrix in `test/variants.ts`:

- **`sanity build`** (`test/build.test.ts`) — plugin-default / `short` / `debug` /
  custom-function (`prefix`) identifiers, `build.cssMinify` (`default` / `true` /
  `'lightningcss'`), and `build.cssTarget` (`chrome61`) variants. Asserts the emitted CSS
  assets and the class names in the built JS: identifier formatting, per-class CSS rules
  (class names in JS without matching CSS was the production regression), minify/target
  effects, and fork ≡ upstream equality of both.
- **`sanity dev`** (`test/dev.test.ts`) — identifier variants. Requests the transformed
  `.css.ts` modules over HTTP like the browser would, follows their virtual `.vanilla.css`
  imports, and compares served CSS and exported class names.
- **`sanity schema extract`** (`test/schema-extract.test.ts`) — identifier variants. The
  fixture schema embeds the generated class names in a field description, so the extracted
  schema doubles as identifier output; the command also exercises `.css.ts` evaluation inside
  the CLI's `ssr.noExternal: true` worker environment.

The studio fixture is this package itself: `sanity.cli.ts` selects the plugin implementation
and options through `VE_PLUGIN` / `VE_IDENTIFIERS` / `VE_CSS_MINIFY` / `VE_CSS_TARGET`
environment variables set by the tests.

## Running

```sh
pnpm --filter @integration/vanilla-extract-studio test
```

No Sanity authentication or network project access is needed; `build`, `dev` (module serving),
and `schema extract` all run locally.

Note: the tests spawn the `sanity` CLI **without `NODE_ENV`** (like a real terminal). This is
load-bearing — `@vanilla-extract/css` ships `NODE_ENV`-switching CJS wrappers and `vite build`
flips `NODE_ENV` to `production` mid-process, which is exactly the divergence behind the
`sanity build` regression; a test-runner-provided `NODE_ENV=test` would mask it.

To poke at the fixture manually:

```sh
cd integration/vanilla-extract-studio
VE_PLUGIN=fork pnpm exec sanity dev
VE_PLUGIN=upstream pnpm exec sanity build output/manual --no-minify
```
