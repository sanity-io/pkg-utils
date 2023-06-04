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
  .action(async (options) => {
    const {buildAction} = await import('./buildAction')

    return buildAction(options)
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
