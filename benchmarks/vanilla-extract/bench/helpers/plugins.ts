import {vanillaExtractPlugin as sanityVanillaExtractPlugin} from '@sanity/vanilla-extract-vite-plugin'
import {vanillaExtractPlugin as officialVanillaExtractPlugin} from '@vanilla-extract/vite-plugin'
import type {Plugin} from 'vite'
import type {VitePluginKind} from './commands.ts'

export function createVitePlugins(plugin: VitePluginKind): Plugin[] {
  return plugin === 'official'
    ? officialVanillaExtractPlugin({identifiers: 'short'})
    : sanityVanillaExtractPlugin({identifiers: 'short'})
}
