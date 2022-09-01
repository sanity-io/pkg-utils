# @sanity/pkg-utils

Simple utilities for modern [npm](https://www.npmjs.com/) packages.

```sh
npm install @sanity/pkg-utils -D
```

## Basic usage

```sh
# In a Node.js package directory with `package.json` present

# Check the package
# This will validate the package.json file
pkg-utils check

# Build the package
pkg-utils build --tsconfig tsconfig.dist.json
```

## License

MIT
