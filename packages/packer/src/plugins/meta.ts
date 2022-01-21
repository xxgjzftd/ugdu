import MagicString from 'magic-string'
import { init, parse } from 'es-module-lexer'

import type { OutputChunk } from 'rollup'
import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'
import type { PkgNode } from '../tasks/project'

/**
 * @internal
 */
export const meta = function (mn: string, context: Context): Plugin {
  const {
    CONSTANTS: { BINDING_NAME_SEP },
    utils: {
      isLocalModule,
      isRoutesModule,
      isVendorModule,
      getVersionedPkgName,
      getPkgFromModuleName,
      getMetaModule,
      getPkgFromPublicPkgName,
      getPublicPkgNameFromImported
    }
  } = context
  return {
    name: 'ugdu:meta',
    async renderChunk (code, chunk) {
      const { importedBindings } = chunk
      const pending: [string, string][] = []
      Object.keys(importedBindings).forEach(
        (imported) => {
          if (isVendorModule(imported)) {
            let ppn = getPublicPkgNameFromImported(imported)
            if (imported.length > ppn.length) {
              pending.push([imported, ppn])
            }
          }
        }
      )
      if (pending.length) {
        await init
        const [imports] = parse(code)
        const ms = new MagicString(code)
        pending.forEach(
          ([imported, ppn]) => {
            imports.forEach(
              ({ n, ss, se }) => {
                if (n === imported) {
                  const bindings = importedBindings[imported]
                  let content = code.slice(ss, se).replace(/\n/g, ' ')
                  if (bindings.length) {
                    const bindingToNameMap: Record<string, string> = {}
                    const d = content.match(/(?<=^import).+?(?=from)/)![0].trim()
                    const m = d.match(/^{(.+)}$/)
                    if (m) {
                      m[1]
                        .split(',')
                        .map(
                          (s) =>
                            s
                              .trim()
                              .split(' as ')
                              .map((v) => v.trim())
                        )
                        .forEach(([binding, name]) => (bindingToNameMap[binding] = name || binding))
                    } else if (d[0] === '*') {
                      bindingToNameMap['*'] = d.split(' as ')[1].trim()
                    } else {
                      bindingToNameMap.default = d
                    }

                    content =
                      `import { ` +
                      bindings
                        .map(
                          (binding) =>
                            `${imported.replace(ppn, '')}/${binding}`.replace(/\W/g, BINDING_NAME_SEP) +
                            ` as ${bindingToNameMap[binding]}`
                        )
                        .join(',') +
                      ` } from "${ppn}"`
                  } else {
                    content = `import "${ppn}"`
                  }
                  ms.overwrite(ss, se, content)
                }
              }
            )
          }
        )
        return {
          code: ms.toString(),
          map: ms.generateMap({ hires: true })
        }
      }
      return null
    },
    generateBundle (_, bundle) {
      const mm = getMetaModule(mn)
      const fileNames = Object.keys(bundle)
      const js = fileNames.find((fileName) => (bundle[fileName] as OutputChunk).isEntry)!
      const css = fileNames.find((fileName) => fileName.endsWith('.css'))
      mm.js = js
      css && (mm.css = css)
      const { importedBindings, exports } = bundle[js] as OutputChunk
      isLocalModule(mn) && (mm.exports = exports.sort())
      let pkg: PkgNode
      !isRoutesModule(mn) && (pkg = getPkgFromModuleName(mn))
      Object.keys(importedBindings).forEach(
        (imported) => {
          const rbs = importedBindings[imported]
          if (isVendorModule(imported)) {
            // Routes module doesn't import any thing from vendor module, and there is no routes pkg.
            if (pkg) {
              const ppn = getPublicPkgNameFromImported(imported)
              let mmi = mm.imports.find((i) => i.name === ppn)
              if (!mmi) {
                mmi = { id: getVersionedPkgName(getPkgFromPublicPkgName(pkg, ppn)), name: ppn, bindings: [] }
                mm.imports.push(mmi)
              }
              const bindings = mmi.bindings
              const prefix = imported.length > ppn.length || !rbs.length ? imported.replace(ppn, '') + '/' : ''
              rbs.length ? rbs.forEach((rb) => bindings.push(prefix + rb)) : bindings.push(prefix)
            }
          } else {
            mm.imports.push({ id: imported, name: imported, bindings: rbs })
          }
        }
      )
    }
  }
}
