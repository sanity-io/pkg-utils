import {lstat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {fileExists} from './fileExists'
import {isEmptyDirectory} from './isEmptyDirectory'
import {createLogger} from './logger'

/** @public */
export async function init(options: {cwd: string; path: string}): Promise<void> {
  const [{createFromTemplate}, {defaultTemplate}] = await Promise.all([
    import('./core/template'),
    import('./templates/default/template'),
  ])
  if (!options.cwd) {
    throw new Error('Missing required option: cwd')
  }

  if (!options.path) {
    throw new Error('Missing required option: path')
  }

  const logger = createLogger()

  const packagePath = resolve(options.cwd, options.path)

  await ensurePackagePath(packagePath)

  await createFromTemplate({
    cwd: options.cwd,
    logger,
    template: defaultTemplate,
    packagePath,
  })
}

async function ensurePackagePath(packagePath: string): Promise<void> {
  const {mkdirp} = await import('mkdirp')
  const exists = fileExists(packagePath)

  if (!exists) {
    await mkdirp(packagePath)

    return
  }

  const dir = (await lstat(packagePath)).isDirectory()

  if (!dir) {
    throw new Error('the package path is a file, not a directory')
  }

  const empty = await isEmptyDirectory(packagePath)

  if (!empty) {
    throw new Error('the package directory is not empty')
  }
}
