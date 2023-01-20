import path from 'path'
import {ExtractorMessage} from '@microsoft/api-extractor'
import rimraf from 'rimraf'
import {BuildContext} from '../../core'
import {buildTypes} from './buildTypes'
import {DtsError} from './DtsError'
import {extractTypes} from './extractTypes'
import {DtsResult, DtsTask, DtsWatchTask} from './types'

/**
 * - Build type definitions to a temporary directory using TypeScript compiler.
 * - Create a type definition bundle for each export entry.
 * - When done, remove the temporary directory.
 */
export async function doExtract(
  ctx: BuildContext,
  task: DtsTask | DtsWatchTask
): Promise<DtsResult> {
  const {config, cwd, files, logger, strict, ts} = ctx

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

  const results: {sourcePath: string; filePath: string}[] = []

  for (const entry of task.entries) {
    const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

    const sourceTypesPath = path.resolve(
      tmpPath,
      path.relative(rootDir, path.resolve(cwd, entry.sourcePath)).replace(/\.ts$/, '.d.ts')
    )

    const targetPath = path.resolve(cwd, entry.targetPath)
    const filePath = path.relative(outDir, targetPath)
    const result = await extractTypes({
      customTags: config?.extract?.customTags,
      cwd,
      distPath: outDir,
      exportPath,
      files,
      filePath: filePath,
      projectPath: cwd,
      rules: config?.extract?.rules,
      sourceTypesPath: sourceTypesPath,
      tmpPath,
      tsconfigPath: path.resolve(cwd, ts.configPath || 'tsconfig.json'),
    })

    messages.push(...result.messages)

    if (result.messages.some((msg) => msg.logLevel === 'error')) {
      await rimraf(tmpPath)

      throw new DtsError('encountered errors when extracting types', result.messages)
    }

    results.push({sourcePath: path.resolve(cwd, entry.sourcePath), filePath: targetPath})
  }

  await rimraf(tmpPath)

  return {type: 'dts', messages, results}
}
