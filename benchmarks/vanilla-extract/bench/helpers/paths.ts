import {readFile} from 'node:fs/promises'
import path from 'node:path'

export const benchmarkRoot = path.resolve(import.meta.dirname, '../..')
export const generatedRoot = path.join(benchmarkRoot, '.generated')
export const resultsRoot = path.join(benchmarkRoot, 'results')

export const configPaths = {
  rolldown: path.join(benchmarkRoot, 'config/rolldown.config.mjs'),
  rollup: path.join(benchmarkRoot, 'config/rollup.config.mjs'),
  vite: path.join(benchmarkRoot, 'config/vite.config.mjs'),
} as const

export interface FixtureDescription {
  directory: string
  plainModules: number
  styleModules: number
}

export interface FixtureManifest {
  version: 1
  representative: FixtureDescription
  stress: FixtureDescription[]
  hmr: {
    official: FixtureDescription
    sanity: FixtureDescription
  }
}

export function fixturePath(fixture: FixtureDescription): string {
  return path.join(generatedRoot, fixture.directory)
}

export async function loadFixtureManifest(): Promise<FixtureManifest> {
  const manifestPath = path.join(generatedRoot, 'manifest.json')
  const contents = await readFile(manifestPath, 'utf8')
  const manifest = JSON.parse(contents) as Partial<FixtureManifest>
  if (manifest.version !== 1 || !manifest.representative || !manifest.stress || !manifest.hmr) {
    throw new Error(`Invalid fixture manifest at ${manifestPath}; run pnpm benchmark:prepare`)
  }
  return manifest as FixtureManifest
}
