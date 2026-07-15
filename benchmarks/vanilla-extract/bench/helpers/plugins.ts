import type {Plugin} from 'vite'
import type {VitePluginKind} from './commands.ts'

/**
 * Lazily imports only the requested plugin package, so a benchmark process never evaluates
 * (or initializes module-level state of) the competing implementation.
 */
export async function createVitePlugins(plugin: VitePluginKind): Promise<Plugin[]> {
  if (plugin === 'official') {
    const {vanillaExtractPlugin} = await import('@vanilla-extract/vite-plugin')
    return vanillaExtractPlugin({identifiers: 'short'})
  }
  const {vanillaExtractPlugin} = await import('@sanity/vanilla-extract-vite-plugin')
  return vanillaExtractPlugin({identifiers: 'short'})
}
