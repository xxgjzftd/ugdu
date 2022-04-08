import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * @internal
 */
export const local = function (lmn: string, context: Context): Plugin {
  const {
    project: {
      sources: { all }
    },
    utils: {
      isLocalPkg,
      getNormalizedPath,
      getLocalPkgFromPath,
      getLocalPkgFromName,
      getLocalModulePath,
      getLocalModuleName,
      getMetaModule
    }
  } = context
  const pkg = getLocalPkgFromName(lmn)
  return {
    name: 'ugdu:local',
    enforce: 'pre',
    async resolveId (source, importer, options) {
      if (!importer) return null
      const resolution = await this.resolve(source, importer, Object.assign({ skipSelf: true }, options))
      if (resolution) {
        if (resolution.external) return resolution
        const path = getNormalizedPath(resolution.id)
        if (!all.includes(path)) return resolution
        if (pkg !== getLocalPkgFromPath(path)) {
          throw new Error(
            `'${source}' is imported by ${importer || getLocalModulePath(lmn)},` +
              `importing source cross package is not allowed.`
          )
        }
        if (getLocalModuleName(path)) {
          if (isLocalPkg(getLocalModuleName(path)!)) {
            return resolution
          }
          return {
            id: getLocalModuleName(path)!,
            external: true
          }
        }
        const mm = getMetaModule(lmn)
        mm.sources = mm.sources || []
        mm.sources.includes(path) || mm.sources.push(path)
        return resolution
      }
      return null
    }
  }
}
