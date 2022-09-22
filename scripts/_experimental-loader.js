const RE_EXT = /\.tsx?$/

export async function load(url, context, defaultLoad) {
  // Change format from "module" to "commonjs" for .ts and .tsx files
  if (RE_EXT.test(url)) {
    const {source} = await defaultLoad(url, {format: 'module'})

    return {format: 'commonjs', source}
  }

  return await defaultLoad(url, context, defaultLoad)
}
