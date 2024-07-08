import path from 'node:path'

import type {ExtractorMessage} from '@microsoft/api-extractor'
import rimraf from 'rimraf'

import type {BuildContext} from '../../core'
import {buildTypes} from './buildTypes'
import {DtsError} from './DtsError'
import {extractTypes} from './extractTypes'
import type {DtsResult, DtsTask, DtsWatchTask} from './types'

/**
 * - Build type definitions to a temporary directory using TypeScript compiler.
 * - Create a type definition bundle for each export entry.
 * - When done, remove the temporary directory.
 */
export async function doExtract(
  ctx: BuildContext,
  task: DtsTask | DtsWatchTask,
): Promise<DtsResult> {
  const {config, cwd, files, logger, strict, ts, bundledPackages} = ctx

  if (!ts.config || !ts.configPath) {
    return {type: 'dts', messages: [], results: []}
  }

  const {outDir, rootDir = cwd} = ts.config.options

  if (!outDir) {
    throw new Error('tsconfig.json is missing `compilerOptions.outDir`')
  }

  const tmpPath = path.resolve(outDir, '__tmp__')

  await buildTypes({cwd, logger, outDir: tmpPath, strict, tsconfig: ts.config})
  const messages: ExtractorMessage[] = []

  const results: {sourcePath: string; filePaths: string[]}[] = []

  for (const entry of task.entries) {
    const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

    const sourceTypesPath = path.resolve(
      tmpPath,
      path.relative(rootDir, path.resolve(cwd, entry.sourcePath)).replace(/\.ts$/, '.d.ts'),
    )

    const targetPaths = entry.targetPaths.map((targetPath) => path.resolve(cwd, targetPath))
    const filePaths = targetPaths.map((targetPath) => path.relative(outDir, targetPath))
    const result = await extractTypes({
      bundledPackages: bundledPackages || [],
      customTags: config?.extract?.customTags,
      cwd,
      distPath: outDir,
      exportPath,
      files,
      filePaths,
      projectPath: cwd,
      rules: config?.extract?.rules,
      sourceTypesPath: sourceTypesPath,
      tsconfig: ts.config,
      tmpPath,
      tsconfigPath: path.resolve(cwd, ts.configPath || 'tsconfig.json'),
    })

    messages.push(...result.messages)

    const errors = result.messages.filter((msg) => msg.logLevel === 'error')

    if (errors.length > 0) {
      await rimraf(tmpPath)
      throw new DtsError(`encountered ${errors.length} errors when extracting types`, errors)
    }

    results.push({sourcePath: path.resolve(cwd, entry.sourcePath), filePaths: targetPaths})
  }

  await rimraf(tmpPath)

  return {type: 'dts', messages, results}
}
