import path from 'node:path'

import type {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'
import ts from 'typescript'

import type {PkgRuntime} from '../../../node/core'

export function createApiExtractorConfig(options: {
  bundledPackages?: string[]
  distPath: string
  exportPath: string
  filePath: string
  messages: IExtractorMessagesConfig
  projectFolder: string
  mainEntryPointFilePath: string
  tsconfig: ts.ParsedCommandLine
  tsconfigPath: string
  runtime: PkgRuntime
}): IConfigFile {
  const {
    bundledPackages,
    distPath,
    exportPath,
    filePath,
    messages,
    projectFolder,
    mainEntryPointFilePath,
    tsconfig,
    tsconfigPath,
    runtime,
  } = options

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,

    compiler: {
      overrideTsconfig: {
        extends: tsconfigPath,
        compilerOptions: {
          // If `paths` are used for self-referencing imports (e.g. the module is named `sanity`, and the `sanity/structure` export is also importing from `sanity/router`),
          // An empty object replaces whatever is in the original tsconfig file
          paths: tsconfig.options.paths ? {} : undefined,
          customConditions:
            runtime === 'browser'
              ? ['api-extractor', 'browser']
              : runtime === 'node'
                ? ['api-extractor', 'node']
                : [],
        },
      },
    },
    // @TODO when api-extractor natively supports export conditions we can go back to this config:
    // compiler: {tsconfigFilePath: tsconfigPath}

    docModel: {
      enabled: false,
      apiJsonFilePath: path.resolve(distPath, `${exportPath}.api.json`),
    },
    dtsRollup: {
      enabled: true,
      untrimmedFilePath: path.resolve(distPath, filePath),
      // betaTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-beta.d.ts')),
      // publicTrimmedFilePath: path.resolve(distPath, filePath.replace('.d.ts', '-public.d.ts')),
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages,
    mainEntryPointFilePath,
    projectFolder,
  }
}
