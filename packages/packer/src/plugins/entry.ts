import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'
import type { RuntimeModule } from '@ugdu/runtime'

/**
 * @internal
 */
export const entry = function (context: Context): Plugin {
  const {
    config: { apps, base },
    project,
    utils: { isVendorModule, getLocalModulePath, getPkgName, getMetaModule, stringify }
  } = context
  return {
    name: 'ugdu:entry',
    transformIndexHtml (html) {
      if (context.building) {
        type Imports = Record<string, string>
        type Scopes = Record<string, Imports>
        interface Importmap {
          imports: Imports
          scopes: Scopes
        }
        const importmap: Importmap = { imports: {}, scopes: {} }
        const rms: RuntimeModule[] = []
        project.meta.cur.modules.forEach(
          (m) => {
            rms.push({ id: m.id, js: m.js, css: m.css, imports: m.imports.map((i) => i.id) })
            const folder = getPkgName(m.id)
            const path = base + m.js
            const scope = path.replace(new RegExp(`(?<=/${folder}/).+`), '')
            if (!isVendorModule(m.id)) {
              importmap.imports[m.id] = path
            }
            importmap.scopes[scope] = importmap.scopes[scope] ?? {}
            m.imports.forEach(
              (i) => {
                if (!importmap.scopes[scope][i.name]) {
                  const im = getMetaModule(i.id)
                  importmap.scopes[scope][i.name] = base + im.js
                  if (im.subs) {
                    im.subs.forEach(
                      (sub) => {
                        importmap.scopes[scope][i.name + sub.subpath] = base + sub.js
                      }
                    )
                  }
                }
              }
            )
          }
        )
        return {
          html: html.replace(/\<script(.+?)type=['"]module['"]/g, '<script$1type="module-shim"'),
          tags: [
            {
              tag: 'script',
              attrs: {
                type: 'importmap-shim'
              },
              children: JSON.stringify(importmap)
            },
            {
              tag: 'script',
              attrs: {
                type: 'module-shim'
              },
              children:
                apps
                  .map(
                    (app) =>
                      `ur.register(` +
                      `"${app.name}", ${stringify(app.predicate)},` +
                      `()=>ur.load` +
                      `("${app.name}"));`
                  )
                  .join('') + `ur.start(${JSON.stringify(rms)},'${base}');`,
              injectTo: 'head'
            }
          ]
        }
      } else {
        return [
          {
            tag: 'script',
            attrs: {
              type: 'module',
              noshim: true
            },
            children:
              apps
                .map(
                  (app) =>
                    `ur.register(` +
                    `"${app.name}", ${stringify(app.predicate)},` +
                    `()=>import` +
                    `("/${getLocalModulePath(app.name)}"));`
                )
                .join('') + `ur.start();`,
            injectTo: 'head'
          }
        ]
      }
    }
  }
}
