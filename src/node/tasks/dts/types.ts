import {ExtractorMessage} from '@microsoft/api-extractor'

/** @internal */
export interface DtsWatchTask {
  type: 'watch:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPath: string
  }[]
}

/** @internal */
export interface DtsTask {
  type: 'build:dts'
  entries: {
    exportPath: string
    importId: string
    sourcePath: string
    targetPath: string
  }[]
}

/** @internal */
export interface DtsResult {
  type: 'dts'
  messages: ExtractorMessage[]
  results: {sourcePath: string; filePath: string}[]
}
