import getLatestVersion from 'get-latest-version'
import gitUrlParse from 'git-url-parse'
import {outdent} from 'outdent'
import parseGitConfig from 'parse-git-config'
import {resolve} from 'path'
import prettier, {Config as PrettierConfig} from 'prettier'

import {defineTemplateOption, isRecord, PackageJSON, PkgTemplate, PkgTemplateFile} from '../../core'

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

      const prettierConfig: PrettierConfig = {
        bracketSpacing: false,
        printWidth: 100,
        semi: false,
        singleQuote: true,
        tabWidth: 2,
        plugins: ['prettier-plugin-packagejson'],
        overrides: [
          {
            files: ['*.yml'],
            options: {
              singleQuote: false,
            },
          },
        ],
      }

      const pkgJson: PackageJSON & {
        prettier?: PrettierConfig
        ['lint-staged']?: Record<string, string[]>
      } = {
        name,
        version: '0.0.0',
        description: options.description ?? undefined,
        keywords: [],
        license: options.license,
        author,
        type: 'module',
        exports: {
          '.': {
            types: undefined,
            source: features.typescript ? './src/index.ts' : './src/index.js',
            require: './dist/index.cjs',
            import: './dist/index.js',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        main: './dist/index.cjs',
        module: './dist/index.js',
        source: features.typescript ? './src/index.ts' : './src/index.js',
        files: ['dist', 'src'],
        scripts: {
          build: 'run-s clean pkg:build pkg:check',
          clean: 'rimraf dist',
          format: 'prettier --write --cache --ignore-unknown .',
          'pkg:build': 'pkg build --strict',
          'pkg:check': 'pkg check --strict',
        },
        prettier: prettierConfig,
        'lint-staged': {
          '*': ['prettier --write --cache --ignore-unknown'],
        },
        dependencies: {},
        devDependencies: {
          '@sanity/pkg-utils': '*',
          'lint-staged': '*',
          'npm-run-all': '*',
          prettier: '*',
          'prettier-plugin-packagejson': '*',
          rimraf: '*',
        },
        engines: {
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

        .DS_Store
        etc
        dist
        node_modules
        `,
      })

      files.push({
        name: '.prettierignore',
        contents: outdent`
        /dist
        /pnpm-lock.yaml
        `,
      })

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

        const mainExport = pkgJson.exports?.['.']

        if (isRecord(mainExport)) {
          mainExport.types = './dist/index.d.ts'
        }

        pkgJson.scripts = {
          ...pkgJson.scripts,
          ['type:check']: 'tsc --build',
        }

        const devDependencies = pkgJson.devDependencies

        if (isRecord(devDependencies)) {
          devDependencies['typescript'] = '*'
        }
      }

      if (features.eslint) {
        const eslintConfig: any = {
          root: true,
          env: {
            browser: true,
            es6: true,
            node: true,
          },
          extends: ['eslint:recommended', 'plugin:prettier/recommended'],
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
          },
          plugins: ['import', 'prettier'],
          rules: {
            'no-console': 'error',
            'no-shadow': 'error',
            'no-warning-comments': ['warn', {location: 'start', terms: ['todo', 'fixme']}],
          },
        }

        files.push({
          name: '.eslintignore',
          contents: outdent`
          /dist
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
          eslint: '*',
          'eslint-config-prettier': '*',
          'eslint-plugin-import': '*',
          'eslint-plugin-prettier': '*',
        }

        if (features.typescript) {
          pkgJson.devDependencies = {
            ...pkgJson.devDependencies,
            '@typescript-eslint/eslint-plugin': '*',
            '@typescript-eslint/parser': '*',
          }

          const eslintConfigOverride: any = {
            files: ['**/*.ts', '**/*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
              project: ['./tsconfig.json'],
            },
            extends: [
              'eslint:recommended',
              'plugin:prettier/recommended',
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
            ].filter(Boolean),
            plugins: ['import', '@typescript-eslint', 'prettier'].filter(Boolean),
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
          contents: format(
            resolve(packagePath, '.eslintrc.cjs'),
            outdent`
            'use strict'

            /** @type import('eslint').Linter.Config */
            module.exports = ${JSON.stringify(eslintConfig, null, 2)}
            `,
            prettierConfig
          ),
        })
      }

      if (features.typescript) {
        files.push({
          name: 'tsconfig.settings.json',
          contents: format(
            resolve(packagePath, 'tsconfig.settings.json'),
            outdent`
            {
              "compilerOptions": {
                "module": "ES2020",
                "target": "ES2020",
                "declaration": true,
                "declarationMap": true,
                "sourceMap": true,

                // Strict type-checking
                "strict": true,
                "noImplicitAny": true,
                "strictNullChecks": true,
                "strictFunctionTypes": true,
                "strictPropertyInitialization": true,
                "noImplicitThis": true,
                "alwaysStrict": true,

                // Additional checks
                "noUnusedLocals": true,
                "noUnusedParameters": true,
                "noImplicitReturns": true,
                "noFallthroughCasesInSwitch": true,
                "skipLibCheck": true,

                // Module resolution
                "moduleResolution": "node",
                "allowSyntheticDefaultImports": true,
                "esModuleInterop": true
              }
            }
            `,
            prettierConfig
          ),
        })

        files.push({
          name: 'tsconfig.dist.json',
          contents: format(
            resolve(packagePath, 'tsconfig.dist.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./src"],
              "compilerOptions": {
                "rootDir": ".",
                "outDir": "./dist",
                "emitDeclarationOnly": true,
                "resolveJsonModule": true
              }
            }
            `,
            prettierConfig
          ),
        })

        files.push({
          name: 'tsconfig.json',
          contents: format(
            resolve(packagePath, 'tsconfig.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./*.cjs", "./*.ts", "./package.config.ts", "./src"],
              "compilerOptions": {
                "rootDir": ".",
                "outDir": "./dist",
                "noEmit": true,
                "allowJs": true,
                "resolveJsonModule": true,
              }
            }
            `,
            prettierConfig
          ),
        })
      }

      // source file
      if (features.typescript) {
        files.push({
          name: 'package.config.ts',
          contents: format(
            resolve(packagePath, 'package.config.ts'),
            outdent`
            import {defineConfig} from '@sanity/pkg-utils'

            export default defineConfig({
              extract: {
                rules: {
                  // do not require internal members to be prefixed with \`_\`
                  'ae-internal-missing-underscore': 'off',
                },
              },

              // the path to the tsconfig file for distributed builds
              tsconfig: 'tsconfig.dist.json',
            })
            `,
            prettierConfig
          ),
        })

        files.push({
          name: 'src/index.ts',
          contents: format(
            resolve(packagePath, 'src/index.ts'),
            outdent`
            /** @public */
            export function main(): void {
              //
            }
            `,
            prettierConfig
          ),
        })
      } else {
        files.push({
          name: 'package.config.js',
          contents: format(
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
            prettierConfig
          ),
        })

        files.push({
          name: 'src/index.js',
          contents: format(
            resolve(packagePath, 'src/index.js'),
            outdent`
            /** @public */
            export function main() {
              //
            }
            `,
            prettierConfig
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
        contents: format(
          resolve(packagePath, 'package.json'),
          JSON.stringify(pkgJson, null, 2),
          prettierConfig
        ),
      })

      return files
    },
  }
}

function format(filepath: string, input: string, prettierOptions: PrettierConfig) {
  return prettier.format(input, {...prettierOptions, filepath})
}

async function resolveLatestDeps(deps: Record<string, string>) {
  const depsEntries = Object.entries(deps)
  const latestDeps: Record<string, string> = {}

  for (const entry of depsEntries) {
    const [name, version] = entry
    const latestVersion = await getLatestVersion(name, version)

    latestDeps[name] = latestVersion ? `^${latestVersion}` : version
  }

  return latestDeps
}
