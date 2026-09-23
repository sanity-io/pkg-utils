/**
 * Ported from `@vanilla-extract/css` (MIT licensed, Copyright (c) 2021 SEEK):
 * `packages/css/src/validateMediaQuery.ts`, with the `dedent` dependency replaced by a plain
 * string.
 */
import {toAST} from 'media-query-parser'

const createMediaQueryError = (mediaQuery: string, msg: string) =>
  new Error(
    [
      `Invalid media query: "${mediaQuery}"`,
      '',
      msg,
      '',
      'Read more on MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries/Using_media_queries',
    ].join('\n'),
  )

export const validateMediaQuery = (mediaQuery: string): void => {
  // Empty queries will start with '@media '
  if (mediaQuery === '@media ') {
    throw createMediaQueryError(mediaQuery, 'Query is empty')
  }

  try {
    toAST(mediaQuery)
  } catch (e) {
    throw createMediaQueryError(mediaQuery, e instanceof Error ? e.message : String(e))
  }
}
