import {ExtractorMessage} from '@microsoft/api-extractor'

/** @internal */
export interface _DtsWatchTask {
  type: 'watch:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPath: string
  }[]
}

/** @internal */
export interface _DtsTask {
  type: 'build:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPath: string
  }[]
}

/** @internal */
export interface _DtsResult {
  type: 'dts'
  messages: ExtractorMessage[]
  results: {sourcePath: string; filePath: string}[]
}
