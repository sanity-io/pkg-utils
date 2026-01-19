# Copilot Instructions for @sanity/pkg-utils

## Project Overview

`@sanity/pkg-utils` is a set of utilities for modern npm packages, providing tools for building, bundling, and validating JavaScript/TypeScript packages. This is a monorepo managed with pnpm workspaces.

## Repository Structure

```
packages/
  @sanity/
    pkg-utils/        # Main package - build utilities
    parse-package-json/ # Package.json parser
    tsconfig/         # Shared TypeScript config
    tsdown-config/    # Shared tsdown config
playground/           # Test projects for validation
```

## Build and Test Commands

- **Install dependencies**: Dependencies are managed by pnpm and installed automatically
- **Build all packages**: `pnpm build`
- **Lint code**: `pnpm lint` (uses oxlint)
- **Format code**: `pnpm format` (uses prettier + oxlint --fix)
- **Run tests**: `pnpm test` (uses vitest)
- **Type checking**: `pnpm typecheck`
- **Build specific package**: `pnpm --filter '@sanity/pkg-utils' build`
- **Run playground tests**: `pnpm playground:typecheck`

## Code Style Guidelines

### Linting and Formatting

- **Linter**: oxlint with type-aware checking
- **Formatter**: Prettier with @sanity/prettier-config preset
- **Import sorting**: Uses @ianvs/prettier-plugin-sort-imports
- Configuration files:
  - `.oxlintrc.json` - oxlint rules
  - `prettier.config.js` - prettier settings
  - `.editorconfig` - editor settings (2 spaces, LF, UTF-8)

### Key Rules

- Use 2 spaces for indentation
- Use single quotes for strings (from Prettier config)
- No console.log/debug/info in production code (only console.warn/error are allowed)
- Imports must not create cycles (import/no-cycle)
- No barrel files (oxc/no-barrel-file)
- Type-aware linting is enabled

### TypeScript

- Minimum version: TypeScript 5.8.x or 5.9.x
- Type declarations are bundled using API Extractor
- Use strict TypeScript settings
- Main tsconfig: `tsconfig.json`
- Distribution builds use: `tsconfig.dist.json`

## Testing Practices

### Framework

- **Test runner**: Vitest
- **Test location**: `test/` directories and `*.test.ts` files
- **Test pattern**: `*.test.ts`, `*.test.js`, `*.test.tsx`, `*.test.jsx`

### Test Structure

- Use `describe()` and `test()` from vitest
- Use snapshot testing for output validation
- Tests use spawnProject helper to create test environments
- Test projects live in `test/env/` directories
- Clean test artifacts with `pnpm run playground:clean`

### Running Tests

- Always run `pnpm pretest` to build before testing
- Run full suite: `pnpm test`
- Update snapshots: `pnpm test:update-snapshots`
- Watch mode: `pnpm test:watch`

## Package Management

### pnpm Workspace

- This is a pnpm workspace monorepo
- Package manager: pnpm ^10.28.0
- Workspace packages use `workspace:*` or `workspace:^` protocol
- Always use pnpm, never npm or yarn

### Dependencies

- Production dependencies should be minimal
- Peer dependencies are used for TypeScript and optional dependencies like babel-plugin-react-compiler
- Dependencies are managed in package.json files
- Catalog references (`catalog:`) are used for shared versions

## Development Workflow

### Making Changes

1. Changes should be minimal and focused
2. Always run linter and tests before committing
3. Use changesets for version management (`.changeset/`)
4. Run `pnpm format` before committing

### Git Hooks

- Pre-commit hooks run lint-staged (via husky)
- Automatically formats and lints staged files
- Located in `.husky/` directory

### Package Configuration

- Main config: `package.config.ts` (or .mts, .js, .mjs)
- Use `defineConfig()` from '@sanity/pkg-utils'
- Configuration options documented in README.md

## Key Conventions

### File Organization

- Source code: `src/` directory
- Compiled output: `dist/` directory
- Tests: `test/` directory or `*.test.ts` alongside source
- TypeScript declaration maps are generated
- Source maps are included by default

### Module System

- All packages use ES modules (`type: "module"`)
- Use `.ts` extension for TypeScript source files
- Compiled output includes both ESM and CommonJS when needed
- Package exports are defined in package.json `exports` field

### Code Quality

- No unused variables or imports
- Proper error handling
- Use types over interfaces when appropriate
- Document public APIs with TSDoc comments
- API Extractor validates TSDoc quality

## Special Considerations

### Rollup Plugins

- The project uses both Rollup and Rolldown for bundling
- Custom rollup plugins can be added via configuration
- Plugin order matters for proper bundling

### Browser Compatibility

- Uses browserslist configuration
- Extends @sanity/browserslist-config
- Browser-specific exports are supported via runtime configuration

### CLI Tool

- Binary: `pkg-utils` or `pkg` command
- Available commands: check, build, watch, init
- Located in `bin/` directory
- Run `pkg-utils -h` for detailed help

## Common Tasks

### Adding a new package

1. Create package directory under `packages/@sanity/`
2. Add package.json with workspace dependencies
3. Add to build scripts if needed
4. Run tests to validate

### Updating dependencies

- Renovate bot handles automated updates
- Configuration in `.github/renovate.json`
- Review and test changes before merging

### Publishing

- Uses changesets for version management
- Run `pnpm release` to publish
- Setup trusted publishing workflow exists
