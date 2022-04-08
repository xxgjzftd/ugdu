import { resolve } from 'path'

import { Processor } from '@ugdu/processor'

import { buildVendorModules } from '../../src/tasks/vendor'
import { meta } from '../../src/plugins/meta'

import { resolveSourceAbsolutePath, setVirtualProject } from '../../__mocks__/utils'

import type { Plugin } from 'vite'
import type {
  NormalizedOutputOptions,
  OutputAsset,
  OutputBundle,
  OutputChunk,
  PluginContext,
  RenderedChunk
} from 'rollup'

import type { MetaModule } from '../../src/tasks/project'

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

const entry = {
  name: 'entry',
  main: 'src/index.ts',
  sources: ['src/index.ts', 'src/app.vue']
}
const foo = {
  name: 'foo',
  sources: ['src/pages/xx.vue', 'src/components/button.vue', 'src/assets/xx.png'],
  dependencies: [localPkgDependOnA, localPkgDependOnB]
}
const components = {
  name: 'components',
  main: 'src/index.ts',
  sources: ['src/index.ts']
}
const lps = [entry, foo, components]

setVirtualProject(lps)

const processor = new Processor()
const task = processor.task(buildVendorModules)
task.hook(
  'get-config',
  () => ({
    cwd,
    apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name) }],
    extensions: ['vue', 'ts'],
    meta: 'local'
  })
)

const pc = { getFileName: jest.fn((ref) => `assets/${ref}`) } as unknown as PluginContext

let plugin: Plugin
let ROUTES: string
let VENDOR: string
let BINDING_NAME_SEP: string
const mn = `${localPkgDependOnB.name}@1.0.0`
const options = {} as any

beforeAll(
  () =>
    task.run().then(
      () => {
        plugin = meta(mn, task.manager.context)
        ROUTES = task.manager.context.CONSTANTS.ROUTES
        VENDOR = task.manager.context.CONSTANTS.VENDOR
        BINDING_NAME_SEP = task.manager.context.CONSTANTS.BINDING_NAME_SEP
      }
    )
)

describe('The renderChunk hook', () => {
  it("should do nothing with the chunk which does not import from dep's sub module", async () => {
    const code = `import { a } from "${multipleVendorsDependOn.name}";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a']
    const chunk = { code, importedBindings } as RenderedChunk
    // @ts-ignore
    await expect(plugin.renderChunk!.call(pc, code, chunk, options)).resolves.toBeNull()
  })

  it('should be able to deal with plain bindings', async () => {
    const code = `import { a } from "${multipleVendorsDependOn.name}";import { x } from "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a']
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = ['x']
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { a } from "${multipleVendorsDependOn.name}";` +
        `import { ${'/sub/x'.replace(/\W/g, BINDING_NAME_SEP)} as x } from "${multipleVendorsDependOn.name}";`
    )
  })

  it('should be able to deal with `*` bindings', async () => {
    const code = `import { a } from "${multipleVendorsDependOn.name}";import * as x from "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a']
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = ['*']
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { a } from "${multipleVendorsDependOn.name}";` +
        `import * as x from "${multipleVendorsDependOn.name}/sub";`
    )
  })

  it('should be able to deal with `default` bindings', async () => {
    const code = `import { a } from "${multipleVendorsDependOn.name}";import x from "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a']
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = ['default']
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { a } from "${multipleVendorsDependOn.name}";` +
        `import { ` +
        `${'/sub/default'.replace(/\W/g, BINDING_NAME_SEP)} as x` +
        ` } from "${multipleVendorsDependOn.name}";`
    )
  })

  it('should be able to deal with non bindings', async () => {
    const code = `import { a } from "${multipleVendorsDependOn.name}";import "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a']
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = []
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { a } from "${multipleVendorsDependOn.name}";` + `import "${multipleVendorsDependOn.name}";`
    )
  })

  it('should be able to deal with export statements', async () => {
    const code =
      `import { a } from "${multipleVendorsDependOn.name}";export { b } from "${multipleVendorsDependOn.name}";` +
      `export { c } from "${multipleVendorsDependOn.name}/sub";` +
      `export * from "${multipleVendorsDependOn.name}/sub";` +
      `export { default as d } from "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[multipleVendorsDependOn.name] = ['a', 'b']
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = ['c', '*', 'default']
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { a } from "${multipleVendorsDependOn.name}";` +
        `export { b } from "${multipleVendorsDependOn.name}";` +
        `export { ${'/sub/c'.replace(/\W/g, BINDING_NAME_SEP)} as c } from "${multipleVendorsDependOn.name}";` +
        `export * from "${multipleVendorsDependOn.name}/sub";` +
        `export { ${'/sub/default'.replace(/\W/g, BINDING_NAME_SEP)} as d } from "${multipleVendorsDependOn.name}";`
    )
  })

  it('should be able to deal with bindings which includes keywords', async () => {
    const code = `import { importasexport as exportasimport } from "${multipleVendorsDependOn.name}/sub";`
    const importedBindings: RenderedChunk['importedBindings'] = {}
    importedBindings[`${multipleVendorsDependOn.name}/sub`] = ['importasexport']
    const chunk = { code, importedBindings } as RenderedChunk
    const res = await plugin.renderChunk!.call(pc, code, chunk, options)
    // @ts-ignore
    expect(res.code).toBe(
      `import { ${'/sub/importasexport'.replace(/\W/g, BINDING_NAME_SEP)} as exportasimport } from "${
        multipleVendorsDependOn.name
      }";`
    )
  })
})

