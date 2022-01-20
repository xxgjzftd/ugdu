import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'
import type { BaseRoute } from '../tasks/config'

/**
 * @internal
 */
export const routes = function (rmn: string, context: Context): Plugin {
  const {
    building,
    CONSTANTS: { ROUTES_INPUT },
    project,
    utils: { isRoutesModule, getRoutesOption, getLocalModuleName, getPkgName, getPkgId, stringify }
  } = context
  return {
    name: 'ugdu:routes',
    resolveId (source) {
      if (source === ROUTES_INPUT) {
        return rmn
      }
      if (isRoutesModule(source)) {
        return source
      }
    },
    async load (id) {
      if (isRoutesModule(id)) {
        const pages = project.routes[id]
        const option = getRoutesOption(id)
        const depth = option.depth
        const base = option.base
        const pn2pm: Record<string, string[]> = {}
        pages.forEach(
          (path) => {
            const pn = getPkgName(getLocalModuleName(path)!)
            pn2pm[pn] = pn2pm[pn] || []
            pn2pm[pn].push(path)
          }
        )
        const brs: BaseRoute[] = []
        Object.keys(pn2pm).forEach(
          (pn) => {
            const pages = pn2pm[pn]
            const length = pages.length
            if (!length) {
              return
            }
            let lca = pages[0].slice(0, pages[0].lastIndexOf('/'))
            for (let index = 1; index < length; index++) {
              const path = pages[index]
              while (!path.startsWith(lca)) {
                lca = lca.slice(0, lca.lastIndexOf('/'))
              }
            }
            pages.forEach(
              (path) => {
                const raw = base + path.replace(lca, getPkgId(pn)).replace(/(\/index)?(\..+?)?$/, '')
                const re = option.extends.find((re) => re.id === path)

                const br = Object.assign(
                  {
                    path: raw.replace(/(?<=\/)_/g, ':'),
                    name: raw.slice(1).replace(/\//g, '-'),
                    depth: depth
                  },
                  re || {},
                  { id: path, component: path }
                )
                brs.push(br)
              }
            )
          }
        )

        const rrs: BaseRoute[] = []
        brs.forEach(
          (br) => {
            let depth = br.depth
            if (depth === 0) {
              rrs.push(br)
            } else {
              depth--
              const parent = brs.find((inner) => inner.depth === depth && br.path.startsWith(inner.path))
              if (!parent) {
                throw new Error(
                  `Can not find parent route of '${br.component}',\n` + `the generated path of which is '${br.path}'.`
                )
              }
              parent.children = parent.children || []
              parent.children.push(br)
            }
          }
        )

        const code = stringify(
          rrs,
          (key, value) => {
            if (key === 'component') {
              return (
                '()=>' +
                (building ? `ugdu.load` : `import`) +
                `("${building ? getLocalModuleName(value) : '/' + value}")`
              )
            }
          }
        )

        return `export default ${code}`
      }
    }
  }
}
