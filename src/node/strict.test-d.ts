import {expectTypeOf, test} from 'vitest'

import type {InferredStrictOptions, StrictOptions} from './strict'

test('the zod schema types matches the manual types', () => {
  expectTypeOf<StrictOptions>().toEqualTypeOf<Partial<InferredStrictOptions>>()
})
