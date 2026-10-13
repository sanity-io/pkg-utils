import {mkdir, readFile, rm} from 'node:fs/promises'
import path from 'node:path'
import {describe, expect, test} from 'vitest'
import {alignFixtureClasses, normalizeClassRecord, replaceClasses} from './compare.ts'
import {
  describeResult,
  outputRoot,
  parseFixtureClassNames,
  runSanityCommand,
  studioRoot,
  type FixtureClassNames,
  type PluginImplementation,
} from './helpers.ts'
import {classNameExpectation, schemaExtractVariants, type StudioVariant} from './variants.ts'

/**
 * `sanity schema extract` evaluates `sanity.config.ts` (and through it the `.css.ts` modules)
 * in the CLI's Node.js worker, where the vanilla-extract plugin runs inside a Vite server
 * configured with `ssr.noExternal: true` — a very different environment from `sanity dev` /
 * `sanity build`. The fixture schema embeds the generated class names in a field description,
 * so the extracted schema also compares identifier output across implementations.
 */
async function extractSchema(
  implementation: PluginImplementation,
  variant: StudioVariant,
): Promise<{schema: unknown; classNames: FixtureClassNames}> {
  const schemaPath = path.join(outputRoot, 'schema', `${implementation}-${variant.slug}.json`)
  await mkdir(path.dirname(schemaPath), {recursive: true})
  await rm(schemaPath, {force: true})
  const result = await runSanityCommand(
    // The CLI resolves `--path` against the working directory (absolute paths included)
    ['schema', 'extract', '--path', path.relative(studioRoot, schemaPath)],
    implementation,
    variant.env,
  )
  expect(
    result.exitCode,
    `sanity schema extract (${implementation}): ${describeResult(result)}`,
  ).toBe(0)

  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as unknown
  const documentType = (schema as {name?: string}[]).find(
    (type) => type.name === 'veStyledDocument',
  )
  expect(documentType, 'expected the veStyledDocument type in the extracted schema').toBeTruthy()
  const classNames = parseFixtureClassNames(JSON.stringify(documentType))
  expect(classNames, 'expected the class-name description in the extracted schema').toBeTruthy()
  return {schema, classNames: classNames!}
}

function expectClassNameFormat(classNames: FixtureClassNames, variant: StudioVariant): void {
  // The schema-extraction worker runs in development mode, so plugin-default identifiers
  // resolve to `debug`
  const {pattern, firstClassPrefixes} = classNameExpectation(variant.identifiers, 'debug')
  for (const [exportName, classList] of Object.entries(classNames)) {
    for (const className of classList.split(' ')) {
      expect(className, `${exportName} class ${className}`).toMatch(pattern)
    }
    if (firstClassPrefixes) {
      const prefix = firstClassPrefixes[exportName as keyof FixtureClassNames]
      expect(classList, `${exportName} debug ID`).toMatch(new RegExp(`^${prefix}`))
    }
  }
}

describe('sanity schema extract', () => {
  test.each(schemaExtractVariants.map((variant) => [variant.slug, variant] as const))(
    '%s: fork output structurally matches the upstream reference',
    async (_slug, variant) => {
      // The upstream plugin is the reference for expected output
      const upstream = await extractSchema('upstream', variant)
      expectClassNameFormat(upstream.classNames, variant)

      const fork = await extractSchema('fork', variant)
      expectClassNameFormat(fork.classNames, variant)

      // The fork salts its file-scope hash with the package version and content (SAPP-4639)
      // while upstream hashes the bare `packageName + filePath`, so the class names
      // legitimately differ — compare everything except the salted hash values
      const alignment = alignFixtureClasses(fork.classNames, upstream.classNames)
      expect(normalizeClassRecord({...fork.classNames}, alignment.forkToPlaceholder)).toEqual(
        normalizeClassRecord({...upstream.classNames}, alignment.upstreamToPlaceholder),
      )
      expect(
        JSON.parse(replaceClasses(JSON.stringify(fork.schema), alignment.forkToPlaceholder)),
      ).toEqual(
        JSON.parse(
          replaceClasses(JSON.stringify(upstream.schema), alignment.upstreamToPlaceholder),
        ),
      )
    },
  )
})
