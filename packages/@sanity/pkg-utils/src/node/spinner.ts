// oxlint-disable no-console
import {styleText} from 'node:util'

export function createSpinner(
  msg: string,
  quiet = false,
): {complete: () => void; error: () => void} {
  const startTime = Date.now()

  if (!quiet) console.log(msg)

  return {
    complete: () => {
      if (!quiet)
        console.log(
          `${styleText('green', '[success]')} ${styleText('gray', `${Date.now() - startTime}ms`)}`,
        )
    },
    error: () => {
      console.log(
        `${styleText('red', '[error]')} ${styleText('gray', `${Date.now() - startTime}ms`)}`,
      )
    },
  }
}
