import {ExtractorMessage} from '@microsoft/api-extractor'

/** @internal */
export interface _DtsWatchTask {
  type: 'watch:dts'
  exportPath: string
  importId: string
  sourcePath: string
  targetPath: string
}

/** @internal */
export interface _DtsTask {
  type: 'build:dts'
  exportPath: string
  importId: string
  sourcePath: string
  targetPath: string
}

/** @internal */
export interface _DtsResult {
  type: 'dts'
  messages: ExtractorMessage[]
}
