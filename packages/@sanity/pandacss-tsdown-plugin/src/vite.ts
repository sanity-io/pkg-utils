import {createNodeDriver} from '@pandacss/compiler'
import {pandacss as pandacssVite, type PandaPluginOptions} from '@pandacss/vite'
import type {Plugin} from 'vite'
import {unwrapCascadeLayers} from './cascadeLayers.ts'

type PandaDriver = Awaited<ReturnType<typeof createNodeDriver>>

/**
 * The specifier of the stylesheet Panda's CSS is generated into: import it once, from the app's
 * entry (or a Vitest setup file), ahead of any other CSS whose rules must win over Panda's, such as
 * styled-components' `<style>` elements. It declares the cascade layers of the Panda config, which
 * makes `@pandacss/vite` append the generated CSS to it, so no hand-written stylesheet has to.
 * @public
 */
export const PANDA_STYLESHEET = 'virtual:panda.css'

/** The module id of {@link PANDA_STYLESHEET}: `@pandacss/vite` only fills ids ending in `.css`. */
const RESOLVED_PANDA_STYLESHEET = `\0${PANDA_STYLESHEET}`

/** Matches {@link PANDA_STYLESHEET}, with or without a query. */
const RE_PANDA_STYLESHEET = /^virtual:panda\.css(?:\?|$)/

/** Matches the module id of {@link PANDA_STYLESHEET}, with or without a query. */
const RE_RESOLVED_PANDA_STYLESHEET = /^\0virtual:panda\.css(?:\?|$)/

const COMPANION_PLUGIN_NAME = 'sanity:pandacss'

/** Matches the ids of CSS modules, with or without a query. */
const RE_CSS_ID = /\.css(?:$|\?)/

/**
 * Matches the queries that load a module as something else than CSS, which Vite's CSS plugin skips
 * too.
 */
const RE_SPECIAL_QUERY = /[?&](?:worker|sharedworker|raw|url)\b/

/**
 * Options for {@link pandacss}: the options of the official `@pandacss/vite` plugin, passed through
 * to it, and the cascade layer options of the tsdown plugin.
 * @public
 */
export interface Options extends PandaPluginOptions {
  /**
   * Keep Panda's cascade layers in the generated stylesheet. Set to `false` to remove every
   * `@layer` block and statement, with the rules ordered so that source order gives them the
   * precedence the layers gave them: the same pass as `cascadeLayers: false` in the tsdown plugin,
   * so the app cascades like the `bundle.css` a library publishes with it. Cannot be combined with
   * the Panda config's `polyfill`.
   * @defaultValue true
   */
  cascadeLayers?: boolean
  /**
   * CSS prepended to the generated stylesheet, on a line of its own, such as a `@layer` statement
   * that orders the layers of other libraries' stylesheets (`@layer sui;`), which is then the first
   * statement of the page to name them. Can't be combined with the Panda config's `polyfill`.
   */
  banner?: string
}

/**
 * What a companion plugin shares with the other instances in the same Vite config: several Panda
 * projects built by one app (a library's sources and the app's own) fill one stylesheet.
 */
interface Companion {
  readonly cascadeLayers: boolean
  readonly banner: string | undefined
  /** The layer names of the instance's Panda config, in cascade order. */
  layerNames(): string[]
  /**
   * Whether a stylesheet declares the layers of the instance's Panda config: the check
   * `@pandacss/vite` fills a stylesheet by.
   */
  hasLayerDeclaration(css: string): boolean
}

/** The companion of each companion plugin object, which a Vite config lists in its `plugins`. */
const companions = new WeakMap<Plugin, Companion>()

/**
 * The official [`@pandacss/vite`](https://panda-css.com/docs/installation/vite) plugin, with the
 * stylesheet it generates the CSS into provided as the {@link PANDA_STYLESHEET | `virtual:panda.css`}
 * module, and its cascade layers optionally removed: a drop-in replacement for `pandacss()` from
 * `@pandacss/vite` for an app, a Storybook or a Vitest browser suite that builds Panda sources, such
 * as a library's that it publishes with the tsdown plugin.
 *
 * Next to the `@pandacss/vite` plugin, it adds a plugin that loads the same Panda config, to declare
 * its layers in `virtual:panda.css`, and that rewrites every stylesheet `@pandacss/vite` fills (also
 * a hand-written one that declares the layers) after `@pandacss/vite` and before Vite's own CSS
 * pipeline (PostCSS, `@import` inlining, Lightning CSS). That holds in `vite dev`, `vite build` and
 * Vitest's browser mode alike.
 * @public
 */
export function pandacss(options: Options = {}): Plugin[] {
  const {cascadeLayers = true, banner, ...pandaOptions} = options
  return [
    // Ahead of `@pandacss/vite`, so that its `hotUpdate` hook has reloaded the config before
    // `@pandacss/vite` reloads the page after a config change. The transforms run in the opposite
    // order regardless: `@pandacss/vite`'s is `order: 'pre'`.
    companionPlugin(pandaOptions, cascadeLayers, banner),
    pandacssVite(pandaOptions),
  ]
}

