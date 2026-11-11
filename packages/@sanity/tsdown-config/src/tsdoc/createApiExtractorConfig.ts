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
   * Only `compilerOptions.paths` and `compilerOptions.types` are read: when `paths` is present,
   * API Extractor gets an override that clears it so self-referencing package imports resolve
   * through `node_modules` instead, and when `types` is unset it is overridden to `['*']`.
   */
  tsconfig: {options: {paths?: unknown; types?: unknown}}
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

  const compilerOptions = {
    // An empty object replaces whatever is in the original tsconfig file
    ...(tsconfig.options.paths ? {paths: {}} : {}),
    // API Extractor >= 7.60 bundles TypeScript 6, which defaults `types` to `[]`, so emitted
    // declarations that lean on an ambient `@types/*` global (e.g. `React.JSX.Element` without
    // an import) would no longer resolve. `'*'` restores the pre-6.0 default of including every
    // `@types` package. The dependency floor is 7.60 so this is never handed to TypeScript 5.9.
    ...(tsconfig.options.types ? {} : {types: ['*']}),
  }

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,

    // If `paths` are used for self-referencing imports (e.g. the module is named `sanity`, and the `sanity/structure` export is also importing from `sanity/router`),
    compiler: Object.keys(compilerOptions).length
      ? {overrideTsconfig: {extends: tsconfigPath, compilerOptions}}
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
