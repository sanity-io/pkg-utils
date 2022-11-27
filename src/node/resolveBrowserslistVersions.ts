import browserslist from 'browserslist'

export interface PackageTargetVersions {
  chrome: string[]
  ff: string[]
  edge: string[]
  iosSaf: string[]
  saf: string[]
  opera: string[]
  node: string[]
}

function sortAsNumber(a: string, b: string) {
  const aVersion = Number(a)
  const bVersion = Number(b)

  return aVersion - bVersion
}

export function resolveBrowserslistVersions(query: string[]): PackageTargetVersions {
  const result = browserslist(query)

  const entries = result.map((key) => {
    const [name, version] = key.split(' ')

    return {name, version: version.split('-')[0].split('.')[0]}
  })

  const andChr = entries.filter((b) => b.name === 'and_chr')
  const andFf = entries.filter((b) => b.name === 'and_ff')
  const chrome = entries.filter((b) => b.name === 'chrome')
  const edge = entries.filter((b) => b.name === 'edge')
  const ff = entries.filter((b) => b.name === 'firefox')
  const iosSaf = entries.filter((b) => b.name === 'ios_saf')
  const saf = entries.filter((b) => b.name === 'safari')
  const opera = entries.filter((b) => b.name === 'opera')
  const node = entries.filter((b) => b.name === 'node')

  // versions
  const versions: PackageTargetVersions = {
    chrome: andChr.concat(chrome).map((b) => b.version),
    ff: andFf.concat(ff).map((b) => b.version),
    edge: edge.map((b) => b.version),
    iosSaf: iosSaf.map((b) => b.version),
    saf: saf.map((b) => b.version),
    opera: opera.map((b) => b.version),
    node: node.map((b) => b.version),
  }

  // sort
  versions.chrome.sort(sortAsNumber)
  versions.ff.sort(sortAsNumber)
  versions.edge.sort(sortAsNumber)
  versions.iosSaf.sort(sortAsNumber)
  versions.saf.sort(sortAsNumber)
  versions.opera.sort(sortAsNumber)
  versions.node.sort(sortAsNumber)

  return versions
}
