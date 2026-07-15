import {rm} from 'node:fs/promises'
import type {BenchOptions} from 'vitest'

type BenchmarkKind = 'build' | 'hmr' | 'stress'

const defaultIterations: Record<BenchmarkKind, number> = {
  build: 5,
  hmr: 10,
  stress: 3,
}

const environmentNames: Record<BenchmarkKind, string> = {
  build: 'VE_BENCH_BUILD_ITERATIONS',
  hmr: 'VE_BENCH_HMR_ITERATIONS',
  stress: 'VE_BENCH_STRESS_ITERATIONS',
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name]
  if (raw === undefined) return fallback

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer, received ${raw}`)
  }
  return parsed
}

export function fixedBenchmarkOptions(
  kind: BenchmarkKind,
  overrides: Pick<BenchOptions, 'now' | 'setup' | 'teardown'> = {},
): BenchOptions {
  return {
    iterations: readPositiveInteger(environmentNames[kind], defaultIterations[kind]),
    time: 0,
    throws: true,
    warmupIterations: readPositiveInteger('VE_BENCH_WARMUP_ITERATIONS', 1),
    warmupTime: 0,
    ...overrides,
  }
}

export function coldBuildOptions(
  kind: Extract<BenchmarkKind, 'build' | 'stress'>,
  outputDirectory: string,
  teardown: () => void | Promise<void>,
): BenchOptions {
  return fixedBenchmarkOptions(kind, {
    setup: () => rm(outputDirectory, {recursive: true, force: true}),
    teardown,
  })
}
