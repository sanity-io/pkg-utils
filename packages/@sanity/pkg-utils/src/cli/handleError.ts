import {styleText} from 'node:util'

export function handleError(err: unknown): void {
  if (err instanceof Error) {
    console.error(styleText('red', 'error', {stream: process.stderr}), err.stack)
  } else {
    console.error(err)
  }

  process.exit(1)
}
