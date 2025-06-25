// Based on https://stackblitz.com/github/Lukinoh/repro-api-extractor-bug

export class ClassExample {
  field1!: number
  field2!: string
}

export const f1 = () => new ClassExample()
