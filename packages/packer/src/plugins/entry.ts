import type { Plugin } from 'vite'
import type { Context } from '@ugdu/processor'
import type { UgduModule } from '@ugdu/runtime'

export const entry = function (context: Context): Plugin {
  const {
    building,
    config: { apps, base },
    project,
    utils: { isVendorModule, getLocalModulePath, getPkgName, getMetaModule, stringify }
  } = context
  return {
    name: 'ugdu:entry',
    transformIndexHtml (html) {
      if (building) {
        type Imports = Record<string, string>
        type Scopes = Record<string, Imports>
        interface Importmap {
          imports: Imports
          scopes: Scopes
        }
        const importmap: Importmap = { imports: {}, scopes: {} }
        const ums: UgduModule[] = []
        project.meta.cur.modules.forEach(
          (m) => {
            ums.push({ id: m.id, js: m.js, css: m.css, imports: m.imports.map((i) => i.id) })
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
                  importmap.scopes[scope][i.name] = base + getMetaModule(i.id).js
                }
              }
            )
          }
        )
        return {
          html: html.replace(/\<script(.+)type=['"]module['"]/g, '<script$1type="module-shim"'),
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
              children:
                `window.ugdu = window.ugdu || {};` +
                `window.ugdu.base = '${base}';` +
                `window.ugdu.modules = ${JSON.stringify(ums)}`
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
                      `ugdu.register(` +
                      `"${app.name}", ${stringify(app.predicate)},` +
                      `()=>ugdu.load` +
                      `("${app.name}"));`
                  )
                  .join('') + `ugdu.start();`,
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
                    `ugdu.register(` +
                    `"${app.name}", ${stringify(app.predicate)},` +
                    `()=>import` +
                    `("/${getLocalModulePath(app.name)}"));`
                )
                .join('') + `ugdu.start();`,
            injectTo: 'head'
          }
        ]
      }
    }
  }
}
