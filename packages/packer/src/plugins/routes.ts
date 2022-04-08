import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * @internal
 */
export const routes = function (context: Context): Plugin {
  const {
    CONSTANTS: { ROUTES_INPUT, ROUTES },
    project,
    utils: { isRoutesModule, getLocalModuleName, stringify }
  } = context
  return {
    name: 'ugdu:routes',
    resolveId (source) {
      if (source === ROUTES_INPUT) {
        return ROUTES
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
                '()=>' +
                (context.building ? `ur.load` : `import`) +
                `("${context.building ? getLocalModuleName(value) : '/' + value}")`
              )
            }
          }
        )

        return `export default ${code}`
      }
    }
  }
}
