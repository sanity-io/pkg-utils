import {ExtractorMessage} from '@microsoft/api-extractor'

/** @internal */
export class _DtsError extends Error {
  messages: ExtractorMessage[]

  constructor(message: string, messages: ExtractorMessage[]) {
    super(message)
    this.messages = messages
  }
}
