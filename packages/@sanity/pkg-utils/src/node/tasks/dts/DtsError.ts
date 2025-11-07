import type {ExtractorMessage} from '@microsoft/api-extractor'

/** @internal */
export class DtsError extends Error {
  messages: ExtractorMessage[]

  constructor(message: string, messages: ExtractorMessage[]) {
    super(message)
    this.messages = messages
  }
}
