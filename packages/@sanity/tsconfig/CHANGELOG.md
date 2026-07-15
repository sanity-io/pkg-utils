# @sanity/tsconfig

## 2.2.1

### Patch Changes

- [#3032](https://github.com/sanity-io/pkg-utils/pull/3032) [`229154b`](https://github.com/sanity-io/pkg-utils/commit/229154b8959194d564667e16940b62b367a85c2a) Thanks [@stipsan](https://github.com/stipsan)! - fix: use a literal `@` instead of the percent-encoded `%40` in the `homepage` links to the `packages/@sanity/*` directories, so the URLs read cleanly in the npm UI (GitHub resolves both forms)

## 2.2.0

### Minor Changes

- [#2959](https://github.com/sanity-io/pkg-utils/pull/2959) [`7a1e207`](https://github.com/sanity-io/pkg-utils/commit/7a1e20734b6d9b33c8bb00e5b273df0aba0d42e6) Thanks [@stipsan](https://github.com/stipsan)! - Add `outDir: "${configDir}/dist"` to the `recommended` preset

  Emitting to `dist` is already the default in `@sanity/pkg-utils` and `tsdown`, but every repo extending these presets had to repeat it in their own tsconfig. Since `${configDir}` resolves to the directory of the tsconfig that extends the preset, output now lands in the `dist` folder next to your `package.json` by default, and the manual declaration can be removed:

  ```diff
  {
    "extends": "@sanity/tsconfig/strictest",
  -  "compilerOptions": {
  -    "outDir": "${configDir}/dist"
  -  }
  }
  ```

## 2.1.0

### Minor Changes

- [`f8d6dcc`](https://github.com/sanity-io/pkg-utils/commit/f8d6dcc592d022de46c4111d9f11d54ed73583a4) Thanks [@stipsan](https://github.com/stipsan)! - Add `noEmitOnError: false` to `recommended` preset

## 2.0.0

### Major Changes

- [#2337](https://github.com/sanity-io/pkg-utils/pull/2337) [`04f3675`](https://github.com/sanity-io/pkg-utils/commit/04f36755337e4a09de6e6d890834b45645edb03c) Thanks [@stipsan](https://github.com/stipsan)! - Remove `noCheck: true` from `isolated-declarations` and `exactOptionalPropertyTypes: true` from `recommended`

## 1.0.0

### Major Changes

- [#2329](https://github.com/sanity-io/pkg-utils/pull/2329) [`c5b81e7`](https://github.com/sanity-io/pkg-utils/commit/c5b81e70c0610df095e68c80c19b62acabc3bc13) Thanks [@stipsan](https://github.com/stipsan)! - Initial release of presets: `recommended`, `strict`, `strictest` and `isolated-declarations`

### Minor Changes

- [#2331](https://github.com/sanity-io/pkg-utils/pull/2331) [`ae7b51c`](https://github.com/sanity-io/pkg-utils/commit/ae7b51c31deeac4af706520d39b94b22cd6112f0) Thanks [@stipsan](https://github.com/stipsan)! - Add `declarationMap: true` to tsconfig preset
