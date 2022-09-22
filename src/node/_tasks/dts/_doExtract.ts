import {rename} from 'fs/promises'
import path from 'path'
import {promisify} from 'util'
import {ExtractorMessage} from '@microsoft/api-extractor'
import cpx from 'cpx'
import rimrafCallback from 'rimraf'
import {_BuildContext} from '../../_core'
import {_buildTypes} from './_buildTypes'
import {_DtsError} from './_DtsError'
import {_extractTypes} from './_extractTypes'
import {_DtsResult, _DtsTask, _DtsWatchTask} from './_types'

const rimraf = promisify(rimrafCallback)

export async function _doExtract(
  ctx: _BuildContext,
  task: _DtsTask | _DtsWatchTask
): Promise<_DtsResult> {
  const {config, cwd, dist, files, ts} = ctx

  if (!ts.config || !ts.configPath) {
    return {type: 'dts', messages: [], results: []}
  }

  const distPath = path.resolve(cwd, dist)

  const {outDir = distPath, rootDir = cwd} = ts.config.options

  await _buildTypes({
    cwd,
    outDir: outDir,
    tsconfig: ts.config,
  })

  const messages: ExtractorMessage[] = []

  const results: {sourcePath: string; filePath: string}[] = []

  for (const entry of task.entries) {
    const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

    const sourcePath = path.resolve(
      outDir,
      path.relative(cwd, rootDir),
      entry.sourcePath.replace(/\.ts$/, '.d.ts')
    )

    const filePath = path.relative(distPath, path.resolve(cwd, entry.targetPath))

    const result = await _extractTypes({
      cwd,
      exportPath,
      files,
      filePath,
      projectPath: cwd,
      rules: config?.extract?.rules,
      sourcePath,
      tsconfigPath: path.resolve(cwd, ts.configPath),
      distPath,
    })

    results.push({sourcePath, filePath})

    messages.push(...result.messages)

    if (result.messages.some((msg) => msg.logLevel === 'error')) {
      throw new _DtsError('encountered errors when extracting types', result.messages)
    }
  }

  const tmpPath = path.resolve(distPath, '__tmp__')

  await rename(outDir, tmpPath)

  for (const result of results) {
    const fromPath = path.resolve(
      tmpPath,
      path.relative(outDir, path.resolve(distPath, result.filePath))
    )

    const toPath = path.resolve(distPath, result.filePath)

    cpx.copySync(fromPath, path.dirname(toPath))
  }

  await rimraf(tmpPath)

  return {type: 'dts', messages, results}
}
