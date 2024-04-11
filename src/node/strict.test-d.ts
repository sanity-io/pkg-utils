import {expectTypeOf, test} from 'vitest'

import {InferredStrictOptions, StrictOptions} from './strict'

test('the zod schema types matches the manual types', () => {
  expectTypeOf<StrictOptions>().toEqualTypeOf<Partial<InferredStrictOptions>>()
})
