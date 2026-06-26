import type {PackageJSON} from '@sanity/parse-package-json'
import type {Logger} from '../../logger.ts'
import type {StrictOptions} from '../../strict.ts'

/**
 * The `package.json` fields a dependency placement rule can reference.
 */
type DependencyField = 'dependencies' | 'devDependencies' | 'peerDependencies'

/**
 * Describes where a given package may, and may not, be declared in `package.json`.
 */
interface DependencyPlacementRule {
  /** The name of the package this rule applies to. */
  name: string
  /** The `strictOptions` toggle that controls whether this rule runs. */
  option: keyof StrictOptions
  /** Fields the package must _not_ be declared in. */
  disallowedIn: DependencyField[]
  /** Fields the package is allowed to be declared in (used for messaging). */
  allowedIn: DependencyField[]
  /**
   * When set and the package is declared in `peerDependencies`, the version range must be
   * exactly this value (e.g. `*` for `@types/*` packages).
   */
  requiredPeerVersion?: string
}

/**
 * The set of dependency placement rules enforced in `--strict` mode.
 */
const dependencyPlacementRules: DependencyPlacementRule[] = [
  {
    name: 'react-is',
    option: 'noReactIsPeerDependency',
    disallowedIn: ['peerDependencies'],
    allowedIn: ['dependencies', 'devDependencies'],
  },
  {
    name: '@sanity/ui',
    option: 'noSanityUiPeerDependency',
    disallowedIn: ['peerDependencies'],
    allowedIn: ['dependencies', 'devDependencies'],
  },
  {
    name: 'sanity',
    option: 'noSanityDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
  },
  {
    name: 'styled-components',
    option: 'noStyledComponentsDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
  },
  {
    name: 'react',
    option: 'noReactDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
  },
  {
    name: 'react-dom',
    option: 'noReactDomDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
  },
  {
    name: '@types/react',
    option: 'noReactTypesDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
    requiredPeerVersion: '*',
  },
  {
    name: '@types/react-dom',
    option: 'noReactDomTypesDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
    requiredPeerVersion: '*',
  },
  {
    name: '@types/node',
    option: 'noNodeTypesDependency',
    disallowedIn: ['dependencies'],
    allowedIn: ['devDependencies', 'peerDependencies'],
    requiredPeerVersion: '*',
  },
  {
    name: 'rxjs',
    option: 'noRxjsPeerDependency',
    disallowedIn: ['peerDependencies'],
    allowedIn: ['dependencies', 'devDependencies'],
  },
  {
    name: '@sanity/client',
    option: 'noSanityClientPeerDependency',
    disallowedIn: ['peerDependencies'],
    allowedIn: ['dependencies', 'devDependencies'],
  },
]

function formatFields(fields: DependencyField[]): string {
  const labels = fields.map((field) => `\`${field}\``)

  if (labels.length <= 1) {
    return labels.join('')
  }

  return `${labels.slice(0, -1).join(', ')} or ${labels[labels.length - 1]}`
}

/**
 * Validates that well-known packages are declared in the correct `package.json` dependency
 * fields. Returns `true` if any rule with severity `error` was violated.
 * @internal
 */
export function checkDependencyPlacement(options: {
  pkg: PackageJSON
  logger: Logger
  strictOptions: StrictOptions
}): boolean {
  const {pkg, logger, strictOptions} = options
  let shouldError = false

  const report = (level: 'error' | 'warn', message: string) => {
    if (level === 'error') {
      shouldError = true
      logger.error(message)
    } else {
      logger.warn(message)
    }
  }

  for (const rule of dependencyPlacementRules) {
    const level = strictOptions[rule.option]

    if (level === 'off') {
      continue
    }

    for (const field of rule.disallowedIn) {
      if (Object.hasOwn(pkg[field] ?? {}, rule.name)) {
        report(
          level,
          `package.json: \`${rule.name}\` should not be in \`${field}\`. It should be in ${formatFields(
            rule.allowedIn,
          )} instead.`,
        )
      }
    }

    if (rule.requiredPeerVersion !== undefined) {
      const peerDependencies = pkg.peerDependencies ?? {}

      if (
        Object.hasOwn(peerDependencies, rule.name) &&
        peerDependencies[rule.name] !== rule.requiredPeerVersion
      ) {
        report(
          level,
          `package.json: \`${rule.name}\` in \`peerDependencies\` should be set to "${rule.requiredPeerVersion}" (got "${peerDependencies[rule.name]}").`,
        )
      }
    }
  }

  return shouldError
}
