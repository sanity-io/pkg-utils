import path from 'path'
import chalk from 'chalk'
import {Observable} from 'rxjs'
import {distinctUntilChanged, scan, startWith} from 'rxjs/operators'
import {globFiles} from './globFiles'
import {watchFiles} from './watchFiles'

export async function watchConfigFiles(options: {cwd: string}): Promise<Observable<string[]>> {
  const {cwd} = options

  const initialFiles = await globFiles([
    path.resolve(cwd, 'package.json'),
    path.resolve(cwd, 'package.config.cjs'),
    path.resolve(cwd, 'package.config.js'),
    path.resolve(cwd, 'package.config.ts'),
  ])

  const fileEvent$ = watchFiles([
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
