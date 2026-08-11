import path from 'node:path'
import type {IConfigFile, IExtractorMessagesConfig} from '@microsoft/api-extractor'

/** @internal */
export function createApiExtractorConfig(options: {
  bundledPackages?: string[]
  distPath: string
  exportPath: string
  filePath: string
  messages: IExtractorMessagesConfig
  projectFolder: string
  mainEntryPointFilePath: string
  /**
   * Only `compilerOptions.paths` is read: when present, API Extractor gets an override that
   * clears `paths` so self-referencing package imports resolve through `node_modules` instead.
   */
  tsconfig: {options: {paths?: unknown}}
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
      // Types come from tsdown; this check only runs API Extractor's TSDoc/release-tag rules
      enabled: false,
      untrimmedFilePath: path.resolve(distPath, filePath),
    },
    tsdocMetadata: {
      enabled: false,
    },
    messages,
    mainEntryPointFilePath,
    projectFolder,
  }
}
