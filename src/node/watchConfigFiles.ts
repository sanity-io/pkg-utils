import path from 'path'
import chalk from 'chalk'
import {Observable} from 'rxjs'
import {distinctUntilChanged, scan, startWith} from 'rxjs/operators'
import {_globFiles} from './_globFiles'
import {_watchFiles} from './_watchFiles'

export async function _watchConfigFiles(options: {cwd: string}): Promise<Observable<string[]>> {
  const {cwd} = options

  const initialFiles = await _globFiles([
    path.resolve(cwd, 'package.json'),
    path.resolve(cwd, 'package.config.cjs'),
    path.resolve(cwd, 'package.config.js'),
    path.resolve(cwd, 'package.config.ts'),
  ])

  const fileEvent$ = _watchFiles([
    path.resolve(cwd, 'package.json'),
    path.resolve(cwd, 'package.config.cjs'),
    path.resolve(cwd, 'package.config.js'),
    path.resolve(cwd, 'package.config.ts'),
  ])

  return fileEvent$.pipe(
    scan((files, fileEvent) => {
      if (fileEvent.type === 'add') {
        return files.concat(fileEvent.file)
      }

      if (fileEvent.type === 'unlink') {
        return files.filter((f) => f !== fileEvent.file)
      }

      if (fileEvent.type === 'change') {
        /* eslint-disable no-console */
        console.log(
          '--------------------------------------------------------------------------------'
        )
        console.log(chalk.blue('info  '), path.relative(cwd, fileEvent.file), 'changed')
        console.log('')
        /* eslint-enable no-console */

        return files.slice(0) // trigger update
      }

      return files
    }, initialFiles),
    startWith(initialFiles),
    distinctUntilChanged()
  )
}
