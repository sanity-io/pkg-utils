import path from 'path'
import {promisify} from 'util'
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

  if (!ts.config || !ts.configPath) return {type: 'dts', messages: []}

  const sourcePath = task.sourcePath
  const exportPath = task.exportPath === '.' ? './index' : task.exportPath
  const distPath = path.resolve(cwd, dist)
  const filePath = path.relative(distPath, path.resolve(cwd, task.targetPath))

  const tmpDirPath = path.resolve(distPath, '__dts__')
  const tmpDir = {
    path: tmpDirPath,
    removeCallback: () => rimraf(tmpDirPath),
  }

  const types = await _buildTypes({
    cwd,
    outDir: tmpDir.path,
    sourcePath,
    tsconfig: ts.config,
  })

  const {messages} = await _extractTypes({
    cwd,
    exportPath,
    files,
    filePath,
    projectPath: cwd,
    rules: config?.extract?.rules,
    sourcePath: types.path,
    tsconfigPath: path.resolve(cwd, ts.configPath),
    distPath,
  })

  await tmpDir.removeCallback()

  if (messages.some((msg) => msg.logLevel === 'error')) {
    throw new _DtsError('encountered errors when extracting types', messages)
  }

  return {type: 'dts', messages}
}
