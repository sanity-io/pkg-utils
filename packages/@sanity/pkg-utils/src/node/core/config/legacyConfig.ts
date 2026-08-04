/**
 * Migration checks for `package.config.ts` options that were removed or deprecated in v12,
 * when `@sanity/pkg-utils` moved from its rollup/rolldown stack onto `tsdown` +
 * `@sanity/tsdown-config`.
 *
 * Removed options are "tombstoned": they stay declared on `PkgConfigOptions` (typed `never`,
 * tagged `@deprecated`) so editors surface the migration path, and the checks below throw a
 * runtime error with copy-pasteable migration instructions when they are set anyway — JS
 * configs bypass the types, and the error text is written to be actionable for humans and
 * agents alike.
 *
 * The checks are gated by the `legacyChecks` option, defaulting to on outside production
 * builds (`process.env.NODE_ENV !== 'production'`) so they add no overhead where migration
 * mistakes can no longer surface.
 */

const MIGRATION_GUIDE_URL =
  'https://github.com/sanity-io/pkg-utils/blob/main/packages/@sanity/pkg-utils/MIGRATE.md'

interface LegacyCheck {
  option: string
  migration: string[]
}

const tombstones: LegacyCheck[] = [
  {
    option: 'tsgo',
    migration: [
      'The `dts` option is now passed through to tsdown as-is. Move the flag into it:',
      '',
      '  // package.config.ts',
      '  export default defineConfig({',
      '    dts: {tsgo: true},',
      '  })',
    ],
  },
  {
    option: 'extract',
    migration: [
      'TSDoc/release-tag checking is configured with the top-level `tsdoc` option:',
      '',
      '  // extract: {enabled: false}          -> tsdoc: false',
      '  // extract: {rules: {...}}            -> tsdoc: {rules: {...}}',
      '  // extract: {customTags: [...]}       -> tsdoc: {customTags: [...]}',
      '',
      'Type inlining (`extract.bundledPackages`) follows the bundling decisions now:',
      'devDependencies that are imported are inlined automatically (types included), and',
      '`deps: {alwaysBundle: [...]}` forces inlining a dependency/peerDependency.',
      '',
      '`extract.checkTypes` has no successor: type generation no longer type-checks',
      '(run `tsc --noEmit` for type checking).',
    ],
  },
  {
    option: 'babel',
    migration: [
      'The Babel options moved to the top level:',
      '',
      '  // babel: {reactCompiler: true}       -> reactCompiler: true',
      '  // babel: {styledComponents: true}    -> styledComponents: true',
      '',
      '`styledComponents` now uses oxc\u2019s native port of `babel-plugin-styled-components`,',
      'so `babel-plugin-styled-components` can be uninstalled.',
      '',
      'Custom Babel plugins (`babel.plugins`) run through the `plugins` option instead,',
      'with a self-installed `@rolldown/plugin-babel`:',
      '',
      '  import pluginBabel from "@rolldown/plugin-babel"',
      '  export default defineConfig({',
      '    plugins: [await pluginBabel({plugins: ["babel-plugin-example"]})],',
      '  })',
    ],
  },
  {
    option: 'rollup',
    migration: [
      'The rollup stack was replaced with tsdown:',
      '',
      '  // rollup: {vanillaExtract: true}     -> vanillaExtract: true',
      '  // rollup: {plugins: [...]}           -> plugins: [...] (rolldown plugins; most',
      '  //                                       Rollup plugins are compatible)',
      '',
      '`rollup.output`, `rollup.treeshake`, `rollup.experimentalLogSideEffects` and',
      '`rollup.hashChunkFileNames` have no successor (chunk filenames are content-hashed now).',
      '',
      '`rollup.optimizeLodash` has no successor either \u2014 and neither does the implicit',
      'lodash-import optimization that was applied whenever `lodash` was a dependency.',
      'Preferably drop lodash altogether (see https://e18e.dev for module replacements like',
      '`es-toolkit`), or import from `lodash-es`, which tree-shakes in consumers without',
      'build-time rewriting.',
    ],
  },
  {
    option: 'reactCompilerOptions',
    migration: [
      'Pass the compiler options to `reactCompiler` instead:',
      '',
      '  // babel: {reactCompiler: true}, reactCompilerOptions: {target: "18"}',
      '  // becomes:',
      '  reactCompiler: {target: "18"}',
    ],
  },
  {
    option: 'jsx',
    migration: [
      'Configure JSX through `tsconfig.json` \u2014 the bundler reads it from there:',
      '',
      '  // tsconfig.json',
      '  {"compilerOptions": {"jsx": "react-jsx"}}',
    ],
  },
  {
    option: 'jsxFactory',
    migration: ['Configure JSX through `tsconfig.json` (`compilerOptions.jsxFactory`).'],
  },
  {
    option: 'jsxFragment',
    migration: ['Configure JSX through `tsconfig.json` (`compilerOptions.jsxFragmentFactory`).'],
  },
  {
    option: 'jsxImportSource',
    migration: ['Configure JSX through `tsconfig.json` (`compilerOptions.jsxImportSource`).'],
  },
]

