---
"@sanity/vanilla-extract-integration": minor
"@sanity/vanilla-extract-vite-plugin": minor
"@sanity/vanilla-extract-rolldown-plugin": minor
"@sanity/vanilla-extract-tsdown-plugin": minor
---

fix: make generated identifiers unique per package version and module content, so class names can never collide across versions of a package

`@vanilla-extract/css` derives every identifier (class names, keyframes, CSS vars, …) from `hash(packageName + filePath)` plus a per-file call counter. With the bare package name the identifiers of a `.css.ts` module were the same in every version of a package, so adding, removing or reordering a style shifted the counter and reused a class name for a different rule — when two versions of `@sanity/ui` were loaded on one page, the stylesheet of one styled the markup of the other (`_2mi48t0` was the Button's loading overlay in ≤ 4.4.2 and became its root class in 4.4.4, turning every Button into an opaque box).

The file scope's package name is now `<name>@<version>+<digest>` (`createFileScopePackageName`): the package name qualified by its `package.json` version and an 8-hex-char digest of the module source. Identifiers stay deterministic for identical input and keep their `<hash><counter>` shape and length (the hash output has a fixed 32-bit width), while differing between versions and between builds of a version with different styles. Custom `identifiers` functions and `serializeVirtualCssPath` keep receiving the bare `packageName`.

Rebuilding a library with this release changes all of its vanilla-extract class names once — which is the point: from then on every version gets its own.
