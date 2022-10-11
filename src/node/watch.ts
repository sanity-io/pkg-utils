import path from 'path'
import {switchMap} from 'rxjs'
import {_loadConfig, _loadPkgWithReporting} from './_core'
import {_resolveBuildContext} from './_resolveBuildContext'
import {_resolveWatchTasks} from './_resolveWatchTasks'
import {_WatchTask, _TaskHandler, _watchTaskHandlers} from './_tasks'
import {_watchConfigFiles} from './_watchConfigFiles'

/** @public */
export async function watch(options: {
  cwd: string
  strict?: boolean
  tsconfig?: string
}): Promise<void> {
  const {cwd, strict = false, tsconfig = 'tsconfig.json'} = options

  const configFiles$ = await _watchConfigFiles({cwd})

  const ctx$ = configFiles$.pipe(
    switchMap(async (configFiles) => {
      const _files = configFiles.map((f) => path.relative(cwd, f))

      const packageJsonPath = _files.find((f) => f === 'package.json')

      if (!packageJsonPath) {
        throw new Error('missing package.json')
      }

      const pkg = await _loadPkgWithReporting({cwd})
      const config = await _loadConfig({cwd})

      return _resolveBuildContext({config, cwd, pkg, strict, tsconfig})
    })
  )

  ctx$.subscribe(async (ctx) => {
    const watchTasks = _resolveWatchTasks(ctx)

    for (const task of watchTasks) {
      const handler = _watchTaskHandlers[task.type] as _TaskHandler<_WatchTask, unknown>
      const result$ = handler.exec(ctx, task)

      result$.subscribe({
        error: (err) => {
          ctx.logger.error(err)
          ctx.logger.log()

          process.exit(1)
        },
        next: (result) => {
          handler.complete(ctx, task, result)
        },
        complete: () => {
          ctx.logger.success(handler.name(ctx, task))
          ctx.logger.log()
        },
      })
    }
  })
}
