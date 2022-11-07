import outdent from 'outdent'
import {expect, test} from 'vitest'
import {_extractModuleBlocks} from '../src/node/_tasks/dts/_declareModuleFix'

test('extract module block', () => {
  const blocks = _extractModuleBlocks(
    outdent`
    interface A {}

    declare module X {
      /**
       * @beta
       **/
      interface A {
          a: string
      }
    }

      /** @public */
      declare module TT {
        interface X {
            x: string
        }
      }

      declare module YY {
        interface Y {
            y: string
        }
      }

      const a = 0; /*declare module 'sanity' {}*/ const b = 0;
/*declare module 'sanity' {}*/
      /* declare module 'sanity' {} */

       /**
       * declare module 'sanity' {
       *  export interface StringOptions {
       *    myCustomOption?: boolean
       *  }
       * }
       * /

 /*
     declare module 'BB' {
      export interface BB {
        a: string
      }
     }
        * /
  `
  )

  expect(blocks.length).toEqual(3)

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

  expect(blocks[2]).toEqual(outdent`
    declare module YY {
      interface Y {
          y: string
      }
    }`)
})
