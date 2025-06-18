export * from './module2.js'

/**
 * @internal
 */
export interface _Dummy {
  field: string
}

declare module './module2.js' {
  export interface IncludedModuleDummy {
    addedField: string
  }
}

// Note: dont remove these blocks, they test that we dont include them in the final bundle

/*
  declare module './module2.js' {
   interface BlockCommentDummy {
     field: string
   }
  }
    */

// declare module './module2.js' {
//  interface CommentDummy {
//    field: string
//  }
// }
