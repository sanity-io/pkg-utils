import {PassThrough} from 'node:stream'
import {createReadableStreamFromReadable} from '@react-router/node'
import {renderToPipeableStream} from 'react-dom/server'
import {ServerRouter, type EntryContext} from 'react-router'

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const {pipe, abort} = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
        onShellReady() {
          const body = new PassThrough()
          const stream = createReadableStreamFromReadable(body)
          responseHeaders.set('Content-Type', 'text/html')
          resolve(new Response(stream, {headers: responseHeaders, status: responseStatusCode}))
          pipe(body)
        },
        onShellError(error) {
          reject(error)
        },
        onError() {
          // eslint-disable-next-line no-param-reassign
          responseStatusCode = 500
        },
      },
    )

    setTimeout(abort, 5000)
  })
}
