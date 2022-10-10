import path from 'path'
import {promisify} from 'util'
import {ExtractorMessage} from '@microsoft/api-extractor'
import rimrafCallback from 'rimraf'
import {_BuildContext} from '../../_core'
import {_buildTypes} from './_buildTypes'
import {_DtsError} from './_DtsError'
import {_extractTypes} from './_extractTypes'
import {_DtsResult, _DtsTask, _DtsWatchTask} from './_types'

const rimraf = promisify(rimrafCallback)

/**
 * - Build type definitions to a temporary directory using TypeScript compiler.
 * - Create a type definition bundle for each export entry.
 * - When done, remove the temporary directory.
 */
export async function _doExtract(
  ctx: _BuildContext,
  task: _DtsTask | _DtsWatchTask
): Promise<_DtsResult> {
  const {config, cwd, files, ts} = ctx

  if (!ts.config || !ts.configPath) {
    return {type: 'dts', messages: [], results: []}
  }

  const {outDir, rootDir = cwd} = ts.config.options

  if (!outDir) {
    throw new Error('tsconfig.json is missing `compilerOptions.outDir`')
  }

  const tmpPath = path.resolve(outDir, '__tmp__')

  await _buildTypes({cwd, outDir: tmpPath, tsconfig: ts.config})

  const messages: ExtractorMessage[] = []

  const results: {sourcePath: string; filePath: string}[] = []

  for (const entry of task.entries) {
    const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

    const sourceTypesPath = path.resolve(
      tmpPath,
      path.relative(rootDir, path.resolve(cwd, entry.sourcePath)).replace(/\.ts$/, '.d.ts')
    )

    const targetPath = path.resolve(cwd, entry.targetPath)

    const result = await _extractTypes({
      customTags: config?.extract?.customTags,
      cwd,
      exportPath,
      files,
      filePath: path.relative(outDir, targetPath),
      projectPath: cwd,
      rules: config?.extract?.rules,
      sourceTypesPath: sourceTypesPath,
      tsconfigPath: path.resolve(cwd, ts.configPath || 'tsconfig.json'),
      distPath: outDir,
    })

    messages.push(...result.messages)

    if (result.messages.some((msg) => msg.logLevel === 'error')) {
      await rimraf(tmpPath)

      throw new _DtsError('encountered errors when extracting types', result.messages)
    }

    results.push({sourcePath: path.resolve(cwd, entry.sourcePath), filePath: targetPath})
  }

  await rimraf(tmpPath)

  return {type: 'dts', messages, results}
}
