export * from './module2'

/**
 * @internal
 */
export interface _Dummy {
  field: string
}

declare module './module2' {
  export interface IncludedModuleDummy {
    addedField: string
  }
}

// Note: dont remove these blocks, they test that we dont include them in the final bundle

/*
  declare module './module2' {
   interface BlockCommentDummy {
     field: string
   }
  }
    */

// declare module './module2' {
//  interface CommentDummy {
//    field: string
//  }
// }
