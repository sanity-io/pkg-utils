import cac from 'cac'
import {version} from '../../package.json'

const cli = cac()

// default commands checks package status
cli
  .command('', 'Check')
  .option('--strict', 'Strict mode')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    const {checkAction: statusAction} = await import('./checkAction')

    return statusAction(options)
  })

cli
  .command('build', 'Build package')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    const {buildAction} = await import('./buildAction')

    return buildAction(options)
  })

cli
  .command('watch', 'Watch package')
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
