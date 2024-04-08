import {resolve} from 'node:path'

import getLatestVersion from 'get-latest-version'
import gitUrlParse from 'git-url-parse'
import {outdent} from 'outdent'
import parseGitConfig from 'parse-git-config'
import prettier, {type Config as PrettierConfig} from 'prettier'

import {
  defineTemplateOption,
  isRecord,
  type PackageJSON,
  type PkgTemplate,
  type PkgTemplateFile,
} from '../../core'

const RE_NAME = /^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)\/)?[a-z0-9-~][a-z0-9-._~]*$/i

export const defaultTemplate: PkgTemplate = async ({cwd, logger, packagePath}) => {
  const gitConfig = await parseGitConfig({cwd, type: 'global'})

  return {
    options: [
      defineTemplateOption<{owner: string; name: string}>({
        name: 'repo',
        type: 'string',
        description: 'git url',
        validate: (v) => {
          if (!v) return true

          try {
            gitUrlParse(v)

            return true
          } catch (err) {
            return 'invalid git url'
          }
        },
        parse: (v) => {
          if (!v) return null

          const result = gitUrlParse(v)

          return {source: result.source, owner: result.owner, name: result.name}
        },
      }),
      defineTemplateOption({
        name: 'pkgName',
        type: 'string',
        description: 'package name',
        initial: (options) => options.repo?.name || undefined,
        validate: (v) => {
          if (!v) return 'package name is required'

          const match = RE_NAME.exec(v)

          if (!match) {
            return 'invalid package name'
          }

          return true
        },
        parse: (v) => {
          if (!v) {
            throw new Error('package name is required')
          }

          const match = RE_NAME.exec(v)

          if (!match) {
            throw new Error('invalid package name')
          }

          const [scope, name] = v.split('/')

          return {scope, name, fullName: v}
        },
      }),
      defineTemplateOption({
        name: 'description',
        type: 'string',
        description: 'package description',
      }),
      defineTemplateOption({
        name: 'authorName',
        type: 'string',
        description: 'package author name',
        initial: gitConfig?.user?.name,
      }),
      defineTemplateOption({
        name: 'authorEmail',
        type: 'string',
        description: 'package author email',
        initial: gitConfig?.user?.email,
      }),
      defineTemplateOption({
        name: 'license',
        type: 'string',
        description: 'package license',
        initial: 'MIT',
        validate: (v) => {
          if (!v) return 'license is required'

          return true
        },
      }),
    ],

    features: [
      {
        name: 'eslint',
        optional: true,
        initial: true,
      },
      {
        name: 'prettier',
        optional: true,
        initial: true,
      },
      {
        name: 'typescript',
        optional: true,
        initial: true,
      },
    ],

    async getFiles(options, features) {
      const {pkgName, repo} = options
      const {fullName: name} = pkgName

      const author =
        [options.authorName, options.authorEmail && `<${options.authorEmail}>`]
          .filter(Boolean)
          .join(' ') ?? undefined

      const prettierConfig: PrettierConfig | undefined = features.prettier
        ? {
            bracketSpacing: false,
            plugins: ['prettier-plugin-packagejson'],
            printWidth: 100,
            quoteProps: 'consistent',
            semi: false,
            singleQuote: true,
            tabWidth: 2,
            overrides: [
              {
                files: ['*.yml'],
                options: {
                  singleQuote: false,
                },
              },
            ],
          }
        : undefined

      const pkgJson: PackageJSON & {
        prettier?: PrettierConfig
        ['lint-staged']?: Record<string, string[]>
      } = {
        name,
        'version': '0.0.0',
        'description': options.description ?? undefined,
        'keywords': [],
        'homepage': undefined,
        'bugs': undefined,
        'repository': undefined,
        'license': options.license,
        author,
        'sideEffects': false,
        'type': 'module',
        'exports': {
          '.': {
            types: undefined,
            source: features.typescript ? './src/index.ts' : './src/index.js',
            import: './dist/index.js',
            require: './dist/index.cjs',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        'main': './dist/index.cjs',
        'module': './dist/index.js',
        'source': features.typescript ? './src/index.ts' : './src/index.js',
        'types': undefined,
        'files': ['dist', 'src'],
        'scripts': {
          'build': 'run-s clean pkg:build pkg:check',
          'clean': 'rimraf dist',
          'format': features.prettier ? 'prettier --write --cache --ignore-unknown .' : undefined,
          'pkg:build': 'pkg build --strict',
          'pkg:check': 'pkg check --strict',
        },
        'lint-staged': features.prettier
          ? {
              '*': ['prettier --write --cache --ignore-unknown'],
            }
          : undefined,
        // prettier: prettierConfig,
        'browserslist': 'extends @sanity/browserslist-config',
        'dependencies': {},
        'devDependencies': {
          '@sanity/pkg-utils': '*',
          '@typescript-eslint/eslint-plugin': undefined,
          '@typescript-eslint/parser': undefined,
          'eslint': undefined,
          'eslint-config-prettier': undefined,
          'eslint-plugin-import': undefined,
          'eslint-plugin-prettier': undefined,
          'eslint-plugin-simple-import-sort': undefined,
          'lint-staged': '*',
          'npm-run-all': '*',
          'prettier': features.prettier ? '*' : undefined,
          'prettier-plugin-packagejson': features.prettier ? '*' : undefined,
          'rimraf': '*',
          'typescript': undefined,
        },
        'engines': {
          node: '>=18.0.0',
        },
      }

      const files: PkgTemplateFile[] = []

      // .editorconfig
      files.push({
        name: '.editorconfig',
        contents: outdent`
        root = true

        [*]
        charset = utf-8
        indent_style = space
        indent_size = 2
        end_of_line = lf
        insert_final_newline = true
        trim_trailing_whitespace = true
        `,
      })

      // .gitignore
      files.push({
        name: '.gitignore',
        contents: outdent`
        *.local
        *.log
        *.tgz

        .DS_Store
        dist
        etc
        node_modules
        `,
      })

      if (features.prettier) {
        files.push({
          name: '.prettierignore',
          contents: outdent`
          dist
          pnpm-lock.yaml
          `,
        })

        files.push({
          name: '.prettierrc',
          contents: await format(
            resolve(packagePath, '.prettierrc.json'),
            JSON.stringify(prettierConfig, null, 2) + '\n',
            prettierConfig,
          ),
        })
      }

      if (repo) {
        pkgJson.repository = {
          type: 'git',
          url: `git+ssh://git@${repo.source}/${repo.owner}/${repo.name}.git`,
        }
        pkgJson.bugs = {
          url: `https://${repo.source}/${repo.owner}/${repo.name}/issues`,
        }
        pkgJson.homepage = `https://${repo.source}/${repo.owner}/${repo.name}#readme`
      }

      if (features.typescript) {
        pkgJson.types = './dist/index.d.ts'

        pkgJson.scripts = {
          ...pkgJson.scripts,
          ['ts:check']: 'tsc --build',
        }

        const devDependencies = pkgJson.devDependencies

        if (isRecord(devDependencies)) {
          devDependencies['typescript'] = '*'
        }
      }

      if (features.eslint) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eslintConfig: any = {
          root: true,
          env: {
            browser: true,
            es6: true,
            node: true,
          },
          extends: [
            'eslint:recommended',
            features.prettier ? 'plugin:prettier/recommended' : undefined,
          ].filter(Boolean),
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
          },
          plugins: [
            'import',
            'simple-import-sort',
            features.prettier ? 'prettier' : undefined,
          ].filter(Boolean),
          rules: {
            'no-console': 'error',
            'no-shadow': 'error',
            'no-warning-comments': ['warn', {location: 'start', terms: ['todo', 'fixme']}],
            'quote-props': ['warn', 'consistent-as-needed'],
            'simple-import-sort/exports': 'warn',
            'simple-import-sort/imports': 'warn',
            'strict': ['warn', 'global'],
          },
        }

        files.push({
          name: '.eslintignore',
          contents: outdent`
          dist
          `,
        })

        pkgJson.scripts = {
          ...pkgJson.scripts,
          lint: features.typescript
            ? 'eslint . --ext .cjs,.js,.ts,.tsx'
            : 'eslint . --ext .cjs,.js',
        }

        pkgJson.devDependencies = {
          ...pkgJson.devDependencies,
          'eslint': '*',
          'eslint-config-prettier': features.prettier ? '*' : undefined,
          'eslint-plugin-simple-import-sort': '*',
          'eslint-plugin-import': '*',
          'eslint-plugin-prettier': features.prettier ? '*' : undefined,
        }

        if (features.typescript) {
          pkgJson.devDependencies = {
            ...pkgJson.devDependencies,
            '@typescript-eslint/eslint-plugin': '*',
            '@typescript-eslint/parser': '*',
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const eslintConfigOverride: any = {
            files: ['**/*.ts', '**/*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
              project: ['./tsconfig.json'],
            },
            extends: [
              'eslint:recommended',
              features.prettier ? 'plugin:prettier/recommended' : undefined,
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
            ].filter(Boolean),
            plugins: [
              'import',
              '@typescript-eslint',
              'simple-import-sort',
              features.prettier ? 'prettier' : undefined,
            ].filter(Boolean),
            rules: {
              '@typescript-eslint/explicit-module-boundary-types': 'error',
              '@typescript-eslint/interface-name-prefix': 'off',
              '@typescript-eslint/member-delimiter-style': 'off',
              '@typescript-eslint/no-empty-interface': 'off',
            },
          }

          eslintConfig.overrides = [eslintConfigOverride]
        }

        files.push({
          name: '.eslintrc.cjs',
          contents: await format(
            resolve(packagePath, '.eslintrc.cjs'),
            outdent`
            'use strict'

            /** @type import('eslint').Linter.Config */
            module.exports = ${JSON.stringify(eslintConfig, null, 2)}
            `,
            prettierConfig,
          ),
        })
      }

      if (features.typescript) {
        files.push({
          name: 'tsconfig.settings.json',
          contents: await format(
            resolve(packagePath, 'tsconfig.settings.json'),
            outdent`
            {
              "compilerOptions": {
                // Completeness
                "skipLibCheck": true,

                // Interop constraints
                "allowSyntheticDefaultImports": true,
                "esModuleInterop": true,

                // Language and environment
                "target": "ES2020",

                // Modules
                "module": "ES2020",
                "moduleResolution": "Node",

                // Type checking
                "alwaysStrict": true,
                "noFallthroughCasesInSwitch": true,
                "noImplicitAny": true,
                "noImplicitReturns": true,
                "noImplicitThis": true,
                "noUnusedLocals": true,
                "noUnusedParameters": true,
                "strict": true,
                "strictFunctionTypes": true,
                "strictNullChecks": true,
                "strictPropertyInitialization": true
              }
            }
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'tsconfig.dist.json',
          contents: await format(
            resolve(packagePath, 'tsconfig.dist.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./src"],
              "exclude": ["./src/**/*.test.ts"],
              "compilerOptions": {
                "rootDir": ".",
                "outDir": "./dist",
                "resolveJsonModule": true
              }
            }
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'tsconfig.json',
          contents: await format(
            resolve(packagePath, 'tsconfig.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./**/*.cjs", "./**/*.ts", "./**/*.tsx"],
              "exclude": ["./node_modules"],
              "compilerOptions": {
                "rootDir": ".",
                "outDir": "./dist",
                "noEmit": true,
                "allowJs": true,
                "resolveJsonModule": true,
              }
            }
            `,
            prettierConfig,
          ),
        })
      }

      // source file
      if (features.typescript) {
        files.push({
          name: 'package.config.ts',
          contents: await format(
            resolve(packagePath, 'package.config.ts'),
            outdent`
            import {defineConfig} from '@sanity/pkg-utils'

            // https://github.com/sanity-io/pkg-utils#configuration
            export default defineConfig({
              // the path to the tsconfig file for distributed builds
              tsconfig: 'tsconfig.dist.json',
            })
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'src/index.ts',
          contents: await format(
            resolve(packagePath, 'src/index.ts'),
            outdent`
            /** @public */
            export function main(): void {
              //
            }
            `,
            prettierConfig,
          ),
        })
      } else {
        files.push({
          name: 'package.config.js',
          contents: await format(
            resolve(packagePath, 'package.config.js'),
            outdent`
            import {defineConfig} from '@sanity/pkg-utils'

            export default defineConfig({
              extract: {
                rules: {
                  // do not require internal members to be prefixed with \`_\`
                  'ae-internal-missing-underscore': 'off',
                },
              },
            })
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'src/index.js',
          contents: await format(
            resolve(packagePath, 'src/index.js'),
            outdent`
            /** @public */
            export function main() {
              //
            }
            `,
            prettierConfig,
          ),
        })
      }

      // Resolve latest dependencies
      try {
        pkgJson.dependencies = await resolveLatestDeps(pkgJson.dependencies ?? {})
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : error)
      }

      // Resolve latest devDependencies
      try {
        pkgJson.devDependencies = await resolveLatestDeps(pkgJson.devDependencies ?? {})
      } catch (error) {
        logger.warn(error instanceof Error ? error.message : error)
      }

      files.push({
        name: 'package.json',
        contents: await format(
          resolve(packagePath, 'package.json'),
          JSON.stringify(pkgJson, null, 2),
          prettierConfig,
        ),
      })

      return files
    },
  }
}

function format(filepath: string, input: string, prettierOptions: PrettierConfig | undefined) {
  return prettier.format(input, {...prettierOptions, plugins: [], filepath})
}

async function resolveLatestDeps(deps: Record<string, string | undefined>) {
  const depsEntries = Object.entries(deps)
  const latestDeps: Record<string, string> = {}

  for (const entry of depsEntries) {
    const [name, version] = entry

    if (version) {
      const latestVersion = await getLatestVersion(name, version)

      latestDeps[name] = latestVersion ? `^${latestVersion}` : version
    }
  }

  return latestDeps
}
