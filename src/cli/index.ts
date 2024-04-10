import cac from 'cac'

import {version} from '../../package.json'

const cli = cac()

cli
  .command('', 'Check')
  .alias('check') // alias to align with the action name
  .option('--strict', 'Strict mode')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    const {checkAction} = await import('./checkAction')

    return checkAction(options)
  })

cli
  .command('build', 'Build package')
  .option('--emitDeclarationOnly', 'Emit d.ts only')
  .option('--strict', 'Strict mode')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .option('--check', 'Run the check command after build (same as running `pkg build && pkg check`)')
  .option('--clean', 'Clean the dist directory before building')
  .action(async (options) => {
    const {check = false, ...buildOptions} = options
    const {buildAction} = await import('./buildAction')

    await buildAction(buildOptions)

    if (check) {
      const {checkAction} = await import('./checkAction')

      await checkAction({
        strict: options.strict,
        tsconfig: options.tsconfig,
      })
    }
  })

cli.command('init [path]', 'Initialize package').action(async (p) => {
  const {initAction} = await import('./initAction')

  return initAction({
    path: p,
  })
})

cli
  .command('watch', 'Watch package')
  .option('--strict', 'Strict mode')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    const {watchAction} = await import('./watchAction')

    return watchAction(options)
  })

// Display help message when `-h` or `--help` appears
cli.help()

// Display version number when `-v` or `--version` appears
// It's also used in help message
cli.version(version)

cli.parse()
