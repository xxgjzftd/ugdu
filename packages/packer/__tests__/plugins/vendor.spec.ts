import { beforeAll, describe, expect, it, vi } from 'vitest'
import { Processor } from '@ugdu/processor'

import { buildVendorModules } from 'src'
import { vendor } from 'src/plugins/vendor'

import { setVirtualProject } from '__mocks__/utils'

import type { Plugin } from 'vite'
import type { PluginContext } from 'rollup'
import type { UserConfig } from 'src'

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
const config: UserConfig = {
  cwd,
  apps: [{ name: 'entry', packages: (lps) => lps.map((lp) => lp.name) }],
  extensions: ['vue', 'ts'],
  meta: 'local'
}
task.hook('get-config', () => config)

const pc = {
  resolve: vi.fn(() => {}),
  emitFile: vi.fn(() => 'ref')
} as unknown as PluginContext

let plugin: Plugin
let VENDOR: string
let VENDOR_INPUT: string
let BINDING_NAME_SEP: string

const mn = `${localPkgDependOnA.name}@1.0.0`

beforeAll(
  async () => {
    await task.run()
    plugin = vendor(mn, task.manager.context)
    VENDOR = task.manager.context.CONSTANTS.VENDOR
    VENDOR_INPUT = task.manager.context.CONSTANTS.VENDOR_INPUT
    BINDING_NAME_SEP = task.manager.context.CONSTANTS.BINDING_NAME_SEP
  }
)

it('should have a enforce property with a value of `pre`', () => {
  expect(plugin.enforce).toBe('pre')
})

describe('The resolveId hook', () => {
  it('should return CONSTANTS.VENDOR when source is CONSTANTS.VENDOR_INPUT', () => {
    //@ts-ignore
    expect(plugin.resolveId.call(pc, VENDOR_INPUT, undefined, {})).toBe(VENDOR)
  })

  it.skip('should invoke this.resolve with the correct importer when the importer is CONSTANTS.VENDOR', () => {
    const {
      manager: {
        context: {
          project: { pkgs }
        }
      }
    } = task
    let plugin = vendor(`${multipleVendorsDependOn.name}@1.0.0`, task.manager.context)
    //@ts-ignore
    plugin.resolveId.call(pc, multipleVendorsDependOn.name, VENDOR, {})
    expect(pc.resolve).toBeCalledWith(
      multipleVendorsDependOn.name,
      `${pkgs.find((pkg) => pkg.name === privateVendor.name)!.ap}/node_modules/` + `${privateVendor.name}/package.json`,
      expect.anything()
    )
    plugin = vendor(`${localPkgDependOnA.name}@1.0.0`, task.manager.context)
    //@ts-ignore
    plugin.resolveId.call(pc, localPkgDependOnA.name, VENDOR, {})
    expect(pc.resolve).toBeCalledWith(
      localPkgDependOnA.name,
      `${pkgs.find((pkg) => pkg.name === foo.name)!.ap}/package.json`,
      expect.anything()
    )
  })

  it('should externalize the module which should be external', () => {
    const {
      manager: {
        context: {
          project: { pkgs },
          utils: { getPublicPkgNameFromDepPath, getDepPath, getPkgFromSourceAndImporter }
        }
      }
    } = task
    const source = `${multipleVendorsDependOn.name}/utils`
    const importer = `${pkgs.find((pkg) => pkg.name === privateVendor.name)!.ap}/dist/index.js`
    const dp = getDepPath(
      pkgs.find((pkg) => pkg.name === localPkgDependOnA.name)!,
      getPkgFromSourceAndImporter(source, importer)!
    )
    //@ts-ignore
    expect(plugin.resolveId.call(pc, source, importer, {})).toEqual(
      {
        id: `${getPublicPkgNameFromDepPath(dp)}/utils`,
        external: true
      }
    )
  })

  it('should return null for the module which should not be external', () => {
    const {
      manager: {
        context: {
          project: { pkgs }
        }
      }
    } = task
    const source = privateVendor.name
    const importer = `${pkgs.find((pkg) => pkg.name === localPkgDependOnA.name)!.ap}/dist/index.js`
    //@ts-ignore
    expect(plugin.resolveId.call(pc, source, importer, {})).toBeNull()
  })
})

describe('The load hook', () => {
  it('should be able to deal with plain bindings', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['a', 'b']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(`export { a,b } from "${localPkgDependOnA.name}";`)
  })

  it('should be able to deal with bindings with a `*`', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['a', 'b', '*']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(`export * from "${localPkgDependOnA.name}";`)
  })

  it('should be able to deal with bindings with a `default`', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['a', 'b', 'default']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(`export { a,b,default } from "${localPkgDependOnA.name}";`)
  })

  it('should be able to deal with bindings with a `default` and a `*`', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['a', 'b', 'default', '*']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(
      `export * from "${localPkgDependOnA.name}";` + `export { default } from "${localPkgDependOnA.name}";`
    )
  })

  it('should return empty string when there is no bindings', () => {
    task.manager.context.project.mn2bm.cur[mn] = []
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe('')
  })

  it('should be able to deal with bindings with subpaths', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['/', '/sub/', '/sub/a', '/sub/b', '/sub/default']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(
      `import "${localPkgDependOnA.name}";\n` +
        `import "${localPkgDependOnA.name}/sub";\n` +
        `export { a as ${'/sub/a'.replace(/\W/g, BINDING_NAME_SEP)} } from "${localPkgDependOnA.name}/sub";\n` +
        `export { b as ${'/sub/b'.replace(/\W/g, BINDING_NAME_SEP)} } from "${localPkgDependOnA.name}/sub";\n` +
        `export { default as ${'/sub/default'.replace(/\W/g, BINDING_NAME_SEP)} } from "${localPkgDependOnA.name}/sub";`
    )
  })

  it('should be able to deal with bindings with a subpath which need to export `*`', () => {
    task.manager.context.project.mn2bm.cur[mn] = ['/sub/*']
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe('')
    expect(pc.emitFile).toBeCalledWith({ id: `${localPkgDependOnA.name}/sub`, type: 'chunk', importer: VENDOR })
  })

  it('should be able to deal with mixed bindings', () => {
    task.manager.context.project.mn2bm.cur[mn] = [
      'a',
      'b',
      'default',
      '*',
      '/',
      '/sub/',
      '/sub/a',
      '/sub/b',
      '/sub/default',
      '/sub/*'
    ]
    //@ts-ignore
    expect(plugin.load.call(pc, VENDOR)).toBe(
      `export * from "${localPkgDependOnA.name}";` +
        `export { default } from "${localPkgDependOnA.name}";` +
        `import "${localPkgDependOnA.name}";\n` +
        `import "${localPkgDependOnA.name}/sub";\n` +
        `export { a as ${'/sub/a'.replace(/\W/g, BINDING_NAME_SEP)} } from "${localPkgDependOnA.name}/sub";\n` +
        `export { b as ${'/sub/b'.replace(/\W/g, BINDING_NAME_SEP)} } from "${localPkgDependOnA.name}/sub";\n` +
        `export { default as ${'/sub/default'.replace(/\W/g, BINDING_NAME_SEP)} } from "${
          localPkgDependOnA.name
        }/sub";\n`
    )
  })
})
