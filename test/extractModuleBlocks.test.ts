import outdent from 'outdent'
import {expect, test} from 'vitest'
import {_extractModuleBlocks} from '../src/node/_tasks/dts/_extractModuleBlocks'

test('extract module block', () => {
  const blocks = _extractModuleBlocks(
    `
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
        /** @public */
        interface X {
            x: string
        }
      }

      declare module YY {
        /** @internal */
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
        */
  `
  )

  expect(blocks.length).toEqual(3)

  expect(blocks[0]).toEqual(outdent`
    declare module X {
      /**
       * @beta
       **/
      interface A {
          a: string
      }
    }`)

  expect(blocks[1]).toEqual(outdent`
    /** @public */
    declare module TT {
      /** @public */
      interface X {
          x: string
      }
    }`)

  expect(blocks[2]).toEqual(outdent`
    declare module YY {
      /** @internal */
      interface Y {
          y: string
      }
    }`)
})
