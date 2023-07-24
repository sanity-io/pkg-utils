import chalk from 'chalk'
import {writeFile} from 'fs/promises'
import {mkdirp} from 'mkdirp'
import path from 'path'
import {from} from 'rxjs'

import {BuildContext} from '../../core'
import {NodeReExportFromCJSTask, TaskHandler} from '../types'

/** @internal */
export const nodeReexportCjsTask: TaskHandler<NodeReExportFromCJSTask> = {
  name: (_ctx, task) =>
    [
      `Re-export CommonJS module in ESM wrapper…`,
      `  entries:`,
      ...task.entries.map((entry) =>
        [
          `    - ${chalk.cyan(entry.importId)}: `,
          `${chalk.yellow(entry.require)} ${chalk.gray('→')} ${chalk.yellow(entry.import)}`,
        ].join('')
      ),
    ].join('\n'),
  exec: (ctx, task) => {
    return from(exec(ctx, task))
  },
  complete: () => {
    //
  },
  error: (_ctx, _task, err) => {
    // eslint-disable-next-line no-console
    console.error(err)
  },
}

async function exec(ctx: BuildContext, task: NodeReExportFromCJSTask) {
  const {cwd} = ctx

  for (const entry of task.entries) {
    const sourcePath = path.resolve(cwd, entry.require)
    const targetPath = path.resolve(cwd, entry.import)
    const targetDir = path.dirname(targetPath)

    await mkdirp(targetDir)

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(sourcePath)

    let relativeImport = `./${path.relative(targetDir, sourcePath)}`

    // Strip leading "./" from relative import
    if (relativeImport.startsWith('./.')) {
      relativeImport = relativeImport.slice(2)
    }

    const code = compileESMWrapper(mod, relativeImport)

    await writeFile(targetPath, code, 'utf8')
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function compileESMWrapper(mod: any, relativeImport: string) {
  const keys = Object.keys(mod).filter((k) => k !== '__esModule')

  let code = `import cjs from '${relativeImport}';\n`

  if (keys.length) {
    code += `\n`
    code += keys
      .filter((k) => (mod.__esModule ? k !== 'default' : true))
      .map((k) => `export const ${k} = cjs.${k};\n`)
      .join('')
  }

  code += `\n`

  if (mod.__esModule) {
    code += `export default cjs.default;\n`
  } else {
    code += `export default cjs;\n`
  }

  return code
}
