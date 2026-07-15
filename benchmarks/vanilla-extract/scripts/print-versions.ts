import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
import os from 'node:os'

const require = createRequire(import.meta.url)

const packages = [
  '@vanilla-extract/rollup-plugin',
  '@vanilla-extract/vite-plugin',
  '@sanity/vanilla-extract-rolldown-plugin',
  '@sanity/vanilla-extract-vite-plugin',
  'rolldown',
  'rollup',
  'vite',
  'vitest',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

async function readPackageVersion(packageName: string): Promise<string> {
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  const packageJson: unknown = JSON.parse(await readFile(packageJsonPath, 'utf8'))
  if (!isRecord(packageJson) || typeof packageJson['version'] !== 'string') {
    throw new Error(`Missing version in ${packageJsonPath}`)
  }
  return packageJson['version']
}

const versions = await Promise.all(
  packages.map(async (packageName) => ({
    component: packageName,
    version: await readPackageVersion(packageName),
  })),
)

// eslint-disable-next-line no-console
console.table([
  {component: 'node', version: process.version},
  {component: 'platform', version: `${process.platform}-${process.arch}`},
  {component: 'cpu', version: os.cpus()[0]?.model ?? 'unknown'},
  ...versions,
])
