import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * @internal
 */
export const routes = function (rmn: string, context: Context): Plugin {
  const {
    building,
    CONSTANTS: { ROUTES_INPUT },
    project,
    utils: { isRoutesModule, getLocalModuleName, stringify }
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
        const code = stringify(
          project.routes,
          (key, value) => {
            if (key === 'component') {
              return (
                '()=>' + (building ? `ur.load` : `import`) + `("${building ? getLocalModuleName(value) : '/' + value}")`
              )
            }
          }
        )

        return `export default ${code}`
      }
    }
  }
}
