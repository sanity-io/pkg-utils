---
'@sanity/tsdown-config': patch
---

`defineConfig()` no longer resolves to the wrong overload in projects that install only one of the optional React Compiler implementations. The `reactCompiler` option types (`ReactCompilerBabelOptions`, `ReactCompilerOxcOptions`) are now interfaces extending the peer packages' option typings instead of intersection type aliases: when `babel-plugin-react-compiler` or `oxc-transform-react` is not installed, its unresolvable typings used to degrade to `any` and absorb the whole `ReactCompilerOptions` union, so every `reactCompiler` config matched the `reactServer: true` overload and typechecked as `Promise<UserConfig[]>` — forcing consumers to stub the missing module (e.g. sanity-io/ui's `typings/babel-plugin-react-compiler.d.ts`). Now the uninstalled branch degrades to just `transform`/`reactServer` while the installed branch keeps its real option typings, on both the JS (6.x) and Go-native (7.x) TypeScript checkers, and such stubs can be deleted.
