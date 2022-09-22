<!-- markdownlint-disable --><!-- textlint-disable -->

# 📓 Changelog

All notable changes to this project will be documented in this file. See
[Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [1.8.1](https://github.com/sanity-io/pkg-utils/compare/v1.8.0...v1.8.1) (2022-09-22)

### Bug Fixes

- print browser export tree ([9cc9923](https://github.com/sanity-io/pkg-utils/commit/9cc99231daf75a636527eaa9de2ddffc5e5bf2e2))

## [1.8.0](https://github.com/sanity-io/pkg-utils/compare/v1.7.3...v1.8.0) (2022-09-22)

### Features

- clean types directory ([e9607ba](https://github.com/sanity-io/pkg-utils/commit/e9607ba9a4e04cbdef1b99cdbef46913e93c063f))
- improve package validation ([bcc3798](https://github.com/sanity-io/pkg-utils/commit/bcc37981af0ccfb0473968a3ab8f50659ad538b6))

### Bug Fixes

- parse browser exports ([491bbf6](https://github.com/sanity-io/pkg-utils/commit/491bbf639f475412c73e88091874e926b7ac82f8))

## [1.7.3](https://github.com/sanity-io/pkg-utils/compare/v1.7.2...v1.7.3) (2022-09-22)

### Bug Fixes

- handle self-referencing imports ([5ebee3c](https://github.com/sanity-io/pkg-utils/commit/5ebee3ccae62809afb8c21ce6a78fbd55a5db075))
- parity between watch and build ([0658026](https://github.com/sanity-io/pkg-utils/commit/0658026459bd338ebdbd3bfe71987a79c4abd3d4))
- use dot when rendering package.json paths ([549c3d3](https://github.com/sanity-io/pkg-utils/commit/549c3d32647b8d63891ebe6670c618796dc727b1))

## [1.7.2](https://github.com/sanity-io/pkg-utils/compare/v1.7.1...v1.7.2) (2022-09-09)

### Bug Fixes

- do not accept config files outside of root ([b796713](https://github.com/sanity-io/pkg-utils/commit/b7967139da698a6f5604a1b7cae9744d89491734))
- improve terser config ([25ce3df](https://github.com/sanity-io/pkg-utils/commit/25ce3df12d64cc309e70d4024867bbc84115abc5))
- transform rest/spread specifically ([172c01b](https://github.com/sanity-io/pkg-utils/commit/172c01b437eb6328af9d8ba4f6ff53f7e11446f9))
- use babel to dedupe inline helpers ([796e0a1](https://github.com/sanity-io/pkg-utils/commit/796e0a1fa42d6664d505fcb29aa644ede139f48c))

## [1.7.1](https://github.com/sanity-io/pkg-utils/compare/v1.7.0...v1.7.1) (2022-09-08)

### Bug Fixes

- print less ([03858b3](https://github.com/sanity-io/pkg-utils/commit/03858b36b0f86ed1c72d4a9ba8a8af8e27c55977))
- simplify spinner ([8bb80a1](https://github.com/sanity-io/pkg-utils/commit/8bb80a1ad24a0579e57baac96338d5024f047cb8))

## [1.7.0](https://github.com/sanity-io/pkg-utils/compare/v1.6.0...v1.7.0) (2022-09-08)

### Features

- require `default` property ([7cd339f](https://github.com/sanity-io/pkg-utils/commit/7cd339fb708e661a890957e12de91f7af622dcbb))

## [1.6.0](https://github.com/sanity-io/pkg-utils/compare/v1.5.1...v1.6.0) (2022-09-07)

### Features

- support custom jsx config options ([af34c50](https://github.com/sanity-io/pkg-utils/commit/af34c50f70309ce177ff54a13ff97562d74eb818))

## [1.5.1](https://github.com/sanity-io/pkg-utils/compare/v1.5.0...v1.5.1) (2022-09-07)

### Bug Fixes

- respect `target` in tsconfig.json ([f8584da](https://github.com/sanity-io/pkg-utils/commit/f8584da57ed67bb1e16310422eb559ef97f216a4))

## [1.5.0](https://github.com/sanity-io/pkg-utils/compare/v1.4.2...v1.5.0) (2022-09-07)

### Features

- add `strict` mode ([67e0b20](https://github.com/sanity-io/pkg-utils/commit/67e0b20b8fd126b35e226f266b88243da62f37ef))

### Bug Fixes

- remove default export from legacy exports ([65fb2d8](https://github.com/sanity-io/pkg-utils/commit/65fb2d8714d4e464ab00d338eef019793a0fe54f))

## [1.4.2](https://github.com/sanity-io/pkg-utils/compare/v1.4.1...v1.4.2) (2022-09-06)

### Bug Fixes

- add `.types` property to schema ([6b32dcd](https://github.com/sanity-io/pkg-utils/commit/6b32dcdac44c05216e7a4b4feefed3629f8badca))
- respect `.types` path ([f12f3ac](https://github.com/sanity-io/pkg-utils/commit/f12f3ac17f66cd3e8406cc5a8a964a5abef6c798))

## [1.4.1](https://github.com/sanity-io/pkg-utils/compare/v1.4.0...v1.4.1) (2022-09-06)

### Bug Fixes

- downgrade to `globby` v11 for commonjs support ([fa36f9d](https://github.com/sanity-io/pkg-utils/commit/fa36f9deb0e6a52667063a62f88040a44b85c748))

## [1.4.0](https://github.com/sanity-io/pkg-utils/compare/v1.3.0...v1.4.0) (2022-09-06)

### Features

- add `check` command ([e100097](https://github.com/sanity-io/pkg-utils/commit/e100097fecbda7e3699af52e93601933e3382476))
- add various features ([9a4fbaa](https://github.com/sanity-io/pkg-utils/commit/9a4fbaa7f6067da725b767e1d7c940f4de3684c1))
- improve build command ([5e70f10](https://github.com/sanity-io/pkg-utils/commit/5e70f107dc859e57ce9dc790ee10b6330acc72be))

### Bug Fixes

- target parsing ([6fce2ed](https://github.com/sanity-io/pkg-utils/commit/6fce2ed032349a3cc14baa4af54b771f4cc2224e))

## [1.3.0](https://github.com/sanity-io/pkg-utils/compare/v1.2.0...v1.3.0) (2022-08-30)

### Features

- use `browserslist` with sane defaults ([7ab40ab](https://github.com/sanity-io/pkg-utils/commit/7ab40ab67c7e80296cfc4c6d1c8569e244dd0975))

## [1.2.0](https://github.com/sanity-io/pkg-utils/compare/v1.1.0...v1.2.0) (2022-08-29)

### Features

- improve runtime and target configuration ([925a584](https://github.com/sanity-io/pkg-utils/commit/925a5847a3b7b063c7b07b15857ff269ffaf8ed1))
- support `package.config.cjs` ([5c73210](https://github.com/sanity-io/pkg-utils/commit/5c73210fb20f3ef7084ee8d2bec546de40de0573))

## [1.1.0](https://github.com/sanity-io/pkg-utils/compare/v1.0.1...v1.1.0) (2022-08-29)

### Features

- log tsconfig path ([c927841](https://github.com/sanity-io/pkg-utils/commit/c927841da53c250d93a6d5c10a23d087316e40bc))

## [1.0.1](https://github.com/sanity-io/pkg-utils/compare/v1.0.0...v1.0.1) (2022-08-29)

### Bug Fixes

- enable declarations when extracting ([49394b8](https://github.com/sanity-io/pkg-utils/commit/49394b81bda174f78b0c481f62d51029433dd52f))

## 1.0.0 (2022-08-29)

### Features

- initial commit ([01d186b](https://github.com/sanity-io/pkg-utils/commit/01d186ba5c18df1ea126b7ec2af38f717248e234))
