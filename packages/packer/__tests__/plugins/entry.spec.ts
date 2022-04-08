import { Processor } from '@ugdu/processor'

import { buildVendorModules } from '../../src/tasks/vendor'
import { entry } from '../../src/plugins/entry'

import { setVirtualProject } from '../../__mocks__/utils'

import type { Plugin } from 'vite'

jest.mock(
  'vite',
  () => ({
    ...jest.requireActual('vite'),
    build: jest.fn()
  })
)
jest.mock('fs/promises')

const cwd = '/path/to/project'

const onlyAVendorPkgDependOn = { name: 'only-a-vendor-pkg-depend-on' }
const multipleVendorsDependOn = { name: 'multiple-vendors-depend-on' }
const privateVendor = { name: 'private-vendor', dependencies: [multipleVendorsDependOn] }

const localPkgDependOnA = {
  name: 'imported-by-local-pkg-a',
  dependencies: [onlyAVendorPkgDependOn, privateVendor]
}
const localPkgDependOnB = {
  name: 'imported-by-local-pkg-b',
  dependencies: [multipleVendorsDependOn]
}

const main = { name: 'main', main: 'src/index.ts', sources: ['src/index.ts'] }

const foo = {
  name: 'foo',
  sources: ['src/pages/xx.vue'],
  dependencies: [localPkgDependOnA, localPkgDependOnB]
}
const lps = [main, foo]

setVirtualProject(lps)

const processor = new Processor()
const task = processor.task(buildVendorModules)
task.hook(
  'get-config',
  () => ({
    cwd,
    apps: [{ name: 'main', packages: (lps) => lps.map((lp) => lp.name) }],
    extensions: ['vue', 'ts'],
    meta: 'local'
  })
)

let plugin: Plugin

let rms: any
let importmap: any

beforeAll(
  () =>
    task.run().then(
      () => {
        plugin = entry(task.manager.context)
        const { getMetaModule } = task.manager.context.utils
        const modules = [
          {
            id: 'foo/src/pages/xx.vue',
            js: 'assets/foo/xx.js',
            css: 'assets/foo/xx.css',
            imports: [
              { id: `${localPkgDependOnA.name}@1.0.0`, name: localPkgDependOnA.name, bindings: ['a'] },
              { id: `${localPkgDependOnB.name}@1.0.0`, name: localPkgDependOnB.name, bindings: ['b'] }
            ]
          },
          {
            id: `${localPkgDependOnA.name}@1.0.0`,
            js: `assets/${localPkgDependOnA.name}@1.0.0/index.js`,
            imports: [
              {
                id: `${multipleVendorsDependOn.name}@1.0.0`,
                name: multipleVendorsDependOn.name,
                bindings: ['xx', '/sub/a']
              }
            ]
          },
          {
            id: `${localPkgDependOnB.name}@1.0.0`,
            js: `assets/${localPkgDependOnB.name}@1.0.0/index.js`,
            imports: [
              {
                id: `${multipleVendorsDependOn.name}@1.0.0`,
                name: multipleVendorsDependOn.name,
                bindings: ['yy', '/sub/*']
              }
            ]
          },
          {
            id: `${multipleVendorsDependOn.name}@1.0.0`,
            js: `assets/${multipleVendorsDependOn.name}@1.0.0/index.js`,
            imports: [],
            subs: [{ subpath: '/sub', js: `assets/${multipleVendorsDependOn.name}@1.0.0/sub.js` }]
          }
        ]
        task.manager.context.project.meta.cur.modules = []
        modules.forEach(
          (m) => {
            task.manager.context.project.meta.cur.modules.push(Object.assign(getMetaModule(m.id), m))
          }
        )
        rms = task.manager.context.project.meta.cur.modules.map(
          (m) => ({ id: m.id, js: m.js, css: m.css, imports: m.imports.map((i) => i.id) })
        )

        importmap = {
          imports: {
            [`foo/src/pages/xx.vue`]: '/assets/foo/xx.js'
          },
          scopes: {
            ['/assets/foo/']: {
              [localPkgDependOnA.name]: `/assets/${localPkgDependOnA.name}@1.0.0/index.js`,
              [localPkgDependOnB.name]: `/assets/${localPkgDependOnB.name}@1.0.0/index.js`
            },
            [`/assets/${localPkgDependOnA.name}@1.0.0/`]: {
              [multipleVendorsDependOn.name]: `/assets/${multipleVendorsDependOn.name}@1.0.0/index.js`,
              [`${multipleVendorsDependOn.name}/sub`]: `/assets/${multipleVendorsDependOn.name}@1.0.0/sub.js`
            },
            [`/assets/${localPkgDependOnB.name}@1.0.0/`]: {
              [multipleVendorsDependOn.name]: `/assets/${multipleVendorsDependOn.name}@1.0.0/index.js`,
              [`${multipleVendorsDependOn.name}/sub`]: `/assets/${multipleVendorsDependOn.name}@1.0.0/sub.js`
            },
            [`/assets/${multipleVendorsDependOn.name}@1.0.0/`]: {}
          }
        }
      }
    )
)

describe('The transformIndexHtml hook', () => {
  describe('when context.building is true', () => {
    beforeAll(
      () => {
        task.manager.context.building = true
      }
    )

    it('should change the script\'s type from "module" to "module-shim"', () => {
      const html = `<script other attrs type="module" src="/assets/a.js"></script><script type='module' src="/assets/b.js"></script>`
      // @ts-ignore
      const result = plugin.transformIndexHtml!(html)
      expect(result.html).toBe(
        `<script other attrs type="module-shim" src="/assets/a.js"></script><script type="module-shim" src="/assets/b.js"></script>`
      )
    })

    it('should add an importmap to the html', () => {
      // @ts-ignore
      const result = plugin.transformIndexHtml!('')
      expect(result.tags[0].children).toBe(JSON.stringify(importmap))
    })

    it('should add an startup script to the html with correct params', () => {
      // @ts-ignore
      const result = plugin.transformIndexHtml!('')
      expect(result.tags[1].children).toMatch(JSON.stringify(rms))
    })
  })

  describe('when context.building is false', () => {
    beforeAll(
      () => {
        task.manager.context.building = false
      }
    )
    it('should add the startup script to the html', () => {
      // @ts-ignore
      const result = plugin.transformIndexHtml!('')
      expect(result[0].children).toMatch('ur.start();')
    })
  })
})
