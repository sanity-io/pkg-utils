/**
 * Module-graph helpers ported from `@vanilla-extract/rollup-plugin`
 * (https://github.com/vanilla-extract-css/vanilla-extract/tree/master/packages/rollup-plugin),
 * MIT licensed, Copyright (c) 2021 SEEK.
 */
import {cssFileFilter} from '@vanilla-extract/integration'
import MagicString, {Bundle as MagicStringBundle} from 'magic-string'
import type {PluginContext} from 'rolldown'

/**
 * `[id, order]` tuple meant for ordering imports.
 * @internal
 */
export type ImportChain = [id: string, order: number][]

/**
 * The subset of the rolldown plugin context needed to traverse the module graph.
 * @internal
 */
export type ModuleGraph = Pick<PluginContext, 'getModuleIds' | 'getModuleInfo' | 'warn'>

/**
 * Generate a CSS bundle from the rolldown module graph, concatenating the CSS of every compiled
 * `.css.ts` module (stashed in the virtual `.vanilla.css` modules' `meta.css` by the `resolveId`
 * hook) in import order.
 * @internal
 */
export function generateCssBundle(plugin: ModuleGraph): {
  bundle: MagicStringBundle
  extractedCssIds: Set<string>
} {
  const cssBundle = new MagicStringBundle()
  const extractedCssIds = new Set<string>()

  // 1. identify CSS files to bundle
  const cssFiles: Record<string, ImportChain> = {}
  for (const id of plugin.getModuleIds()) {
    if (cssFileFilter.test(id)) {
      cssFiles[id] = buildImportChain(id, plugin)
    }
  }

  // 2. build bundle from import order
  for (const id of sortModules(cssFiles)) {
    const importedIds = plugin.getModuleInfo(id)?.importedIds ?? []
    for (const importedId of importedIds) {
      const resolution = plugin.getModuleInfo(importedId)
      if (!resolution || extractedCssIds.has(resolution.id)) continue
      const css: unknown = resolution.meta['css']
      if (typeof css !== 'string' || !css) continue
      extractedCssIds.add(resolution.id)
      cssBundle.addSource({
        filename: resolution.id,
        content: new MagicString(css),
      })
    }
  }

  return {bundle: cssBundle, extractedCssIds}
}

/**
 * Trace a file back through its importers, building an ordered list.
 */
function buildImportChain(
  id: string,
  plugin: Pick<PluginContext, 'getModuleInfo' | 'warn'>,
): ImportChain {
  let mod = plugin.getModuleInfo(id)
  if (!mod) {
    return []
  }
  const chain: ImportChain = [[id, -1]]
  // resolve upwards to root entry
  while (!mod.isEntry) {
    const {id: currentId, importers} = mod
    const lastImporterId = importers.at(-1)
    if (!lastImporterId) {
      break
    }
    if (chain.some(([chainId]) => chainId === lastImporterId)) {
      plugin.warn(
        `Circular import detected. Can’t determine ideal import order of module.\n${chain
          .toReversed()
          .map(([chainId]) => chainId)
          .join('\n → ')}`,
      )
      break
    }
    mod = plugin.getModuleInfo(lastImporterId)
    if (!mod) {
      break
    }
    // importedIds preserves the import order within each module
    chain.push([lastImporterId, mod.importedIds.indexOf(currentId)])
  }
  return chain.toReversed()
}

/**
 * Compare import chains to determine a flat ordering for modules.
 */
function sortModules(modules: Record<string, ImportChain>): string[] {
  const sortedModules = Object.entries(modules)

  sortedModules.sort(([, chainA], [, chainB]) => {
    const shorterChain = Math.min(chainA.length, chainB.length)
    for (let i = 0; i < shorterChain; i++) {
      const linkA = chainA[i]
      const linkB = chainB[i]
      if (!linkA || !linkB) break
      const [moduleA, orderA] = linkA
      const [moduleB, orderB] = linkB
      // on same node, continue to next one
      if (moduleA === moduleB && orderA === orderB) {
        continue
      }
      if (orderA !== orderB) {
        return orderA - orderB
      }
    }
    return 0
  })

  return sortedModules.map(([id]) => id)
}

const SIDE_EFFECT_IMPORT_RE =
  /^\s*(?:import\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))\s*;?\s*/gm

/**
 * Remove specific side effect imports and requires from JS.
 * @internal
 */
export function stripSideEffectImportsMatching(code: string, sources: string[]): string {
  return code.replace(
    SIDE_EFFECT_IMPORT_RE,
    (match, importSource: string | undefined, requireSource: string | undefined) => {
      const source = importSource ?? requireSource
      return source !== undefined && sources.includes(source) ? '' : match
    },
  )
}
