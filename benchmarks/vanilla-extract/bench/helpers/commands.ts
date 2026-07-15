import {spawn} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import path from 'node:path'
import {benchmarkRoot, configPaths} from './paths.ts'
import type {BuildVariant} from './variants.ts'

const require = createRequire(import.meta.url)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export interface CommandResult {
  stderr: string
  stdout: string
}

export type VitePluginKind = 'official' | 'sanity'

function resolvePackageBin(packageName: string, binName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`)
  const manifest: unknown = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  if (!isRecord(manifest)) {
    throw new Error(`Invalid package manifest at ${packageJsonPath}`)
  }

  const bin = manifest['bin']
  const relativeBin =
    typeof bin === 'string'
      ? bin
      : isRecord(bin) && typeof bin[binName] === 'string'
        ? bin[binName]
        : undefined

  if (!relativeBin) {
    throw new Error(`Could not resolve the ${binName} binary from ${packageJsonPath}`)
  }
  return path.resolve(path.dirname(packageJsonPath), relativeBin)
}

async function runPackageBin(
  packageName: string,
  binName: string,
  arguments_: string[],
  environment: NodeJS.ProcessEnv,
): Promise<CommandResult> {
  const binPath = resolvePackageBin(packageName, binName)
  const child = spawn(process.execPath, [binPath, ...arguments_], {
    cwd: benchmarkRoot,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      NO_COLOR: '1',
      NODE_ENV: 'production',
      ...environment,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stderr = ''
  let stdout = ''
  child.stderr.setEncoding('utf8')
  child.stdout.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })

  const code = await new Promise<number>((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (exitCode, signal) => {
      if (exitCode === null) {
        reject(new Error(`${binName} exited after signal ${signal ?? 'unknown'}`))
        return
      }
      resolve(exitCode)
    })
  })

  if (code !== 0) {
    throw new Error(`${binName} exited with code ${code}\n${stdout}\n${stderr}`.trim())
  }
  return {stderr, stdout}
}

function buildEnvironment(
  fixtureRoot: string,
  outputDirectory: string,
  variant?: BuildVariant,
): NodeJS.ProcessEnv {
  return {
    VE_BENCH_FIXTURE_ROOT: fixtureRoot,
    VE_BENCH_IDENTIFIERS: variant?.identifiers ?? 'short',
    VE_BENCH_MINIFY: variant?.minify ? '1' : '0',
    VE_BENCH_OUTPUT_DIR: outputDirectory,
    VE_BENCH_TARGET: variant?.target ? variant.target : '',
  }
}

export function runRollupBuild(
  fixtureRoot: string,
  outputDirectory: string,
  variant?: BuildVariant,
): Promise<CommandResult> {
  return runPackageBin(
    'rollup',
    'rollup',
    ['--config', configPaths.rollup, '--silent'],
    buildEnvironment(fixtureRoot, outputDirectory, variant),
  )
}

export function runRolldownBuild(
  fixtureRoot: string,
  outputDirectory: string,
  variant?: BuildVariant,
): Promise<CommandResult> {
  return runPackageBin(
    'rolldown',
    'rolldown',
    ['--config', configPaths.rolldown],
    buildEnvironment(fixtureRoot, outputDirectory, variant),
  )
}

export function runViteBuild(
  fixtureRoot: string,
  outputDirectory: string,
  plugin: VitePluginKind,
  options: {showWarnings?: boolean; identifiers?: 'short' | 'debug'} = {},
): Promise<CommandResult> {
  return runPackageBin('vite', 'vite', ['build', '--config', configPaths.vite], {
    ...buildEnvironment(fixtureRoot, outputDirectory),
    VE_BENCH_IDENTIFIERS: options.identifiers ?? 'short',
    VE_BENCH_LOG_LEVEL: options.showWarnings ? 'warn' : 'silent',
    VE_BENCH_PLUGIN: plugin,
  })
}