function companionPlugin(
  pandaOptions: PandaPluginOptions,
  cascadeLayers: boolean,
  banner: string | undefined,
): Plugin {
  let driver: PandaDriver | undefined
  /**
   * Every instance in the Vite config, in plugin order. The first one serves the stylesheet and
   * rewrites the stylesheets they fill, so a stylesheet several projects fill is rewritten once.
   */
  let instances: Companion[] = []

  const companion: Companion = {
    cascadeLayers,
    banner,
    layerNames: () => (driver ? Object.values(driver.compiler.layers()) : []),
    hasLayerDeclaration: (css) => driver?.compiler.hasLayerDeclaration(css) ?? false,
  }

  /**
   * Rejects the Panda config's `polyfill` where it breaks the plugin. `@pandacss/vite` applies it by
   * removing the `@layer` statement that the stylesheet is recognized by: by this plugin, which
   * removes the layers and prepends the banner after `@pandacss/vite`, and by the `@pandacss/vite`
   * of every other project that generates its CSS into the same stylesheet.
   */
  function assertPolyfillSupported(currentDriver: PandaDriver): void {
    if (currentDriver.config['polyfill'] !== true) return
    if (instances.length === 1 && cascadeLayers && banner === undefined) return
    throw new Error(
      "[pandacss] `polyfill: true` in the Panda config only works with a single `pandacss()` plugin of `@sanity/pandacss-tsdown-plugin/vite`, `cascadeLayers: true` and no `banner`: `@pandacss/vite` applies the polyfill by removing the `@layer` statement that the plugin, and the other Panda projects generating their CSS into the same stylesheet, recognize it by. Remove `polyfill` (`cascadeLayers: false` publishes the CSS without layers while keeping every selector's specificity), or those options.",
    )
  }

  const plugin: Plugin = {
    name: COMPANION_PLUGIN_NAME,
    enforce: 'pre',

    async configResolved(config) {
      // The config `@pandacss/vite` loads, from the same options
      const currentDriver = await createNodeDriver({
        cwd: pandaOptions.cwd ?? config.root,
        configPath: pandaOptions.configPath,
      })
      driver = currentDriver
      instances = config.plugins.flatMap((listed) => companions.get(listed) ?? [])
      if (
        instances.some(
          (instance) => instance.cascadeLayers !== cascadeLayers || instance.banner !== banner,
        )
      ) {
        throw new Error(
          '[pandacss] Every `pandacss()` plugin of `@sanity/pandacss-tsdown-plugin/vite` in a Vite config generates its CSS into the same stylesheet, so they must have the same `cascadeLayers` and `banner` options.',
        )
      }
      assertPolyfillSupported(currentDriver)
    },

    resolveId: {
      filter: {id: RE_PANDA_STYLESHEET},
      handler(id) {
        if (instances[0] !== companion) return null
        const [specifier, query] = splitQuery(id)
        return specifier === PANDA_STYLESHEET ? `${RESOLVED_PANDA_STYLESHEET}${query}` : null
      },
    },

    load: {
      filter: {id: RE_RESOLVED_PANDA_STYLESHEET},
      handler(id) {
        if (splitQuery(id)[0] !== RESOLVED_PANDA_STYLESHEET) return null
        const layers = new Set(instances.flatMap((instance) => instance.layerNames()))
        return `@layer ${[...layers].join(', ')};\n`
      },
    },

    transform: {
      filter: {id: {include: RE_CSS_ID, exclude: RE_SPECIAL_QUERY}},
      handler(code, id) {
        if (instances[0] !== companion || (cascadeLayers && banner === undefined)) return null
        // The filter isn't applied by Vite versions before 6.3
        const [file] = splitQuery(id)
        if (!file.endsWith('.css') || RE_SPECIAL_QUERY.test(id)) return null
        if (!instances.some((instance) => instance.hasLayerDeclaration(code))) return null

        const css = cascadeLayers ? code : unwrapCascadeLayers(code)
        return {code: banner === undefined ? css : `${banner}\n${css}`, map: null}
      },
    },

    // A config change can rename the layers that `virtual:panda.css` declares, or turn on the
    // `polyfill`. An error thrown here keeps `@pandacss/vite` from reloading the page, and Vite
    // shows it in the browser.
    async hotUpdate({file, server}) {
      if (!driver || this.environment !== server.environments.client) return undefined
      if (!driver.isConfigFile(file) || !(await driver.reload()).hasChanged) return undefined
      assertPolyfillSupported(driver)
      const {moduleGraph} = this.environment
      for (const module of moduleGraph.getModulesByFile(RESOLVED_PANDA_STYLESHEET) ?? []) {
        moduleGraph.invalidateModule(module)
      }
      return undefined
    },
  }
  companions.set(plugin, companion)
  return plugin
}

function splitQuery(id: string): [path: string, query: string] {
  const index = id.indexOf('?')
  return index === -1 ? [id, ''] : [id.slice(0, index), id.slice(index)]
}