describe('The writeBundle hook', () => {
  describe('for vendor modules', () => {
    let mm: MetaModule

    beforeAll(
      () => {
        const bundle: OutputBundle = {}
        bundle[`assets/${localPkgDependOnB.name}@1.0.0/a.js`] = {
          type: 'chunk',
          facadeModuleId: VENDOR,
          importedBindings: {
            [`assets/${localPkgDependOnB.name}@1.0.0/b.js`]: ['b'],
            [`assets/${localPkgDependOnB.name}@1.0.0/c.js`]: ['c'],
            [`${multipleVendorsDependOn.name}`]: ['x']
          }
        } as OutputChunk
        bundle[`assets/${localPkgDependOnB.name}@1.0.0/b.js`] = {
          type: 'chunk',
          facadeModuleId: resolve(
            cwd,
            'node_modules/.pnpm',
            `${localPkgDependOnB.name}@1.0.0/node_modules/${localPkgDependOnB.name}/dist/sub.js`
          ),
          importedBindings: {
            [`assets/${localPkgDependOnB.name}@1.0.0/c.js`]: ['c']
          }
        } as OutputChunk
        bundle[`assets/${localPkgDependOnB.name}@1.0.0/c.js`] = {
          type: 'chunk',
          facadeModuleId: null,
          importedBindings: {
            [`${multipleVendorsDependOn.name}`]: ['x', 'xx']
          }
        } as OutputChunk
        bundle[`assets/${localPkgDependOnB.name}@1.0.0/a.css`] = {
          type: 'asset'
        } as OutputAsset

        mm = task.manager.context.utils.getMetaModule(mn)
        mm.subs = [{ subpath: '/sub', js: 'ref' }]
        meta(mn, task.manager.context).writeBundle!.call(pc, {} as NormalizedOutputOptions, bundle)
      }
    )

    it('should set the js field correctly', () => {
      expect(mm.js).toBe(`assets/${localPkgDependOnB.name}@1.0.0/a.js`)
    })

    it('should set the css field correctly', () => {
      expect(mm.css).toBe(`assets/${localPkgDependOnB.name}@1.0.0/a.css`)
    })

    it('should set the imports field correctly', () => {
      expect(mm.imports).toEqual(
        [{ id: `${multipleVendorsDependOn.name}@1.0.0`, name: multipleVendorsDependOn.name, bindings: ['x', 'xx'] }]
      )
    })

    it('should set the subs field correctly', () => {
      expect(mm.subs).toEqual([{ subpath: '/sub', js: 'assets/ref' }])
    })
  })

  describe('for local modules', () => {
    let mn = `foo/src/pages/xx.vue`
    let mm: MetaModule

    beforeAll(
      () => {
        const bundle: OutputBundle = {}
        bundle[`assets/foo/a.js`] = {
          type: 'chunk',
          facadeModuleId: resolveSourceAbsolutePath('foo', 'src/pages/xx.vue'),
          exports: ['default'],
          importedBindings: {
            [`${localPkgDependOnA.name}`]: ['a'],
            [`${localPkgDependOnB.name}`]: ['b']
          }
        } as OutputChunk
        bundle[`assets/foo/a.css`] = {
          type: 'asset'
        } as OutputAsset

        mm = task.manager.context.utils.getMetaModule(mn)
        meta(mn, task.manager.context).writeBundle!.call(pc, {} as NormalizedOutputOptions, bundle)
      }
    )

    it('should set the js field correctly', () => {
      expect(mm.js).toBe(`assets/foo/a.js`)
    })

    it('should set the css field correctly', () => {
      expect(mm.css).toBe(`assets/foo/a.css`)
    })

    it('should set the imports field correctly', () => {
      expect(mm.imports).toEqual(
        [
          { id: `${localPkgDependOnA.name}@1.0.0`, name: localPkgDependOnA.name, bindings: ['a'] },
          { id: `${localPkgDependOnB.name}@1.0.0`, name: localPkgDependOnB.name, bindings: ['b'] }
        ]
      )
    })

    it('should set the exports field correctly', () => {
      expect(mm.exports).toEqual(['default'])
    })
  })

  describe('for routes module', () => {
    let mn = 'routes'
    let mm: MetaModule

    beforeAll(
      () => {
        const bundle: OutputBundle = {}
        bundle[`assets/routes/a.js`] = {
          type: 'chunk',
          facadeModuleId: ROUTES,
          importedBindings: {},
          exports: ['default']
        } as OutputChunk

        mm = task.manager.context.utils.getMetaModule(mn)
        meta(mn, task.manager.context).writeBundle!.call(pc, {} as NormalizedOutputOptions, bundle)
      }
    )

    it('should set the js field correctly', () => {
      expect(mm.js).toBe(`assets/routes/a.js`)
    })
  })
})
