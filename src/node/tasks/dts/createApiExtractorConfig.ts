import path from 'node:path'
import type {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'
import ts from 'typescript'

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
  } = options

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,

    // If `paths` are used for self-referencing imports (e.g. the module is named `sanity`, and the `sanity/structure` export is also importing from `sanity/router`),
    compiler: tsconfig.options.paths
      ? {
          overrideTsconfig: {
            extends: tsconfigPath,
            compilerOptions: {
              // An empty object replaces whatever is in the original tsconfig file
              paths: {},
            },
          },
        }
      : {tsconfigFilePath: tsconfigPath},

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
