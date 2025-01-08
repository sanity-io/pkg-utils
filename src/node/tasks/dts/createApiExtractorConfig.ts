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

  // When the module is 'preserve' it's necessary to override the tsconfig file as api-extractor doesn't handle it out of the box
  const workaroundModulePreserve = tsconfig.options.module === ts.ModuleKind.Preserve
  // If `paths` are used for self-referencing imports (e.g. the module is named `sanity`, and the `sanity/structure` export is also importing from `sanity/router`),
  const workaroundPaths = !!tsconfig.options.paths

  const overrideTsconfig = {
    extends: tsconfigPath,
    compilerOptions: {},
  }

  if (workaroundModulePreserve) {
    Object.assign(overrideTsconfig.compilerOptions, {
      // Set the equivalent options to `module: 'Preserve'`
      // https://github.com/microsoft/TypeScript/pull/56785/files?file-filters%5B%5D=.js&file-filters%5B%5D=.json&file-filters%5B%5D=.symbols&file-filters%5B%5D=.ts&file-filters%5B%5D=.types&show-viewed-files=true#diff-31d3c12bafea26bc9e8c8a77920c41af0c593206442add70c45a06c063767445
      module: 'ESNext',
      moduleResolution: 'Bundler',
      esModuleInterop: true,
      resolveJsonModule: true,
    })
  }

  if (workaroundPaths) {
    Object.assign(overrideTsconfig.compilerOptions, {
      // An empty object replaces whatever is in the original tsconfig file
      paths: {},
    })
  }

  return {
    apiReport: {
      enabled: false,
      reportFileName: '<unscopedPackageName>.api.md',
    },
    bundledPackages,

    compiler:
      workaroundModulePreserve || workaroundPaths
        ? {overrideTsconfig}
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
