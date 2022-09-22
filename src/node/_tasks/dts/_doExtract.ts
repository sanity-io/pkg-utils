import path from 'path'
import {ExtractorMessage} from '@microsoft/api-extractor'
import {_BuildContext} from '../../_core'
import {_buildTypes} from './_buildTypes'
import {_DtsError} from './_DtsError'
import {_extractTypes} from './_extractTypes'
import {_DtsResult, _DtsTask, _DtsWatchTask} from './_types'

export async function _doExtract(
  ctx: _BuildContext,
  task: _DtsTask | _DtsWatchTask
): Promise<_DtsResult> {
  const {config, cwd, dist, files, ts} = ctx

  if (!ts.config || !ts.configPath) return {type: 'dts', messages: []}

  const distPath = path.resolve(cwd, dist)

  const {outDir = distPath, rootDir = cwd} = ts.config.options

  await _buildTypes({
    cwd,
    outDir: outDir,
    tsconfig: ts.config,
  })

  const messages: ExtractorMessage[] = []

  for (const entry of task.entries) {
    const exportPath = entry.exportPath === '.' ? './index' : entry.exportPath

    const filePath = path.relative(distPath, path.resolve(cwd, entry.targetPath))

    const result = await _extractTypes({
      cwd,
      exportPath,
      files,
      filePath,
      projectPath: cwd,
      rules: config?.extract?.rules,
      sourcePath: path.resolve(
        outDir,
        path.relative(cwd, rootDir),
        entry.sourcePath.replace(/\.ts$/, '.d.ts')
      ),
      tsconfigPath: path.resolve(cwd, ts.configPath),
      distPath,
    })

    messages.push(...result.messages)

    if (result.messages.some((msg) => msg.logLevel === 'error')) {
      throw new _DtsError('encountered errors when extracting types', result.messages)
    }
  }

  return {type: 'dts', messages}
}
