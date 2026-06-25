# css-playground

A cross-framework / cross-runtime harness for the **conditional `bundle.css` export** pattern
(see [SAPP-3845] and [sanity-io/sanity#12825]). It exists to catch one specific failure mode: a
package whose built entry contains a self-referential `import "<pkg>/bundle.css"` crashing runtimes
that cannot import `.css` files (Node SSR, typegen, importing a package in `next.config.ts`, …).

## What's here

- **`sanity-css-vanilla-extract-test`** — the _producer_. A `@sanity/pkg-utils`-built package that
  uses vanilla-extract, injects a self-referential `import "sanity-css-vanilla-extract-test/bundle.css"`
  into its entry chunk, and exposes a conditional export so that import resolves to:
  - the real CSS file under the `browser`/`style` conditions (bundlers / browsers), and
  - a no-op JS shim (`export default ""`) under the `node`/`default` conditions (Node-like runtimes).

  It exports `TestComponent` (a React component styled with a marker colour `rgb(1, 2, 3)`),
  `createConfig()` (logs an assertable marker; used by Node/`next.config.ts` smoke tests), and
  `renderInto(el)` (mounts the component with `react-dom` `createRoot`, for non-React hosts).

- **`@css-playground/*`** — consumers that import the producer from many frameworks/runtimes.
- **`@css-playground/verify`** — a Playwright-based helper to check, in a real headless browser,
  whether the producer's CSS actually applies.
- It keeps its exact name (no `@css-playground/` prefix) so you can point a consumer at an
  npm-published build instead of the workspace, to rule out monorepo-only resolution quirks.

## 1. Automated smoke tests (no browser)

Each consumer has a single command that must exit cleanly. This is what CI runs:

```sh
pnpm build                                   # build @sanity/* (the `pkg` CLI)
pnpm --filter sanity-css-vanilla-extract-test build   # build the producer
pnpm --workspace-concurrency=1 --filter "./css-playground/**" test
```

These only assert that nothing **crashes** on the `bundle.css` import. They do **not** assert that
the CSS is visually applied — that is what the steps below are for.

## 2. Manual visual verification (humans)

Start any consumer's dev server and open the URL it prints:

```sh
pnpm --filter @css-playground/vite dev        # then open http://localhost:5173
pnpm --filter @css-playground/next-client-component dev
pnpm --filter @css-playground/astro dev
# …etc
```

Look for the text **`sanity-css-vanilla-extract-test`** on the page:

- **CSS applied** → it sits inside a box with a `1px solid` border, `8px` padding, and the text/border
  use the marker colour `rgb(1, 2, 3)` (a near-black).
- **CSS absent (shim)** → it is plain, unstyled text with no border.

## 3. Automated visual verification (agents / CI-on-demand)

Install Chromium once:

```sh
pnpm --filter @css-playground/verify install-browser
```

Then either let the helper start + stop the dev server for you:

```sh
# <name> is the consumer dir; second arg is the expected outcome (css | no-css)
pnpm --filter @css-playground/verify verify-app vite css
pnpm --filter @css-playground/verify verify-app next-server-component no-css
```

…or run it against a server you started yourself:

```sh
pnpm --filter @css-playground/vite dev &
pnpm --filter @css-playground/verify verify http://localhost:5173 vite css
```

The check loads the page, reads the producer element's **computed** `color`, compares it to the
marker `rgb(1, 2, 3)`, and writes a full-page screenshot to `css-playground/verify/screenshots/`.

## Expected CSS-render behaviour

The self-referential import only pulls in the real CSS where the component ends up in a
**client/browser** bundle. Anywhere it is resolved by Node (server) it gets the shim. So:

| Consumer                                                     | Renders CSS?    | Why                                                                               |
| ------------------------------------------------------------ | --------------- | --------------------------------------------------------------------------------- |
| `vite`, `webpack`, `rspack`                                  | yes             | client bundle → `browser` condition → real CSS                                    |
| `solidjs`, `nuxt`                                            | yes             | React island mounted client-side via `renderInto`                                 |
| `react-router`, `tanstack-start`                             | yes             | route component hydrates on the client                                            |
| `next-client-component`                                      | yes             | `'use client'` → component in the client bundle                                   |
| `next-server-component`                                      | no              | pure Server Component ships no client JS → shim only                              |
| `next-dynamic`                                               | no              | Server Component + `next/dynamic`, still no client JS → shim                      |
| `astro`                                                      | no              | Astro collects island CSS from the SSR graph, where the import is the shim        |
| `parcel`                                                     | n/a in monorepo | Parcel prefers the workspace `source` condition; verify against a published build |
| `node`, `deno`, `bun`, `jest`, `vitest`, `node-tap`, `remix` | n/a             | no UI — they assert the import resolves to the shim without crashing              |

The `no`/`n/a` rows are **expected** for this design: shipping a Node-safe shim necessarily means
server-only render paths do not receive the CSS. Components that need styling should be (or be used
from) client components — which is the case for Sanity Studio.

[SAPP-3845]: https://linear.app/sanity/issue/SAPP-3845
[sanity-io/sanity#12825]: https://github.com/sanity-io/sanity/pull/12825
