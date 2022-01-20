import { isAbsolute } from 'path/posix'

import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * @internal
 */
export const vendor = function (vvn: string, context: Context): Plugin {
  const {
    CONSTANTS: { BINDING_NAME_SEP, VENDOR, VENDOR_INPUT },
    project: { mn2bm },
    utils: { shouldExternal, getPkgFromModuleName, getPkgFromSourceAndImporter, getDepPath, getPublicPkgName }
  } = context
  const pkg = getPkgFromModuleName(vvn)
  return {
    name: 'ugdu:vendor',
    enforce: 'pre',
    resolveId (source, importer, options) {
      if (source === VENDOR_INPUT) {
        return VENDOR
      } else if (importer === VENDOR) {
        const dependent = pkg.dependents[0]
        return this.resolve(
          source,
          `${dependent.ap}${dependent.local ? '' : '/node_modules/' + dependent.name}/package.json`,
          Object.assign({ skipSelf: true }, options)
        )
      } else if (isAbsolute(importer!)) {
        const dep = getPkgFromSourceAndImporter(source, importer!)
        if (dep && shouldExternal(dep)) {
          return {
            id: source.replace(dep.name, getPublicPkgName(getDepPath(pkg, dep))),
            external: true
          }
        }
      }
      return null
    },
    load (id) {
      if (id === VENDOR) {
        let names: string[] = []
        let subs: string[] = []
        const bindings = mn2bm.cur[vvn]
        bindings.forEach((binding) => (binding.includes('/') ? subs.push(binding) : names.push(binding)))
        return (
          (names.length
            ? names.includes('*')
              ? `export * from "${pkg.name}";` +
                (names.includes('default') ? `export { default } from "${pkg.name}";` : '')
              : `export { ${names.toString()} } from "${pkg.name}";`
            : '') +
          subs
            .map(
              (sub) => {
                const index = sub.lastIndexOf('/')
                const path = sub.slice(0, index)
                const binding = sub.slice(index + 1)
                const name = sub.replace(/\W/g, BINDING_NAME_SEP)
                return binding
                  ? binding === '*'
                    ? `export * as ${name} from "${path}";`
                    : `export { ${binding} as ` + `${name} } from "${path}";`
                  : `import "${path}";`
              }
            )
            .join('\n')
        )
      }
    }
  }
}
