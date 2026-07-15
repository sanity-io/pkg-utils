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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFixtureDescription(value: unknown): value is FixtureDescription {
  return (
    isRecord(value) &&
    typeof value['directory'] === 'string' &&
    typeof value['plainModules'] === 'number' &&
    typeof value['styleModules'] === 'number'
  )
}

function isFixtureManifest(value: unknown): value is FixtureManifest {
  if (
    !isRecord(value) ||
    value['version'] !== 1 ||
    !isFixtureDescription(value['representative']) ||
    !Array.isArray(value['stress']) ||
    !value['stress'].every(isFixtureDescription)
  ) {
    return false
  }

  const hmr = value['hmr']
  return (
    isRecord(hmr) && isFixtureDescription(hmr['official']) && isFixtureDescription(hmr['sanity'])
  )
}

export function fixturePath(fixture: FixtureDescription): string {
  return path.join(generatedRoot, fixture.directory)
}

export async function loadFixtureManifest(): Promise<FixtureManifest> {
  const manifestPath = path.join(generatedRoot, 'manifest.json')
  const contents = await readFile(manifestPath, 'utf8')
  const manifest: unknown = JSON.parse(contents)
  if (!isFixtureManifest(manifest)) {
    throw new Error(`Invalid fixture manifest at ${manifestPath}; run pnpm benchmark:prepare`)
  }
  return manifest
}