/**
 * Throws for tombstoned options and warns for grandfathered ones. `config` is the raw loaded
 * config object (before it is narrowed to `PkgConfigOptions`), so removed options are still
 * observable.
 * @internal
 */
export function runLegacyConfigChecks(config: Record<string, unknown>): void {
  const legacyChecks =
    typeof config['legacyChecks'] === 'boolean'
      ? config['legacyChecks']
      : process.env['NODE_ENV'] !== 'production'

  if (!legacyChecks) return

  for (const {option, migration} of tombstones) {
    if (config[option] === undefined) continue

    throw new Error(
      [
        `package.config.ts: the \`${option}\` option was removed in @sanity/pkg-utils v12.`,
        '',
        ...migration,
        '',
        `Full migration guide: ${MIGRATION_GUIDE_URL}`,
        'Set `legacyChecks: false` in package.config.ts to skip this validation (it is also',
        'skipped when NODE_ENV=production).',
      ].join('\n'),
    )
  }

  // `dts` survived, but as a tsdown passthrough object — the old mode strings are tombstoned
  // with value-specific migration instructions.
  const dts = config['dts']
  if (typeof dts === 'string') {
    throw new Error(
      [
        `package.config.ts: \`dts: '${dts}'\` was removed in @sanity/pkg-utils v12 — the \`dts\``,
        'option is now passed through to tsdown as-is (an options object, or `false`).',
        '',
        ...(dts === 'rolldown'
          ? [
              "`dts: 'rolldown'` is the default behavior now: delete the option. Options that",
              'accompanied it move into the object, e.g. `tsgo: true` becomes `dts: {tsgo: true}`.',
            ]
          : [
              "`dts: 'api-extractor'` type generation was removed. Types are generated with",
              'tsdown (rolldown-plugin-dts); api-extractor remains as the TSDoc/release-tag',
              'checking that runs during `pkg check` — configure it with the `tsdoc` option.',
            ]),
        '',
        `Full migration guide: ${MIGRATION_GUIDE_URL}`,
        'Set `legacyChecks: false` in package.config.ts to skip this validation (it is also',
        'skipped when NODE_ENV=production).',
      ].join('\n'),
    )
  }

  // Grandfathered: `external` still works (mapped onto tsdown's `deps`), with a nudge toward
  // its successor.
  if (config['external'] !== undefined) {
    // eslint-disable-next-line no-console -- config-load-time deprecation warning
    console.warn(
      [
        'package.config.ts: `external` is deprecated. Use `deps: {neverBundle: [...]}` to mark',
        'dependencies as external, and `deps: {alwaysBundle: [...]}` to bundle a dependency',
        '(the callback pattern that filtered entries out of the defaults).',
      ].join('\n'),
    )
  }
}
