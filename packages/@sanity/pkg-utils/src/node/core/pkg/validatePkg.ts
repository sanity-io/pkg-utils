import {parsePackage, _typoMap as typoMap, type PackageJSON} from '@sanity/parse-package-json'

export function validatePkg(input: unknown): PackageJSON {
  const pkg = parsePackage(input)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Need to check raw input for typos
  const invalidKey = Object.keys(input as PackageJSON).find((key) => {
    const needle = key.toUpperCase()

    return typoMap.has(needle) ? typoMap.get(needle) !== key : false
  })

  if (invalidKey) {
    throw new TypeError(
      `
- package.json: "${invalidKey}" is not a valid key. Did you mean "${typoMap.get(invalidKey.toUpperCase())}"?`,
    )
  }

  return pkg
}
