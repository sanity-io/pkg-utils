import outdent from 'outdent'
import {expect, test} from 'vitest'
import {_extractModuleBlocks} from '../src/node/_tasks/dts/_declareModuleFix'

test('extract module block', () => {
  const blocks = _extractModuleBlocks(
    outdent`
    interface A {}

    declare module X {
      interface A {
          a: string
      }
    }

      declare module TT {
        interface X {
            x: string
        }
      }
  `
  )

  expect(blocks[0]).toEqual(outdent`
    declare module X {
      interface A {
          a: string
      }
    }`)

  expect(blocks[1]).toEqual(outdent`
    declare module TT {
      interface X {
          x: string
      }
    }`)
})
