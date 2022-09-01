import cac from 'cac'
import {build} from './build'
import {check} from './check'

const cli = cac()

cli
  .command('build', 'Build package')
  .option('--extract', 'Extract API reference')
  .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    await build({
      cwd: process.cwd(),
      extract: options.extract ? Boolean(options.extract) : undefined,
      tsconfig: options.tsconfig,
    })
  })

cli
  .command('check', 'Check package')
  // .option('--tsconfig [tsconfig]', '[string] tsconfig.json')
  .action(async (options) => {
    await check({
      cwd: process.cwd(),
      // extract: options.extract ? Boolean(options.extract) : undefined,
      // tsconfig: options.tsconfig,
    })
  })

// Display help message when `-h` or `--help` appears
cli.help()

// Display version number when `-v` or `--version` appears
// It's also used in help message
cli.version('0.0.0')

cli.parse()
