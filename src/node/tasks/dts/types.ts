import type {ExtractorMessage} from '@microsoft/api-extractor'

import type {PkgRuntime} from '../../core'

/** @internal */
export interface DtsWatchTask {
  type: 'watch:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPaths: string[]
    runtime: PkgRuntime
  }[]
}

/** @internal */
export interface DtsTask {
  type: 'build:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPaths: string[]
    runtime: PkgRuntime
  }[]
}

/** @internal */
export interface DtsResult {
  type: 'dts'
  messages: ExtractorMessage[]
  results: {sourcePath: string; filePaths: string[]}[]
}
