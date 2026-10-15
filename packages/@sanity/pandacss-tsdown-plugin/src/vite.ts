import type {Plugin} from 'vite'
import {unwrapCascadeLayers} from './cascadeLayers.ts'

/** Matches the ids of CSS modules, with or without a query. */
const RE_CSS_ID = /\.css(?:$|\?)/

/**
 * Matches the queries that load a module as something else than CSS, which Vite's CSS plugin skips
 * too.
 */
const RE_SPECIAL_QUERY = /[?&](?:worker|sharedworker|raw|url)\b/

/**
 * A Vite plugin that removes the named cascade layers from the CSS the official `@pandacss/vite`
 * plugin generates, with the pass behind the tsdown plugin's `cascadeLayers: false`, so a dev
 * server, a Storybook or a Vitest browser suite of a package built with the tsdown plugin cascades
 * like the `bundle.css` the package publishes. Register it next to `@pandacss/vite`, with the
 * names of the Panda config's layers:
 *
 * ```ts
 * plugins: [pandacss(), removeCascadeLayers(['reset', 'base', 'tokens', 'recipes', 'utilities'])]
 * ```
 *
 * In every CSS module, it removes the `@layer` blocks of those layers and their sublayers, and
 * their names from `@layer` statements, ordering the rules so that source order gives them the
 * precedence the layers gave them. Other layers stay as they are.
 *
 * It runs after `@pandacss/vite` has added Panda's CSS to the stylesheet that declares the layers,
 * wherever it is registered (`@pandacss/vite`'s transform is `order: 'pre'`), and before Vite's own
 * CSS pipeline (PostCSS, `@import` inlining, Lightning CSS), in `vite dev`, `vite build` and
 * Vitest's browser mode.
 * @public
 */
export function removeCascadeLayers(layerNames: readonly string[]): Plugin {
  const layers = new Set(layerNames)
  return {
    name: 'sanity:remove-cascade-layers',
    enforce: 'pre',
    transform: {
      filter: {id: {include: RE_CSS_ID, exclude: RE_SPECIAL_QUERY}},
      handler(code, id) {
        // The filter isn't applied by Vite versions before 6.3
        const [file = id] = id.split('?')
        if (!file.endsWith('.css') || RE_SPECIAL_QUERY.test(id)) return null
        const css = unwrapCascadeLayers(code, layers)
        return css === code ? null : {code: css, map: null}
      },
    },
  }
}
