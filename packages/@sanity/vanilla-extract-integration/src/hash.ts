import crypto from 'node:crypto'

/**
 * Ported from `@vanilla-extract/integration` (MIT licensed, Copyright (c) 2021 SEEK).
 * @internal
 */
export const hash = (value: string): string => crypto.createHash('md5').update(value).digest('hex')
