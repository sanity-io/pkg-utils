import {_loadConfig, _loadPkgWithReporting} from './_core'
import {_printPackageTree} from './_printPackageTree'
import {_resolveBuildContext} from './_resolveBuildContext'
import {_resolveBuildTasks} from './_resolveBuildTasks'
import {_spinner} from './_spinner'
import {_BuildTask, _TaskHandler, _buildTaskHandlers} from './_tasks'

/** @public */
export async function build(options: {cwd: string; tsconfig?: string}): Promise<void> {
  const {cwd, tsconfig = 'tsconfig.json'} = options

  const pkg = await _loadPkgWithReporting({cwd})
  const config = await _loadConfig({cwd})

  const ctx = await _resolveBuildContext({config, cwd, pkg, tsconfig})

  const buildTasks = _resolveBuildTasks(ctx)

  for (const task of buildTasks) {
    const handler = _buildTaskHandlers[task.type] as _TaskHandler<_BuildTask>
    const taskName = handler.name(ctx, task)

    const spinner = _spinner(taskName)

    try {
      const result = await handler.exec(ctx, task).toPromise()

      spinner.complete()
      ctx.logger.log()

      handler.complete(ctx, task, result)
    } catch (err) {
      spinner.error()

      if (err instanceof Error) {
        const RE_CWD = new RegExp(`${cwd}`, 'g')

        ctx.logger.error(err.message.replace(RE_CWD, '.'))
        ctx.logger.log()
      }

      handler.error(ctx, task, err)

      process.exit(1)
    }
  }
}
