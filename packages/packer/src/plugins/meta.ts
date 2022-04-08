import MagicString from 'magic-string'
import { init, parse } from 'es-module-lexer'

import type { OutputChunk } from 'rollup'
import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'

/**
 * @internal
 */
export const meta = function (mn: string, context: Context): Plugin {
  const {
    CONSTANTS: { ROUTES, VENDOR, BINDING_NAME_SEP },
    utils: {
      isLocalModule,
      isRoutesModule,
      isVendorModule,
      getVersionedPkgName,
      getPkgFromModuleName,
      getMetaModule,
      getPkgFromPublicPkgName,
      getPublicPkgNameFromImported,
      getNormalizedPath,
      getLocalModulePath
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
                    const d = content.match(/(?<=^(import|export)).+?(?=\bfrom\b)/)![0].trim()
                    const m = d.match(/^{(.+)}$/)
                    const isExportStatement = content.startsWith('export')
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
                      return
                    } else {
                      bindingToNameMap.default = d
                    }

                    content =
                      `${isExportStatement ? 'export' : 'import'} { ` +
                      Object.keys(bindingToNameMap)
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
    writeBundle (_, bundle) {
      const mm = getMetaModule(mn)
      const fileNames = Object.keys(bundle)
      const js = fileNames.find(
        (fileName) => {
          const info = bundle[fileName] as OutputChunk
          if (!info.facadeModuleId) return false
          if (isLocalModule(mn)) {
            return getNormalizedPath(info.facadeModuleId) === getLocalModulePath(mn)
          } else if (isRoutesModule(mn)) {
            return info.facadeModuleId === ROUTES
          } else {
            return info.facadeModuleId === VENDOR
          }
        }
      )!
      const css = fileNames.find((fileName) => fileName.endsWith('.css'))
      mm.js = js
      css && (mm.css = css)
      const { exports } = bundle[js] as OutputChunk
      isLocalModule(mn) && (mm.exports = exports.sort())

      fileNames.forEach(
        (fileName) => {
          const info = bundle[fileName]
          if (info.type === 'chunk') {
            const { importedBindings } = info
            Object.keys(importedBindings).forEach(
              (imported) => {
                if (!bundle[imported]) {
                  const rbs = importedBindings[imported]
                  let id = imported
                  let name = imported
                  if (isVendorModule(imported)) {
                    name = getPublicPkgNameFromImported(imported)
                    // `routes` module doesn't import any thing from vendor module, so `mn` can't be `routes` here. We can invoke getPkgFromModuleName(mn) safely.
                    id = getVersionedPkgName(getPkgFromPublicPkgName(getPkgFromModuleName(mn), name))
                  }
                  let mmi = mm.imports.find((i) => i.name === name)
                  if (!mmi) {
                    mmi = { id, name, bindings: [] }
                    mm.imports.push(mmi)
                  }
                  const bindings = mmi.bindings

                  if (isVendorModule(imported)) {
                    const prefix = imported.length > name.length || !rbs.length ? imported.replace(name, '') + '/' : ''
                    rbs.length ? rbs.forEach((rb) => bindings.push(prefix + rb)) : bindings.push(prefix)
                  } else {
                    bindings.push(...rbs)
                  }
                }
              }
            )
          }
        }
      )

      mm.imports.forEach(
        (i) => {
          i.bindings = [...new Set(i.bindings)]
        }
      )

      if (mm.subs) {
        mm.subs.forEach(
          (sub) => {
            sub.js = this.getFileName(sub.js)
          }
        )
      }
    }
  }
}
