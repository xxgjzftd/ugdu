import '../src/runtime'

const mountV2 = jest.fn()
const unmountV2 = jest.fn()
const mountV3 = jest.fn()
const unmountV3 = jest.fn()
// @ts-ignore
window.importShim = jest.fn(
  async (mn: string) => {
    switch (mn) {
      case '@v2/container':
        return { default: { mount: mountV2, unmount: unmountV2 } }
      case '@v3/container':
        return { default: { mount: mountV3, unmount: unmountV3 } }
      default:
        return {}
    }
  }
)

const microTaskQueueHasExhausted = async () => new Promise((resolve) => setTimeout(resolve))

const ur = window.ur
const base = '/'
const rms = [
  {
    id: '@v2/container',
    js: 'assets/@v2/container/index.js',
    css: 'assets/@v2/container/index.css',
    imports: ['vue@2.0.0']
  },
  {
    id: '@v2/purchase/src/pages/list.vue',
    js: 'assets/@v2/purchase/list.js',
    css: 'assets/@v2/purchase/list.css',
    imports: ['vue@2.0.0']
  },
  {
    id: '@v3/container',
    js: 'assets/@v3/container/index.js',
    css: 'assets/@v3/container/index.css',
    imports: ['vue@3.0.0']
  },
  {
    id: '@v3/sale/src/pages/list.vue',
    js: 'assets/@v3/sale/list.js',
    css: 'assets/@v3/sale/list.css',
    imports: ['vue@3.0.0']
  },
  {
    id: 'vue@2.0.0',
    js: 'assets/vue@2.0.0/index.js',
    imports: []
  },
  {
    id: 'vue@3.0.0',
    js: 'assets/vue@3.0.0/index.js',
    imports: []
  }
]

ur.register(
  '@v2/container',
  (pathname) => pathname.startsWith('/v2'),
  () => ur.load('@v2/container')
)
ur.register(
  '@v3/container',
  (pathname) => pathname === '/' || pathname.startsWith('/v3'),
  () => ur.load('@v3/container')
)
const load = jest.spyOn(ur, 'load')
const unload = jest.spyOn(ur, 'unload')

it('should load and mount the apps which should be active according to the initial pathname', async () => {
  await ur.start(rms, base)
  expect(load).not.toHaveBeenCalledWith('@v2/container')
  expect(load).toHaveBeenCalledWith('@v3/container')
  expect(mountV2).not.toHaveBeenCalled()
  expect(mountV3).toHaveBeenCalledTimes(1)
})

it('should unmount and unload the apps which should be inactive then load and mount the active apps which should be active according to the changed pathname', async () => {
  history.pushState({}, '', '/v2')
  await microTaskQueueHasExhausted()
  expect(unmountV3).toHaveBeenCalledTimes(1)
  expect(unload).toHaveBeenLastCalledWith('@v3/container')
  expect(load).toHaveBeenLastCalledWith('@v2/container')
  expect(mountV2).toHaveBeenCalledTimes(1)
})
