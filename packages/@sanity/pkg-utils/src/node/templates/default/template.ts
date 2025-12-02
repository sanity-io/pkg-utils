import {execSync} from 'node:child_process'
import {resolve} from 'node:path'
import prettierConfig from '@sanity/prettier-config'
import getLatestVersion from 'get-latest-version'
import gitUrlParse from 'git-url-parse'
import {outdent} from 'outdent'
import {format, type Config as PrettierConfig} from 'prettier'
import {isRecord} from '../../core/isRecord.ts'
import type {PackageJSON} from '../../core/pkg/types.ts'
import {defineTemplateOption} from '../../core/template/define.ts'
import {type PkgTemplate, type PkgTemplateFile} from '../../core/template/types.ts'

const RE_NAME = /^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)\/)?[a-z0-9-~][a-z0-9-._~]*$/i

export const defaultTemplate: PkgTemplate = async ({cwd, logger, packagePath}) => {
  const gitConfig = getGitUserConfig(cwd)

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
          } catch {
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
        initial: (options) => options['repo']?.name || undefined,
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
        initial: gitConfig.user,
      }),
      defineTemplateOption({
        name: 'authorEmail',
        type: 'string',
        description: 'package author email',
        initial: gitConfig.email,
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
        [options['authorName'], options['authorEmail'] && `<${options['authorEmail']}>`]
          .filter(Boolean)
          .join(' ') ?? undefined

      const pkgJson: PackageJSON & {
        prettier?: '@sanity/prettier-config'
        ['lint-staged']?: Record<string, string[]>
      } = {
        name,
        'version': '0.0.0',
        'description': options['description'] ?? undefined,
        'keywords': [],
        'homepage': undefined,
        'bugs': undefined,
        'repository': undefined,
        'license': options['license'],
        author,
        'sideEffects': false,
        'type': 'module',
        'exports': {
          '.': {
            source: features['typescript'] ? './src/index.ts' : './src/index.js',
            require: './dist/index.cjs',
            default: './dist/index.js',
          },
          './package.json': './package.json',
        },
        'main': './dist/index.cjs',
        'module': './dist/index.js',
        'types': undefined,
        'files': ['dist', 'src'],
        'scripts': {
          build: 'pkg build --strict --clean --check',
          format: features['prettier'] ? 'prettier --write --cache --ignore-unknown .' : undefined,
        },
        'lint-staged': features['prettier']
          ? {
              '*': ['prettier --write --cache --ignore-unknown'],
            }
          : undefined,
        'browserslist': 'extends @sanity/browserslist-config',
        'prettier': features['prettier'] ? '@sanity/prettier-config' : undefined,
        'dependencies': {},
        'devDependencies': {
          '@sanity/tsconfig': features['typescript'] ? '^1' : undefined,
          '@sanity/pkg-utils': '^9',
          '@sanity/prettier-config': features['prettier'] ? '^1' : undefined,
          '@typescript-eslint/eslint-plugin': undefined,
          '@typescript-eslint/parser': undefined,
          'eslint': undefined,
          'eslint-config-prettier': undefined,
          'eslint-plugin-import': undefined,
          'eslint-plugin-prettier': undefined,
          'eslint-plugin-simple-import-sort': undefined,
          'lint-staged': '^15',
          'prettier': features['prettier'] ? '^3' : undefined,
          'typescript': undefined,
        },
        'engines': {
          node: '>=20.19 <22 || >=22.12',
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

      if (features['prettier']) {
        files.push({
          name: '.prettierignore',
          contents: outdent`
          dist
          pnpm-lock.yaml
          `,
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

      if (features['typescript']) {
        pkgJson.types = './dist/index.d.ts'

        pkgJson.scripts = {
          ...pkgJson.scripts,
          ['ts:check']: 'tsc --noEmit',
        }

        const devDependencies = pkgJson.devDependencies

        if (isRecord(devDependencies)) {
          devDependencies['typescript'] = '^5.9'
        }
      }

      if (features['eslint']) {
        const eslintConfig: any = {
          root: true,
          env: {
            browser: true,
            es6: true,
            node: true,
          },
          extends: [
            'eslint:recommended',
            features['prettier'] ? 'plugin:prettier/recommended' : undefined,
          ].filter(Boolean),
          parserOptions: {
            ecmaVersion: 2020,
            sourceType: 'module',
          },
          plugins: [
            'import',
            'simple-import-sort',
            features['prettier'] ? 'prettier' : undefined,
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
          lint: features['typescript']
            ? 'eslint . --ext .cjs,.js,.ts,.tsx'
            : 'eslint . --ext .cjs,.js',
        }

        pkgJson.devDependencies = {
          ...pkgJson.devDependencies,
          'eslint': '^8',
          'eslint-config-prettier': features['prettier'] ? '^9' : undefined,
          'eslint-plugin-import': '^2',
          'eslint-plugin-prettier': features['prettier'] ? '^5' : undefined,
          'eslint-plugin-simple-import-sort': '^12',
        }

        if (features['typescript']) {
          pkgJson.devDependencies = {
            ...pkgJson.devDependencies,
            '@typescript-eslint/eslint-plugin': '^7',
            '@typescript-eslint/parser': '^7',
          }

          const eslintConfigOverride: any = {
            files: ['**/*.ts', '**/*.tsx'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
              project: ['./tsconfig.json'],
            },
            extends: [
              'eslint:recommended',
              features['prettier'] ? 'plugin:prettier/recommended' : undefined,
              'plugin:@typescript-eslint/eslint-recommended',
              'plugin:@typescript-eslint/recommended',
            ].filter(Boolean),
            plugins: [
              'import',
              '@typescript-eslint',
              'simple-import-sort',
              features['prettier'] ? 'prettier' : undefined,
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
          contents: await prettierFormat(
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

      if (features['typescript']) {
        files.push({
          name: 'tsconfig.settings.json',
          contents: await prettierFormat(
            resolve(packagePath, 'tsconfig.settings.json'),
            outdent`
            {
              "extends": "@sanity/tsconfig/strictest",
              "compilerOptions": {
                "rootDir": ".",
                "outDir": "./dist"
              }
            }
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'tsconfig.dist.json',
          contents: await prettierFormat(
            resolve(packagePath, 'tsconfig.dist.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./src"],
              "exclude": ["./src/**/*.test.ts"]
            }
            `,
            prettierConfig,
          ),
        })

        files.push({
          name: 'tsconfig.json',
          contents: await prettierFormat(
            resolve(packagePath, 'tsconfig.json'),
            outdent`
            {
              "extends": "./tsconfig.settings",
              "include": ["./**/*.cjs", "./**/*.ts", "./**/*.tsx"],
              "exclude": ["./node_modules"]
            }
            `,
            prettierConfig,
          ),
        })
      }

      // source file
      if (features['typescript']) {
        files.push({
          name: 'package.config.ts',
          contents: await prettierFormat(
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
          contents: await prettierFormat(
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
          contents: await prettierFormat(
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
          contents: await prettierFormat(
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
        contents: await prettierFormat(
          resolve(packagePath, 'package.json'),
          JSON.stringify(pkgJson, null, 2),
          prettierConfig,
        ),
      })

      return files
    },
  }
}

function prettierFormat(
  filepath: string,
  input: string,
  prettierOptions: PrettierConfig | undefined,
) {
  return format(input, {...prettierOptions, plugins: [], filepath})
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

function getGitUserConfig(cwd: string): {user: string | undefined; email: string | undefined} {
  let user: string | undefined
  let email: string | undefined

  try {
    user = execSync('git config user.name', {encoding: 'utf8', cwd}).trim() || undefined
    email = execSync('git config user.email', {encoding: 'utf8', cwd}).trim() || undefined
  } catch {
    /* ignore */
  }

  return {user, email}
}
