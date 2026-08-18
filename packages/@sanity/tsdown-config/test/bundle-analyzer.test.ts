import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import type {UserConfig} from 'tsdown'
import {describe, expect, test} from 'vitest'
import {defineConfig} from '../src/index.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(__dirname, 'fixtures/bundle-analyzer-library')

const BUNDLE_ANALYZER_PLUGIN = 'builtin:bundle-analyzer'

function getPlugins(config: UserConfig) {
  const {plugins} = config
  if (!Array.isArray(plugins)) return []
  return plugins.filter(
    (plugin): plugin is {name: string; _options?: unknown} =>
      !!plugin && typeof plugin === 'object' && 'name' in plugin && typeof plugin.name === 'string',
  )
}

function getPluginNames(config: UserConfig) {
  return getPlugins(config).map((plugin) => plugin.name)
}

function getBundleAnalyzerOptions(config: UserConfig) {
  return getPlugins(config).find((plugin) => plugin.name === BUNDLE_ANALYZER_PLUGIN)?._options
}

describe('bundleAnalyzer option', () => {
  test('is disabled by default', async () => {
    expect(getPluginNames(await defineConfig())).toEqual([])
    expect(getPluginNames(await defineConfig({bundleAnalyzer: false}))).toEqual([])
  })

  test('adds the analyzer plugin with the markdown default when enabled', async () => {
    // Rolldown's own default is `format: 'json'`; this config selects markdown so `true`
    // matches the LLM-friendly report Sanity library builds want
    expect(getPluginNames(await defineConfig({bundleAnalyzer: true}))).toEqual([
      BUNDLE_ANALYZER_PLUGIN,
    ])
    expect(getBundleAnalyzerOptions(await defineConfig({bundleAnalyzer: true}))).toEqual({
      format: 'md',
    })
  })

  test('merges user provided options over the markdown default', async () => {
    expect(
      getBundleAnalyzerOptions(
        await defineConfig({bundleAnalyzer: {fileName: 'bundle-analysis.json', format: 'json'}}),
      ),
    ).toEqual({
      format: 'json',
      fileName: 'bundle-analysis.json',
    })
    expect(
      getBundleAnalyzerOptions(await defineConfig({bundleAnalyzer: {fileName: 'report.md'}})),
    ).toEqual({
      format: 'md',
      fileName: 'report.md',
    })
  })

  test('skips the analyzer on the react-server variant of a dual build', async () => {
    // Both variants write to the same `outDir`; analyzing only the compiled (`default`)
    // variant avoids a race on one `analyze-data.md` and reports the published client bundle
    const configs = await defineConfig({
      reactCompiler: {target: '19', reactServer: true},
      bundleAnalyzer: true,
    })
    expect(configs).toHaveLength(2)
    const [compiled, reactServer] = configs
    if (!compiled || !reactServer)
      throw new Error('expected the compiled and react-server variants')

    expect(getPluginNames(compiled)).toEqual(['@rolldown/plugin-babel', BUNDLE_ANALYZER_PLUGIN])
    expect(getPluginNames(reactServer)).toEqual([])
  })
})

describe('bundle-analyzer-library', () => {
  test('emits an LLM-friendly markdown report next to the build output', async () => {
    const report = await readFile(path.join(fixtureDir, 'dist/analyze-data.md'), 'utf-8')

    expect(report).toContain('# Bundle Analysis Report')
    expect(report).toContain('## Quick Summary')
    expect(report).toContain('## Largest Modules by Output Contribution')
    expect(report).toContain('## Entry Point Analysis')
    // The fixture's helper module must appear so the report is analyzing this package, not
    // an empty graph
    expect(report).toMatch(/util\.ts|helper/)
  })

  test('does not emit the JSON report when format is markdown', async () => {
    await expect(
      readFile(path.join(fixtureDir, 'dist/analyze-data.json'), 'utf-8'),
    ).rejects.toThrow()
  })
})
